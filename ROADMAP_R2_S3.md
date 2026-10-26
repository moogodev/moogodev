# Roadmap R2/S3 Compatibility — Updated (2026-10-26)
# Based on Phase 0 decision (Option B — Native/Bearer auth). Phase 1 deferred.

## Phase 0 — Keputusan Arsitektur
Status: ✅ Option B (fail-closed / native auth)
- Secret tetap bcrypt (tidak diubah)
- Auth: Bearer `moogo_sk_`; SigV4 HMAC deferred
- Commit: ab551df / 6e78382

## Phase 1 — Auth & Signature (P0)
Status: ❌ DITUNDA (butuh Option A / secret reversibility)
- HMAC verification real: ❌ (sigv4/verify.go: always false — fail-closed)
- Expiry check: ❌
- SignedHeaders validation: ❌
- Credential scope: ❌
- Presigned PUT / GET/HEAD: ❌ (query parsing belum lengkap)
Note: Tanpa Option A, tidak bisa implementasi real VerifySignature.

## Phase 2 — API Coverage (P1)
Status: ⚠️ PARTIAL
- GET /s3/{bucket}/{key}: ✅ (PublicDownload)
- HEAD /s3/{bucket}/{key}: ✅ (PublicDownload)
- PUT /s3/{bucket}/{key}: ✅ (PresignedUpload)
- DeleteObject: ✅ (native auth; DELETE /s3/{bucket}/{key} -> Bucket.Delete)
- ListObjectsV2: ✅ (GET /s3/{bucket} -> Bucket.ListObjectsV2; XML)
- CopyObject: ✅ (PUT /s3/{bucket}/{key} dengan x-amz-copy-source)
- DeleteObjects (batch): ✅ (POST /s3/{bucket}?delete)

## Phase 3 — Bucket Namespace (P1)
Status: ⚠️ PARTIAL
- bucket_name resolution: ✅ (ResolveBucketByName)
- Bucket existence check: ⚠️ error handling bisa lebih baik
- Bucket-level isolation: ❌ (schema UNIQUE(bucket_id, key) belum; object unik per project_id + key)
Note: Migrasi schema besar — ditunda.

## Phase 4 — Wire Format (P2)
Status: ⚠️ PARTIAL
- Error XML: ⚠️ (internal/auth/sigv4/xml.go ada; belum konsisten semua /s3/ route)
- S3 error codes: ❌ (NoSuchBucket, SignatureDoesNotMatch, dll belum lengkap)
- Response headers: ❌ (x-amz-request-id, x-amz-id-2, ETag quoted, Last-Modified belum konsisten)
- ListObjectsV2 XML: ❌

## Phase 5 — SDK & Docs (P2)
Status: ✅ SELESAI (commit 4e33588 / 782044e / 0.2.4 npm)
- SDK createSignedUpload fix: ✅ (/sign PUT)
- SDK getPresignedUrl bucket param: ✅ (body, bukan query)
- SDK setBucketPublic / updateBucket: ✅ (dihapus dari SDK — dashboard-only)
- SDK errors.ts NotFoundError: ✅ (pesan diperbaiki)
- Docs status: ✅ Diperbarui (18-javascript-client.md lengkap; 01-what-is-moogo.md, before-start.md, Landing.tsx diperbaiki; versi 0.x.x untuk docs)
- SDK version: 0.2.4 (npm published)

## Phase 6 — Optimal (P3)
Status: ❌ DITUNDA
- Multipart upload: ✅ (Create/UploadPart/Complete/Abort)
- Copy object: ❌
- Batch delete: ❌
- Bucket policy / CORS: ❌
- Custom domain per bucket: ❌
- Cache purge real: ❌ (masih no-op)

## Rekomendasi Urutan (dengan Option B)
1. Phase 5 sudah selesai → lanjut ke Phase 2 (List/Delete endpoint lengkap)
2. Phase 4 wire format → konsisten XML + header saat endpoint lengkap
3. Phase 3 schema migration → hanya jika butuh full R2-compat
4. Phase 1 HMAC → hanya jika Option A diputuskan nanti
5. Phase 6 → hanya setelah Phase 1-4 solid
