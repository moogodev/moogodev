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

### Projects per account

Two. `POST /api/projects` returns `429 quota_exceeded` for a third.

The check happens **inside the transaction** that creates the project, not before
it. Two simultaneous requests cannot both pass a check-then-create and leave you
with three projects.

### Database size

250 MB, measured as `(page_count - freelist_count) * page_size` — the data pages,
so space freed by a DELETE starts counting as free immediately.

The check runs **before** the write, and SQLite refuses the page growth that
would cross the ceiling, so a write that would overrun is refused; it is not
partially applied and it is not silently truncated.

```json
{ "error": { "code": "database_too_large", "message": "the database has reached its size limit" } }
```

Note that a database does not shrink on its own. Deleting rows frees space
*inside* the file for reuse, but the file does not get smaller. A database that
once grew past 250 MB stays large, and the freed pages only stop counting toward
the ceiling until later writes reuse them.

### Result size

One read response carries at most **16 MB** of row data. The row cap of 1000
bounds how many rows come back; this bounds how many bytes they add up to — a
thousand rows of a wide `BLOB` column would otherwise be a response held twice
in memory, once as rows and once as JSON.

A single value larger than the project's own size limit is refused before SQLite
materializes it, so `SELECT zeroblob(n)` cannot ask for more bytes than the file
would ever hold.

```json
{ "error": { "code": "result_too_large", "message": "the result set is over the response size limit; narrow the query or page the result" } }
```

### Storage

250 MB **per project**, summed across all buckets. Two buckets do not give you
512 MB.

Every storage response reports usage and quota:

```json
{ "storage_used_bytes": 10485760, "quota_bytes": 262144000 }
```

The quota is checked against the declared `Content-Length` before a byte is
written, and again against what actually arrived. Uploads for one project are
serialised, so two concurrent large uploads cannot both see room and together
overrun the quota.

## Request limits

| Limit | Value | Error code |
|---|---|---|
| Request body (JSON endpoints) | **1 MB** | `body_too_large` |
| Request body (storage uploads) | Bucket cap or 250 MB | `object_too_large` |
| List page size (`limit`) | **200** | Clamped down silently — a larger `limit` returns 200, it is not an error. |
| Statement length | **64 KB** | `sql_too_long` |
| Statements per transaction | **100** | `too_many_statements` |
| Statement duration | **15 seconds** | `statement_timeout` |
| Transaction duration | **15 seconds** for the whole batch | `statement_timeout` |
| Result payload (one read) | **16 MB** | `result_too_large` |
| Storage credentials per project | **5** | `credential_limit` |
| Sign-in endpoints | **10 / minute / client address**, shared | `rate_limited` |
| Data plane | **300 / minute** — queries per project, storage per address | `rate_limited` |
| Dashboard update list (`GET /api/updates`) | **60 / minute / client address** | `rate_limited` |

The JSON and storage caps differ on purpose. They guard different things: a JSON
body is a statement or a settings object where anything past a megabyte is a
mistake, while an upload is a file. A shared 1 MB cap would mean a project with
250 MB of storage could never store an image.

The body limit stops the request **while reading it**, not after the whole body is
in memory.

A statement that passes 15 seconds is **cancelled in the engine**, not left to time
out at the HTTP layer, so the connection is not held open.

## Retention

| Data | Kept |
|---|---|
| Activity log | **7 days**, then pruned on a schedule |
| Secrets | Once. Only a hash and a short prefix are stored. |

## What is *not* limited

Worth knowing explicitly, because these are common assumptions:

- **No idle timeout.** A project does not pause after inactivity. No cold start.
- **No automatic backup schedule.** Download one from the project settings when
  you want it.
- **No bucket count limit.** A project may create as many buckets as it wants;
  the dashboard lists the first 1000.
- **No bandwidth or egress limit.** Storage is metered by what is stored, not
  by how much travels in or out.
- **No daily quota.** Nothing resets at midnight — the storage and database
  ceilings are cumulative.
- **No table-count limit.** The database ceiling is bytes, not objects: rows,
  tables and indexes all draw from the same space, in whatever shape you
  choose.

## If you hit a limit

| Error | What to do |
|---|---|
| `quota_exceeded` on project creation | Delete an unused project, or [pause](/docs/create-project#pausing) it if you only need to stop using it. Pausing does not free the slot — it is still a project. |
| `database_too_large` | Delete rows you no longer need. Freed pages stop counting toward the ceiling, but the file itself will not shrink. If you genuinely need more, this is the ceiling to design around. |
| `result_too_large` | Narrow the query: add a `WHERE`, select fewer columns, or page the result. The row cap of 1000 does not bound bytes. |
| `database_busy` | Retry after the second in `Retry-After`. The project ran out of statement slots or is waiting for the previous writer — your statement was not wrong. |
| `too_many_statements` | A `/transaction` batch carries more than 100 statements. Split it into numbered batches; each one still commits or rolls back as a unit. |
| `transaction_empty` | A `/transaction` batch with nothing in it. Usually a loop that produced no rows — check before you send it. |
| `statement_timeout` | Look at the query. Add an index, narrow the `WHERE`, or page the result. |
| `sql_too_long` | Generate fewer statements per request. One statement per request is the rule. |
| `body_too_large` | Send less in one call. Page a listing instead of requesting everything. |
| `object_too_large` | Lower the bucket's `max_object_size_bytes`, or compress the file. |
| `credential_limit` | Revoke the credentials you no longer use — 5 is the cap. |

## Designed to be visible

A limit you cannot see is a limit you discover in production. So:

- Storage responses carry `storage_used_bytes` and `quota_bytes`.
- Writes carry `size_bytes`.
- Queries carry `duration_ms`, so you can watch a slow query get slower before it
  times out.
- Reads carry `truncated`, so you know a result set was capped rather than
  complete.

Track these rather than guessing where you stand.

## Next

- [Security](/docs/security) — why these limits exist
- [Errors](/docs/errors) — the full error code table