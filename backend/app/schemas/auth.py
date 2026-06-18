from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenRefresh(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
