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
- Implement full SigV4 HMAC verification (canonical request, signed headers, signature compare, expiry).
- Wrong signature → 403/401. Expired → rejected. Unknown access key → 401.
- Test these cases.
- Add PUT/HEAD/LIST routes when fully verified.
