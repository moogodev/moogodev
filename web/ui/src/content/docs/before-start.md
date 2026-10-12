# Before Start — Dictionary for Moogo Newbies

Welcome to Moogo! This page helps you who are new to the service understand
the basic concepts, the differences with regular SQLite, and all the terms
you will encounter while using this service.

It is written as a short dictionary/reference to read before starting to build
an application.
Sifatnya kamus/reference singkat yang bisa Anda baca sebelum memulai pembangunan aplikasi.

---

## Apa itu Moogo?

**Moogo adalah hosted backend** yang memberikan setiap project SQLite database sendiri dan object storage, masing-masing dapat diakses melalui plain HTTP.

**Tidak ada connection string, driver, atau database client yang perlu diinstal.**

Yang Andabutuhkan hanya tiga nilai environment:

| Variabel | Contoh | Keterangan |
|----------|--------|------------|
| `MOOGO_PROJECT_URL` | `https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0` | Base URL untuk semua request SQL |
| `MOOGO_SECRET_KEY` | `moogo_...` | Kunci rahasia untuk authentication SQL endpoint |
| `MOOGO_BUCKET_ENDPOINT` | `https://api.moogo.dev/p/<project-id>/bucket` | Base URL untuk object storage |

Masukkan ketiga variabel ini ke aplikasi Anda, dan Anda sudah bisa membaca dan menulis data melalui HTTP request saja.

---

## SQLite over HTTP vs SQLite Biasa

Ini adalah perbedaan fundamental yang harus Anda pahami sebelum mulai:

### SQLite Biasa (Secara Lokal)

- **Mengharuskan driver/database client** terinstall di komputer Anda (contoh: `psql`, `sqlite3`, `pysqlite`, `prisma`, `django-orm`)
- **Koneksi langsung ke file `.db`** di filesystem lokal atau server sendiri
- **Koneksi dalam proses** — aplikasi Anda berkomunikasi langsung dengan file database
- **Single-user write** — SQLite memungkinkan satu penulis pada waktu, butuh library khusus untuk concurrency
- ** Anda tanggung jawab penuh** tentang backup, migration, keamanan, pemantauan ukuran

### SQLite over HTTP (Moogo)

- **Tidak butuh driver apa pun** — hanya perlu `fetch` atau `curl` dengan HTTP
- **Koneksi melalui HTTP endpoint** — aplikasi mengirim request ke `https://api.moogo.dev/...`
- **Arsitektur dua tingkatan (two-tier):**
  - **Control plane:** PostgreSQL yang mengelola accounts, projects, quotas, bucket catalog
  - **Data plane:** SQLite per-project, menyimpan data aktual Anda
  - **Kedua plane tidak pernah bercampur** — bug di control plane tidak bisa sampai data di data plane
- **Isolasi fisik:** Setiap project memiliki file `.db` sendiri di `/data/dbs/{project_id}.db`. Tidak ada shared table, tidak ada shared buffer pool.
- **Aktivitas dilaporkan** — setiap limit (250 MB, 15 detik, 1 MB request body) dikembalikan dalam response API, bukan "hanged tab" atau "surprise bill"
- **No SDK needed** — cukup `curl` dengan header `Authorization: Bearer ...` dan `Content-Type: application/json`
- **Honest limits** — setiap batas dilaporkan oleh API, jadi Anda tahu kapan Anda melampaui batas

**Ringkasnya:** SQLite biasa = install driver + koneksi file local. Moogo = hanya HTTP request + environment variables, dan semua infrastruktur dikelola oleh Moogo.

---

## Dictionary of Important Terms

Berikut adalah kamus istilah-istilah yang akan Anda temui saat menggunakan Moogo. Dibaca seperti kamus kamus, satu per satu.

### Database & Project

| Istilah | Definisi |
|---------|----------|
| **Project** | Unit terisolasi dalam Moogo. Setiap project memiliki database SQLite sendiri dan bucket storage. Sama seperti "project" di GitHub atau Firebase — setiap project memiliki settingan dan kredensial sendiri. |
| **Project URL** | Alur utama untuk request SQL. Format: `https://api.moogo.dev/p/{project_id}`. Projek ID adalah UUID yang unik. |
| **Project ID** | Identifikasi unik project dalam format UUID (contoh: `8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0`). Digunakan di URL dan untuk memastikan akses hanya milik pemilik project. |
| **Secret Key** | Kunci rahasia `moogo_...` yang diberikan saat project dibuat. Digunakan untuk authentication di endpoint SQL. **Jangan pernah** sisipkan di kode client-side (browser) karena akan terlihat oleh siapa pun yang menginspect kode. |
| **Control Plane** | Lantai atas layanan yang mengelola hal "admin": accounts, project creation, quota management, bucket catalog, activity logs. Berjalan di PostgreSQL. **Jangan pernah** gunakan project key ini untuk operasi data. |
| **Data Plane** | Lantai bawah yang menyimpan data aktual Anda di SQLite database per-project. Semua query `SELECT`, `INSERT`, `UPDATE`, `DELETE` dilakukan di sini. |
| **Isolasi** | Karena setiap project punya file `.db` sendiri, tidak bisa terjadi "cross-project query" meski tahu project ID lawas. Project lain akan merespons `404`. |

### SQL Endpoint & Statements

| Istilah | Definisi |
|---------|----------|
| **`/query`** | Endpoint hanya untuk **baca (read)**. Kirim `SELECT`, `WITH`, `PRAGMA`, `EXPLAIN` dan serupa. Database akan menolak jika coba kirim `INSERT`, `UPDATE`, `DELETE`. Bisa membawa `args` (parameter posisi). |
| **`/exec`** | Endpoint untuk **tulis (write)** sekaligus sekali. Kirim `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, dll. **Tidak bisa** mengirim `SELECT` ke endpoint ini. |
| **`/transaction`** | Endpoint untuk **sekumpulan pernyataan SQL** sebagai satu unit atomik. Atau **semua commit**, atau **semua rollback**. Penting: maksimal 100 pernyataan, budget 15 detik total. **Jangan pernah** gabungkan DDL besar (membuat banyak tabel) dengan manipulasi data intensif dalam satu transaksi. |
| **`/exec/txn`** | Alias dari `/transaction`. Behaves sama persis. |
| **`isReadStatement()`** | Fungsi internal yang mengenal aperead pernyataan adalah baca (SELECT/VALUES/PRAGMA/EXPLAIN/WITH) atau tulis. Digunakan server untuk menentukan endpoint mana yang harus digunakan. |
| **Parameterized Query** | Query dengan `?` placeholder dan `args` array. **Perlu penting:** **JANGAN pernah** menggantikan `?` dengan nilai langsung (interpolasi string) karena rentu SQL injection. Selalu gunakan format `{"query": "SELECT * FROM users WHERE plan = ?", "args": ["pro"]}`. |
| **DDL (Data Definition Language)** | Pernyataan yang mengubah struktur database: `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`. Dapat dikirim ke `/exec` atau `/transaction`. |
| **DML (Data Manipulation Language)** | Pernyataan yang memanipulasi data: `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Beda endpoint untuk baca vs tulis. |

### Object Storage & Bucket

| Istilah | Definisi |
|---------|----------|
| **Bucket** | Kontainer untuk mengelompokkan object (file) yang memiliki pola penggunaan yang berbeda dalam project. Contoh struktur umum: `avatars` (foto profil), `exports` (file ekspor data), `templates` (template konfigurasi). Setiap bucket memiliki `max_object_size_bytes` dan berperan dalam mengatur quota storage. |
| **Object** | File individual yang disimpan di dalam bucket. Setiap object memiliki key (nama file), size_bytes, content_type, is_public flag. |
| **Key** | Nama file lengkap di dalam bucket. Struktur: `/{prefix}/{filename}`. Contoh: `avatars/kit.png` — di di mana `avatars` adalah nama bucket dan `kit.png` adalah nama file. **Bagian pertama sebelum `/` adalah bagian dari nama bucket.** |
| **Upload** | Proses menaruh object ke bucket via HTTP POST. Harus menambahkan parameter `?bucket=nama_bucket` jika ingin menaruh object ke bucket tertentu (bukan bucket default). Object privat secara default setelah diupload. |
| **Publish** | Mekanisme mengubah object dari privat menjadi baca-baca siapa saja (tanpa kredensial). Setel `is_public: true` melalui PATCH request atau dashboard. Setelah dipublikasikan, `public_url` akan diisi dengan `https://cdn.moogo.dev/pub/{project_id}/{key}` (jika CDN diaktifkan) atau `https://api.moogo.dev/pub/{project_id}/{key}`. |
| **Public URL** | URL yang dapat dibagikan siapa saja tanpa kredensial. **PENTING:** `public_url` bersifat **bearer token** — ini adalah URL yang bisa dibagikan siapa saja dan **tidak bisa direvoke** tanpa mengganti key atau unpublish object. Jika membagikan `public_url`, asalkan object masih dipublikasikan, siapa pun yang memiliki URL bisa mengaksesnya. **Workflow disarankan:** setelah upload, lakukan `PATCH is_public: true` jika ingin object bisa dibaca tanpa kredensial. |
| **`/pub/{project_id}/{key}`** | Path publik untuk object yang dipublikasikan. **Wajib ada `project_id`** di jalur ini. **Jangan pernah gunakan `/pub/{key}` saja**, karena `project_id` adalah bagian wajid untuk mengidentifikasi project. |
| **`max_object_size_bytes`** | Batas maksimal ukuran object per bucket. Jika bucket tidak set size, maka berlianya ceiling project 250 MB. |
| **Storage Quota** | Total storage limit per project: **250 MB** across all buckets. Monitor daily usage, and migrate to a new project before reaching 250 MB. Database does not auto-shrink when data is deleted — requires VACUUM (blocked on Moogo) or progressive row deletion. |

### Error & Code

| Istilah | Definisi |
|---------|----------|
| **Error Code** | Kode machine-readable dalam envelope error response. Contoh: `sql_error`, `database_not_found`, `database_too_large`, `statement_timeout`, `quota_exceeded`, `project_paused`, `project_not_ready`, `body_too_large`, `invalid_json`. **Sangat disarankan** membandingkan `code` daripada `message` untuk branching logika di aplikasi. |
| **Error Message** | Deskripsi manusia-readable tentang kesalahan. Bisa berganti-ganti, jangan bergantung pada pesan ini untuk logika aplikasi. |
| **Error Detail** | Informasi tambahan tentang kesalahan, biasanya nama token atau posisi statement yang bermasalah. |
| **Retryable vs Non-Retryable** | - **Retryable:** `database_busy` — bisa di-retry dengan exponential backoff setelah `PRAGMA busy_timeout`.<br>- **Non-retryable:** `quota_exceeded` — jangan retry, notifikasi pengguna bahwa storage quota habis.<br>- **Tidak bisa di-retry:** `not_found`, `sql_invalid`, `too_many_statements`. |

### Limits & Limits

| Istilah | Batas | Keterangan |
|---------|-------|------------|
| **Database size** | 250 MB per project | Diamukur sebelum setiap write. Diukur `(page_count - freelist_count) * page_size`. |
| **Statement timeout** | 15 detik | Melewati batas menyebabkan `500 timeout`. |
| **Max statements per transaction** | 100 pernyataan | Melewati batas menyebabkan `too_many_statements` error. |
| **Max object size** | Bucket's `max_object_size_bytes` atau 250 MB | Jika bucket set size sendiri, batas itu yang berlaku. |
| **Max request body** | 1 MB | Batas JSON request body untuk endpoint SQL. |
| **Projects per account** | 2 projects | `POST /api/projects` akan response `429 quota_exceeded` untuk project ketiga. |
| **Rows per read response** | Maks 1000 rows atau 16 MB | Jika data lebih banyak, akan truncated dan tandai `truncated: true`. |

### Debug & Tips

| Tips | Keterangan |
|------|------------|
| **Cek `error.code` sebelum `error.message`** | Envelope error konsisten, tapi code lebih stabil untuk branching logika |
| **Gunakan `LIMIT/OFFSET` untuk paging** | Untuk dataset > 100 baris, gunakan halaman kecil (contoh: 50 baris per halaman) daripada `SELECT *` seluruhnya |
| **Hindari `SELECT *`** | Perubahan schema akan memecah klien tanpa migrasi. Selalu nama kolom yang dibutuhkan. |
| **Database tidak menyusut sendirip** | `DELETE` membebaskan halaman, tetapi ruang fisial (`250 MB`) tidak berkurang hingga `VACUUM` dieksekusi (diblokir Moogo). |
| **Monitor Daily Usage** | If approaching 230 MB, migrate to a new project before reaching the 250 MB ceiling. |
| **Cookie session memiliki HttpOnly + Secure + SameSite=Lax** | Mencegah XSS mengambil session dan CSRF lintas situs. |
| **SQL key tidak pernah dikirim ke browser** | Dashboard pakai session cookie, tapi API SQL butuh secret key yang disimpan di sisi server. |
| **Public URL butuh publish terlebih dahulu** | Object privat memiliki `public_url` kosong. Pastikan object sudah dipublikasikan (`PATCH is_public: true`) sebelum membagikan URL-nya. |

---

## Next Steps After Understanding

1. **Buat project** melalui dashboard atau `POST /api/projects`
2. **Ambil 3 environment variables** (`MOOGO_PROJECT_URL`, `MOOGO_SECRET_KEY`, `MOOGO_BUCKET_ENDPOINT`)
3. **Baca section Production Readiness** di guide framework favorit Anda (React, Python, Go, dll)
4. **Coba query sederhana** pertama:
   ```bash
   curl $MOOGO_PROJECT_URL/query \
     -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{"query":"SELECT 1+2 as result","args":[]}'
   ```
5. **Coba upload object** pertama:
   ```bash
   curl -X POST "$MOOGO_BUCKET_ENDPOINT/kit.png?bucket=avatars" \
     -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
     -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \
     -H "Content-Type: image/png" \
     --data-binary @kit.png
   ```
6. **Lakukan publish jika ingin share** tanpa kredensial:
   ```bash
   curl -X PATCH "$MOOGO_BUCKET_ENDPOINT/avatars/kit.png" \
     -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
     -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{"is_public": true}'
   ```

---

## Still Confused?

Jika masih ada istilah yang tidak jelas, lihat dokumentasi referensi berikut:
- `/docs/sql-api` — dokumentasi lengkap endpoint SQL
- `/docs/object-storage` — dokumentasi lengkap storage object
- `/docs/limits` — dokumentasi semua batas dan limit
- `/docs/security` — mengapa aturan keamanan ada
- `/docs/errors` — setiap error code dan penanganannya

---

**Selamat eksplorasi di Moogo!** Jika sudah paham segini, Anda siap membangun aplikasi kecil-menengah dengan cepat. Ingat: bacalah dokumentasi guide framework Anda, dan jaga kebiasaan membandingkan `error.code` bukan `error.message` saat handling error.