# Progress Tracker — Moogo.dev

Terakhir diperbarui: 2026-10-02
Status: **Auth email/password (register, login, lupa/reset password) selesai dengan Resend; bucket, konsol SQL + penjelajah tabel (termasuk pembuat/editor tabel ala SQLite viewer), docs Markdown, dan halaman setup OAuth selesai. Sudah diverifikasi end-to-end terhadap Postgres nyata. Sisa: rate limit, Dockerfile.**

Rincian tiap progress ada di file terpisah:

| # | Progress | Status | Berkas tracker |
|---|---|---|---|
| 1 | Fondasi & konfigurasi | selesai | [00_fondasi_dan_konfigurasi.md](00_fondasi_dan_konfigurasi.md) |
| 2 | Skema control plane Postgres | selesai | [00_fondasi_dan_konfigurasi.md](00_fondasi_dan_konfigurasi.md) |
| 3 | Data access control plane | selesai | [00_fondasi_dan_konfigurasi.md](00_fondasi_dan_konfigurasi.md) |
| 4 | Pembuatan secret key | selesai | [00_fondasi_dan_konfigurasi.md](00_fondasi_dan_konfigurasi.md) |
| 5 | Sanitizer SQL | selesai | [01_sanitizer_sql.md](01_sanitizer_sql.md) |
| 6 | Engine SQLite per-project | selesai | [02_engine_sqlite.md](02_engine_sqlite.md) |
| 7 | Autentikasi Google | selesai | [03_autentikasi.md](03_autentikasi.md) |
| 8 | HTTP server | selesai | [04_http_server.md](04_http_server.md) |
| 9 | Routing | selesai untuk API, bucket belum | [05_routing.md](05_routing.md) |
| 10 | Entry point & rekonsiliasi | selesai | [06_entrypoint.md](06_entrypoint.md) |

---

## Status kode

`go build ./...`, `go vet ./...`, dan `go test ./...` semuanya bersih.

| Paket | Baris | Test lulus |
|---|---|---|
| `pkg/sanitizer` | 756 | 78 |
| `pkg/session` | 190 | 16 |
| `pkg/httpx` | 290 | 15 |
| `pkg/logger` | 177 | 0 |
| `pkg/secretkey` | 83 | 0 |
| `internal/config` | 245 | 0 |
| `internal/dbcontrol` | 1.312 | 16 |
| `internal/dbplane` | 576 | 12 |
| `internal/auth` | 621 | 28 |
| `internal/handler` | 1.221 | 58 |
| `internal/router` | 280 | 39 |
| `internal/app` | 330 | 0 |
| `cmd/api` | 120 | 0 |
| `web` | 23 | 0 |
| `web/ui` (React + TypeScript) | 1.520 | 0 |

Total: 6.227 baris Go, 3.441 baris test Go, 1.520 baris frontend (React), **265 test lulus**.

## Yang sudah bisa dilakukan

- `POST /db/{id}/query` dan `/exec` dengan project key, sanitizer, prepared
  statement, batas ukuran, dan batas waktu
- `POST /api/projects` membuat project dua tahap: row Postgres lalu file SQLite
- `GET /api/me`, daftar, detail, rotasi key, hapus, audit log
- OAuth Google: redirect, callback, cookie session, logout, probe session
- Auth email/password: register, login, lupa password, reset password; hash
  bcrypt, token reset sekali-pakai + berbatas waktu, email via Resend
  (`RESEND_API_KEY`; tanpa key, email dicatat di log). Login tidak membocorkan
  apakah email terdaftar (anti enumerasi).
- Migrasi otomatis dengan advisory lock dan verifikasi checksum
- Reconciler untuk project yang menggantung, scheduler prune activity log
- `/healthz` dan `/readyz`
- Bucket per project: upload, download, hapus, daftar object, kuota storage 256 MB
- Dashboard ala Supabase di `/app`: sidebar, batas 2 project, modal secret key
  tampil sekali, dan detail project (PROJECT_ID, PROJECT_URL, SECRET_KEY)
- Konsol SQL dan penjelajah tabel di dashboard (`/app/projects/{id}`): jalankan
  query/exec, lihat skema dan isi tabel; key disimpan di localStorage browser
- Editor tabel ala SQLite viewer di tab Database: buat tabel baru lewat form
  (nama kolom, affinity, default, satu PK, AUTOINCREMENT), tambah/rename/drop
  kolom, rename/drop tabel. DDL yang dihasilkan diperlihatkan sebelum dijalankan
- Docs dari Markdown yang di-embed (`internal/docs`), dirender di `/docs`
- Halaman setup OAuth saat credential Google belum diisi
- Frontend React (landing, login, dashboard, konsol SQL, docs) di `web/ui`, hasil build `web/dist` di-embed

## Yang belum

- [ ] Dockerfile dan compose untuk Postgres lokal
- [ ] Rate limit
- [ ] Verifikasi domain `moogo.dev` di akun Resend (langkah di luar kode)

## Peringatan

Sudah dijalankan terhadap Postgres nyata (Postgres 17 lokal, port sementara):
migrasi 0001–0003 berhasil, dan alur register → login → lupa → reset password
diverifikasi end-to-end via HTTP (termasuk token sekali-pakai dan password
lama yang tidak lagi berlaku). Integrasi Resend terkonfirmasi sampai batas
API: key valid, format request benar; yang tersisa hanyalah verifikasi domain
`moogo.dev` di akun Resend (Resend menjawab 403 "domain is not verified").
Yang belum terbukti: callback OAuth dengan kredensial Google asli, dan perilaku
shutdown di bawah beban.

## Keputusan yang sudah dikunci

Rincian lengkap di [`docs/DECISIONS.md`](../docs/DECISIONS.md). Ringkas:

- Cloud-only dulu, self-hosted versi 2
- Path routing, bukan subdomain
- Control plane Postgres, data plane SQLite
- Auth Google + email/password (password opsional per akun; akun Google murni
  tetap tanpa password)
- Single node
- UUID di path
- Bucket per project, 256 MB
- Free tier, tanpa billing
- Secret key tampil sekali, cukup di-hash
- Satu email = satu user, maksimal 2 project

## Yang belum diputuskan

- Bentuk final bucket: apakah satu bucket per project, dan apakah object key
  boleh memuat `/`. Skema saat ini mendukung banyak bucket per project dengan
  key unik lintas bucket, sedangkan route di PRD tidak menyebut nama bucket.
- Alur secret key di dashboard. **Sudah diputuskan:** dashboard meminta key
  ditempel dan menyimpannya di `localStorage` per project (bukan di server),
  lalu mengirimnya sebagai bearer token ke origin sendiri. Server tetap hanya
  menyimpan hash.