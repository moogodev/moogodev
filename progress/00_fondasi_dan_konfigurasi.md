# Progress Tracker — Moogo.dev

Terakhir diperbarui: 2026-10-01
Status keseluruhan: **5 dari 10 progress selesai**

---

## 1. Fondasi & Konfigurasi — SELESAI

Berkas:
- `internal/config/config.go` (239 baris)
- `pkg/logger/logger.go` (168 baris)
- `go.mod` — chi v5, pgx v5, modernc.org/sqlite, oauth2, uuid, x/crypto

Yang sudah dikerjakan:
- Config dari environment dengan default aman untuk pengembangan lokal
- Enam variabel tanpa default dan wajib diisi: `MOOGO_DATABASE_URL`,
  `MOOGO_GOOGLE_CLIENT_ID`, `MOOGO_GOOGLE_CLIENT_SECRET`, `MOOGO_SESSION_SECRET`
- Validasi menolak `MOOGO_COOKIE_SECURE=false` di produksi, session secret
  kurang dari 32 karakter, connection pool tidak konsisten
- Error agregat: semua masalah dilaporkan sekaligus, bukan hanya yang pertama
- Logger JSON satu baris per entri, dengan `Info(msg, Fields)`instead of
  variadic key-value agar salah eja ketahuan compiler

Belum:
- [ ] Unit test config

---

## 2. Skema Control Plane Postgres — SELESAI

Berkas:
- `internal/dbcontrol/migrations/postgres/0001_init.sql`
- `internal/dbcontrol/migrations/postgres/0002_bucket_objects.sql`

File SQL pindah ke dalam package karena `go:embed` hanya bisa membaca file di
dalam atau di bawah direktori package yang memanggilnya.

Yang sudah dikerjakan:
- Tabel `users`, `projects`, `buckets`, `bucket_objects`, `activity_logs`
- Semua primary key bertipe UUID, termasuk `activity_logs.id`
- Kolom kuota (`quota_max_*`) dan billing sudah disiapkan di skema supaya
  penambahan billing tidak butuh migrasi destruktif
- Constraint `CHECK` menolak parent traversal pada object key di level storage,
  jadi bug di layer atas tetap tidak bisa keluar dari root project
- Trigger `updated_at` supaya tidak harus di-set manual di tiap UPDATE
- `ON DELETE CASCADE` untuk data turunan, `SET NULL` untuk audit supaya log
  tetap ada setelah project dihapus

Runner migrasi sudah ada, dikerjakan di progress 10:
- `internal/dbcontrol/migrate.go` — advisory lock, satu file satu transaksi,
  verifikasi checksum
- `internal/dbcontrol/embed.go` — `go:embed`, jadi binary tidak bergantung file
- Tabel `schema_migrations` dibuat dan diisi saat startup

---

## 3. Data Access Control Plane — SELESAI

Berkas:
- `internal/dbcontrol/store.go` (99 baris)
- `internal/dbcontrol/models.go` (103 baris)
- `internal/dbcontrol/user.go` (126 baris)
- `internal/dbcontrol/project.go` (336 baris)
- `internal/dbcontrol/bucket.go` (259 baris)
- `internal/dbcontrol/activity.go` (100 baris)

Yang sudah dikerjakan:
- Pool dengan batas koneksi dan health check
- `CreateProject` memakai `SELECT ... FOR UPDATE` pada baris user, jadi dua
  request bersamaan tidak sama-sama lolos dari batas 5 project
- `ProjectOwnedBy` membuat "tidak ada" dan "bukan milikmu" sengaja tidak
  bisa dibedakan, supaya UUID project orang lain tidak bisa diprobe
- Soft delete: kuota langsung bebas, penghapusan file tetap bisa diaudit
- `PutObject` memakai CTE supaya ukuran lama tertangkap sebelum upsert
  menimpa, supaya kuota tidak terhitung dua kali
- `PruneActivity` ada supaya tabel audit tidak jadi penyebab disk penuh
- Projection dan scan disatukan per entitas, tiga jalur baca tidak bisa
  berbeda jauh satu sama lain

Belum:
- [ ] Unit test (butuh Postgres, pakai testcontainer atau instance lokal)
- [ ] `dbproxy` sudah dihapus, tidak dibutuhkan

---

## 4. Pembuatan Secret Key — SELESAI

Berkas:
- `pkg/secretkey/secretkey.go` (83 baris)

Yang sudah dikerjakan:
- 32 byte dari `crypto/rand`, format `moogo_<base64url>`
- SHA-256 tanpa salt, dengan alasan yang ditulis di komentar: key-nya sendiri
  sudah 256 bit entropy, jadi salt tidak menambah apa pun
- Perbandingan constant-time lewat `subtle.ConstantTimeCompare`
- Prefix 8 karakter tersimpan terpisah untuk identifikasi di log
- Hanya di-hash, bukan di-enkripsi — sesuai keputusan secret key tampil sekali

Belum:
- [ ] Unit test

---

## 5. Sanitizer SQL — BELUM SELESAI

Target: `pkg/sanitizer/`

Ini bagian keamanan paling kritis dan belum ada sama sekali. Tanpa ini,
`/db/{id}/exec` menjadi file-read primitive untuk seluruh server lewat
`ATTACH DATABASE '/etc/passwd'`.

Rencana implementasi:
- Tokenisasi SQL lebih dulu, lalu periksa token — **bukan** `strings.Contains`,
  karena itu menolak nama tabel atau string yang kebetulan sama
- Tolak `ATTACH` / `DETACH`
- Tolak `readfile`, `writefile`, `load_extension`
- Satu statement per request, deteksi titik koma di luar string literal
- Periksa kata kunci di posisi yang benar, bukan kemunculan anywhere

Belum:
- [ ] Tokenizer
- [ ] Deteksi multi-statement
- [ ] Daftar keyword terlarang + posisi yang valid
- [ ] Unit test, termasuk kasus
   
---

## 6. Engine SQLite per-Project — BELUM SELESAI

Target: `internal/dbplane/`

Rencana implementasi:
- `modernc.org/sqlite` (CGO-free) dengan `journal_mode=WAL` dan
  `foreign_keys=ON` di setiap koneksi
- Satu koneksi per project, bukan connection pool global, supaya jumlah
  handle terbuka bisa dibatasi
- Mutex per project untuk serialize penulisan; query boleh paralel
- `busy_timeout` sebagai jaring pengaman
- Batas 100 MB dicek sebelum dan sesudah eksekusi lewat
  `page_count * page_size`
- Inisialisasi file saat project dibuat: mkdir, buat file, set
  `application_id` dan `user_version`
- Reconciler: menyapu project menggantung saat restart

Belum:
- [ ] Semua

---

## 7. Autentikasi — BELUM SELESAI

Target: `internal/auth/`

Rencana implementasi:
- Google OAuth saja, satu provider
- `state` dicek untuk mencegah CSRF pada callback
- Session cookie `HttpOnly` + `Secure` + `SameSite=Lax`
- `UpsertUserByEmail` sudah tersedia di control plane
- TIDAK ada password, tidak ada reset password

Belum:
- [ ] Semua

---

## 8. HTTP Server — BELUM SELESAI

Target: `pkg/httpserver/`

Rencana implementasi:
- chi router
- Timeout: read, write, idle, shutdown
- Recovery middleware
- Batas ukuran body (`MOOGO_MAX_BODY_BYTES`)
- Request ID

Belum:
- [ ] Semua

---

## 9. Routing — BELUM SELESAI

Target: `internal/router/`

Rencana implementasi:
- `/` landing page
- `/app` dashboard
- `/auth/*` alur OAuth
- `/api/*` control plane
- `/db/{project_id}/*` data plane SQL
- `/bucket/{project_id}/*` data plane storage

Belum:
- [ ] Semua
- [ ] `web/landing` dan `web/dashboard` masih kosong

---

## 10. Entry Point & Rekonsiliasi — BELUM SELESAI

Target: `cmd/api/main.go`

Rencana implementasi:
- Load config, logger, store
- Reconciler untuk project menggantung
- Pruning activity log terjadwal
- Graceful shutdown
- Health check endpoint

Belum:
- [ ] Semua

**Penting:** sampai progress 10 selesai, belum ada file yang bisa dijalankan.
`go build ./...` lolos sekarang hanya karena belum ada entrypoint sama sekali.