from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, BigInteger, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_extension = Column(String(20), nullable=True)
    file_hash = Column(String(64), nullable=False, index=True)  # SHA-256

    # Encryption
    is_encrypted = Column(Boolean, default=True)
    encryption_metadata = Column(Text, nullable=True)

    # Ownership
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Versioning
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("files.id"), nullable=True)

    # Status
    is_deleted = Column(Boolean, default=False)
    is_quarantined = Column(Boolean, default=False)
    scan_status = Column(String(20), default="pending")  # pending, clean, infected, error
    scan_result = Column(Text, nullable=True)
    scan_date = Column(DateTime(timezone=True), nullable=True)

    # Storage
    storage_backend = Column(String(20), default="local")
    s3_key = Column(String(500), nullable=True)

    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    folder = Column(String(500), default="/")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    owner = relationship("User", back_populates="files", foreign_keys=[owner_id])
    shared_links = relationship("SharedFile", back_populates="file")
    versions = relationship("File", foreign_keys=[parent_id])

    def __repr__(self):
        return f"<File {self.original_filename} v{self.version}>"
