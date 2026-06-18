from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FileBase(BaseModel):
    original_filename: str
    description: Optional[str] = None
    tags: Optional[List[str]] = []
    folder: Optional[str] = "/"


class FileResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    file_extension: Optional[str] = None
    file_hash: str
    is_encrypted: bool
    owner_id: int
    version: int
    parent_id: Optional[int] = None
    is_deleted: bool
    scan_status: str
    description: Optional[str] = None
    tags: Optional[List[str]] = []
    folder: str
    storage_backend: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FileUpdate(BaseModel):
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    folder: Optional[str] = None


class FileSearchRequest(BaseModel):
    query: str
    folder: Optional[str] = None
    mime_type: Optional[str] = None
    min_size: Optional[int] = None
    max_size: Optional[int] = None
    tags: Optional[List[str]] = None


class ShareFileRequest(BaseModel):
    file_id: int
    shared_with_email: Optional[str] = None
    can_download: bool = True
    can_view: bool = True
    requires_password: bool = False
    share_password: Optional[str] = None
    max_downloads: Optional[int] = None
    max_views: Optional[int] = None
    expires_hours: Optional[int] = None


class SharedFileResponse(BaseModel):
    id: int
    file_id: int
    token: str
    shared_with_email: Optional[str] = None
    can_download: bool
    can_view: bool
    requires_password: bool
    max_downloads: Optional[int] = None
    download_count: int
    max_views: Optional[int] = None
    view_count: int
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    share_url: Optional[str] = None

    class Config:
        from_attributes = True


class FileVersionResponse(BaseModel):
    id: int
    version: int
    filename: str
    original_filename: str
    file_size: int
    file_hash: str
    created_at: datetime

    class Config:
        from_attributes = True
