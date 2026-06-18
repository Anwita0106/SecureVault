import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.role import Role

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        # Create roles
        roles = [
            Role(name="admin", description="Admin", permissions=["*"]),
            Role(name="user", description="User", permissions=["files:own"]),
        ]
        for r in roles:
            session.add(r)
        await session.commit()

        # Create test users
        admin_role = await session.execute(__import__('sqlalchemy', fromlist=['select']).select(Role).where(Role.name == "admin"))
        admin_role = admin_role.scalar_one()

        admin = User(
            email="admin@test.com",
            username="testadmin",
            full_name="Test Admin",
            hashed_password=get_password_hash("Admin@Test1234!"),
            role_id=admin_role.id,
            is_active=True,
            is_superuser=True,
            is_verified=True,
        )
        session.add(admin)

        user_role = await session.execute(__import__('sqlalchemy', fromlist=['select']).select(Role).where(Role.name == "user"))
        user_role = user_role.scalar_one()

        user = User(
            email="user@test.com",
            username="testuser",
            full_name="Test User",
            hashed_password=get_password_hash("User@Test1234!"),
            role_id=user_role.id,
            is_active=True,
            is_superuser=False,
            is_verified=True,
        )
        session.add(user)
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def admin_token(client):
    res = await client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "Admin@Test1234!"})
    return res.json()["access_token"]


@pytest.fixture
async def user_token(client):
    res = await client.post("/api/v1/auth/login", json={"email": "user@test.com", "password": "User@Test1234!"})
    return res.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}
