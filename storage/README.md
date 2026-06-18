# Storage

This directory is the **local storage backend** mount point for encrypted files.

In Docker Compose, this maps to the `file_storage` named volume mounted at
`/app/storage/files` inside the `backend` container.

## Layout

```
storage/
└── files/
    └── <user_id>/
        └── <uuid>.<ext>   # AES-256-GCM encrypted blob
```

Files are named with a randomly generated UUID (not the original filename) to avoid
path traversal and information disclosure. The original filename, MIME type, and other
metadata are stored in the `files` table in PostgreSQL.

## Switching to S3

Set the following environment variables to use AWS S3 instead of local disk
(`backend/app/services/storage_service.py` handles both backends transparently):

```env
STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=securevault-files
```

Files are still encrypted client-side (AES-256-GCM) before upload to S3, and
server-side encryption (`AES256`) is additionally enabled on the S3 object.
