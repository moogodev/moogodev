# Moogo.dev — Architecture Decisions

Status: draft, 2026-10-01.

## Keputusan yang sudah dikunci

| # | Keputusan | Alasan |
|---|---|---|
| D1 | Cloud-only dulu, self-hosted adalah versi 2 | Validasi produk sebelum menambah beban distribusi |
| D3 | Control plane Moogo = Postgres, data plane pengguna = SQLite | Yang dijual ke pengguna adalah SQLite; Postgres hanya untuk state internal Moogo sendiri |
| D2 | Path routing: `/`, `/app`, `/db`, `/bucket` | Satu origin, jadi nol CORS, satu sertifikat, satu cookie jar |

| D4 | Auth = Google saja (social-first, tanpa password) | GitHub menunda; satu provider berarti satu jalur signup, satu tabel user, tanpa tabel identitas terpisah |
| D5 | Single node | Routing multi-node ditunda, tapi abstraksi interface tetap dipisah |
| D6 | Project ID = UUID, eksplisit di path `/db/{project_id}` | Path bisa jadi kunci routing Caddy nanti tanpa mengubah bentuk API |
| D7 | Bucket terisolasi per project, hard cap 256 MB | Isolasi bawaan; naikkan kuota jadi perubahan config, bukan migrasi |
| D8 | Free tier penuh, tanpa billing | Kolom billing sudah disiapkan di skema, tapi tidak ada kode billing di Phase 1 |
| D9 | Satu email = satu user, maksimum 2 project | Google menjamin email terverifikasi, jadi tidak perlu tabel identitas terpisah atau alur verifikasi email |
| D10 | Secret key ditampilkan sekali di layar pembuatan project, lalu tidak pernah lagi | Ini membatalkan pilihan show/hide. Karena tidak perlu dibaca kembali, key cukup di-hash, tidak perlu enkripsi |

## Konsekuensi yang harus diakomodasi

### C1 — Header `X-Moogo-Project-ID` digantikan oleh path

PRD asli mewajibkan header tersebut. Sekarang project ID ada di URL, jadi header tidak lagi dipakai sebagai selector project. Hanya `Authorization: Bearer <secret>` yang dipakai, supaya tidak ada dua sumber kebenaran yang bisa berbeda antara URL dan header.

### C2 — Bucket butuh katalog di control plane

Bucket per-project berarti tabel `buckets (project_id, name)` di Postgres. Object key tetap murni path di disk: `/data/buckets/{project_id}/{key}`.

### C3 — Dua store tidak bisa di-transact bersama

`create project` berarti insert Postgres, lalu mkdir, lalu inisialisasi file SQLite. Ini bukan transaksi tunggal, jadi pakai saga: Postgres commit dulu sebagai source of truth dengan status `pending`, lalu materialisasi di disk, lalu ubah status jadi `ready`. Reconciler menyapu project yang menggantung di status `pending` saat restart.

### C4 — Endpoint bucket harus bisa diakses publik

Menyajikan file butuh endpoint read-only tanpa header auth, jadi object key pada dasarnya jadi bearer token. Karena kuota 256 MB dan belum ada billing, ini tetap permukaan publik yang wajib di-rate-limit dan diberi guard di gateway.

## Isu terbuka (menunggu jawaban)

- **Q1 (selesai)** — Self-hosted ditunda ke versi 2, jadi control plane tetap Postgres tanpa driver alternatif di Phase 1.
- ~~Q2~~ selesai — GitHub ditunda, Google saja.
- ~~Q3~~ selesai — secret key ditampilkan sekali saat pembuatan project.
- ~~Q4~~ selesai — satu user = satu email, maksimum 2 project.

## Catatan desain untuk keputusan secret key

Tampil sekali berarti hanya ada satu jalur yang pernah melihat nilai mentah: respons `POST /api/projects`. Jadi `secret_key_hash` cukup untuk validasi — tidak ada AES-GCM, tidak ada kunci enkripsi yang bisa hilang, tidak ada kebocoran kalau Postgres ter-dump. Ini lebih sederhana sekaligus lebih aman daripada show/hide.

Kolom pendukung yang tetap perlu: `secret_key_prefix` (8 karakter awal, untuk logging dan supaya user bisa mengidentifikasi key mana yang dipakai) dan `secret_key_rotated_at`.

Konsekuensi ke user: kalau key hilang, tidak bisa dipulihkan, harus di-regenerate. Jadi regenerasi harus jadi endpoint yang jelas, bukan afterthought. Key yang di-regenerate harus langsung membatalkan key lama.