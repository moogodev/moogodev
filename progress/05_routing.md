# Progress 9 — Routing

Status: **selesai untuk API dan halaman; bucket belum**
Target: `internal/router/`, `internal/handler/`

---

## Yang sudah

Berkas:
- `internal/router/router.go`
- `internal/router/router_test.go` — 39 test
- `internal/handler/dataplane.go` — endpoint `/db/*`
- `internal/handler/controlplane.go` — endpoint `/api/*`
- `internal/handler/oauth.go` — endpoint `/auth/*`
- `internal/handler/util.go` — pemisahan read/write
- `web/web.go` — embed aset frontend
- `web/assets/index.html`, `login.html`, `app.html` — dokumen HTML
- `web/assets/css/landing.css`, `web/assets/js/landing.js`, `login.js`, `dashboard.js`
- `web/assets/img/favicon.svg`

### Peta route yang aktif

```
GET  /healthz                   liveness
GET  /readyz                    readiness (cek Postgres)

GET  /auth/google               mulai OAuth
GET  /auth/google/callback      callback OAuth
POST /auth/logout               hapus session
GET  /auth/session              status session untuk dashboard

GET  /api/me                    user saat ini
GET  /api/projects              daftar project
POST /api/projects              buat project, kembalikan secret key SEKALI
GET  /api/projects/{id}         detail
DELETE /api/projects/{id}       hapus
POST /api/projects/{id}/rotate-key    rotasi key, kembalikan SEKALI
GET  /api/projects/{id}/activity      audit log

POST /db/{project_id}/query     SELECT, mengembalikan rows
POST /db/{project_id}/exec      DDL/DML, mengembalikan rows_affected

GET  /                           landing page (`index.html`)
GET  /login                      halaman masuk (`login.html`)
GET  /app                        dashboard (`app.html`)
GET  /static/*                   CSS, JS, gambar
```

### Frontend yang disajikan

`registerPages` menyajikan tiga dokumen dari `PagesFS` dan aset dari `StaticFS`.
Landing page memuat `landing.css` dan `landing.js` sebagai berkas eksternal,
bukan inline, karena CSP `script-src 'self'` dan `style-src 'self'` menolaknya.
Tab contoh API memakai pola tablist (klik + panah kiri/kanan) dan tombol salin;
keduanya fitur CSS yang tidak bisa menyediakannya. Halaman login menerjemahkan
`?error=` ke pesan yang dikenal saja; halaman dashboard memuat `/auth/session`,
`/api/me`, dan `/api/projects` memakai `textContent` agar nama project dari
pengguna tidak pernah menjadi HTML.

### Middleware per grup

| Grup | Middleware |
|---|---|
| `/healthz`, `/readyz` | Tidak ada. Probe tidak punya cookie |
| `/auth/*` | Tidak ada, kecuali `RequireSession` di dalam handler yang butuh |
| `/api/*` | `RequireSession` |
| `/db/*` | `ProjectContext` lalu `RequireProjectKey` |

### Yang diverifikasi

| Yang dijanjikan | Test pembuktian |
|---|---|
| Route publik jalan tanpa session | `TestPublicRoutesAreReachableWithoutSession` |
| Semua `/api/*` menolak tanpa session | `TestControlPlaneRoutesRequireSession` |
| `/api/*` jalan dengan session valid | `TestControlPlaneRoutesAcceptSession` |
| `/db/*` menolak tanpa project key | `TestDataPlaneRoutesRequireProjectKey` |
| UUID project_id divalidasi sebelum cek key | `TestDataPlaneRejectsNonUUIDProjectID` |
| `/db/*` menolak GET | `TestDataPlaneRejectsGetMethod` |
| Route tidak dikenal membalas JSON 404 | `TestUnknownRouteReturnsJSON404` |
| Probe jalan tanpa session | `TestProbesAreReachableWithoutSession` |
| Header keamanan di semua response | `TestSecurityHeadersApplied` |
| HSTS hanya di TLS | `TestHSTSSkippedOnPlainHTTP`, `TestHSTSSetOnTLS` |
| API tidak bisa di-cache | `TestAPISetsNoStore` |
| Halaman tetap bisa di-cache | `TestPagesAreNotNoStore` |
| Dokumen HTML tersaji dari PagesFS | `TestPagesAreServed` |
| Aset statis tersaji dari StaticFS | `TestStaticAssetsAreServed` |
| Router tanpa PagesFS membalas 503 | `TestMissingPageIsAServerError` |
| Pembuatan project mengembalikan key sekali | `TestCreateProjectReturnsSecretOnce` |
| Key tidak muncul lagi di pembacaan | `TestCreateProjectHidesSecretOnLaterReads` |
| Project orang lain 404, bukan 403 | `TestGetProjectRejectsOtherUsersProject` |
| File dihapus bersama project | `TestDeleteProjectRemovesFile` |
| Statement berbahaya tidak sampai ke engine | `TestQueryRejectsFileAccess` |
| Write ke `/query` ditolak | `TestQueryRejectsWrites` |
| Read ke `/exec` ditolak | `TestExecRejectsReads` |
| CTE `WITH ... SELECT` dikenali sebagai read | `TestIsReadStatement` |

### Keputusan yang diambil

**Project ID dibaca dari context, bukan dari `r.PathValue`.** Handler pertama
dicolokkan ke `chi` dan membentuk test dengan `httptest`, di mana tidak ada
router. `PathValue` hanya diisi oleh `http.ServeMux` pola Go 1.22, bukan oleh
`chi`, sehingga selalu kosong. Sekarang middleware `ProjectContext` mem-parsing
UUID sekali dan menaruhnya di context; kedua plane membacanya dari sana.

**Pembuatan project adalah saga dua tahap.** Postgres tidak bisa ikut dalam
transaksi yang sama dengan pembuatan file SQLite, jadi urutannya: insert row
`pending`, buat file, tandai `ready`. Kalau pembuatan file gagal, row ditandai
`failed`, bukan dihapus, supaya ada yang bisa di-retry dan dashboard bisa
menampilkan apa yang terjadi. Kalau penandaan `ready` yang gagal, project
dibiarkan hidup karena filenya memang ada — hanya statusnya yang basi, dan
reconciler yang memperbaikinya.

**`isReadStatement` bukan kontrol keamanan.** Gunanya hanya memilih endpoint
yang dimaksud pemanggil. Kedua endpoint menjalankan `sanitizer.Validate` lebih
dulu, jadi jawaban yang salah hanya mengarahkan permintaan, tidak pernah
meloloskan sesuatu. Versi pertama salah pada dua hal: komentar blok `/* */`
diabaikan, dan CTE dianggap salah karena kurung daftar kolom `c(x)` dihitung
sebagai badan CTE.

**Pemisahan read/write lebih ketat dari yang sebenarnya dibutuhkan.** Kirim `SELECT`
ke `/exec` dan hasilnya bisa melewati batas baris yang hanya ditegakkan
`/query`.

**`UpsertUserByEmail` menerima quota default sebagai parameter.** Nilai ini
berasal dari config. Nanti billing menimpanya lewat pemanggilan yang sama,
tanpa mengubah handler.

## Yang belum

- [ ] Route bucket: upload, download, hapus, daftar
- [ ] Normalisasi object key (kalau bucket dikerjakan, key bisa berisi `/`)
- [ ] Dashboard penuh: buat/hapus/rotasi key dan konsol SQL dari UI (shell hanya mendaftar project)
- [ ] Halaman setup login saat credential Google belum diisi
- [ ] Rate limit
