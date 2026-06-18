import pytest


@pytest.mark.asyncio
class TestAuth:

    async def test_register_success(self, client):
        res = await client.post("/api/v1/auth/register", json={
            "email": "newuser@test.com",
            "username": "newuser123",
            "password": "NewUser@1234!",
            "full_name": "New User"
        })
        assert res.status_code == 201
        data = res.json()
        assert data["email"] == "newuser@test.com"
        assert "hashed_password" not in data

    async def test_register_duplicate_email(self, client):
        await client.post("/api/v1/auth/register", json={
            "email": "dup@test.com", "username": "dup1", "password": "Dup@1234!"
        })
        res = await client.post("/api/v1/auth/register", json={
            "email": "dup@test.com", "username": "dup2", "password": "Dup@1234!"
        })
        assert res.status_code == 400

    async def test_register_weak_password(self, client):
        res = await client.post("/api/v1/auth/register", json={
            "email": "weakpw@test.com", "username": "weakuser", "password": "weak"
        })
        assert res.status_code == 422

    async def test_login_success(self, client):
        res = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com", "password": "Admin@Test1234!"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client):
        res = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com", "password": "WrongPassword!"
        })
        assert res.status_code == 401

    async def test_login_unknown_user(self, client):
        res = await client.post("/api/v1/auth/login", json={
            "email": "ghost@test.com", "password": "Ghost@1234!"
        })
        assert res.status_code == 401

    async def test_get_me(self, client, admin_headers):
        res = await client.get("/api/v1/auth/me", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "admin@test.com"

    async def test_get_me_no_auth(self, client):
        res = await client.get("/api/v1/auth/me")
        assert res.status_code == 403

    async def test_refresh_token(self, client):
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com", "password": "Admin@Test1234!"
        })
        refresh = login_res.json()["refresh_token"]
        res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert res.status_code == 200
        assert "access_token" in res.json()

    async def test_logout(self, client, admin_headers):
        res = await client.post("/api/v1/auth/logout", headers=admin_headers)
        assert res.status_code == 200
