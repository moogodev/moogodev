# AI Adoption Prompt

A self-contained reference to Moogo — a hosted SQLite database and object
storage over HTTP — written for AI coding agents. Save this page as `moogo.md`
in your project and point your agent at it, so it knows what Moogo is and how
to call it before it writes a line of code.

## What Moogo is

Moogo gives each project its own SQLite database and its own object storage,
both reached over plain HTTP. There is no connection string and no database
driver: SQL travels as JSON in a POST request, and files travel as raw request
bodies. One account can hold up to two projects.

Three surfaces, each with its own credential:

- **SQL** — `POST {PROJECT_URL}/query` for reads, `POST {PROJECT_URL}/exec`
  for writes, authorized with the project's secret key.
- **Object storage** — `POST/GET/DELETE {PROJECT_URL}/bucket/{key}`,
  authorized with a separate storage credential.
- **Dashboard** — `/app`, session cookie, for browsing tables, running queries
  by hand, and downloading backups. Not for applications.

The service is in development: usable for testing, not ready for production.
Read [Limits](/docs/limits) before designing around it.

## How it is used

1. Register at `/register` and confirm the email.
2. Create a project in the dashboard. The secret key is shown once, at creation
   and at each rotation — only a hash is stored, so put it in the environment
   immediately.
3. Put these in the project's environment:

```bash
MOOGO_PROJECT_URL=https://moogo.dev/p/<project_id>
MOOGO_PROJECT_ID=<project_id>
MOOGO_SECRET_KEY=...             # SQL only
MOOGO_BUCKET_ACCESS_KEY_ID=...   # object storage only
MOOGO_BUCKET_SECRET_KEY=...      # object storage only
```

4. Call the APIs. Every JSON request must send
   `Content-Type: application/json` — a body declared as anything else is
   refused with `415 unsupported_media_type`.

On moogo.dev the base is `https://moogo.dev`; a self-hosted deployment uses its
own public URL. Read credentials from the environment. Never ask the user to
paste them, and never print them.

## SQL API

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN` | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Request, authorized with the SQL key:

```bash
curl "$MOOGO_PROJECT_URL/query" \
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT id, email FROM users WHERE plan = ?", "args": ["pro"]}'
```

Response from `/query`:

```json
{
  "success": true,
  "columns": ["id", "email"],
  "rows": [["7c1f", "ketut@example.com"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 2
}
```

`rows` are arrays aligned with `columns`, not objects. `/exec` answers
`{"success": true, "rows_affected": 1, "row_count": 1, "duration_ms": 2}`.
Every failure, on any endpoint, uses one envelope:

```json
{ "error": { "code": "not_a_read", "message": "...", "detail": "..." } }
```

Rules the engine enforces, not conventions:

- `?` placeholders with an `args` array — values are bound as
  prepared-statement arguments, never concatenated into SQL.
- One statement per request. Stacked statements (`a; b`) are rejected.
- File functions (`readfile`, `writefile`, `load_extension`) are rejected.
- Statements are capped at 64 KB and cancelled after 15 seconds.
- Results cap at 1000 rows; `truncated: true` means there is more to fetch.

## Object storage (buckets)

Storage takes its own credential. The two credential types are **not**
interchangeable — the SQL key on a bucket request gets 401, and the storage
credential on SQL gets 401. Two headers on every storage request:

```
X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID
Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY
```

With `ENDPOINT=$MOOGO_PROJECT_URL/bucket`:

| Action | Request |
|---|---|
| Upload | `POST $ENDPOINT/{key}` — the body is the file bytes and the `Content-Type` is the file's own type, **not** `application/json`. `?bucket=NAME` picks a bucket; no bucket means `default`. |
| Download | `GET $ENDPOINT/{key}` — returns the bytes with the object's `Content-Type`. |
| Delete | `DELETE $ENDPOINT/{key}` |
| List | `GET $ENDPOINT/?limit=100&order=key&dir=asc` — add `?bucket=NAME` to pick a bucket. |

Upload answers with the object — `key`, `size_bytes`, `content_type`,
`storage_used_bytes` and `quota_bytes` — and three URL fields: `url` for your
application (it needs the credential), `preview_url` for the dashboard, and
`public_url`, which stays empty until the object is published. A published
object is readable by anyone holding `https://moogo.dev/pub/{project_id}/{key}`;
treat publishing as permanent, because anyone who recorded the URL keeps it.

## Limits

Every limit is enforced by the server, and most come back in the response.

| What | Limit |
|---|---|
| Projects per account | 2 |
| Database size | 100 MB per project; the file never shrinks on its own |
| Storage | 256 MB per project, summed across all buckets |
| Object size | The bucket's `max_object_size_bytes`, or 256 MB |
| JSON request body | 1 MB (`body_too_large`) |
| Statement | 64 KB (`sql_too_long`), 15 seconds (`statement_timeout`) |
| Storage credentials | 5 per project (`storage_credential_limit`) |
| Sign-in endpoints | 10 requests/minute per client address, shared across them (`rate_limited`) |
| Data plane | 300 requests/minute — queries per project, storage per address (`rate_limited`) |
| Result rows | 1000 per response; `truncated: true` when the cap was hit |

Reads report `truncated` and `duration_ms`; storage reports
`storage_used_bytes` and `quota_bytes`. Check them instead of assuming.

## Do

- Read credentials from the environment; never ask the user to paste them.
- Bind every value through `args`; treat SQL strings as code to review.
- Keep the SQL key and the storage credential on their own endpoints.
- Branch on `error.code`, never on the message text.
- Send `Content-Type: application/json` on JSON requests — it is enforced.
- Page storage listings, and re-fetch when a read returns `truncated: true`.
- Use `/query` for reads and `/exec` for writes; each refuses the other.

## Don't

- Don't concatenate user input into SQL — the placeholder syntax exists for
  that.
- Don't send stacked statements, file functions, or statements over 64 KB.
- Don't send `Content-Type: application/json` on a file upload: the body is
  raw bytes with the file's own type.
- Don't put a private object's `url` in an `<img>` tag — a browser carries no
  storage credential.
- Don't assume a different error shape somewhere: it is always
  `{"error": {"code", "message", "detail"}}`.
- Don't paste the secret key, the bucket secret, or session cookies into chat,
  logs, or client-side code.
- Don't treat Moogo as production-ready; it is in development.

## Learn more

- [Quickstart](/docs/quickstart) — account to first query in two minutes
- [Credentials](/docs/credentials) — the two credential types and rotation
- [SQL API](/docs/sql-api) — the full reference for `/query` and `/exec`
- [Object storage](/docs/object-storage) — buckets, publishing, listing
- [Limits](/docs/limits) — quotas and request caps in detail
- [Errors](/docs/errors) — every error code and what to do about it
- [Security](/docs/security) — the threat model, stated plainly
