from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router
from app.core.security import SecurityMiddleware
from app.models import *  # noqa: F401, F403 - import all models for table creation

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting SecureVault API...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified.")
    yield
    # Shutdown
    logger.info("Shutting down SecureVault API...")


app = FastAPI(
    title="SecureVault API",
    description="Enterprise-Grade Secure File Sharing and Document Management Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Security Middleware
app.add_middleware(SecurityMiddleware)

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check():
    return JSONResponse(
        content={
            "status": "healthy",
            "service": "SecureVault API",
            "version": "1.0.0"
        }
    )


@app.get("/", tags=["root"])
async def root():
    return {"message": "SecureVault Enterprise API", "docs": "/api/docs"}
