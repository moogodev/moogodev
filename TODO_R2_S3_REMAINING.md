# TODO — Sisa R2/S3 Compatibility (belum selesai)

## Phase 3 — Bucket Namespace / schema migration (DEFERRED - scope besar)
- [ ] Migrasi schema `UNIQUE(bucket_id, key)` (ganti `UNIQUE(project_id, key)`).
- [ ] Ubah path storage ke `project/bucket/key` (FileSystem interface).
- [ ] Update semua query store (ObjectByKey, DeleteObject, PutObject, ListObjects) pakai bucket_id.
- [ ] Bucket existence check error handling lebih baik.
- [ ] Bucket-level isolation end-to-end.

## Phase 6 — Optimal
- [x] CORS per-bucket config (storage + model + handler).
- [x] Cache purge real (Cloudflare) — env config.
- [x] Custom domain per bucket (storage + model + handler).
- [ ] Bucket policy (advanced) — sudah ada allowed_types.

## Phase 4 — Wire format consistency
- [x] XML error konsisten di semua /s3/ route.
- [x] S3 error codes lengkap.
- [x] x-amz-id-2 konsisten.
- [x] ListObjectsV2 XML + continuation + CommonPrefixes.

## Phase 1 — HMAC SigV4
- [x] Option A encrypted secret.
- [x] HMAC verification.
- [x] Presigned SigV4 real signature.

## Catatan
- Prioritas: Phase 3 (butuh perubahan path storage besar).
- Semua test lulus (`go test ./...`).