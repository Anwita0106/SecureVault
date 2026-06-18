from pydantic_settings import BaseSettings
from typing import List, Optional
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SecureVault"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(32)

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://securevault:securevault_pass@db:5432/securevault"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # JWT
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Encryption
    ENCRYPTION_KEY: str = secrets.token_urlsafe(32)

    # Storage
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    LOCAL_STORAGE_PATH: str = "/app/storage/files"
    MAX_FILE_SIZE_MB: int = 100
    ALLOWED_EXTENSIONS: List[str] = [
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        "txt", "csv", "png", "jpg", "jpeg", "gif", "zip", "tar", "gz"
    ]

    # AWS S3
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: Optional[str] = None

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:80",
        "http://frontend:3000",
    ]

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # ClamAV
    CLAMAV_HOST: str = "clamav"
    CLAMAV_PORT: int = 3310
    CLAMAV_ENABLED: bool = False

    # Email (optional for password reset)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@securevault.local"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Admin
    FIRST_ADMIN_EMAIL: str = "admin@securevault.local"
    FIRST_ADMIN_PASSWORD: str = "Admin@SecureVault2024!"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
