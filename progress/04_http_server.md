# Progress 8 — HTTP Server

Status: **selesai**
Target: `pkg/httpx/`

---

## Yang sudah

| Berkas | Isi |
|---|---|
| `pkg/httpx/response.go` | Satu bentuk error untuk seluruh API |
| `pkg/httpx/middleware.go` | `Recoverer`, `RequestID`, `AccessLog`, `MaxBodyBytes`, `RealIP`, `Timeout` |
| `pkg/httpx/httpx_test.go` | 15 test |
| `internal/handler/health.go` | Liveness dan readiness |

### Timeout

| Timeout | Default | Alasan |
|---|---|---|
| Read header | 15s | Slowloris: koneksi yang cuma kirim header |
| Idle | 120s | Koneksi pasif dipegang sia-sia |
| Shutdown | 30s | Lebih lama dari statement timeout, supaya query yang sedang jalan sempat selesai |

`WriteTimeout` sengaja tidak dipasang. Response `/db/*/query` boleh selama
statement timeout, dan `WriteTimeout` yang lebih pendek akan memotong result
yang justru sukses.

### Yang diverifikasi

| Yang dijanjikan | Test pembuktian |
|---|---|
| Satu panic jadi 500, bukan connection putus | `TestRecovererTurnsPanicInto500` |
| Nilai panic tidak bocor ke client | `TestRecovererHidesPanicValueFromClient` |
| `ErrAbortHandler` diteruskan, bukan jadi 500 | `TestRecovererRethrowsAbortHandler` |
| Body dibatasi saat baca, bukan sesudah | `TestMaxBodyBytesStopsLargeBody` |
| Handler yang menggantung terputus | `TestTimeoutCutsOffHungHandler` |
| Request id diteruskan dari edge | `TestRequestIDKeepsInboundValue` |
| Request id kepanjangan dibuang | `TestRequestIDReplacesOversizedValue` |
| Query string tidak masuk log | `TestAccessLogExcludesQueryString` |
| Liveness tidak cek database | `TestLivenessAlwaysPasses` |
| Readiness gagal saat Postgres mati | `TestReadinessFailsWhenControlPlaneIsDown` |
| Readiness punya batas waktu | `TestReadinessBoundsTheCheck` |

### Keputusan yang diambil

**`Timeout` memakai `http.TimeoutHandler` dari standard library.** Versi
pertama menulis response 504 dari goroutine terpisah while handler masih bisa
menulis body-nya sendiri. Itu menghasilkan body yang saling tumpang tindih dan
error yang membingungkan di sisi client. Standard library sudah
mengatasi race ini dengan locking; statusnya tidak bisa diubah (selalu 503),
jadi itu yang dipakai dan alasannya ditulis di komentar.

**Liveness dan readiness dipisah.** Kalau liveness cek database, outage
Postgres akan membuat orchestrator me-restart proses yang sebenarnya baik-baik
saja. Liveness menjawab tanpa cek apa pun; readiness yang cek dependensi.

**`AccessLog` tidak menulis query string.** Object key dan token bisa bocor dari
`r.URL.String()`, jadi hanya `r.URL.Path` yang dicatat.

## Yang belum

- [ ] Rate limit di gateway (belum ada dependency rate limit)
- [ ] Tracing ter-distribusi, hanya ada request id
