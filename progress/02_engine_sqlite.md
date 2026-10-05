# Progress 6 — Engine SQLite per-Project

Status: **selesai**
Target: `internal/dbplane/`

---

## Yang harus dibangun

### Koneksi per project

Satu `*sql.DB` dengan `MaxOpenConns(1)` per project, bukan connection pool
global. Alasannya:

- SQLite hanya boleh satu penulis, jadiyte tidak ada gunanya menambah koneksi
- Jumlah handle terbuka jadi terikat dan bisa dihitung
- Batas RAM di host 2 GB jadi bisa diperkirakan

Konsekuensi: setiap project yang aktif memakan satu handle. KalauPressed
terlalu banyak project aktif, perlu eviction policy — tapi untuk Phase 1 dengan
maks 5 project per user, cukup.

### Inisialisasi

Saat project dibuat (tahap 2 saga):

1. `mkdir /data/dbs`
2. Buka file `{project_id}.db`
3. `PRAGMA journal_mode = WAL`
4. `PRAGMA foreign_keys = ON`
5. Set `application_id` dan `user_version` — nilai ApplicationID khusus Moogo,
   supaya file bisa dikenali dan tidak tertukar dengan SQLite lain

### Pragma per koneksi

| Pragma | Nilai | Alasan |
|---|---|---|
| `journal_mode` | `WAL` | Baca tidak terblokir penulisan |
| `foreign_keys` | `ON` | Default SQLite adalah OFF |
| `busy_timeout` | 5000ms | Jaring pengaman kalau mutex somehow dilewati |
| `synchronous` | `NORMAL` |*Kompromibetween durability and throughput, cukup untuk use case ini |

`synchronous = FULL` akan jauh lebih lambat untuk tidak perlu.

### Mutex per project

SQLite menolak dua penulis dengan `SQLITE_BUSY`. Solusinya mutex per project,
bukan menambah retry.

- Query boleh paralel, mutex hanya melindungi path tulis
- Mutex di Go, bukan di SQLite, supaya tidak adaErrno yang muncul ke user

### Batas ukuran

100 MB dicek sebelum dan sesudah eksekusi:

```sql
SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size();
```

Dicek sebelum **dan** sesudah, bukan hanya sesudah: kalau hanya sesudah,
penulisan besar sudah selesai dan disk sudah terpakai.

Kalau tidak bisa dibatalkan, opsinya cek sebelum, dan kalau butuh_basis_size
lebih besar dari batas, tolak.

### Reconciler

Project menggantung di status `pending` setelah restart:
- Reconcile: cek apakah file ada → `ready`
- Kalau tidak ada → buat ulang → `ready`
- Kalau gagal → `failed` dengan alasannya

Dijalankan saat startup dan berkala setelahnya.

### Path aman

`project_id` divalidasi sebagai UUID sebelum dipakai. Ini bukan
optimasi, ini yang membuat path traversal mustahil secara struktural —
path dibangun dari komponen, bukan dari input mentah.

Perlu diperhatikan juga: macOS punya filesystem case-insensitive, sehingga
UUID `A1B2...` dan `a1b2...` menunjuk file yang sama. Karena UUID di-lowercase
dan divalidasi, ini aman.

## Yang sudah

Berkas:
- `internal/dbplane/manager.go` — Manager koneksi, lifecycle file
- `internal/dbplane/query.go` — Query dan Exec
- `internal/dbplane/result.go` — bentuk hasil
- `internal/dbplane/manager_test.go` — 12 test

### Terverifikasi oleh test

| Yang dijanjikan | Test pembuktian |
|---|---|
| Pragma diterapkan per koneksi | `TestForeignKeysAreEnforced` — insert violate FK gagal |
| Prepared statement, bukan interpolasi | `TestQueryUsesPreparedStatements` — payload `'; DROP TABLE` aman |
| Mutex per project bekerja | `TestConcurrentWritesSucceed` — 20 goroutine tanpa SQLITE_BUSY |
| Baris tidak saling alias | `TestRowsDoNotAliasEachOther` — 3 baris punya nilai masing-masing |
| Batas ukuran ditegakkan | `TestExecEnforcesSizeLimit` |
| Isolasi antar project | `TestProjectsAreIsolatedFromEachOther` |
| Sidecar -wal/-shm ikut terhapus | `TestRemoveProjectDeletesSidecarFiles` |
| Project closed tidak bisa dibuka diam-diam | `TestManagerRejectsQueriesAfterClose` |

### Keputusan yang diambil

**`MaxOpenConns(1)` per project.** SQLite hanya mengizinkan satu penulis,
jadi koneksi tambahan tidak menambah apa pun. Dengan begitu jumlah file handle
terbuka sama dengan jumlah project, dan bisa diperkirakan di host 2 GB.

**Mutex di Go, bukan retry di SQLite.** Mengambil `SQLITE_BUSY` sebagai error
ke user berartiRace condition yang akan muncul sebagai 500 acak. Menyerialkan
di Go membuat kondisi itu mustahil secara struktural.

**`application_id = 0x4D4F4F47`.** Ditulis di header file dan ikut terbawa
kemana pun filenya. Gunanya: file asing di direktori data tidak akan pernah
terbaca sebagai database user. `user_version` di 1 karena Moogo tidak mengelola
skema per-project.

**`_txlock=immediate`.** Mengambil write lock saat BEGIN, bukan saat write
pertama. Kalau ada yang menahan file (checkpoint, proses lain), errornya muncul
di awal, bukan di tengah transaksi.

**Cap 1000 baris per query.** Tanpa itu, `SELECT * FROM tabel_besar` akan
menyerap seluruh hasil ke RAM di host 2 GB. Hasil yang terpotong ditandai
`truncated`, jadi client tahu datanya tidak lengkap.

### Yang belum

- [ ] Reconciler (butuh Store dari control plane)
- [ ] Integrasi ke handler `/db/{project_id}`
- [ ] Batas durasi belum diuji end-to-end (sudah ada di kode via context)