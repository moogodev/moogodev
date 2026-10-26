# TODO — Sisa R2/S3 Compatibility (belum selesai)

## Phase 1 — HMAC SigV4 (butuh Option A / secret reversibility)
- [ ] Pilih Option A (secret reversible/encrypted at rest) atau tetap Option B.
- [ ] Implement canonical request + signing key derivation + signature compare.
- [ ] Expiry check (X-Amz-Date + Expires).
- [ ] SignedHeaders validation.
- [ ] Credential scope validation (us-east-1/s3/aws4_request).
- [ ] Presigned PUT/GET/HEAD via query auth.

## Phase 3 — Bucket Namespace / schema migration
- [ ] Migrasi schema `UNIQUE(bucket_id, key)` (ganti `UNIQUE(project_id, key)`).
- [ ] Update semua query store (ObjectByKey, DeleteObject, PutObject, ListObjects) pakai bucket_id.
- [ ] Bucket existence check error handling lebih baik.
- [ ] Bucket-level isolation end-to-end.

## Phase 4 — Wire format consistency
- [ ] Konversi error di handler lama (`PublicDownload`, `PresignedUpload`, `serveObject`) ke XML untuk route `/s3/`.
- [ ] S3 error codes lengkap (NoSuchBucket, NoSuchKey, AccessDenied, SignatureDoesNotMatch, dll).
- [ ] `x-amz-id-2` konsisten (sudah di middleware) + verifikasi.
- [ ] ListObjectsV2 XML sudah ✅; perlu CommonPrefixes/NextContinuationToken polish.

## Phase 6 — Optimal
- [ ] CORS per-bucket config.
- [ ] Cache purge real (panggil Cloudflare API, bukan no-op).
- [ ] Custom domain per bucket.
- [ ] Bucket policy.

## Catatan
- Phase 2 & 5 sudah selesai (lihat ROADMAP_R2_S3.md).
- Prioritas: Phase 4 (error XML) → Phase 3 (schema) → Phase 1 (HMAC) → Phase 6.
