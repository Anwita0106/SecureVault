# Architecture Overview

## High-Level Diagram

```
                         ┌──────────────────────────────────────┐
                         │              Browser                  │
                         └────────────────┬───────────────────────┘
                                           │ HTTPS
                         ┌─────────────────▼──────────────────────┐
                         │     Nginx (frontend container)          │
                         │  - Serves React SPA (build output)      │
                         │  - Reverse-proxies /api/* → backend      │
                         │  - Security headers, gzip, caching       │
                         └────────────────┬───────────────────────┘
                                           │
                         ┌─────────────────▼──────────────────────┐
                         │   FastAPI Backend (Uvicorn, 4 workers)  │
                         │                                          │
                         │  app/api/v1/endpoints/                  │
                         │   ├── auth.py      - JWT auth, register │
                         │   ├── files.py     - upload/download/   │
                         │   │                   share/versioning   │
                         │   ├── users.py     - RBAC user mgmt     │
                         │   └── security.py  - audit, dashboard,  │
                         │                       AI inspector       │
                         │                                          │
                         │  app/core/                              │
                         │   ├── security.py  - JWT, bcrypt, AES   │
                         │   ├── deps.py      - auth dependencies, │
                         │   │                   RoleChecker        │
                         │   └── config.py    - Pydantic settings  │
                         │                                          │
                         │  app/services/                          │
                         │   ├── storage_service.py - local/S3     │
                         │   ├── scanner_service.py - ClamAV        │
                         │   ├── ai_service.py      - Claude API    │
                         │   └── audit_service.py   - logging       │
                         └──────┬─────────┬─────────┬──────────────┘
                                │         │         │
                  ┌─────────────▼──┐ ┌────▼────┐ ┌──▼────────────┐
                  │  PostgreSQL 15  │ │  Redis  │ │  ClamAV       │
                  │  (async SQL-    │ │ (cache) │ │  (TCP scan)   │
                  │   Alchemy ORM)  │ └─────────┘ └───────────────┘
                  └─────────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │  File Storage               │
                  │  (local volume or S3)       │
                  │  AES-256-GCM encrypted blobs │
                  └──────────────────────────────┘
```

## Request Lifecycle: File Upload

1. Client sends `multipart/form-data` to `POST /api/v1/files/upload` with JWT bearer token
2. `get_current_active_user` dependency validates JWT, loads `User` from DB
3. Extension and size validated against `ALLOWED_EXTENSIONS` / `MAX_FILE_SIZE_MB`
4. File bytes streamed to `scanner_service.scan_bytes()`:
   - If ClamAV enabled → `INSTREAM` protocol scan
   - If infected → `SecurityFinding` created, audit log (`status=failure`), HTTP 422 returned
5. If clean, `storage_service.save_file()`:
   - SHA-256 hash computed (`file_hash`)
   - AES-256-GCM encryption (`encrypt_file()`) with random IV + auth tag
   - Encrypted blob written to local disk (`/app/storage/files/<user_id>/<uuid>.<ext>`)
     or uploaded to S3 with server-side encryption
6. `File` row inserted into PostgreSQL with metadata, `scan_status=clean`, `is_encrypted=true`
7. `AuditLog` entry created: `action=file.upload`, `status=success`
8. Response returns `FileResponse` schema (no decrypted content, no encryption keys)

## Request Lifecycle: Shared Link Access

1. Anonymous user visits `/share/{token}` (no auth required)
2. Backend looks up `SharedFile` by `token`, checks:
   - `is_active == true`
   - `expires_at` not in the past
   - `view_count < max_views` (if set)
   - If `requires_password`, validates bcrypt-hashed password
3. Increments `view_count`, updates `last_accessed`
4. Returns file metadata (filename, size, MIME type) — not the file itself
5. If `can_download`, the React `SharedAccessPage` shows a Download button →
   `GET /share/{token}/download` repeats checks for `download_count`/`max_downloads`,
   decrypts the file server-side, and streams it to the client

## Data Model Relationships

```
users 1───* files            (owner_id)
users 1───* shared_files      (shared_by)
users 1───* audit_logs        (user_id)
files 1───* shared_files       (file_id)
files 1───* files              (parent_id, for versioning)
roles 1───* users               (role_id)
```

## Frontend Architecture

- **AuthContext** (`src/context/AuthContext.js`) holds the current user, exposes
  `login`, `logout`, `register`, and `isAdmin`/`isManager` flags. Tokens persist in
  `localStorage`.
- **Axios client** (`src/api/client.js`) attaches `Authorization: Bearer <token>` to
  every request via an interceptor, and automatically refreshes expired access tokens
  using the refresh token, retrying the original request transparently.
- **Layout** (`src/components/common/Layout.js`) provides the sidebar nav, collapsible
  on mobile, with role-aware admin links.
- **Pages** are route-level components under `src/pages/`, each responsible for
  fetching its own data via the API client and rendering with Tailwind + Recharts.

## AI Security Inspector

`app/services/ai_service.py` wraps calls to the Anthropic Messages API
(`claude-sonnet-4-20250514`). It is invoked from `/api/v1/security/ai/analyze` and
`/api/v1/security/ai/report`, which gather platform statistics, recent audit activity,
and open security findings, then ask Claude to:

- Score overall risk (0-100)
- Identify top concerns and recommendations
- Acknowledge existing positive controls
- (For reports) produce a markdown executive summary

If the Claude API is unreachable, both endpoints return a graceful fallback response
so the dashboard never hard-fails.
