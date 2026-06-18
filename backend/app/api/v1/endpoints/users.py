from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc
from typing import List
import logging

from app.core.database import get_db
from app.core.deps import get_current_active_user, require_admin, require_manager
from app.models.user import User
from app.models.role import Role
from app.models.file import File
from app.schemas.user import UserResponse, UserUpdate, UserAdminUpdate, UserWithRole
from app.schemas.security import RoleResponse, RoleCreate
from app.services.audit_service import AuditService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    for field, value in update_data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.get("/", response_model=List[UserWithRole])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    result = await db.execute(
        select(User).offset(skip).limit(limit).order_by(desc(User.created_at))
    )
    users = result.scalars().all()

    enriched = []
    for u in users:
        user_dict = {
            "id": u.id, "email": u.email, "username": u.username,
            "full_name": u.full_name, "department": u.department,
            "phone": u.phone, "role_id": u.role_id, "is_active": u.is_active,
            "is_superuser": u.is_superuser, "is_verified": u.is_verified,
            "avatar_url": u.avatar_url, "last_login": u.last_login,
            "created_at": u.created_at, "updated_at": u.updated_at,
            "role_name": None,
        }
        if u.role_id:
            r = await db.execute(select(Role).where(Role.id == u.role_id))
            role = r.scalar_one_or_none()
            if role:
                user_dict["role_name"] = role.name
        enriched.append(user_dict)

    return enriched


@router.get("/roles/all", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Role))
    return result.scalars().all()


@router.post("/roles", response_model=RoleResponse, status_code=201)
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Role).where(Role.name == role_data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role already exists")

    role = Role(**role_data.model_dump())
    db.add(role)
    await db.flush()
    await db.refresh(role)
    return role


@router.get("/{user_id}", response_model=UserWithRole)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_name = None
    if user.role_id:
        r = await db.execute(select(Role).where(Role.id == user.role_id))
        role = r.scalar_one_or_none()
        role_name = role.name if role else None

    return {
        "id": user.id, "email": user.email, "username": user.username,
        "full_name": user.full_name, "department": user.department,
        "phone": user.phone, "role_id": user.role_id, "is_active": user.is_active,
        "is_superuser": user.is_superuser, "is_verified": user.is_verified,
        "avatar_url": user.avatar_url, "last_login": user.last_login,
        "created_at": user.created_at, "updated_at": user.updated_at,
        "role_name": role_name,
    }


@router.put("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    update_data: UserAdminUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    changes = {}
    for field, value in update_data.model_dump(exclude_none=True).items():
        if getattr(user, field) != value:
            changes[field] = {"old": getattr(user, field), "new": value}
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)

    await AuditService.log(
        db, "user.admin_update", user_id=current_user.id,
        resource_type="user", resource_id=str(user_id),
        description=f"Admin updated user {user.email}",
        ip_address=request.client.host if request.client else None,
        metadata={"changes": changes},
    )
    return user


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.execute(update(User).where(User.id == user_id).values(is_active=False))
    await AuditService.log(
        db, "user.deactivated", user_id=current_user.id,
        resource_type="user", resource_id=str(user_id),
        description=f"Deactivated user {user.email}",
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "User deactivated"}


@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    result = await db.execute(
        select(func.count(File.id), func.sum(File.file_size))
        .where(File.owner_id == user_id, File.is_deleted == False)
    )
    row = result.first()
    file_count = row[0] or 0
    total_size = row[1] or 0

    return {
        "user_id": user_id,
        "file_count": file_count,
        "total_storage_bytes": total_size,
        "total_storage_formatted": f"{total_size / (1024*1024):.2f} MB",
    }


# Roles management
