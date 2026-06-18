-- SecureVault Database Initialization
-- This file runs on first startup

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance (tables created by SQLAlchemy)
-- These will run after tables exist via Alembic or SQLAlchemy create_all

-- Note: Table creation is handled by SQLAlchemy in the application
-- This file handles PostgreSQL-specific setup

-- Set timezone
SET timezone = 'UTC';
