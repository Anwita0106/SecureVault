# Security Architecture & Controls

This document describes the security controls implemented across SecureVault. The actual
implementation code lives in `backend/app/core/security.py`, `backend/app/services/scanner_service.py`,
and `backend/app/core/deps.py`.

## 1. Authentication

- **JWT Access Tokens**: HS256-signed, 30-minute expiry (configurable via `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`)
- **JWT Refresh Tokens**: 7-day expiry, used to mint new access tokens without re-login
- **Password Hashing**: bcrypt via `passlib`, automatic salt generation
- **Account Lockout**: 5 failed login attempts triggers a 15-minute lock (`User.locked_until`)
- **Password Policy**: minimum 8 characters, requires uppercase, lowercase, digit, and special character

## 2. Authorization (RBAC)

Roles are stored in the `roles` table with a JSON `permissions` array:

| Role | Permissions |
|------|-------------|
| admin | `*` (full access) |
| manager | `files:*`, `users:read`, `audit:read` |
| user | `files:own`, `share:create` |
| viewer | `files:read` |

Enforcement happens via FastAPI dependencies (`RoleChecker` in `app/core/deps.py`):
- `require_admin` - admin only
- `require_manager` - admin or manager
- `require_user` - admin, manager, or user

## 3. File Encryption

All files are encrypted at rest using **AES-256-GCM**:

1. A 256-bit key is derived via SHA-256 from `ENCRYPTION_KEY`
2. A random 96-bit IV (nonce) is generated per file
3. AES-GCM produces ciphertext + a 128-bit authentication tag
4. The stored blob is `IV || TAG || CIPHERTEXT`
5. SHA-256 hash of the *original* file is stored for integrity verification

Decryption reverses this process and verifies the GCM tag, providing both confidentiality
and tamper detection.

## 4. Malware Scanning

Uploaded files are streamed to **ClamAV** via the `INSTREAM` protocol over TCP
(`scanner_service.py`). If ClamAV is disabled (`CLAMAV_ENABLED=false`, the default for
local dev), an EICAR test-string check is performed instead, so the malware-blocking
path can still be tested without a running ClamAV daemon.

Outcomes:
- `clean` → file proceeds to encryption + storage
- `infected` → upload rejected (HTTP 422), a `SecurityFinding` is created, and an audit
  log entry with `status=failure` is written
- `error` → ClamAV unreachable; logged but does not block upload (configurable)

## 5. Secure Sharing

Share links use `secrets.token_urlsafe(32)` for cryptographically secure, unguessable
tokens. Each share record supports:

- **Expiry** (`expires_at`) - time-bound access
- **Download/View limits** (`max_downloads`, `max_views`) - usage-bound access
- **Password protection** - bcrypt-hashed `share_password_hash`
- **Granular permissions** - `can_view`, `can_download` independently togglable

## 6. Audit Logging

Every significant action (login, logout, upload, download, share, delete, admin changes,
security events) is recorded in the `audit_logs` table with:

- User ID, action name, resource type/ID
- IP address and User-Agent
- Status (`success` / `failure` / `warning`)
- Arbitrary JSON metadata

## 7. HTTP Security Headers

Applied via `SecurityMiddleware` in `app/core/security.py`:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

## 8. AI Security Inspector

The `ai_service.py` module calls the Anthropic Claude API to:

- Analyze overall security posture (risk score, concerns, recommendations)
- Generate narrative security reports for compliance/exec review
- Analyze suspicious user activity patterns
- Assess file-level risk based on scan history and metadata

This supplements (does not replace) deterministic controls like ClamAV and RBAC.
