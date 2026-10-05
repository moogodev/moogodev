# Product Requirements Document — Moogo.dev

Versi: 1.0 (revisi atas PRD awal)
Tanggal: 2026-10-01
Status: disepakati untuk Phase 1

---

## 1. Ringkasan Produk

Moogo.dev adalah Backend-as-a-Service hosted yang menyediakan database SQLite per-project dan object storage, tanpa konfigurasi server.

Two-tier, dan pemisahan ini adalah inti arsitektur:

- **Control plane — Postgres.** Menyimpan state internal Moogo: akun, project, secret key, kuota, katalog bucket. Tidak pernah menyentuh data pengguna.
- **Data plane — SQLite.** Yang dijual ke pengguna. Satu file `.db` per project di disk.

Perbedaan dari Supabase: Moogo tidak menyewakan Postgres. Yang dialinggam adalah SQLite penuh, satu file per project, dengan kontrol Penuh lewat SQL. Perbedaan dari Turso: Moogo menyediakan file SQLite yang benar-benar lengkap, daneyeiae tidak melakukan replikasi antar-region.

Positioning: Supabase-style DX, SQLite sebagai engine. Dibuat dengan Go dan CGO-free. Satu binary untuk kode layanan, tapi tidak untuk datanya: control plane hidup di Postgres yang terpisah.

### Prinsip

1. **Pure Go.** Tanpa CGO, supaya portability tinggi dan build reproducible.
2. **Resource ringan.** Target host RAM 2 GB.
3. **Always-on.** Tanpa auto-pause, tanpa cold start, tanpa idle timeout.
4. **Serverless-friendly.** Aplikasi serverless adalah konsumen API ini, bukan tempat Moogo berjalan.
5. **Aman secara default.**hawkins Keamanan tidak bisa ditambahkan belakangan tanpa mengubah API.

## 2. Routing

Satu origin. Path routing, bukan subdomain. Konsekuensinya: nol CORS, satu sertifikat TLS, satu cookie jar.

| Path | Fungsi |
|---|---|
| `/` | Landing page |
| `/app` | Dashboard Studio |
| `/auth/*` | Alur OAuth Google |
| `/api/*` | Control plane API |
| `/db/{project_id}/*` | Data plane API (SQL) |
| `/bucket/{project_id}/*` | Data plane API (object storage) |

Subdomain ditunda. Path cukup untuk Phase 1, dan tidak menutup jalan ke routing multi-node nanti karena `project_id` ada di path.

## 3. Multi-tenancy

Setiap project dipetakan ke file database fisik terpisah:

```
/data/dbs/{project_id}.db
/data/buckets/{project_id}/{key}
```

Pemetaan berbasis UUID dari path URL. Tidak ada tabel per-tenant, tidak ada filter `tenant_id` pada query — isolasi datang dari sistem file.

### 3.1 Keamanan pemetaan

`project_id` adalah output dari generator kita, tapi tetap divalidasi server-side sebagai UUID v4, karena path received dari jaringan tidak boleh dipercaya begitu saja. Setelah validasi, path dibangun ulang dari komponen, bukan dari input mentah, sehingga path traversal tidak mungkin terjadi secara struktural.

## 4. Autentikasi

Dua lapisan yang berbeda, tidak boleh dicampur.

### 4.1 Auth dashboard (session)

- Google OAuth saja. GitHub ditunda.
- Satu email = satu user. Email dari Google selalu terverifikasi, jadi tidak ada tabel identitas terpisah dan tidak ada alur verifikasi email.
- Tidak ada password, tidak ada reset password.
- Session lewat cookie `HttpOnly` + `Secure` + `SameSite=Lax`.
- Identitas akun adalah `email`.

### 4.2 Auth API data plane (bearer)

Setiap request ke `/db` dan `/bucket` wajib menyertakan:

```
Authorization: Bearer {secret_key}
```

Secret key bersifat per-project, dibuat saat project dibuat, **ditampilkan satu kali** lalu tidak pernah ditampilkan lagi.

Konsekuensi default: `secret_key` cukup di-hash (`secret_key_hash`), tanpa enkripsi. Tidak ada kunci yang bisa hilang, dan dump Postgres tidak berisi apa pun yang berguna. Catatan: bagian 8 membahas opsi dashboard yang membatalkan pilihan ini.

Disimpan bersama `secret_key_prefix` (8 karakter awal, untuk logging) dan `secret_key_rotated_at`.

Header `X-Moogo-Project-ID` dari PRD awal **dihapus**. Project ID sudah ada di path, dan memakai dua sumber kebenaran membuat keduanya pasti akan berbeda pada akhirnya.

## 5. Control Plane API

```
GET    /api/me
GET    /api/projects
POST   /api/projects
DELETE /api/projects/{id}
POST   /api/projects/{id}/rotate-key
GET    /api/projects/{id}/activity
GET    /api/projects/{id}/buckets
POST   /api/projects/{id}/buckets
```

`POST /api/projects` mengembalikan `secret_key` di respons body. Endpoint ini satu-satunya tempat nilai mentah pernah keluar.

### 5.1 Skema Postgres

```
users          (id uuid PK, email text UNIQUE, name text, avatar_url text,
                quota_max_projects int, quota_max_db_bytes bigint,
                quota_max_storage_bytes bigint,
                billing_plan text default 'free', billing_customer_id text null,
                created_at timestamptz)

projects       (id uuid PK, user_id uuid FK, name text,
                status text,                  -- pending | ready | failed
                secret_key_hash text, secret_key_prefix text,
                secret_key_rotated_at timestamptz,
                created_at timestamptz)

buckets        (id uuid PK, project_id uuid FK, name text, created_at timestamptz)
                 UNIQUE (project_id, name)

activity_logs  (id bigserial, project_id uuid, method text, path text,
                status int, duration_ms int, created_at timestamptz)
```

Kolom `quota_*` dan `billing_*` sudah disiapkan agar penambahan billing nanti tidak butuh migrasi yang merusak.

### 5.2 Saga pembuatan project

Pembuatan project menyentuh dua store, jadi tidak bisa satu transaksi:

1. Insert `projects` dengan `status = 'pending'` di Postgres. Ini source of truth.
2. Materialisasi di disk: mkdir `/data/dbs`, init file SQLite dengan WAL dan foreign keys aktif, set application_id dan user_version.
3. Update `status = 'ready'`. Kegagalan di sini atau di langkah 2 menghasilkan `status = 'failed'`.
4. Reconciler berjalan saat startup dan menyapu project yang menggantung di `pending`.

Dashboard menampilkan status `pending` dan `failed`, bukan spinner tanpa akhir.

## 6. Data Plane — SQL API

```
POST /db/{project_id}/query
POST /db/{project_id}/exec
```

### 6.1 Bentuk request

```json
{
  "query": "SELECT id, name FROM users WHERE status = ?",
  "args": ["active"]
}
```

### 6.2 Bentuk response

```json
{
  "success": true,
  "rows": [{ "id": 1, "name": "Ketut" }]
}
```

`/query` mengembalikan baris. `/exec` mengembalikan `{"success": true, "rows_affected": n}`.

### 6.3 Aturan eksekusi

Prepared statement wajib untuk seluruh parameter terikat. Prinsipnya: developer mengirim string SQL, jadi string itu tepercaya atas kehendak, tapi tidak boleh pernah di-interpolasi.

Pengaman yang wajib ada, karena `/exec` menerima DDL dan oleh karena itu bisa jadi primitive:

| Ancaman | Mitigasi |
|---|---|
| `ATTACH DATABASE '/etc/passwd'` | Tolak `ATTACH` / `DETACH` setelah tokenisasi, bukan pencarian substring |
| Akses file dan ekstensi | Tolak `readfile`, `writefile`, `load_extension` |
| Multi-statement | Satu statement per request, ditolak di luar string literal |
| Beban sumber daya | Batas ukuran body, batas durasi, batas jumlah baris |

Pencocokan dilakukan setelah tokenisasi SQL, bukan `strings.Contains`, supaya nama tabel atau string yang kebetulan sama tidak ikut tertolak.

### 6.4 Konkurensi

- Query boleh paralel, pembacaan tidak saling memblokir karena WAL.
- Eksekusi tulis diserialisasi per project lewat mutex per-project, supaya tidak kena `SQLITE_BUSY` antar-request.
- `busy_timeout` tetap diset sebagai jaring pengaman.
- `journal_mode = WAL` dan `foreign_keys = ON` di setiap koneksi.
- Satu koneksi per project, bukan connection pool global, supaya jumlah handle terbuka terbatas dan bisa dihitung.

### 6.5 Pembatasan ukuran

Batas 100 MB per file database dicek sebelum dan sesudah eksekusi, lewat `page_count * page_size`. Melewati batas mengembalikan error, bukan diam-diam menolak write.

## 7. Data Plane — Bucket

```
POST   /bucket/{project_id}/{key}      -- upload
GET    /bucket/{project_id}/{key}      -- download (publik)
DELETE /bucket/{project_id}/{key}      -- hapus
GET    /bucket/{project_id}            -- list object
```

Object key adalah path relatif di bawah `/data/buckets/{project_id}/`. Path dinormalisasi dan diperiksa tidak keluar dari root project sebelum menyentuh disk.

Download bersifat publik tanpa header auth, jadi object key praktis menjadi bearer token. Ini konsekuensi yang tidak bisa dihindari dari desain storage publik, dan harus disadari: kuota kecil dan free tier, jadi permukaan ini wajib di-rate-limit dan dijaga di gateway.

Kuota 256 MB per project, dihitung per project, bukan per bucket.

## 8. Dashboard Studio

Disajikan embedded lewat `go:embed`.

- **Table builder** — buat dan ubah skema tanpa menulis migrasi manual.
- **Spreadsheet editor** — manipulasi data dengan tampilan tabel.
- **SQL console** — eksekusi DDL/DML langsung.
- **Activity log** — monitoring eksekusi query secara real-time.

### Prinsip dashboard, dan batasnya

Dashboard tidak pernah menerima secret key. Prinsipnya: kalau key masuk browser,
key itu bocor begitu saja — lewat devtools, screenshot, atau ekstensi.

Tapi prinsip itu tidak bisa sendirian. Server hanya menyimpan `secret_key_hash`,
dan hash tidak bisa dibalik menjadi key. Jadi server **tidak mungkin** mem-proxy
permintaan `/db` atas nama pengguna. Dua-duanya tidak bisa benar bersamaan.

Konsekuensi yang harus diterima:

| Pilihan | Akibat |
|---|---|
| **Dashboard meminta key diulang tiap kali** | Prinsip terjaga. UX buruk: user tidak akan menyimpan key 40 karakter |
| **Server menyimpan key dalam bentuk yang bisa diambil** | UX bagus. Tapi key ada di memori dan di database, dan dump Postgres jadi bocor seluruhnya |

Yang ditulis di sini: **pilihan kedua**, dengan alasan bahwa Moogo adalah
layanan terkelola yang boarding-nya adalah "samba lalu jalan", dan karena itu
`secret_key_encrypted` menggantikan `secret_key_hash`. Kunci enkripsi berasal dari
env (`MOOGO_KEY_ENCRYPTION_KEY`), diputar lewat operasi yang disengaja.

Konsekuensi yang harus ditulis di PRD, bukan disembunyikan: ini membatalkan
alasan hash-only yang ada di bagian 3, dan menaikkanversi keamanan dari
"s Gmail bocor" jadi "database bocor". Putusan ini belum final dan harus
disetujui sebelum dashboard dibangun. Enterprise nanti butuh kunci per tenant,
yang berarti satu kunci global tidak lagi cukup.

## 9. Kuota

| Batas | Nilai | Cara enforcement |
|---|---|---|
| Project per user | 2 | Saat `POST /api/projects` |
| Ukuran database | 100 MB per file | Pre-flight dan post-flight check |
| Storage | 256 MB per project | Akumulasi ukuran object |
| Uptime | 24/7, tanpa idle timeout | Selalu aktif |

Tidak ada billing di Phase 1. Semua user free. Struktur data sudah siap untuk billing.

## 10. Anti-abuse

Signup gratis dengan kuota nyata berarti siapa pun bisa mengambil 2 × 100 MB. Mitigasi ada di edge, bukan di biner: verifikasi identitas di lapisan gateway sebelum request sampai ke aplikasi.

Rate limit per project dan per IP, batas ukuran body, dan batas durasi query.

## 11. Deploy

Single node, Phase 1. Reverse proxy Caddy untuk TLS. Host target RAM 2 GB.

Multi-node ditunda, tapi batas abstraksi sudah ditarik sejak awal: control plane dan data plane terpisah, dan `project_id` ada di path sehingga routing ke node lain tidak mengubah bentuk API.

Self-hosted adalah **versi 2**, tidak dikerjakan sekarang. Konsekuensinya prinsip "satu binary" dari PRD awal tidak berlaku untuk Phase 1.

## 12. Yang tidak dikerjakan di Phase 1

Disebutkan eksplisit supaya tidak dianggap lupa:

- Self-hosted / installer / Docker image
- Multi-node, sharding, routing per region
- GitHub OAuth
- Billing dan pembayaran
- Replikasi antar-region (Turso/libSQL untuk driver serverless)
- Rekor driver bahasa (SDK JS/Python/Go)
- Range request dan cache headerCDs

## 13. Roadmap

**Phase 1 — Core.** Router path, auth middleware Google, control plane Postgres, query engine SQLite dengan prepared statements, schema migration.

**Phase 2 — Bucket.** Handler upload/download/delete, katalog bucket di control plane, enforcement kuota storage.

**Phase 3 — Dashboard Studio.** UI `go:embed`, table builder, spreadsheet editor, SQL console, activity log.

**Phase 4 — Deploy.** Caddy di host RAM 2 GB, rate limiting, monitoring, backup control plane.