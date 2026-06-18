from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SharedFile(Base):
    __tablename__ = "shared_files"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    shared_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with_email = Column(String(255), nullable=True)  # None = public link
    shared_with_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Share token (unique URL token)
    token = Column(String(64), unique=True, nullable=False, index=True)

    # Permissions
    can_download = Column(Boolean, default=True)
    can_view = Column(Boolean, default=True)
    requires_password = Column(Boolean, default=False)
    share_password_hash = Column(String(255), nullable=True)

    # Limits
    max_downloads = Column(Integer, nullable=True)  # None = unlimited
    download_count = Column(Integer, default=0)
    max_views = Column(Integer, nullable=True)
    view_count = Column(Integer, default=0)

    # Expiry
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)

    # Tracking
    last_accessed = Column(DateTime(timezone=True), nullable=True)
    access_log = Column(JSON, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    file = relationship("File", back_populates="shared_links")
    shared_by_user = relationship("User", back_populates="shared_files_created", foreign_keys=[shared_by])
    shared_with_user = relationship("User", foreign_keys=[shared_with_user_id])

    def __repr__(self):
        return f"<SharedFile token={self.token[:8]}...>"
