# R2 / S3 Wire-Compat

## Status
- **Unverified**: `VerifySignature` returns false until full AWS SigV4 HMAC is implemented. `/s3/` rejects all requests with 401 while the placeholder is in place. This is fail-safe but not functional.

## SigV4 Middleware (`internal/auth/sigv4/`)
- Parses `AWS4-HMAC-SHA256 Authorization` header.
- Extracts access key and region from `Credential=`.
- Middleware looks up `StorageCredential` by access key ID to resolve project_id and sets it on request context.
- `VerifySignature()` returns `false` until complete — fail-closed by design.

## Route (`internal/router/router.go`)
- `GET /s3/{bucket_name}/*` → reuses `deps.Bucket.PublicDownload`; reads object key from URL into `auth.ContextKeyObjectKey`.
- Project id comes from credential resolution in middleware.

## Open Items
- **C.8**: Presigned signer must be SigV4. Current `signedurl` package uses custom HMAC; `PresignURL()` generates query params structurally but signature stays placeholder. Full verification impossible because `SecretKeyHash` is bcrypt-hashed (not reversible). Architectural change required to proceed.
- **B.6**: ListObjectsV2 on /s3/ — not yet implemented (requires S3 list API).
- **B.7**: Public URL shape differs (cdn.moogo.dev/pub/ vs R2 bucket-based) — mostly OK given bucket-level model.
- **F.14**: Multipart upload not supported (R2/S3 client feature).
- **F.15**: CORS not configured for /s3/.
- **E.12**: SDK `s3Download()` added; rebuild `clients/js/dist`.
- **Test**: unit tests for each stage (parser, signature, XML, presign).
