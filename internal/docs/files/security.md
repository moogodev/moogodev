# Security

This page explains how Moogo is built to fail safely, and — just as importantly — what the model does **not** protect you from.

## Multi-tenancy

Each project maps to one SQLite file:

```
 /data/dbs/{project_id}.db
 /data/buckets/{project_id}/{key}
```

Isolasi datang dari filesystem, bukan dari kebijakan. Tidak ada tabel yang
terbagi dan tidak ada kolom `tenant_id` yang lupa dilewati dalam klausa `WHERE`,
karena tidak ada tabel yang terbagi.

### Path divalidasi, tidak dipercaya

`project_id` datang dari URL, dan URL adalah input yang tidak dipercaya. Ia
divalidasi sebagai UUID sebelum terjadi apa pun, dan path di-disk kemudian
dibangun dari komponen yang divalidasi, bukan dikumpulkan dari string mentah.

Itu adalah alasan struktural mengapa path traversal mustahil di sini: tidak ada
kode di mana input mentah menjadi path.

ID yang tidak valid mengembalikan `400 invalid_project_id` sebelum apapun
pengecekan terjadi.

### Kepemilikan diverifikasi per-request

Kepemilikan diverifikasi pada **Setiap permintaan**, bukan hanya sekali di
sign-in.

Akun lain mengembalikan `404`, bukan `403`. `403` akan mengonfirmasi bahwa
projek ada, yang menghadirkan ID di URL sebagai cara untuk menelusuri projek
orang lain. `404` memberitahu penyerang tidak ada sedikit pun tentang projek
tertentu.

## Validasi pernyataan

Karena `/exec` menerima DDL, itu bisa menjadi pemacu baca filesystem host.
Setiap pernyataan **ditokenisasi dan diperiksa sebelum dijalankan**.

### Dicek pada token, bukan pada teks

Pemetaan terjadi setelah tokenisasi, bukan dengan pencarian substring. Hal ini
perlu karena: tabel bernama `attachments` tidak mengandung kata kunci `ATTACH`
secara kata, karena `ATTACH` muncul sebagai bagian dari identifikator yang
panjang rather than sebagai kata sendiri.

`strings.Contains(text, "ATTACH")` naive akan menolak `SELECT * FROM
attachments`. Pemeriksa berbasis token tidak melakukannya.

Kecuali nama **fungsi yang diblokir**, yang cocok di mana saja mereka muncul —
termasuk sebagai nama kolom. Kolom dengan nama `readfile` benar-benar ditolak.
Ini adalah perdeliberatan: kolom yang nama-nya membingungkan adalah biaya yang
kecil dibandingkan baca `/etc/passwd`.

### Daftar yang ditolak

| Kategori | Item |
|---|---|
| Akses file | `ATTACH`, `DETACH` |
| Tulis ulang utuh | `VACUUM`, `REINDEX`, `ANALYZE` |
| Kontrol transaksi | `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE` |
| Bawaan filesystem | `readfile`, `writefile`, `load_extension`, `edit`, `fts3_tokenizer`, `sqlite_compileoption_get`, `sqlite_compileoption_used` |
| Trigger | `CREATE TRIGGER` |
| Pragma penulis file | Apa saja yang tidak ada di [daftar izinkan](/docs/sql-api#pragma) |

`ATTACH` adalah yang penting: membuka database acak sebagai path, yang akan mengubah
endpoint tulis menjadi pembaca file untuk seluruh host.

`PRAGMA` **dipilihizinkan rather than diblokir**, karena banyak pragma menulis ke
file (`journal_mode`, `key`, `rekey`, `page_size`, `auto_vacuum`,
`synchronous`) dan daftar blokir harus meramalkan semua dari mereka.

### Trigger ditolak pada tujuan

Body trigger berada antara `BEGIN` dan `END` dan berisi titik koma, sehingga
membedakan titik koma trigger dari stacked statement memerlukan parser nyata yang
melacak nesting. Estimasi tangan adalah persekatan yang tepat jenis pemeriksaan
yang gagal terbuka pada input SQLite yang diterima tetapi kode tidak.

Trigger ditolak daripada dikirimkan pemeriksa yang mungkin salah. Tulis invarian
anda di kode aplikasi.

## Hanya prepared statements only

Nilai selalu melalui parameter bound:

```json
{ "query": "SELECT id FROM users WHERE email = ?", "args": ["ketut@example.com"] }
```

Mesin hanya pernah melihat pernyataan parameterisasi, jadi **nilakan pernah menjadi
syntax**. Ini bukan "injection mostly prevented" — pada jalur ini strukturally
mustahil.

Field JSON yang tidak dikenal ditolak rather than diabaikan. Pengirim `{"argz": [...]}`
kesalahan, tidak keberhasilan yang sunyi tidak melakukan apa-apa.

## Penyimpanan rahasia

| Kredensial | Disimpan |
|---|---|
| Kunci proyek | SHA-256 hash + 8-character prefix |
| Rahasia penyimpanan | SHA-256 hash + 6-character preview |
| Kata sandi | Hash dengan garam |

Plaintext muncul dalam respons tepat satu — create atau rotate yang mengeluarkannya — dan
 tidak pulih kembali setelahnya.

Perbandingan hash adalah **waktu konstan**, sehingga verifikasi tidak leak seberapa
banyak byte yang cocok.

Uji praktis: pengampian database kontrol plane menghasilkan hash, bukan kredensial
yang bekerja. Karena kunci tidak dapat dipulihkan dari awal, tidak ada apa-apa
untuk attacker reverse-engineer.

SHA-256 tanpa garam benar untuk hash-hash ini khusus: rahasia sudah memiliki
256 bit entropy dari `crypto/rand`, sehingga tidak ada ruang tebakan bagi garam
untuk menutup.

## Kredensial sudah difilter

Kunci proyek menjalankan SQL. Kredensial penyimpanan memindahkan file. Dashboard
menggunakan sesi. **Tidak ada dari mereka bekerja untuk yang lainnya.**

Bukanlah birokrasi. Kunci yang scope untuk menjalankan `SELECT` tidak harus
dapat menuliskan setiap file di proyek, dan rotasi kunci SQL tidak harus
sendengar putus setiap aplikasi yang berjalan.

## Sesi bisa dicabut

Sesi dashboard adalah token yang ditandai dengan **epoch** — counter yang
disimpan pada akun. Setiap permintah yang autentik membandingkan epoch token
dengan epoch saat ini akun, dan ketidakcocokan gagal tertutup: tidak ada baris,
tidak ada sesi.

**Keluar login menaikkan epoch.** Satu klik dari setiap perangkat pensiun setiap
sesi yang dimiliki akun, di mana saja sekaligus. Browser lain tidak perlu
direach; token-t mereka hanya berhenti diverifikasi pada permintaan selanjutnya.

Menghapus akun adalah kegagalan dari arah lain: tidak ada akun yang baca dari
epoch, sehingga setiap sesi ditandai pada dirinya gagal.

## URL publik objek

Objek yang dipublikasi dapat dibaca di `/pub/{project_id}/{key}` tanpa kredensial,
sesuatu, dan cookie.

Objek **private** mengembalikan `404` di sana — bukan `403` — sehingga tidak
terdistinguish dari satu yang tidak ada. Mengingat kunci mempelajari tidak
mendapat apa-apa dari respons.

Mengerti apa yang berarti publishing sebelum melakukannya: **URL publik adalah
token membawa.** Siapa pun yang memiliki tautan memiliki file, dan Anda tidak
bisa membuatnya privat lagi tanpa mengubah URL.

## Header respons

Setiap respons membawa:

| Header | Nilai |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; tidak ada skrip inline, own origin untuk frames and connections; images dari own origin, `data:`, atau `https:` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | Hanya atas HTTPS |
| `Cache-Control` | `no-store` pada `/api/`, `/p/`, `/db/`, `/bucket/`, `/auth/` |

`no-store` penting karena dashboard menampilkan material rahasia pada create dan
rotate. Respons body yang di-cache akan menyerahkannya kepada siapa saja yang
bertanya setelahnya.

HSTS hanya dikirim atas HTTPS, sehingga lokal development atas plain HTTP tidak
meninggalkan browser menolak untuk mencapai situsnya setelahnya.

## Pesan kesalahan

Kesalahan tidak leak internals.

`detail` pada SQL error membawa pesan driver, yang dapat menyebutkan tabel dan
kolom — berguna untuk Anda, dan tidak revealing tentang host. Kesalahan internal
mengembalikan pesan umum, dan panic tidak mengembalikan apa-apa gunakan.

## Model ini tidak melindungi

Being clear about this is more useful than a reassuring summary.

- **Kunci bocor works.** Jika kunci proyek Anda terkompromi, attacker memiliki
  database hingga Anda rotasi. Tidak ada IP allowlist, tidak ada per-IP rate limit
  di lapisan aplikasi, dan tidak ada cara untuk membatasi kunci ke IP. Rotasi
  adalah mitigasi, dan ia cepat.
- **URL publik tidak bisa dicabut.** Hanya URL yang mengandungnya yang bisa
  diubah.
- **Tidak ada enkripsi di resting.** File database dan objek yang disimpan adalah
  plaintext di disk. Proteksi di sini bergantung pada host dan disk-level access
  control.
- **Tidak ada multi-factor authentication.** Satu email dan password adalah
  seluruh model keamanan akun.
- **Rate limits are ceilings, not traffic shaping.** Data plane memungkinkan 300
  request menit — queries per project, storage operations per client address —
  cukup untuk menghentikan klien runaway atau stolen key menyenggangi host, tidak
  cukup untuk shape penggunaan ordinari. Endpoint sign-in (`/auth/login`,
  `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`,
  `/auth/verify-email`, `/auth/resend-verification`) berbagi 10 upaya menit
  per client address, karena mereka adalah satu-satunya yang bisa dilanda oleh
  pemanggil unauthenticated. Daftar update dashboard dibaca, `GET /api/updates`,
  mendapatkan 60 menit per address sekalipun — public, tetapi setiap panggilan
  bisa menghabiskan hingga tiga detik menunggu pada news service — dan melayani
  jawaban yang menit kuno, sehingga news service melihat paling satu fetch menit.
  `429` membawa header `Retry-After`.
- **SQLite writes are serialised per project.** Ini adalah properti mesin, bukan
  sesuatu Moogo konfigurasi. Tulisans concurrently tinggi akan antrean.

## Berjalan di balik proxy

Jika deployment berada di balik reverse proxy — Caddy, nginx, load balancer —
maka `MOOGO_TRUSTED_PROXIES` harus mencantumkan alamat proxy:

```
MOOGO_TRUSTED_PROXIES=127.0.0.1,::1
```

Tanpa itu, setiap permintaan terlihat seperti datang dari proxy, sehingga batas
per-client akan memperlakukan semua pengunjung sebagai satu pemanggil dan satu
bucket akan kunci semua orang sekaligus.

Ini adalah daftar alamat atau CIDR ranges — `127.0.0.1` dan `10.0.0.0/24` adalah
masukannya yang valid. Moogo percaya `X-Forwarded-For` hanya ketika permintaan
sampai dari satu dari mereka; dari siapa pun lainnya header diabaikan, sehingga
pemicu tidak dapat memilih identitas mereka sendiri untuk meloloskan batas atau
menyakiti log akses. Ketika header dipercaya, rantai di dalamnya dibaca dari
kanan ke kiri melewati proxy yang tercatat, sehingga entri yang dikirim klien
sendiri tidak boleh outweigh alamat proxy yang ditambahkan. Jangan daftarkan
`0.0.0.0` atau `::` — itu sama dengan mempercayai semua.

## Mengeluhkan kerentanan

Jika Anda menemukan sesuatu yang keliru, silakan
[lapor it](/docs/feedback). Laporan keamanan ditangani dengan prioritas, dan Anda
akan mendapatkan pengakuan.