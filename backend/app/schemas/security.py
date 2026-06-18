from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str
    metadata: Optional[Dict[str, Any]] = {}
    created_at: datetime
    username: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True


class SecurityFindingResponse(BaseModel):
    id: int
    finding_type: str
    severity: str
    title: str
    description: Optional[str] = None
    recommendation: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    user_id: Optional[int] = None
    file_id: Optional[int] = None
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = Field(default={}, validation_alias="extra_data")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class SecurityFindingCreate(BaseModel):
    finding_type: str
    severity: str
    title: str
    description: Optional[str] = None
    recommendation: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    user_id: Optional[int] = None
    file_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = {}


class DashboardStats(BaseModel):
    total_files: int
    total_users: int
    total_storage_bytes: int
    active_shares: int
    security_findings: int
    critical_findings: int
    recent_uploads: int
    recent_logins: int
    infected_files: int
    quarantined_files: int


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: Optional[List[str]] = []
    created_at: datetime

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class AIAnalysisRequest(BaseModel):
    context: str
    analysis_type: str = "security"
