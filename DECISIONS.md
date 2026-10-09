# Moogo.dev — Architecture Decisions

Status: draft, 2026-10-01; diperbarui 2026-10-09.

## Keputusan yang sudah dikunci

| # | Keputusan | Alasan |
|---|---|---|
| D1 | Cloud-only dulu, self-hosted adalah versi 2 | Validasi produk sebelum menambah beban distribusi |
| D3 | Control plane Moogo = Postgres, data plane pengguna = SQLite | Yang dijual ke pengguna adalah SQLite; Postgres hanya untuk state internal Moogo sendiri |
| D2 | Path routing: `/`, `/app`, `/db`, `/bucket` | Satu origin, jadi nol CORS, satu sertifikat, satu cookie jar |

| D4 | Auth = Google + email/password | GitHub menunda, jadi Google satu-satunya provider OAuth. Keputusan awal "Google saja, tanpa password" berubah setelah alur email/password dengan verifikasi email dibangun; kedua jalur tetap memakai satu tabel user, tanpa tabel identitas terpisah |
| D5 | Single node | Routing multi-node ditunda, tapi abstraksi interface tetap dipisah |
| D6 | Project ID = UUID, eksplisit di path `/db/{project_id}` | Path bisa jadi kunci routing Caddy nanti tanpa mengubah bentuk API |
| D7 | Bucket terisolasi per project, hard cap 256 MB | Isolasi bawaan; kuota adalah batas produk yang tertulis di UI dan prompt, jadi tidak bisa dinaikkan lewat env |
| D8 | Free tier penuh, tanpa billing | Kolom billing sudah disiapkan di skema, tapi tidak ada kode billing di Phase 1 |
| D9 | Satu email = satu user, maksimum 2 project | Google menjamin email terverifikasi; untuk daftar via email/password, verifikasi lewat link sekali pakai pada kolom `email_verified_at` mengambil peran yang sama. Tetap tanpa tabel identitas terpisah |
| D10 | Secret key ditampilkan sekali di layar pembuatan project, lalu tidak pernah lagi | Ini membatalkan pilihan show/hide. Karena tidak perlu dibaca kembali, key cukup di-hash, tidak perlu enkripsi |
| D11 | `http.Server` sengaja tanpa `ReadTimeout`/`WriteTimeout`; yang dibatasi hanya `ReadHeaderTimeout` | Timeout net/http membatasi total waktu permintaan/respon, jadi nilai yang cukup kecil untuk mencegah koneksi macet pasti memotong upload 256 MB atau query yang jalan penuh 15 detik. Yang dibutuhkan adalah timeout antar-byte (gap-based) — itu urusan edge: `client_body_timeout`, `send_timeout`, `proxy_read_timeout` yang ditulis deploy.sh untuk nginx yang dikelolanya; di balik Cloudflare Tunnel deploy.sh tidak menulis nginx apa pun, jadi operator memasang tiga direktif itu sendiri (checklist di deploy-guide.md). Komentar di `internal/app/app.go` mencatat alasan ini agar tidak dikembalikan |
| D12 | Login/logout mengirim dua header `Set-Cookie` bila `MOOGO_COOKIE_DOMAIN` di-set: satu varian host-only di-expire dulu, lalu satu varian dengan domain | Cookie host-only dan cookie domain adalah dua entitas berbeda di mata browser; varian lama harus diberi `Max-Age=0` di respons yang sama, atau ia tetap duduk di sebelah varian baru dan menang di host yang mengeluarkannya (sesi lama terbaca sesudah logout). Tanpa domain hanya satu header yang keluar. Wontfix sebagai "bug ganda" — ganda ini memang mekanismenya, diuji di `auth_test.go` |

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
- ~~Q2~~ selesai — GitHub ditunda; Google satu-satunya provider OAuth.
- ~~Q3~~ selesai — secret key ditampilkan sekali saat pembuatan project.
- ~~Q4~~ selesai — satu user = satu email, maksimum 2 project.

## Catatan desain untuk keputusan secret key

Tampil sekali berarti hanya ada satu jalur yang pernah melihat nilai mentah: respons `POST /api/projects`. Jadi `secret_key_hash` cukup untuk validasi — tidak ada AES-GCM, tidak ada kunci enkripsi yang bisa hilang, tidak ada kebocoran kalau Postgres ter-dump. Ini lebih sederhana sekaligus lebih aman daripada show/hide.

Kolom pendukung yang tetap perlu: `secret_key_prefix` (8 karakter awal, untuk logging dan supaya user bisa mengidentifikasi key mana yang dipakai) dan `secret_key_rotated_at`.

Konsekuensi ke user: kalau key hilang, tidak bisa dipulihkan, harus di-regenerate. Jadi regenerasi harus jadi endpoint yang jelas, bukan afterthought. Key yang di-regenerate harus langsung membatalkan key lama.

## Catatan desain untuk batas upload

Tiga batas berlaku pada satu request upload, dan ketiganya beda disengaja:

| Batas | Nilai | Yang dijaga |
|---|---|---|
| `MOOGO_MAX_BODY_BYTES` | 1 MiB | Body JSON: statement SQL, body rename, body setelan bucket |
| `MOOGO_MAX_OBJECT_BYTES` | 256 MiB | Satu request upload |
| `MOOGO_MAX_STORAGE_BYTES` | 256 MiB | Total seluruh object dalam satu project |

Batas body JSON sengaja tetap kecil dan terpisah dari batas object. Kalau keduanya berbagi satu angka, upload terpotong oleh cap yang dirancang untuk statement SQL, sehingga project dengan kuota 256 MiB tidak pernah bisa menerima file lebih besar dari 1 MiB, dan kuotanya jadi angka yang tidak bisa terpakai.

Body JSON juga dibatasi sendiri di dalam `httpx.ReadJSON`, jadi menaikkan batas route tidak membuat endpoint JSON ikut menerima body sebesar upload.

Plafon 256 MiB ditulis sebagai konstanta, bukan hanya default. Angkanya muncul di dashboard, di prompt yang diserahkan ke coding assistant, dan di jawaban atas "kenapa upload saya gagal", sehingga ketiganya harus angka yang sama. Env yang nilainya lebih besar ditolak saat start: clamp diam-diam membuat operator mengira kuota 1 GB sudah aktif padahal upload tetap berhenti di 256 MiB.

Policy per bucket (`allowed_types`, `max_object_size_bytes`) ditegakkan di server, bukan hanya di file picker dashboard. Client API tidak pernah membuka dialog tersebut, jadi pengecekan di browser hanya memberitahu lebih awal, bukan penjaga.

Overwrite mengurangi total: ukuran versi lama dihitung sebagai ruang yang kembali, sehingga project yang sudah 90% penuh masih bisa mengganti file dengan file yang lebih kecil.
