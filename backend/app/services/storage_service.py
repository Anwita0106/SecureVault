import os
import aiofiles
import hashlib
import mimetypes
from pathlib import Path
from typing import Optional, Tuple
import logging
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.core.security import encrypt_file, decrypt_file, hash_file

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self.backend = settings.STORAGE_BACKEND
        self.local_path = Path(settings.LOCAL_STORAGE_PATH)
        self.local_path.mkdir(parents=True, exist_ok=True)

        if self.backend == "s3":
            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )

    async def save_file(
        self,
        data: bytes,
        filename: str,
        user_id: int,
        encrypt: bool = True,
    ) -> Tuple[str, str, str, str]:
        """
        Save file to storage backend.
        Returns: (file_path, file_hash, encryption_metadata, storage_key)
        """
        file_hash = hash_file(data)
        encrypted_data = data
        encryption_metadata = ""

        if encrypt:
            encrypted_data, encryption_metadata = encrypt_file(data)

        if self.backend == "s3":
            return await self._save_to_s3(encrypted_data, filename, user_id, file_hash, encryption_metadata)
        else:
            return await self._save_to_local(encrypted_data, filename, user_id, file_hash, encryption_metadata)

    async def _save_to_local(
        self,
        data: bytes,
        filename: str,
        user_id: int,
        file_hash: str,
        encryption_metadata: str,
    ) -> Tuple[str, str, str, str]:
        user_dir = self.local_path / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        file_path = user_dir / filename
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)

        return str(file_path), file_hash, encryption_metadata, ""

    async def _save_to_s3(
        self,
        data: bytes,
        filename: str,
        user_id: int,
        file_hash: str,
        encryption_metadata: str,
    ) -> Tuple[str, str, str, str]:
        s3_key = f"users/{user_id}/{filename}"
        try:
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=data,
                ServerSideEncryption="AES256",
            )
            return s3_key, file_hash, encryption_metadata, s3_key
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            raise

    async def read_file(
        self,
        file_path: str,
        is_encrypted: bool = True,
        s3_key: Optional[str] = None,
    ) -> bytes:
        """Read and optionally decrypt file from storage."""
        if self.backend == "s3" and s3_key:
            data = await self._read_from_s3(s3_key)
        else:
            data = await self._read_from_local(file_path)

        if is_encrypted:
            data = decrypt_file(data)

        return data

    async def _read_from_local(self, file_path: str) -> bytes:
        async with aiofiles.open(file_path, "rb") as f:
            return await f.read()

    async def _read_from_s3(self, s3_key: str) -> bytes:
        try:
            response = self.s3_client.get_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
            )
            return response["Body"].read()
        except ClientError as e:
            logger.error(f"S3 read failed: {e}")
            raise

    async def delete_file(
        self,
        file_path: str,
        s3_key: Optional[str] = None,
    ) -> bool:
        try:
            if self.backend == "s3" and s3_key:
                self.s3_client.delete_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=s3_key,
                )
            else:
                path = Path(file_path)
                if path.exists():
                    path.unlink()
            return True
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            return False

    @staticmethod
    def get_mime_type(filename: str) -> str:
        mime, _ = mimetypes.guess_type(filename)
        return mime or "application/octet-stream"

    @staticmethod
    def get_extension(filename: str) -> str:
        return Path(filename).suffix.lstrip(".").lower()

    @staticmethod
    def validate_extension(filename: str) -> bool:
        ext = StorageService.get_extension(filename)
        return ext in settings.ALLOWED_EXTENSIONS

    @staticmethod
    def validate_size(size: int) -> bool:
        return size <= settings.MAX_FILE_SIZE_MB * 1024 * 1024

    @staticmethod
    def format_size(size_bytes: int) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} TB"


storage_service = StorageService()
