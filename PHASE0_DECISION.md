# Phase 0 — Keputusan Arsitektur (2026-10-26)

## Blocker #1: Storage Secret Reversibility
Status: Secret disimpan sebagai bcrypt hash (irreversible). SigV4 HMAC memerlukan secret asli.

## Karar: Option B — Fail-Closed / Native Auth
- Tidak mengubah skema secret (tidak perlu KMS / encrypt-at-rest).
- SDK menggunakan Bearer (`moogo_sk_`) — sudah diimplementasikan.
- `s3Download` / `/s3/*` menggunakan native auth header, bukan pure AWS SigV4.
- R2-like (API shape mirip), bukan R2-compatible murni (§ Phase 1 HMAC verification deferred).

## Impact
- Phase 1 (HMAC verify): DIEMBANGKAN / deferred hingga Option A diputuskan.
- Phase 2 + 4 (API coverage + wire format): dilanjutkan tanpa secret change.
- Phase 3 (namespace): perlu schema migration terpisah.
=== Decision locked ===
Option B (Native/Bearer auth) — Phase 1 deferred.

## Phase Roadmap (dengan Option B)
- Phase 0 ✅ keputusan + dokumen (commit ab551df)
- Phase 2-4-5 ✅ dugaan perbaikan sebelumnya (Bug P0-P2, SDK 0.2.4, SQLite opt)
- Phase 2 API: ListObjectsV2 / DeleteObject masih dibangun (router DELETE placeholder). Copy/batch ditunda.
- Phase 4 XML/Headers: Wire format dasar (internal/auth/sigv4/xml.go ada), belum konsisten semua route.
- Phase 3 schema migration (UNIQUE bucket_id, key): ditunda, besar scope.
