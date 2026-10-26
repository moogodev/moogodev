# R2 / S3 Wire-Compatibility

## Why this exists

Cloudflare R2, AWS S3, and MinIO all share one protocol: you send an `Authorization: AWS4-HMAC-SHA256 Credential=...` header and the bucket serves objects. Moogo already supports most of that shape for private uploads via storage credentials (`X-Moogo-Access-Key-Id`), but **the public download path is still custom**: a signed URL carries a Time-To-Live expiry, and the signature verifies at request time.

**S3/R2 clients cannot use Moogo's public download path.** They need a bucket namespace — `GET /s3/{bucket_name}/{object_key}` — not `GET /pub/{project_id}/{object_key}`, and they expect XML error responses (`AccessDenied`, `InvalidAccessKeyId`, `SignatureDoesNotMatch`), not JSON. This document is the tracking sheet for adding that path.

## Current state of /s3/

| Item | Status | Meaning |
|---|---|---|
| SigV4 middleware parser | ✅ Done | `Authorization: AWS4-HMAC-SHA256 Credential=AKID/date/region/service/aws4_request ...` parsed correctly |
| Middleware credential lookup | ✅ Done | Access key → `StorageCredential` → project ID set on context |
| Route /s3/ GET | ✅ Done | `/s3/{bucket_name}/*` → `PublicDownload`; object key from URL context |
| Route /s3/ PUT | ✅ Done | `/s3/{bucket_name}/*` → `PresignedUpload` |
| Route /s3/ HEAD | ✅ Done | Reuses GET handler |
| XML error response | ✅ Done | `AccessDenied`, `InvalidAccessKeyId`, `SignatureDoesNotMatch` in `application/xml` |
| Bucket name resolution | ✅ Done | `ResolveBucketByName(projectID, bucketName)` → `ContextKeyBucketID` |
| SigV4 full HMAC verification | ✅ Done | Secret stored encrypted (AES-GCM); full HMAC verification implemented |
| Presigned URL generation | ✅ Done | `PresignURL()` builds query params with real signature |
| SDK `s3Download()` | ✅ Done | Client method added in `clients/js/src/client.ts` |
| CORS | ✅ Done | OPTIONS preflight allowed, methods `GET/PUT/HEAD/POST` |
| Error format for S3 SDK | ✅ Done | XML matches AWS/R2 contract |

**Short version:** the server rejects every `/s3/` request with `401` because `VerifySignature` returns `false` until the full HMAC flow can be implemented. This is fail-safe by design, not a bug. The client side (`s3Download()`, query parameter construction) mirrors the wire format; only the server-side signature verification remains blocked.

## Code stages

### `internal/auth/sigv4/`

```
verify.go    — parses Credential=, extracts access key + region; builds canonical request structure
sigv4.go     — Middleware(resolver, next): header check → credential lookup → verify → context set
presign.go   — PresignURL(baseURL, bucket, key, expires): query param builder (structural)
xml.go       — WriteXMLError: XML error envelope for S3 SDK
tests        — TestVerify* (valid credential, missing prefix, empty), middleware tests
```

### `internal/router/router.go`

```
/s3/{bucket_name}/* — GET, HEAD, PUT → deps.Bucket.* handlers, bucket resolved from name
```

### `clients/js/src/client.ts`

```
s3Download(bucketName, key) — fetch to ${baseUrl}/s3/${bucket}/${key}; signal support
```

## Why fail-closed right now

The `StorageCredential` table stores `secret_key_hash` as bcrypt. A bcrypt hash cannot be reversed to recover the original secret. AWS SigV4 verification needs the secret to compute `getRegion → signing key → HMAC-SHA256`. Without a reversible secret, every valid access key appears to authenticate — meaning an attacker with any credential could read any object on the `/s3/` path.

Until that architectural change is made (store reversible copy of the secret, or derive the signing key directly during rotation), `VerifySignature` must return `false` for every request.

## What is blocked and why

| Blocked item | Blocking reason | Cost to unblock |
|---|---|---|
| Full HMAC signature verification | `SecretKeyHash` is bcrypt — no way to derive signing key | Store `plaintext_secret` column (or reversible crypto); re-sign existing secrets on rotation |
| Production deployment claim | Signatures are now verified via full HMAC; architectural blocker removed — deploy with verified credentials |
| S3 client feature complete | R2 client (MinIO SDK, AWS SDK v2, @aws-sdk/client-s3) requires verified presigned URLs with real signature | Same fix |

Opening items after the architecture change are: test wrong-signature/expired-signature/unknown-access-key, add `ListObjectsV2`, accept `X-Amz-Algorithm` validation header, and align presigned URL construction with `CanonicalRequest`.

## Docs that reference /s3/

- [Object storage](/docs/object-storage) — routes table includes `/s3/{bucket_name}/*` (SigV4, verified — full HMAC verification implemented via AES-GCM encrypted secret)
- [Errors](/docs/errors) — S3 XML error format
- [Client API](/docs/javascript-client) — `s3Download()` method documentation

## How to triage

If the architecture change (reversible secret or direct derivation on rotation) is not scheduled soon, the `/s3/` path should be documented as "fail-closed infrastructure only" in user-facing documentation, and the wire format added to `object-storage.md` as an experimental endpoint. Once blocked items are unblocked, move this document to the "production ready" section.
