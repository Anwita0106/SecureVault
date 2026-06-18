from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timedelta
import logging

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_password_reset_token,
)
from app.core.config import settings
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.role import Role
from app.schemas.auth import Token, LoginRequest, TokenRefresh
from app.schemas.user import UserCreate, UserResponse, PasswordChange, PasswordResetRequest, PasswordReset
from app.services.audit_service import AuditService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Check email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    result = await db.execute(select(User).where(User.username == user_in.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Get default user role
    result = await db.execute(select(Role).where(Role.name == "user"))
    default_role = result.scalar_one_or_none()

    user = User(
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role_id=default_role.id if default_role else None,
        department=user_in.department,
        phone=user_in.phone,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await AuditService.log(
        db,
        action="user.register",
        user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        description=f"New user registered: {user.email}",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return user


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()

    if not user:
        await AuditService.log(
            db, "user.login_failed", description=f"Login attempt for unknown email: {login_data.email}",
            ip_address=request.client.host if request.client else None, status="failure"
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check account lock
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(status_code=423, detail=f"Account locked until {user.locked_until}")

    if not verify_password(login_data.password, user.hashed_password):
        # Increment failed attempts
        new_attempts = (user.failed_login_attempts or 0) + 1
        locked_until = None
        if new_attempts >= 5:
            locked_until = datetime.utcnow() + timedelta(minutes=15)

        await db.execute(
            update(User).where(User.id == user.id).values(
                failed_login_attempts=new_attempts,
                locked_until=locked_until,
            )
        )
        await AuditService.log(
            db, "user.login_failed", user_id=user.id,
            description=f"Failed login attempt #{new_attempts}",
            ip_address=request.client.host if request.client else None, status="failure"
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    # Reset failed attempts, update last login
    await db.execute(
        update(User).where(User.id == user.id).values(
            failed_login_attempts=0,
            locked_until=None,
            last_login=datetime.utcnow(),
        )
    )

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    refresh_token = create_refresh_token({"sub": str(user.id), "email": user.email})

    await AuditService.log(
        db, "user.login", user_id=user.id,
        description="Successful login",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(token_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)).where(User.is_active == True))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    new_refresh = create_refresh_token({"sub": str(user.id), "email": user.email})

    return Token(
        access_token=access_token,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await AuditService.log(
        db, "user.logout", user_id=current_user.id,
        description="User logged out",
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "Logged out successfully"}


@router.post("/password-change")
async def change_password(
    data: PasswordChange,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    await db.execute(
        update(User).where(User.id == current_user.id).values(
            hashed_password=get_password_hash(data.new_password)
        )
    )
    await AuditService.log(
        db, "user.password_changed", user_id=current_user.id,
        description="Password changed",
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "Password changed successfully"}


@router.post("/password-reset-request")
async def request_password_reset(
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user:
        token = create_password_reset_token(user.email)
        expires = datetime.utcnow() + timedelta(hours=1)
        await db.execute(
            update(User).where(User.id == user.id).values(
                password_reset_token=token,
                password_reset_expires=expires,
            )
        )
        logger.info(f"Password reset token for {user.email}: {token}")

    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/password-reset")
async def reset_password(
    data: PasswordReset,
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(data.token)
    if not payload or payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    email = payload.get("sub")
    result = await db.execute(
        select(User).where(User.email == email)
        .where(User.password_reset_token == data.token)
        .where(User.password_reset_expires > datetime.utcnow())
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    await db.execute(
        update(User).where(User.id == user.id).values(
            hashed_password=get_password_hash(data.new_password),
            password_reset_token=None,
            password_reset_expires=None,
        )
    )
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user
