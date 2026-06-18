from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database with default data."""
    from app.models.user import User
    from app.models.role import Role
    from app.core.security import get_password_hash
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        # Create default roles
        roles_data = [
            {"name": "admin", "description": "Full system access", "permissions": ["*"]},
            {"name": "manager", "description": "File management and user oversight", "permissions": ["files:*", "users:read", "audit:read"]},
            {"name": "user", "description": "Standard file operations", "permissions": ["files:own", "share:create"]},
            {"name": "viewer", "description": "Read-only access", "permissions": ["files:read"]},
        ]

        for role_data in roles_data:
            result = await session.execute(select(Role).where(Role.name == role_data["name"]))
            existing = result.scalar_one_or_none()
            if not existing:
                role = Role(**role_data)
                session.add(role)

        await session.commit()

        # Create admin user
        result = await session.execute(select(User).where(User.email == settings.FIRST_ADMIN_EMAIL))
        admin = result.scalar_one_or_none()

        if not admin:
            result = await session.execute(select(Role).where(Role.name == "admin"))
            admin_role = result.scalar_one_or_none()

            admin_user = User(
                email=settings.FIRST_ADMIN_EMAIL,
                username="admin",
                full_name="System Administrator",
                hashed_password=get_password_hash(settings.FIRST_ADMIN_PASSWORD),
                role_id=admin_role.id if admin_role else None,
                is_active=True,
                is_superuser=True,
            )
            session.add(admin_user)
            await session.commit()
            logger.info(f"Created admin user: {settings.FIRST_ADMIN_EMAIL}")
