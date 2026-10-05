# Progress 10 — Entry Point & Rekonsiliasi

Status: **selesai**
Target: `cmd/api/main.go`, `internal/app/`

---

## Yang sudah

| Berkas | Isi |
|---|---|
| `internal/app/app.go` | Wiring semua komponen |
| `internal/app/background.go` | Reconciler dan scheduler |
| `cmd/api/main.go` | Startup, sinyal, graceful shutdown |
| `internal/dbcontrol/migrate.go` | Runner migrasi dengan embed dan advisory lock |
| `internal/dbcontrol/embed.go` | `go:embed` untuk SQL |
| `internal/dbcontrol/migrate_test.go` | 16 test |

### Urutan startup yang berjalan

```
1. Load config       -> gagal fast kalau env salah
2. Init logger
3. Buka Store        -> gagal kalau Postgres tidak terjangkau
4. Jalankan migrasi  -> advisory lock, satu file satu transaksi
5. Bangun handler, router, http.Server
6. Jalankan scheduler (reconcile + prune) di goroutine terpisah
7. ListenAndServe
8. Tunggu sinyal
9. Graceful shutdown
10. Tutup koneksi SQLite, lalu pool Postgres
```

### Yang diverifikasi

| Yang dijanjikan | Test pembuktian |
|---|---|
| Nama migrasi wajib `NNNN_nama.sql` | `TestParseMigrationName` |
| Migrasi diurutkan dari nomornya, bukan urutan file | `TestLoadMigrationsOrdersByVersion` |
| Checksum stabil untuk isi yang sama | `TestLoadMigrationsComputesChecksum` |
| Dua file dengan versi sama ditolak | `TestLoadMigrationsRejectsDuplicateVersion` |
| File kosong ditolak | `TestLoadMigrationsRejectsEmptyFile` |
| File non-SQL diabaikan | `TestLoadMigrationsIgnoresNonSQL` |
| File migrasi benar-benar ter-embed | `TestEmbeddedMigrationsArePresent` |

Sisa langkah startup diverifikasi oleh `go build`, `go vet`, dan `go test ./...`
yang semuanya bersih, bukan oleh test integrasi. Itu gap yang diketahui dan
ditulis di bagian bawah.

### Keputusan yang diambil

**Advisory lock, bukan tabel lock.** `pg_advisory_lock` dipegang satu koneksi
selama seluruh migrasi, dilepas dengan context terpisah supaya tidak tertinggal
kalau context pemanggil sudah selesai. Kalau kuncinya diambil lewat pool, query
berikutnya bisa jatuh ke koneksi lain yang tidak memegang lock itu.

**Checksum diverifikasi, bukan diabaikan.** Migrasi yang sudah pernah jalan
lalu diedit akan menghentikan startup. Melewatkannya berarti menerapkan
migrasi berikutnya di atas skema yang tidak bisa dijelaskan siapa pun.

**Lock dilepas dengan `context.WithoutCancel`.** Kalau context pemanggil sudah
dibatalkan saat shutdown, memakai context itu untuk melepas lock akan gagal dan
lock tertinggal sampai sesi Postgres berakhir.

**Migrasi dipindah ke dalam package.** Dari `migrations/postgres/` menjadi
`internal/dbcontrol/migrations/postgres/`, karena `go:embed` hanya bisa membaca
file di dalam atau di bawah direktori package yang memanggilnya. Konsekuensinya
tidak ada direktori SQL terpisah di root repo.

**Jalankan sekuensial, bukan paralel.** SQLite men-serialize statement di
engine, jadi paralelisme tidak menambah apa pun.

## Yang belum

- [ ] Test integrasi terhadap Postgres sungguhan: startup, migrasi dua kali, advisory lock
- [ ] Reconciler belum punya unit test (butuh Postgres untuk `ProjectsNeedingReconcile`)
- [ ] Dockerfile dan compose untuk Postgres lokal
- [ ] `go run ./cmd/api` belum pernah dijalankan terhadap Postgres nyata
