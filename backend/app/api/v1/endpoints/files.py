from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_, and_, desc
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import io
import logging

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.security import generate_share_token
from app.core.config import settings
from app.models.user import User
from app.models.file import File
from app.models.shared_file import SharedFile
from app.models.audit_log import SecurityFinding
from app.schemas.file import (
    FileResponse, FileUpdate, ShareFileRequest,
    SharedFileResponse, FileVersionResponse
)
from app.services.storage_service import storage_service
from app.services.scanner_service import scanner
from app.services.audit_service import AuditService
from app.core.security import get_password_hash, verify_password

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/upload", response_model=FileResponse, status_code=201)
async def upload_file(
    request: Request,
    file: UploadFile = FastAPIFile(...),
    description: Optional[str] = None,
    folder: str = "/",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Validate extension
    if not storage_service.validate_extension(file.filename):
        raise HTTPException(status_code=400, detail=f"File type not allowed")

    data = await file.read()

    # Validate size
    if not storage_service.validate_size(len(data)):
        raise HTTPException(status_code=413, detail=f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB")

    # Malware scan
    scan_status, scan_result = scanner.scan_bytes(data)

    if scan_status == "infected":
        # Log security finding
        finding = SecurityFinding(
            finding_type="malware_detected",
            severity="critical",
            title=f"Malware detected in uploaded file",
            description=f"File '{file.filename}' contains malware: {scan_result}",
            recommendation="File has been blocked. Do not download or share.",
            resource_type="file",
            user_id=current_user.id,
        )
        db.add(finding)
        await AuditService.log(
            db, "file.malware_detected", user_id=current_user.id,
            description=f"Malware detected in '{file.filename}': {scan_result}",
            status="failure", ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=422, detail=f"Malware detected: {scan_result}")

    # Generate unique filename
    ext = storage_service.get_extension(file.filename)
    unique_filename = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())

    # Store file
    file_path, file_hash, encryption_metadata, s3_key = await storage_service.save_file(
        data=data,
        filename=unique_filename,
        user_id=current_user.id,
        encrypt=True,
    )

    db_file = File(
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(data),
        mime_type=storage_service.get_mime_type(file.filename),
        file_extension=ext,
        file_hash=file_hash,
        is_encrypted=True,
        encryption_metadata=encryption_metadata,
        owner_id=current_user.id,
        scan_status=scan_status,
        scan_result=scan_result,
        scan_date=datetime.utcnow(),
        description=description,
        folder=folder,
        storage_backend=settings.STORAGE_BACKEND,
        s3_key=s3_key or None,
    )
    db.add(db_file)
    await db.flush()
    await db.refresh(db_file)

    await AuditService.log(
        db, "file.upload", user_id=current_user.id,
        resource_type="file", resource_id=str(db_file.id),
        description=f"Uploaded '{file.filename}' ({storage_service.format_size(len(data))})",
        ip_address=request.client.host if request.client else None,
        metadata={"filename": file.filename, "size": len(data), "scan_status": scan_status},
    )

    return db_file


@router.get("/", response_model=List[FileResponse])
async def list_files(
    folder: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(File).where(
        File.owner_id == current_user.id,
        File.is_deleted == False,
        File.parent_id == None,
    )
    if folder:
        query = query.where(File.folder == folder)
    query = query.order_by(desc(File.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/search", response_model=List[FileResponse])
async def search_files(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(File).where(
            File.owner_id == current_user.id,
            File.is_deleted == False,
            or_(
                File.original_filename.ilike(f"%{q}%"),
                File.description.ilike(f"%{q}%"),
            )
        ).limit(50)
    )
    return result.scalars().all()


@router.get("/shared/links", response_model=List[SharedFileResponse])
async def get_my_shared_links(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(SharedFile).where(SharedFile.shared_by == current_user.id)
        .order_by(desc(SharedFile.created_at)).limit(50)
    )
    shares = result.scalars().all()
    return [
        {
            "id": s.id, "file_id": s.file_id, "token": s.token,
            "shared_with_email": s.shared_with_email, "can_download": s.can_download,
            "can_view": s.can_view, "requires_password": s.requires_password,
            "max_downloads": s.max_downloads, "download_count": s.download_count,
            "max_views": s.max_views, "view_count": s.view_count,
            "expires_at": s.expires_at, "is_active": s.is_active,
            "created_at": s.created_at, "share_url": f"/share/{s.token}",
        }
        for s in shares
    ]


@router.get("/share/{token}")
async def access_shared_file(
    token: str,
    password: Optional[str] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SharedFile).where(SharedFile.token == token, SharedFile.is_active == True)
    )
    shared = result.scalar_one_or_none()
    if not shared:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    if shared.expires_at and shared.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link has expired")

    if shared.max_views and shared.view_count >= shared.max_views:
        raise HTTPException(status_code=410, detail="View limit reached")

    if shared.requires_password:
        if not password or not verify_password(password, shared.share_password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")

    result = await db.execute(select(File).where(File.id == shared.file_id, File.is_deleted == False))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    await db.execute(update(SharedFile).where(SharedFile.id == shared.id).values(
        view_count=shared.view_count + 1, last_accessed=datetime.utcnow()
    ))

    return {
        "file_id": file.id,
        "filename": file.original_filename,
        "file_size": file.file_size,
        "mime_type": file.mime_type,
        "can_download": shared.can_download,
        "created_at": file.created_at,
    }


@router.get("/share/{token}/download")
async def download_shared_file(
    token: str,
    password: Optional[str] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SharedFile).where(SharedFile.token == token, SharedFile.is_active == True)
    )
    shared = result.scalar_one_or_none()
    if not shared:
        raise HTTPException(status_code=404, detail="Share link not found")
    if not shared.can_download:
        raise HTTPException(status_code=403, detail="Download not permitted")
    if shared.expires_at and shared.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Link expired")
    if shared.max_downloads and shared.download_count >= shared.max_downloads:
        raise HTTPException(status_code=410, detail="Download limit reached")
    if shared.requires_password and (not password or not verify_password(password, shared.share_password_hash)):
        raise HTTPException(status_code=401, detail="Invalid password")

    result = await db.execute(select(File).where(File.id == shared.file_id, File.is_deleted == False))
    file = result.scalar_one_or_none()
    if not file or file.is_quarantined:
        raise HTTPException(status_code=404, detail="File unavailable")

    data = await storage_service.read_file(
        file_path=file.file_path, is_encrypted=file.is_encrypted, s3_key=file.s3_key
    )

    await db.execute(update(SharedFile).where(SharedFile.id == shared.id).values(
        download_count=shared.download_count + 1, last_accessed=datetime.utcnow()
    ))

    return StreamingResponse(
        io.BytesIO(data),
        media_type=file.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file.original_filename}"'},
    )


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(File).where(File.id == file_id, File.is_deleted == False)
    )
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    return file


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(File).where(File.id == file_id, File.is_deleted == False)
    )
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    if file.is_quarantined:
        raise HTTPException(status_code=403, detail="File is quarantined")

    data = await storage_service.read_file(
        file_path=file.file_path,
        is_encrypted=file.is_encrypted,
        s3_key=file.s3_key,
    )

    await AuditService.log(
        db, "file.download", user_id=current_user.id,
        resource_type="file", resource_id=str(file.id),
        description=f"Downloaded '{file.original_filename}'",
        ip_address=request.client.host if request.client else None,
    )

    return StreamingResponse(
        io.BytesIO(data),
        media_type=file.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file.original_filename}"'},
    )


@router.put("/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: int,
    update_data: FileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(File).where(File.id == file_id, File.is_deleted == False))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    for field, value in update_data.model_dump(exclude_none=True).items():
        setattr(file, field, value)
    await db.flush()
    await db.refresh(file)
    return file


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(File).where(File.id == file_id, File.is_deleted == False))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.execute(
        update(File).where(File.id == file_id).values(
            is_deleted=True, deleted_at=datetime.utcnow()
        )
    )
    await AuditService.log(
        db, "file.delete", user_id=current_user.id,
        resource_type="file", resource_id=str(file_id),
        description=f"Deleted '{file.original_filename}'",
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "File deleted"}


@router.post("/{file_id}/share", response_model=SharedFileResponse)
async def share_file(
    file_id: int,
    share_data: ShareFileRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(File).where(File.id == file_id, File.is_deleted == False))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")

    expires_at = None
    if share_data.expires_hours:
        expires_at = datetime.utcnow() + timedelta(hours=share_data.expires_hours)

    shared = SharedFile(
        file_id=file_id,
        shared_by=current_user.id,
        shared_with_email=share_data.shared_with_email,
        token=generate_share_token(),
        can_download=share_data.can_download,
        can_view=share_data.can_view,
        requires_password=share_data.requires_password,
        share_password_hash=get_password_hash(share_data.share_password) if share_data.share_password else None,
        max_downloads=share_data.max_downloads,
        max_views=share_data.max_views,
        expires_at=expires_at,
    )
    db.add(shared)
    await db.flush()
    await db.refresh(shared)

    await AuditService.log(
        db, "file.share_created", user_id=current_user.id,
        resource_type="file", resource_id=str(file_id),
        description=f"Created share link for '{file.original_filename}'",
        ip_address=request.client.host if request.client else None,
    )

    result_dict = {
        "id": shared.id,
        "file_id": shared.file_id,
        "token": shared.token,
        "shared_with_email": shared.shared_with_email,
        "can_download": shared.can_download,
        "can_view": shared.can_view,
        "requires_password": shared.requires_password,
        "max_downloads": shared.max_downloads,
        "download_count": shared.download_count,
        "max_views": shared.max_views,
        "view_count": shared.view_count,
        "expires_at": shared.expires_at,
        "is_active": shared.is_active,
        "created_at": shared.created_at,
        "share_url": f"/share/{shared.token}",
    }
    return result_dict





@router.get("/{file_id}/versions", response_model=List[FileVersionResponse])
async def get_file_versions(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    if not file or file.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found")

    # Get all versions (same parent or root)
    root_id = file.parent_id or file.id
    result = await db.execute(
        select(File).where(
            or_(File.id == root_id, File.parent_id == root_id)
        ).order_by(File.version)
    )
    return result.scalars().all()


@router.post("/{file_id}/version", response_model=FileResponse)
async def upload_new_version(
    file_id: int,
    request: Request,
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(File).where(File.id == file_id, File.is_deleted == False))
    original = result.scalar_one_or_none()
    if not original or original.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found")

    if not storage_service.validate_extension(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")

    data = await file.read()
    if not storage_service.validate_size(len(data)):
        raise HTTPException(status_code=413, detail="File too large")

    scan_status, scan_result = scanner.scan_bytes(data)
    if scan_status == "infected":
        raise HTTPException(status_code=422, detail=f"Malware detected: {scan_result}")

    ext = storage_service.get_extension(file.filename)
    unique_filename = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
    file_path, file_hash, encryption_metadata, s3_key = await storage_service.save_file(
        data=data, filename=unique_filename, user_id=current_user.id, encrypt=True
    )

    root_id = original.parent_id or original.id
    result2 = await db.execute(
        select(func.max(File.version)).where(
            or_(File.id == root_id, File.parent_id == root_id)
        )
    )
    max_version = result2.scalar() or 1

    new_version = File(
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(data),
        mime_type=storage_service.get_mime_type(file.filename),
        file_extension=ext,
        file_hash=file_hash,
        is_encrypted=True,
        encryption_metadata=encryption_metadata,
        owner_id=current_user.id,
        version=max_version + 1,
        parent_id=root_id,
        scan_status=scan_status,
        scan_result=scan_result,
        scan_date=datetime.utcnow(),
        folder=original.folder,
        description=original.description,
    )
    db.add(new_version)
    await db.flush()
    await db.refresh(new_version)

    await AuditService.log(
        db, "file.new_version", user_id=current_user.id,
        resource_type="file", resource_id=str(new_version.id),
        description=f"Uploaded version {new_version.version} of '{file.filename}'",
        ip_address=request.client.host if request.client else None,
    )

    return new_version
