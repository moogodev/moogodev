# Limits

Every limit below is enforced by the server. Most come back **in the response**, so
you find out from the API rather than from a hung tab or a surprise bill.

## Quotas

| Limit | Value | Enforced |
|---|---|---|
| Projects per account | **2** | Checked inside the transaction that creates a project. |
| Database size | **250 MB** per project | Before every write; SQLite itself refuses page growth past the ceiling. |
| Storage | **250 MB** per project | On upload, against usage plus declared size. |
| Object size | Bucket's `max_object_size_bytes`, or 250 MB | On upload. |

Automatic database backups are stored **separately** and do **not** count
against a project's storage quota — that quota is for the objects you serve. See
[Backups](/docs/backups).

### Projects per account

Two. `POST /api/projects` returns `429 quota_exceeded` for a third.

The check happens **inside the transaction** that creates the project, not before it. Two simultaneous requests cannot both pass a check-then-create and leave you with three projects.

### Database size

250 MB, measured as `(page_count - freelist_count) * page_size` — the data pages, so space freed by a DELETE starts counting as free immediately.

The check runs **before** the write, and SQLite refuses the page growth that would cross the ceiling, so a write that would overrun is refused; it is not partially applied and it is not silently truncated.

**Pola pembacaan dan penulisannya**:

- Untuk dataset kecil (di bawah 100 baris), `SELECT *` boleh digunakan untuk kemudahan.
- Untuk dataset lebih besar, gunakan `LIMIT`/`OFFSET` dengan halaman kecil (misal: 50 baris per halaman) daripada membaca seluruh data sekaligus.
- Hindari `OFFSET` yang sangat besar (lebih dari setengah total baris), karena performa menurun secara linear.
- Gunakan CTE untuk logika kompres kompleks, tetapi hindari CTE rekurif di transaksi yang sama dengan operasi tulis.
- **Jangan gunakan `SELECT *`** dalam pengolahan produksi; selalu nama kolom yang dibutuhkan, karena perubahan schema akan memecah klien tanpa migrasi.

Database does not auto-shrink when data is deleted. Physical space remains until you run `moogo db vacuum` or `POST /maintenance` (see [SQL API](./07-sql-api#post-maintenance--reclaim-space-after-deletes)). Reclaim space regularly after large deletes.

### Result size

One read response carries at most **16 MB** of row data. The row cap of 1000 bounds how many rows come back; this bounds how many bytes they add up to — a thousand rows of a wide `BLOB` column would otherwise be a response held twice in memory, once as rows and once as JSON.

A single value larger than the project's own size limit is refused before SQLite materializes it, so `SELECT zeroblob(n)` cannot ask for more bytes than the file would ever hold.