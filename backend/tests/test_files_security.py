import pytest
import io


@pytest.mark.asyncio
class TestFiles:

    async def test_upload_file(self, client, user_headers):
        content = b"Hello, SecureVault! This is a test file."
        res = await client.post(
            "/api/v1/files/upload",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
            headers=user_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["original_filename"] == "test.txt"
        assert data["is_encrypted"] is True
        assert data["scan_status"] in ("clean", "pending", "error")
        return data["id"]

    async def test_upload_disallowed_extension(self, client, user_headers):
        res = await client.post(
            "/api/v1/files/upload",
            files={"file": ("malware.exe", io.BytesIO(b"exec content"), "application/octet-stream")},
            headers=user_headers,
        )
        assert res.status_code == 400

    async def test_upload_eicar(self, client, user_headers):
        eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
        res = await client.post(
            "/api/v1/files/upload",
            files={"file": ("eicar.txt", io.BytesIO(eicar), "text/plain")},
            headers=user_headers,
        )
        assert res.status_code == 422  # Malware detected

    async def test_list_files(self, client, user_headers):
        res = await client.get("/api/v1/files/", headers=user_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_search_files(self, client, user_headers):
        # Upload first
        await client.post(
            "/api/v1/files/upload",
            files={"file": ("searchable.txt", io.BytesIO(b"search content"), "text/plain")},
            headers=user_headers,
        )
        res = await client.get("/api/v1/files/search?q=searchable", headers=user_headers)
        assert res.status_code == 200

    async def test_download_file(self, client, user_headers):
        # Upload
        upload_res = await client.post(
            "/api/v1/files/upload",
            files={"file": ("download_test.txt", io.BytesIO(b"download me"), "text/plain")},
            headers=user_headers,
        )
        file_id = upload_res.json()["id"]

        # Download
        dl_res = await client.get(f"/api/v1/files/{file_id}/download", headers=user_headers)
        assert dl_res.status_code == 200
        assert dl_res.content == b"download me"

    async def test_delete_file(self, client, user_headers):
        upload_res = await client.post(
            "/api/v1/files/upload",
            files={"file": ("delete_me.txt", io.BytesIO(b"delete me"), "text/plain")},
            headers=user_headers,
        )
        file_id = upload_res.json()["id"]

        del_res = await client.delete(f"/api/v1/files/{file_id}", headers=user_headers)
        assert del_res.status_code == 200

        get_res = await client.get(f"/api/v1/files/{file_id}", headers=user_headers)
        assert get_res.status_code == 404

    async def test_share_file(self, client, user_headers):
        upload_res = await client.post(
            "/api/v1/files/upload",
            files={"file": ("share_me.txt", io.BytesIO(b"share me"), "text/plain")},
            headers=user_headers,
        )
        file_id = upload_res.json()["id"]

        share_res = await client.post(
            f"/api/v1/files/{file_id}/share",
            json={"file_id": file_id, "can_download": True, "can_view": True, "expires_hours": 24},
            headers=user_headers,
        )
        assert share_res.status_code == 200
        assert "token" in share_res.json()


@pytest.mark.asyncio
class TestSecurity:

    async def test_dashboard_admin(self, client, admin_headers):
        res = await client.get("/api/v1/security/dashboard", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_files" in data
        assert "total_users" in data

    async def test_dashboard_user(self, client, user_headers):
        res = await client.get("/api/v1/security/dashboard", headers=user_headers)
        assert res.status_code == 200  # All users can see dashboard

    async def test_audit_logs_admin(self, client, admin_headers):
        res = await client.get("/api/v1/security/audit-logs", headers=admin_headers)
        assert res.status_code == 200

    async def test_audit_logs_user_forbidden(self, client, user_headers):
        res = await client.get("/api/v1/security/audit-logs", headers=user_headers)
        assert res.status_code == 403

    async def test_my_activity(self, client, user_headers):
        res = await client.get("/api/v1/security/my-activity", headers=user_headers)
        assert res.status_code == 200


@pytest.mark.asyncio
class TestSecurity_Core:
    """Test core security functions."""

    def test_password_hashing(self):
        from app.core.security import get_password_hash, verify_password
        pw = "TestPass@1234!"
        hashed = get_password_hash(pw)
        assert hashed != pw
        assert verify_password(pw, hashed)
        assert not verify_password("wrong", hashed)

    def test_jwt_tokens(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token({"sub": "42", "email": "test@test.com"})
        payload = decode_token(token)
        assert payload["sub"] == "42"
        assert payload["type"] == "access"

    def test_invalid_jwt(self):
        from app.core.security import decode_token
        assert decode_token("invalid.token.here") is None

    def test_file_encryption(self):
        from app.core.security import encrypt_file, decrypt_file, hash_file
        data = b"Sensitive document content - encrypt me!"
        encrypted, meta = encrypt_file(data)
        assert encrypted != data
        assert len(meta) > 0

        decrypted = decrypt_file(encrypted)
        assert decrypted == data

    def test_file_hash(self):
        from app.core.security import hash_file
        data = b"hash me"
        h1 = hash_file(data)
        h2 = hash_file(data)
        h3 = hash_file(b"different")
        assert h1 == h2
        assert h1 != h3
        assert len(h1) == 64  # SHA-256 hex

    def test_share_token_uniqueness(self):
        from app.core.security import generate_share_token
        tokens = {generate_share_token() for _ in range(100)}
        assert len(tokens) == 100  # All unique
