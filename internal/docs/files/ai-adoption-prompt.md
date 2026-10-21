# AI Adoption Prompt

A self-contained reference to Moogo — a hosted SQLite database and object
storage over HTTP — written for AI coding agents. Save this page as `moogo.md`
in your project and point your agent at it, so it knows what Moogo is and how
to call it before it writes a line of code. Covers the **MCP server** (stdio
and HTTP transport), SQL API, transactions, and object storage (buckets).

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
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project_id>
MOOGO_PROJECT_ID=<project_id>
MOOGO_SECRET_KEY=...             # SQL only
MOOGO_BUCKET_ACCESS_KEY_ID=...   # object storage only
MOOGO_BUCKET_SECRET_KEY=...      # object storage only
```

4. Call the APIs. Every JSON request must send
   `Content-Type: application/json` — a body declared as anything else is
   refused with `415 unsupported_media_type`.

On moogo.dev the base is `https://api.moogo.dev`; a self-hosted deployment uses
its own public URL. Read credentials from the environment. Never ask the user to
paste them, and never print them.

## MCP server

Moogo ships a Model Context Protocol server (`cmd/mcp`) for agents that can call
MCP tools. Connected this way, the same SQL API **and** object storage appear as
tools — no HTTP request to build:

| Tool | Does |
|---|---|
| `list_schema` | Lists every table and view, with the SQL that created each one. Call this first. |
| `query` | One read statement; returns `columns`, `rows`, `row_count` and `truncated`. |
| `exec` | One write statement; returns `rows_affected`, `size_bytes` and `last_insert_rowid`. |
| `transaction` | Up to 100 writes as one atomic batch. |
| `list_objects` | One page of objects in a bucket; filter by prefix, search, order, dir. |
| `upload_object` | Store one object at `key`; body is UTF-8 text or base64. |
| `download_object` | Read one object by key; returns an embedded resource (text or base64 blob). Capped at 1 MiB default / 8 MiB max. |
| `delete_object` | Remove one object by key, or every object under a prefix with `prefix=true`. |

`sql` carries the statement and `args` the bound values, the same as the HTTP
API below: one statement per call, placeholders for every value. `query` also
takes an optional `limit` (default 100, capped at 1000).

### Environment

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MOOGO_PROJECT_URL` | yes | — | e.g. `https://api.moogo.dev/p/<project_id>` |
| `MOOGO_SECRET_KEY` | yes | — | SQL credential (project secret) |
| `MOOGO_MCP_TRANSPORT` | no | `stdio` | `stdio` or `http` |
| `MOOGO_MCP_ADDR` | no | `127.0.0.1:4618` | Only for `http` transport |
| `MOOGO_BUCKET_ACCESS_KEY_ID` | no* | — | Bucket tools need **both** this and the secret |
| `MOOGO_BUCKET_SECRET_KEY` | no* | — | Bucket tools need **both** this and the access key id |

\* Bucket tools are registered only when **both** bucket variables are set.
When neither is set, the server exposes SQL tools only.

### stdio transport (default, for local agents)

```bash
go build -o moogo-mcp ./cmd/mcp
```

```json
{
  "mcpServers": {
    "moogo": {
      "command": "/path/to/moogo-mcp",
      "env": {
        "MOOGO_PROJECT_URL": "https://api.moogo.dev/p/<project_id>",
        "MOOGO_SECRET_KEY": "...",
        "MOOGO_BUCKET_ACCESS_KEY_ID": "...",   // optional
        "MOOGO_BUCKET_SECRET_KEY": "..."       // optional
      }
    }
  }
}
```

The server reads all variables once at startup and speaks stdio. Every tool call
is an HTTP request to the data plane, so the key check, rate limit, sanitizer
and size caps are unchanged.

### HTTP transport (for remote agents)

```bash
MOOGO_MCP_TRANSPORT=http MOOGO_MCP_ADDR=127.0.0.1:4618 ./moogo-mcp
# → listening on http://127.0.0.1:4618/mcp
```

The endpoint is `/mcp` (Streamable HTTP). An agent initializes with:

```bash
curl -X POST http://127.0.0.1:4618/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
```

**Security**: the default `127.0.0.1:4618` binds loopback on purpose — the
process holds the project secret. Do **not** bind `0.0.0.0` unless you run it
behind an authenticated tunnel (SSH, WireGuard, Cloudflare Tunnel). The secret
is never logged, never in tool args, never in tool results.

## SQL API

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN`, `WITH` that selects | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |
| `/transaction` | Several writes as one atomic batch | Reads, with `not_a_write` |
| `/maintenance` | Maintenance operations (`vacuum`) | — |

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
`{"success": true, "rows_affected": 1, "size_bytes": 24576, "duration_ms": 2}`.
Every failure, on any endpoint, uses one envelope:

```json
{ "error": { "code": "not_a_read", "message": "...", "detail": "..." } }
```

## Maintenance / Vacuum

Reclaim space after deletes/drops. The database file never shrinks on its own.

```bash
# Via HTTP
curl -X POST "$MOOGO_PROJECT_URL/maintenance" \
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"operation": "vacuum"}'

# Or via CLI
moogo db vacuum
```

Runs `REINDEX` → `ANALYZE` → `VACUUM` → `WAL checkpoint`. Size limits remain
enforced (250 MB/project).

## Transactions

When one logical change is several writes, send them to `/transaction` as one
batch. They commit together or not at all. (`/exec/txn` is an accepted alias.)

```json
POST /transaction
{
  "statements": [
    { "query": "INSERT INTO users (id, email) VALUES (?, ?)", "args": ["7c1f", "ketut@example.com"] },
    { "query": "INSERT INTO activity (user_id, action) VALUES (?, ?)", "args": ["7c1f", "created"] }
  ]
}
```

```json
{
  "success": true,
  "statements": [
    { "rows_affected": 1, "last_insert_rowid": 1 },
    { "rows_affected": 1 }
  ],
  "rows_affected": 2,
  "size_bytes": 24576,
  "duration_ms": 3
}
```

- `statements[i]` is the outcome of `statements[i]` from the request, in order.
- **`last_insert_rowid`** is present only on a statement that inserted a row —
  an `INSERT` or a `REPLACE`. It is the new row's id, so creating a record does
  not need a `SELECT` to learn it. It is omitted, not zeroed, on every other
  statement: an `UPDATE` right after an `INSERT` would otherwise report the id
  the `INSERT` created.
- A failure rolls the whole batch back and names the position:
  `"detail": "statement 2: execute statement: constraint failed: ..."`. Nothing
  partial is left behind, so a retry is safe.
- Up to 100 statements, one statement per entry, and one 15-second budget for
  the whole batch.
- Reads stay on `/query`. A write that seems to need a read first usually does
  not: `UPDATE counters SET signups = signups + 1 WHERE id = ?` needs no read.

Rules the engine enforces, not conventions:

- `?` placeholders with an `args` array — values are bound as
  prepared-statement arguments, never concatenated into SQL.
- One statement per entry. Stacked statements (`a; b`) are rejected. Several
  statements belong in a `/transaction` batch.
- File functions (`readfile`, `writefile`, `load_extension`) are rejected.
- Statements are capped at 64 KB and cancelled after 15 seconds.
- Results cap at 1000 rows; `truncated: true` means there is more to fetch.
- `foreign_keys` is **on** for every connection, so a `REFERENCES` clause is
  enforced — an orphan insert fails. Declare it explicitly; a column without
  `REFERENCES` is a plain column.

## Command line client (CLI)

The official `moogo` CLI is a pure HTTP client — it makes the same requests to the API as `curl`, with no direct access to the database or object files.

### Install

**Recommended (no Go required):**

```bash
curl -fsSL https://get.moogo.dev | sh
```

**Alternative (if you have Go):**

```bash
go install github.com/moogodev/moogodev/cmd/moogo@latest
```

Verify:

```bash
moogo version
moogo help
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `MOOGO_PROJECT_URL` | yes | e.g. `https://api.moogo.dev/p/<project_id>` |
| `MOOGO_SECRET_KEY` | yes | Project secret key for SQL commands |
| `MOOGO_BUCKET_ACCESS_KEY_ID` | for `bucket` commands | Storage credential |
| `MOOGO_BUCKET_SECRET_KEY` | for `bucket` commands | Storage credential |

Flags `--url`, `--key`, `--storage-key-id`, `--storage-key` override environment variables.

### Commands

| Command | Does |
|---|---|
| `moogo db push <file>` | Apply a SQL file as one or more transactions |
| `moogo db seed [file]` | Apply a seed file once (tracked by content hash) |
| `moogo db reset --yes` | Drop every table and view in the project |
| `moogo db vacuum` | Reindex, analyze, vacuum and checkpoint the WAL to reclaim free space |
| `moogo bucket ls [prefix]` | List objects in a bucket (cursor-based, walks pages) |
| `moogo bucket rm <key>...` | Delete objects, or with `--prefix` an entire folder |
| `moogo version` | Print client version |
| `moogo help` | Print usage |

The CLI follows the same rules as the API: placeholders via args, one statement per request where applicable, and it will not do anything the API refuses to do.

## Official JS/TS Client

Install:

```bash
npm install @moogodev/client
```

```typescript
import { MoogoClient, createClientFromEnv } from '@moogodev/client';

// From env vars (MOOGO_API_URL, MOOGO_PROJECT_ID, MOOGO_BUCKET_ACCESS_KEY_ID, MOOGO_BUCKET_SECRET_KEY)
const client = createClientFromEnv();

// Upload with custom Cache-Control
await client.upload('avatars/user.png', fileBlob, {
  contentType: 'image/png',
  cacheControl: 'public, max-age=31536000, immutable',
  onProgress: (loaded, total) => console.log(`${loaded}/${total}`),
});

// List objects (cursor-based pagination)
const { objects, nextCursor, total } = await client.listObjects({ 
  prefix: 'avatars/', 
  limit: 50 
});

// Download
const blob = await client.downloadBlob('avatars/user.png');

// Presigned URL
const { url, expiresAt } = await client.getPresignedUrl('avatars/user.png', {
  method: 'GET',
  expiresIn: 3600,
});
```

See [npm](https://www.npmjs.com/package/@moogodev/client) for full API.

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
| Upload | `POST $ENDPOINT/{key}` — the body is the raw file bytes and the `Content-Type` is the file's own type: never a JSON wrapper around the bytes, and never `application/json` by default (it is correct only when the file really is JSON). `?bucket=NAME` picks a bucket; no bucket means `default`. |
| Download | `GET $ENDPOINT/{key}` — returns the bytes with the object's `Content-Type`. Supports `Range` header for partial downloads (206 Partial Content, 416 Range Not Satisfiable). |
| Delete | `DELETE $ENDPOINT/{key}` |
| List | `GET $ENDPOINT/?limit=100&order=key&dir=asc` — add `?bucket=NAME` to pick a bucket. **Cursor-based pagination**: use `cursor` from previous page, not `offset`. Response includes `next_cursor` and stable `total`. |

Upload answers with the object — `key`, `size_bytes`, `content_type`,
`storage_used_bytes` and `quota_bytes` — and URL fields:

- `url` — authenticated download (needs credential), for your application
- `preview_url` — dashboard preview (session cookie)
- `public_url` — empty until published, then `https://cdn.moogo.dev/pub/{project_id}/{key}`
- `public_url_base` — CDN origin for building public URLs
- `url_base` — API origin for building authenticated URLs

### Custom Cache-Control

Override default caching by sending `Cache-Control` header on upload:

```bash
curl -X POST "$ENDPOINT/avatars/kit.png" \
  -H "Cache-Control: public, max-age=31536000, immutable" \
  --data-binary @kit.png
```

Stored with object, used for all subsequent downloads. Defaults:

| Access type | Default `Cache-Control` |
|---|---|
| Published (`/pub/`) | `public, max-age=300, must-revalidate` |
| Private / Signed | `private, no-cache` |

### Publishing — per-object, not global

**Publishing is per-object.** Setting a bucket to public (`PATCH /buckets/{id}` with `is_public: true`) only affects **new uploads** — it fans out the default visibility to future objects. Existing objects keep their individual `is_public` state. To publish an existing object, PATCH it directly.

```bash
# Publish a single object
curl -X PATCH "$ENDPOINT/avatars/kit.png" \
  -H "Content-Type: application/json" \
  -d '{"is_public": true}'

# Set bucket default for new uploads
curl -X PATCH "$CATALOG/bucket-id" \
  -H "Content-Type: application/json" \
  -d '{"is_public": true}'
```

### Bucket info endpoint

```bash
GET /buckets/{project_id}/{bucket_id}
```

Returns bucket config (`is_public`, `allowed_types`, `max_object_size_bytes`, `quota_bytes`) plus `storage_used_bytes` and project `quota_bytes`.

### 404 shape and CDN negative caching

All errors use the same envelope: `{"error":{"code":"...","message":"...","detail":"..."}}`.

On `/pub/*` (public route), missing or unpublished objects return `404 not_found` with that envelope. These responses are sent with `Cache-Control: no-store, no-cache, must-revalidate, private` to avoid CDN negative caching. The shape is identical to authenticated routes.

If a published object was previously accessed while unpublished, a CDN may have cached the 404. To purge: re-upload the object (changes ETag), or wait for the negative cache TTL to expire.

## Limits

Every limit is enforced by the server, and most come back in the response.

| What | Limit |
|---|---|
| Projects per account | 2 |
| Database size | 250 MB per project; the file never shrinks on its own |
| Storage | 250 MB per project, summed across all buckets |
| Object size | The bucket's `max_object_size_bytes`, or 250 MB |
| JSON request body | 1 MB (`body_too_large`) |
| Statement | 64 KB (`sql_too_long`), 15 seconds (`statement_timeout`) |
| Storage credentials | 5 per project (`credential_limit`) |
| Sign-in endpoints | 10 requests/minute per client address, shared across them (`rate_limited`) |
| Data plane | 300 requests/minute — queries per project, storage per address (`rate_limited`) |
| Result rows | 1000 per response; `truncated: true` when the cap was hit |

Reads report `truncated` and `duration_ms`; storage reports
`storage_used_bytes` and `quota_bytes`. Check them instead of assuming.

**Rate-limit headers** on every response:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Max requests in window |
| `X-RateLimit-Remaining` | Requests left in window |
| `X-RateLimit-Reset` | Unix timestamp when allowance refills to limit |

## Do

- Read credentials from the environment; never ask the user to paste them.
- Bind every value through `args`; treat SQL strings as code to review.
- Keep the SQL key and the storage credential on their own endpoints.
- Branch on `error.code`, never on the message text.
- Send `Content-Type: application/json` on JSON requests — it is enforced.
- Page storage listings with `cursor`, and re-fetch when a read returns `truncated: true`.
- Use `/query` for reads and `/exec` for writes; each refuses the other.
- Group writes that must not half-apply into one `/transaction` batch, and read
  `last_insert_rowid` instead of running a `SELECT` for a new id.
- Run each migration file as one `/transaction` batch, so a failure applies
  nothing.
- Use `Range` header for resumable downloads and partial reads.
- Use `X-RateLimit-Reset` to schedule retries instead of guessing.

## Don't

- Don't concatenate user input into SQL — the placeholder syntax exists for
  that.
- Don't send stacked statements, file functions, or statements over 64 KB.
- Don't JSON-wrap an upload or send its `Content-Type: application/json` out
  of habit: the body is raw bytes with the file's own type — `application/json`
  is right only when the file really is JSON.
- Don't put a private object's `url` in an `<img>` tag — a browser carries no
  storage credential.
- Don't assume a different error shape somewhere: it is always
  `{"error": {"code", "message", "detail"}}`.
- Don't paste the secret key, the bucket secret, or session cookies into chat,
  logs, or client-side code.
- Don't use `offset` for pagination — use `cursor` (keyset pagination).
- Don't treat Moogo as production-ready; it is in development.

## Learn more

- [Quickstart](/docs/quickstart) — account to first query in two minutes
- [Credentials](/docs/credentials) — the two credential types and rotation
- [SQL API](/docs/sql-api) — the full reference for `/query`, `/exec`, `/transaction`, `/maintenance`
- [Object storage](/docs/object-storage) — buckets, publishing, listing, cursor pagination, range requests, custom Cache-Control
- [Command line client](/docs/cli) — `moogo db push/seed/reset/vacuum`, `bucket ls/rm`, install via `curl -fsSL https://get.moogo.dev | sh`
- [Maintenance](/docs/sql-api#post-maintenance--reclaim-space-after-deletes) — reclaim database space with `POST /maintenance` or `moogo db vacuum`
- [Limits](/docs/limits) — quotas and request caps in detail
- [Errors](/docs/errors) — every error code and what to do about it
- [Security](/docs/security) — the threat model, stated plainly