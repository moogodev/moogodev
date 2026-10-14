# Before Start

Welcome to Moogo! This page helps you who are new to the service understand
the basic concepts, the differences with regular SQLite, and all the terms
you will encounter while using this service.

It is written as a short dictionary/reference to read before starting to build
an application.

---

## What is Moogo?

Moogo is a hosted backend that gives every project its own SQLite database
and object storage, each reachable over plain HTTP.

There is no connection string, no driver, and no database client to install.

You only need three environment variables:

| Variable | Example | Description |
|----------|---------|-------------|
| `MOOGO_PROJECT_URL` | `https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0` | Base URL for all SQL requests |
| `MOOGO_SECRET_KEY` | `moogo_...` | Secret key for SQL endpoint authentication |
| `MOOGO_BUCKET_ENDPOINT` | `https://api.moogo.dev/p/<project-id>/bucket` | Base URL for object storage |

Put these three variables into your application, and you can read and write data
through HTTP requests.

---

## SQLite over HTTP vs Regular SQLite

This is the fundamental difference you must understand before starting:

### Regular SQLite (Local)

- **Requires driver/database client** installed on your machine (examples: `psql`, `sqlite3`, `pysqlite`, `prisma`, `django-orm`)
- **Direct connection to `.db` file** on local filesystem or your own server
- **In-process connection** — your application communicates directly with the database file
- **Single-user write** — SQLite allows one writer at a time; needs special libraries for concurrency
- **You are fully responsible** for backup, migration, security, size monitoring

### SQLite over HTTP (Moogo)

- **No driver needed** — only `fetch` or `curl` with HTTP
- **Connection via HTTP endpoint** — application sends requests to `https://api.moogo.dev/...`
- **Two-tier architecture:**
  - **Control plane:** PostgreSQL managing accounts, projects, quotas, bucket catalog
  - **Data plane:** SQLite per-project, storing your actual data
  - **The two planes never mix** — a bug in the control plane cannot reach data plane data
- **Physical isolation:** Each project has its own `.db` file at `/data/dbs/{project_id}.db`. No shared tables, no shared buffer pool.
- **Activity reported** — every limit (250 MB, 15 seconds, 1 MB request body) returned in API response, not "hanged tab" or "surprise bill"
- **No SDK needed** — just `curl` with header `Authorization: Bearer ...` and `Content-Type: application/json`
- **Honest limits** — every limit reported by API, so you know when you exceed limits
- **Managed infrastructure** — all infrastructure handled by Moogo
- **Off-site backups built in** — every database is copied to Cloudflare R2 on a schedule and can be restored from the dashboard, so you are not on your own for backup. See [Backups](/docs/backups).

**In short:** Regular SQLite = install driver + local file connection. Moogo = HTTP requests + environment variables only.

---

## Dictionary of Important Terms

Below is a dictionary of terms you will encounter while using Moogo. Read it like a dictionary, one by one.

---

### Database & Project

| Term | Definition |
|------|------------|
| **Project** | Isolated unit in Moogo. Each project has its own SQLite database and bucket storage. Like a "project" in GitHub or Firebase — each project has its own settings and credentials. |
| **Project URL** | Main endpoint for SQL requests. Format: `https://api.moogo.dev/p/{project_id}`. Project ID is a unique UUID. |
| **Project ID** | Unique project identifier in UUID format (example: `8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0`). Used in URL and to ensure access only by project owner. |
| **Secret Key** | Secret key `moogo_...` given when project is created. Used for authentication on SQL endpoints. **Never** put in client-side code (browser) as it will be visible to anyone inspecting the code. |
| **Control Plane** | Upper tier managing "admin" operations: accounts, project creation, quota management, bucket catalog, activity logs. Runs on PostgreSQL. **Never** use project key for data operations. |
| **Data Plane** | Lower tier storing your actual data in SQLite database per-project. All `SELECT`, `INSERT`, `UPDATE`, `DELETE` queries run here. |
| **Isolation** | Because each project has its own `.db` file, cross-project queries cannot happen even if you know another project's ID. Other projects will respond with `404`. |

---

### SQL Endpoint & Statements

| Term | Definition |
|------|------------|
| **`/query`** | Endpoint for **read** only. Send `SELECT`, `WITH`, `PRAGMA`, `EXPLAIN`, etc. Database rejects if you try to send `INSERT`, `UPDATE`, `DELETE`. Can carry `args` (positional parameters). |
| **`/exec`** | Endpoint for **write** single statement. Send `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, etc. **Cannot** send `SELECT` to this endpoint. |
| **`/transaction`** | Endpoint for **multiple SQL statements** as one atomic unit. **Either all commit** or **all rollback**. Important: max 100 statements, 15-second total budget. **Never** combine large DDL (creating many tables) with intensive data manipulation in one transaction. |
| **`/exec/txn`** | Alias for `/transaction`. Behaves identically. |
| **`isReadStatement()`** | Internal function that identifies whether a statement is read (`SELECT`/`VALUES`/`PRAGMA`/`EXPLAIN`/`WITH`) or write. Used by server to determine which endpoint must be used. |
| **Parameterized Query** | Query with `?` placeholders and `args` array. **Important:** **NEVER** replace `?` with direct values (string interpolation) because of SQL injection risk. Always use format `{"query": "SELECT * FROM users WHERE plan = ?", "args": ["pro"]}`. |
| **DDL (Data Definition Language)** | Statements changing database structure: `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`. Can be sent to `/exec` or `/transaction`. |
| **DML (Data Manipulation Language)** | Statements manipulating data: `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Different endpoints for read vs write. |

---

### Object Storage & Bucket

| Term | Definition |
|------|------------|
| **Bucket** | Container for grouping objects (files) with different usage patterns in a project. Common structure examples: `avatars` (profile photos), `exports` (data export files), `templates` (config templates). Each bucket has `max_object_size_bytes` and plays role in storage quota management. |
| **Object** | Individual file stored inside a bucket. Each object has key (filename), size_bytes, content_type, is_public flag. |
| **Key** | Full filename inside bucket. Structure: `/{prefix}/{filename}`. Example: `avatars/kit.png` — where `avatars` is bucket name and `kit.png` is filename. **First part before `/` is part of bucket name.** |
| **Upload** | Process of putting object into bucket via HTTP POST. Must add `?bucket=bucket_name` parameter if you want to put object in a specific bucket (not default bucket). Object is private by default after upload. |
| **Publish** | Mechanism to change object from private to publicly readable (no credentials). Set `is_public: true` via PATCH request or dashboard. After publishing, `public_url` is populated with `https://cdn.moogo.dev/pub/{project_id}/{key}` (if CDN enabled) or `https://api.moogo.dev/pub/{project_id}/{key}`. |
| **Public URL** | URL shareable by anyone without credentials. **IMPORTANT:** `public_url` is a **bearer token** — it is a URL that can be shared with anyone and **cannot be revoked** without rotating the key or unpublishing the object. If you share `public_url`, as long as object remains published, anyone with the URL can access it. **Recommended workflow:** after upload, do `PATCH is_public: true` if you want object readable without credentials. |
| **`/pub/{project_id}/{key}`** | Public path for published objects. **`project_id` is required** in this path. **Never use `/pub/{key}` alone**, because `project_id` is required to identify the project. |
| **`max_object_size_bytes`** | Maximum object size per bucket. If bucket doesn't set size, project ceiling of 250 MB applies. |
| **Storage Quota** | Total storage limit per project: **250 MB** across all buckets. Monitor daily usage, and migrate to a new project before reaching 250 MB. Database does not auto-shrink when data is deleted — requires VACUUM (blocked on Moogo) or progressive row deletion. |

---

### Error & Code

| Term | Definition |
|------|------------|
| **Error Code** | Machine-readable code in error response envelope. Examples: `sql_error`, `database_not_found`, `database_too_large`, `statement_timeout`, `quota_exceeded`, `project_paused`, `project_not_ready`, `body_too_large`, `invalid_json`. **Highly recommended** to compare `code` rather than `message` for branching logic in application. |
| **Error Message** | Human-readable description of error. Can change; don't rely on it for application logic. |
| **Error Detail** | Additional information about error, usually the offending token or statement position. |
| **Retryable vs Non-Retryable** | - **Retryable:** `database_busy` — can retry with exponential backoff after `PRAGMA busy_timeout`.<br>- **Non-retryable:** `quota_exceeded` — don't retry, notify user storage quota exceeded.<br>- **Cannot retry:** `not_found`, `sql_invalid`, `too_many_statements`. |

---

### Limits

| Term | Limit | Description |
|------|-------|-------------|
| **Database size** | 250 MB per project | Measured before every write. Calculated as `(page_count - freelist_count) * page_size`. |
| **Statement timeout** | 15 seconds | Exceeding causes `500 timeout`. |
| **Max statements per transaction** | 100 statements | Exceeding causes `too_many_statements` error. |
| **Max object size** | Bucket's `max_object_size_bytes` or 250 MB | If bucket sets its own size, that limit applies. |
| **Max request body** | 1 MB | JSON request body limit for SQL endpoints. |
| **Projects per account** | 2 projects | `POST /api/projects` responds `429 quota_exceeded` for third project. |
| **Rows per read response** | Max 1000 rows or 16 MB | If data exceeds, truncated and marked `truncated: true`. |

---

### Debug & Tips

| Tip | Description |
|-----|-------------|
| **Check `error.code` before `error.message`** | Error envelope is consistent, but code is more stable for branching logic |
| **Use `LIMIT/OFFSET` for paging** | For datasets > 100 rows, use small pages (example: 50 rows per page) instead of `SELECT *` entirely |
| **Avoid `SELECT *`** | Schema changes break clients without migration. Always specify needed columns. |
| **Database does not auto-shrink** | `DELETE` frees pages, but physical space (250 MB) doesn't shrink until `VACUUM` executes (blocked on Moogo). |
| **Monitor Daily Usage** | If approaching 230 MB, migrate to a new project before reaching the 250 MB ceiling. |
| **Session cookie has HttpOnly + Secure + SameSite=Lax** | Prevents XSS from stealing session and cross-site CSRF. |
| **SQL key never sent to browser** | Dashboard uses session cookie, but SQL API needs secret key stored server-side. |
| **Public URL requires publish first** | Private objects have empty `public_url`. Ensure object is published (`PATCH is_public: true`) before sharing URL. |

---

## Next Steps After Understanding

1. **Create project** via dashboard or `POST /api/projects`
2. **Get 3 environment variables** (`MOOGO_PROJECT_URL`, `MOOGO_SECRET_KEY`, `MOOGO_BUCKET_ENDPOINT`)
3. **Read Production Readiness section** in your favorite framework guide (React, Python, Go, etc.)
4. **Try first simple query:**
   ```bash
   curl $MOOGO_PROJECT_URL/query \
     -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{"query":"SELECT 1+2 as result","args":[]}'
   ```
5. **Try first object upload:**
   ```bash
   curl -X POST "$MOOGO_BUCKET_ENDPOINT/kit.png?bucket=avatars" \
     -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
     -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \
     -H "Content-Type: image/png" \
     --data-binary @kit.png
   ```
6. **Publish if you want to share without credentials:**
   ```bash
   curl -X PATCH "$MOOGO_BUCKET_ENDPOINT/avatars/kit.png" \
     -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
     -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{"is_public": true}'
   ```

---

## Still Confused?

If any term is still unclear, see the reference documentation below:

- `/docs/sql-api` — complete SQL endpoint documentation
- `/docs/object-storage` — complete object storage documentation
- `/docs/limits` — all limits and quotas documentation
- `/docs/security` — why security rules exist
- `/docs/errors` — every error code and how to handle it

---

If you already understand all of this, you are ready to build a small-to-medium Moogo application. Remember: read the framework documentation guide you are using, and get used to comparing `error.code` rather than `error.message` when handling errors.