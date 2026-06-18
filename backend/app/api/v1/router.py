from fastapi import APIRouter
from app.api.v1.endpoints import auth, files, users, security

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(files.router, prefix="/files", tags=["Files"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(security.router, prefix="/security", tags=["Security"])
