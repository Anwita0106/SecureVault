# Deployment Guide

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+
- 2GB+ RAM available (ClamAV virus database requires ~1GB)
- Ports 80, 3000, 8000, 5432, 6379, 3310 free (or adjust in `docker-compose.yml`)

## 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and **change these values for production**:

```env
SECRET_KEY=<generate with: openssl rand -base64 32>
JWT_SECRET_KEY=<generate with: openssl rand -base64 32>
ENCRYPTION_KEY=<generate with: openssl rand -base64 32>
ADMIN_PASSWORD=<a strong unique password>
```

> ⚠️ **Important**: `ENCRYPTION_KEY` encrypts all files at rest. If you change it after
> files have been uploaded, those files become undecryptable. Back it up securely.

## 2. Build and Start

```bash
docker-compose up -d --build
```

This starts:
- `db` - PostgreSQL 15 (persisted in `postgres_data` volume)
- `redis` - Redis 7 for caching/session support
- `clamav` - ClamAV malware scanner (takes 1-2 min to download virus definitions on first start)
- `backend` - FastAPI app on port 8000
- `frontend` - React app served via Nginx on port 80

## 3. Verify Health

```bash
# Check all containers are healthy
docker-compose ps

# Backend health check
curl http://localhost:8000/health

# Frontend
curl http://localhost/
```

## 4. First Login

Navigate to `http://localhost` and log in with:
- Email: value of `ADMIN_EMAIL` (default `admin@securevault.local`)
- Password: value of `ADMIN_PASSWORD`

**Change the admin password immediately** via Profile → Change Password.

## 5. Enabling ClamAV Scanning

By default `CLAMAV_ENABLED=false` so the app works without waiting for ClamAV's
virus database download. To enable real-time scanning:

```env
CLAMAV_ENABLED=true
```

Then restart the backend:

```bash
docker-compose restart backend
```

Wait for the ClamAV container to report healthy (`docker-compose ps`) before uploading
files, or scans will return `error` status.

## 6. Using AWS S3 Storage

Edit `.env`:

```env
STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket
```

Restart: `docker-compose restart backend`

## 7. Production Hardening Checklist

- [ ] Replace all default secrets in `.env`
- [ ] Put the stack behind a TLS-terminating reverse proxy (e.g., Traefik, Caddy, or an ALB)
- [ ] Set `ALLOWED_ORIGINS` to your real domain(s) only
- [ ] Enable ClamAV (`CLAMAV_ENABLED=true`)
- [ ] Configure SMTP for password reset emails
- [ ] Set up automated PostgreSQL backups (`pg_dump` cron or managed DB)
- [ ] Configure log aggregation for audit logs (e.g., ship to ELK/Datadog)
- [ ] Review and tighten `Content-Security-Policy` in `app/core/security.py`
- [ ] Run `docker-compose` with resource limits (`mem_limit`, `cpus`)
- [ ] Rotate `JWT_SECRET_KEY` periodically (invalidates existing sessions)

## 8. Scaling

- `backend` runs with 4 Uvicorn workers by default (see `Dockerfile` CMD)
- For horizontal scaling, run multiple `backend` replicas behind a load balancer
  and point all of them at the same PostgreSQL + shared storage (S3 recommended
  for multi-instance deployments since local disk isn't shared)
- Redis can be used for distributed rate limiting / session caching at scale

## 9. Stopping & Cleanup

```bash
# Stop containers, keep data
docker-compose down

# Stop and remove all data volumes (DESTRUCTIVE)
docker-compose down -v
```
