# TODO — Sisa R2/S3 Compatibility (belum selesai)

## Phase 1 — HMAC SigV4 (Option A implemented: encrypted-at-rest secret)
- [x] Option A: secret disimpan terenkripsi (AES-GCM) di kolom secret_key_encrypted.
- [x] Implement canonical request + signing key derivation + signature compare.
- [x] Expiry check (X-Amz-Date + Expires).
- [x] SignedHeaders validation.
- [x] Credential scope validation (region/s3/aws4_request).
- [x] Presigned PUT/GET/HEAD via query auth.

## Phase 3 — Bucket Namespace / schema migration
- [ ] Migrasi schema `UNIQUE(bucket_id, key)` (ganti `UNIQUE(project_id, key)`). (DEFERRED: butuh perubahan path storage project/bucket/key)
- [ ] Update semua query store (ObjectByKey, DeleteObject, PutObject, ListObjects) pakai bucket_id.
- [x] Bucket existence check error handling lebih baik (s3 routes).
- [ ] Bucket-level isolation end-to-end. (DEFERRED)

## Phase 4 — Wire format consistency
- [x] Konversi error di handler lama ke XML untuk route `/s3/` (writeErr helper).
- [x] S3 error codes lengkap (NoSuchBucket, NoSuchKey, AccessDenied, SignatureDoesNotMatch, dll).
- [x] `x-amz-id-2` konsisten (middleware) + verifikasi.
- [x] ListObjectsV2 XML + continuation token + CommonPrefixes polish.

## Phase 6 — Optimal
- [x] CORS per-bucket config (storage + model).
- [ ] Cache purge real (Cloudflare) — ✅ diimplementasikan (env config).
- [x] Custom domain per bucket (storage + model).
- [ ] Bucket policy (advanced).

## Catatan
- Prioritas: Phase 3 (schema) → Phase 6 (custom domain/CORS/policy).
- Semua test lulus (`go test ./...`).