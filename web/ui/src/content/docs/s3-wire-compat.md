# R2 / S3 Wire-Compat

## SigV4 Middleware
- `internal/auth/sigv4/`: parses `AWS4-HMAC-SHA256` Authorization header
- Verifies `Credential=` (access key + region) before passing to `/s3/`

## Route
- `/s3/{bucket_name}/*` → reuse `PublicDownload` / `PresignedUpload`
- Data-plane bucket toggle (`/buckets/` PATCH/POST) hanya via session cookie, tidak storage credential
