# Limits

Every limit below is enforced by the server. Most come back **in the response**, so
you find out from the API rather than from a hung tab or a surprise bill.

## Quotas

| Limit | Value | Enforced |
|---|---|---|
| Projects per account | **2** | Checked inside the transaction that creates a project. |
| Database size | **100 MB** per project | Before *and* after every write. |
| Storage | **256 MB** per project | On upload, against usage plus declared size. |
| Object size | Bucket's `max_object_size_bytes`, or 256 MB | On upload. |

### Projects per account

Two. `POST /api/projects` returns `429 quota_exceeded` for a third.

The check happens **inside the transaction** that creates the project, not before
it. Two simultaneous requests cannot both pass a check-then-create and leave you
with three projects.

### Database size

100 MB, measured as `page_count * page_size` — the real size on disk, not an
estimate.

The check runs **before** the write commits and again after. A write that would
cross the ceiling is refused; it is not partially applied and it is not silently
truncated.

```json
{ "error": { "code": "database_too_large", "message": "the database has reached its size limit" } }
```

Note that a database does not shrink on its own. Deleting rows frees space
*inside* the file for reuse, but the file does not get smaller. A database that
once grew past 100 MB stays large, and you will keep needing to delete.

### Storage

256 MB **per project**, summed across all buckets. Two buckets do not give you
512 MB.

Every storage response reports usage and quota:

```json
{ "storage_used_bytes": 10485760, "quota_bytes": 268435456 }
```

The quota is checked against the declared `Content-Length` before a byte is
written, and again against what actually arrived. Uploads for one project are
serialised, so two concurrent large uploads cannot both see room and together
overrun the quota.

## Request limits

| Limit | Value | Error code |
|---|---|---|
| Request body (JSON endpoints) | **1 MB** | `body_too_large` |
| Request body (storage uploads) | Bucket cap or 256 MB | `object_too_large` |
| Statement length | **64 KB** | `sql_too_long` |
| Statement duration | **15 seconds** | `statement_timeout` |
| Storage credentials per project | **5** | `storage_credential_limit` |

The JSON and storage caps differ on purpose. They guard different things: a JSON
body is a statement or a settings object where anything past a megabyte is a
mistake, while an upload is a file. A shared 1 MB cap would mean a project with
256 MB of storage could never store an image.

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
- **No request rate limit at the application level.** Rate limiting is expected at
  the edge or gateway in front of the deployment.
- **No automatic backup schedule.** Download one from the project settings when
  you want it.

## If you hit a limit

| Error | What to do |
|---|---|
| `quota_exceeded` on project creation | Delete an unused project, or [pause](/docs/create-project#pausing) it if you only need to stop using it. Pausing does not free the slot — it is still a project. |
| `database_too_large` | Delete rows you no longer need. Remember the file itself will not shrink. If you genuinely need more, this is the ceiling to design around. |
| `statement_timeout` | Look at the query. Add an index, narrow the `WHERE`, or page the result. |
| `sql_too_long` | Generate fewer statements per request. One statement per request is the rule. |
| `body_too_large` | Send less in one call. Page a listing instead of requesting everything. |
| `object_too_large` | Lower the bucket's `max_object_size_bytes`, or compress the file. |
| `storage_credential_limit` | Revoke the credentials you no longer use — 5 is the cap. |

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