from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, desc
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from app.core.database import get_db
from app.core.deps import get_current_active_user, require_admin, require_manager
from app.models.user import User
from app.models.file import File
from app.models.shared_file import SharedFile
from app.models.audit_log import AuditLog, SecurityFinding
from app.schemas.security import (
    AuditLogResponse, SecurityFindingResponse,
    SecurityFindingCreate, DashboardStats, AIAnalysisRequest
)
from app.services.audit_service import AuditService
from app.services.ai_service import ai_inspector

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    since_24h = datetime.utcnow() - timedelta(hours=24)
    since_7d = datetime.utcnow() - timedelta(days=7)

    total_files = await db.execute(select(func.count(File.id)).where(File.is_deleted == False))
    total_users = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    total_storage = await db.execute(select(func.sum(File.file_size)).where(File.is_deleted == False))
    active_shares = await db.execute(
        select(func.count(SharedFile.id)).where(SharedFile.is_active == True)
    )
    security_findings = await db.execute(
        select(func.count(SecurityFinding.id)).where(SecurityFinding.is_resolved == False)
    )
    critical_findings = await db.execute(
        select(func.count(SecurityFinding.id)).where(
            SecurityFinding.is_resolved == False,
            SecurityFinding.severity == "critical"
        )
    )
    recent_uploads = await db.execute(
        select(func.count(File.id)).where(File.created_at >= since_24h)
    )
    recent_logins = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.action == "user.login",
            AuditLog.created_at >= since_7d
        )
    )
    infected = await db.execute(
        select(func.count(File.id)).where(File.scan_status == "infected")
    )
    quarantined = await db.execute(
        select(func.count(File.id)).where(File.is_quarantined == True)
    )

    return DashboardStats(
        total_files=total_files.scalar() or 0,
        total_users=total_users.scalar() or 0,
        total_storage_bytes=total_storage.scalar() or 0,
        active_shares=active_shares.scalar() or 0,
        security_findings=security_findings.scalar() or 0,
        critical_findings=critical_findings.scalar() or 0,
        recent_uploads=recent_uploads.scalar() or 0,
        recent_logins=recent_logins.scalar() or 0,
        infected_files=infected.scalar() or 0,
        quarantined_files=quarantined.scalar() or 0,
    )


@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    status: Optional[str] = None,
    days: int = 30,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    return await AuditService.get_logs(
        db, user_id=user_id, action=action, status=status,
        days=days, skip=skip, limit=limit
    )


@router.get("/my-activity", response_model=List[AuditLogResponse])
async def get_my_activity(
    days: int = 30,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await AuditService.get_logs(
        db, user_id=current_user.id, days=days, skip=skip, limit=limit
    )


@router.get("/activity-summary")
async def get_activity_summary(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    return await AuditService.get_activity_summary(db, days=days)


@router.get("/findings", response_model=List[SecurityFindingResponse])
async def get_security_findings(
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    query = select(SecurityFinding)
    if severity:
        query = query.where(SecurityFinding.severity == severity)
    if resolved is not None:
        query = query.where(SecurityFinding.is_resolved == resolved)
    query = query.order_by(desc(SecurityFinding.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/findings", response_model=SecurityFindingResponse, status_code=201)
async def create_finding(
    finding_data: SecurityFindingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = finding_data.model_dump()
    extra = data.pop("metadata", None)
    finding = SecurityFinding(**data, extra_data=extra or {})
    db.add(finding)
    await db.flush()
    await db.refresh(finding)
    return finding


@router.put("/findings/{finding_id}/resolve")
async def resolve_finding(
    finding_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    result = await db.execute(select(SecurityFinding).where(SecurityFinding.id == finding_id))
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    await db.execute(
        update(SecurityFinding).where(SecurityFinding.id == finding_id).values(
            is_resolved=True,
            resolved_at=datetime.utcnow(),
            resolved_by=current_user.id,
        )
    )
    await AuditService.log(
        db, "security.finding_resolved", user_id=current_user.id,
        resource_type="finding", resource_id=str(finding_id),
        description=f"Resolved security finding: {finding.title}",
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "Finding resolved"}


@router.get("/files/all", response_model=list)
async def admin_list_all_files(
    skip: int = 0,
    limit: int = 50,
    scan_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = select(File).where(File.is_deleted == False)
    if scan_status:
        query = query.where(File.scan_status == scan_status)
    query = query.order_by(desc(File.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    files = result.scalars().all()
    return [
        {
            "id": f.id, "original_filename": f.original_filename,
            "file_size": f.file_size, "owner_id": f.owner_id,
            "scan_status": f.scan_status, "is_quarantined": f.is_quarantined,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in files
    ]


@router.post("/files/{file_id}/quarantine")
async def quarantine_file(
    file_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    await db.execute(
        update(File).where(File.id == file_id).values(is_quarantined=True)
    )
    await AuditService.log(
        db, "file.quarantined", user_id=current_user.id,
        resource_type="file", resource_id=str(file_id),
        description=f"Quarantined file: {file.original_filename}",
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "File quarantined"}


@router.post("/files/{file_id}/unquarantine")
async def unquarantine_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    await db.execute(
        update(File).where(File.id == file_id).values(is_quarantined=False)
    )
    return {"message": "File unquarantined"}


@router.post("/ai/analyze")
async def ai_security_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Run AI-powered security analysis on the platform."""
    # Gather data
    stats_result = await get_dashboard_stats(db=db, current_user=current_user)
    activity = await AuditService.get_activity_summary(db, days=7)

    findings_result = await db.execute(
        select(SecurityFinding).where(SecurityFinding.is_resolved == False)
        .order_by(desc(SecurityFinding.created_at)).limit(10)
    )
    findings = [
        {
            "id": f.id, "type": f.finding_type, "severity": f.severity,
            "title": f.title, "description": f.description, "created_at": str(f.created_at)
        }
        for f in findings_result.scalars().all()
    ]

    stats_dict = stats_result.model_dump()
    analysis = await ai_inspector.analyze_security_posture(
        audit_summary=activity,
        findings=findings,
        stats=stats_dict,
    )

    await AuditService.log(
        db, "security.ai_analysis", user_id=current_user.id,
        description="Ran AI security analysis",
    )

    return {"analysis": analysis, "timestamp": datetime.utcnow().isoformat()}


@router.post("/ai/report")
async def generate_security_report(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Generate a narrative security report."""
    stats = await get_dashboard_stats(db=db, current_user=current_user)
    activity = await AuditService.get_activity_summary(db, days=days)

    findings_result = await db.execute(
        select(SecurityFinding).order_by(desc(SecurityFinding.created_at)).limit(5)
    )
    findings = [
        {"severity": f.severity, "title": f.title, "resolved": f.is_resolved}
        for f in findings_result.scalars().all()
    ]

    report = await ai_inspector.generate_security_report(
        period_days=days,
        all_stats=stats.model_dump(),
        top_findings=findings,
        activity_summary=activity,
    )

    return {"report": report, "generated_at": datetime.utcnow().isoformat(), "period_days": days}
