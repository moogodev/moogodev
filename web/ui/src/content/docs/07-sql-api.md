# SQL API

Two endpoints. One runs reads, the other runs writes. Both take a project key and
both validate your SQL before it touches the database.

## Base URL

Everything hangs off `MOOGO_PROJECT_URL`, which already contains the project id:

```
https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
```

Append `/query` or `/exec`. You never assemble the path yourself, so the internal
route layout is not something your application has to track.

There is also an older form, `/db/{project_id}/query` and `/db/{project_id}/exec`.
It behaves identically and exists so integrations built against it keep working.
New code should use the project-scoped URL.

## Authentication

Every request needs the project key:

```
Authorization: Bearer moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
Content-Type: application/json
```

A missing or wrong key returns `401`.

## Request body

Both endpoints take the same body:

```json
{
  "query": "SELECT id, email FROM users WHERE plan = ?",
  "args": ["pro"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `query` | string | Yes | One SQL statement. |
| `args` | array | No | Values for the `?` placeholders, in order. |

Unknown fields are rejected rather than ignored. If you send `{"argz": [...]}` you
get an error instead of a success that quietly did nothing.

### Always use `args`

Values belong in `args`, never concatenated into `query`. `args` travel as bound
parameters, so a value can never become syntax:

```json
{ "query": "INSERT INTO users (id, email) VALUES (?, ?)", "args": ["7c1f", "ketut@example.com"] }
```

Not this, ever:

```json
{ "query": "INSERT INTO users (id, email) VALUES ('7c1f', 'ketut@example.com')" }
```

## `POST /query` — reads

Use this for anything that returns rows: `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN`.

```bash
curl $MOOGO_PROJECT_URL/query \
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id, email FROM users WHERE plan = ?","args":["pro"]}'
```

Response:

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

| Field | Type | Notes |
|---|---|---|
| `success` | boolean | Always `true` on a 200. |
| `columns` | string[] | The shape of every row. |
| `rows` | any[][] | Positionally aligned with `columns`. |
| `row_count` | number | Rows returned. |
| `truncated` | boolean | `true` if a row cap was hit — do not treat this as the whole table. |
| `duration_ms` | number | Server-side execution time. |

Rows are **arrays, not objects**. `rows[i][j]` corresponds to `columns[j]`, which
keeps the payload small and lets you render a table without reading the first row
to discover the shape.

`/query` **rejects writes** with `not_a_read`. That is deliberate: routing a write
through the read endpoint would let a caller pull a large result set past the row
cap.

## `POST /exec` — writes

Use this for `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`.

```bash
curl $MOOGO_PROJECT_URL/exec \
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"INSERT INTO users (id, email, plan) VALUES (?, ?, ?)","args":["7c1f","ketut@example.com","free"]}'
```

Response:

```json
{
  "success": true,
  "rows_affected": 1,
  "size_bytes": 24576,
  "duration_ms": 1
}
```

| Field | Type | Notes |
|---|---|---|
| `success` | boolean | Always `true` on a 200. |
| `rows_affected` | number | Rows changed. |
| `size_bytes` | number | Database size after the write. Useful for tracking quota. |
| `duration_ms` | number | Server-side execution time. |

`/exec` rejects reads with `not_a_write`.

> **DDL goes here too.** `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX` are all
> writes. They run through the same sanitizer, so check
> [what is rejected](#what-is-rejected) before you are surprised.

## One statement per request

Send exactly one statement. A second statement is rejected with
`sql_multiple_statements`.

```json
{ "query": "SELECT 1; DROP TABLE users" }
```

This is checked on **tokens**, not on raw text, so a semicolon inside a string
literal or a comment is not counted:

```json
{ "query": "SELECT * FROM notes WHERE body = 'hello; world'" }
```

That is fine. A trailing semicolon is also fine — it terminates the statement
rather than starting another one.

## What is rejected

Every statement is tokenized and inspected **before** it runs. Rejections come
back as `400` with a specific `code`.

### Keywords that would escape the database

| Rejected | Because |
|---|---|
| `ATTACH` | Opens an arbitrary path as a database. This would turn `/exec` into a file reader for the whole host. |
| `DETACH` | The other half of the same escape. |
| `VACUUM` | Rewrites the whole file, bypassing the per-project size limit. |
| `REINDEX` | Same — it rebuilds and can grow the file unchecked. |
| `ANALYZE` | Same. |
| `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE` | You get one statement per request, and transactions are managed per request. |

### Functions that read files or load native code

`readfile`, `writefile`, `load_extension`, `edit`, `fts3_tokenizer`,
`sqlite_compileoption_get`, `sqlite_compileoption_used`.

These are matched **by name anywhere they appear**, including as a column or table
name. That means a column literally named `readfile` is refused. This is a
deliberate trade: a confusingly-named column is a small cost next to a readable
`/etc/passwd`.

### Triggers

`CREATE TRIGGER` is rejected. A trigger body sits between `BEGIN` and `END` and
contains semicolons, so detecting stacked statements correctly needs a real
parser — and a hand-rolled approximation is exactly the kind of check that fails
open on input SQLite accepts. Triggers are declined rather than shipping a check
that might be wrong. Write your invariants in application code.

### PRAGMA

`PRAGMA` is **allowlisted, not blocked**, because many pragmas write to the file
(`journal_mode`, `key`, `rekey`, `page_size`, `auto_vacuum`, `synchronous`).

Allowed:

`table_info`, `table_xinfo`, `index_list`, `index_info`, `index_xinfo`,
`foreign_key_list`, `database_list`, `collation_list`, `function_list`,
`module_list`, `pragma_list`, `compile_options`, `integrity_check`,
`quick_check`, `foreign_key_check`

Both spellings work:

```json
{ "query": "PRAGMA table_info(users)" }
{ "query": "pragma_table_info('users')" }
```

These are read-only introspection statements, which is what the dashboard's
schema inspector needs.

### Size and duration

| Limit | Value | Error code |
|---|---|---|
| Statement length | 64 KB | `sql_too_long` |
| Request body | 1 MB | `body_too_large` |
| Execution time | 15 seconds | `statement_timeout` |
| Database size | 100 MB | `database_too_large` |

The statement length limit bounds tokenizer work and error-message size. It is not
a substitute for the body limit, which is enforced while reading.

A write that **would** cross the size ceiling is refused before it commits. You
get an error, not a silently truncated database.

## Concurrency

- **Reads run in parallel.** `WAL` mode means a reader never blocks the writer.
- **Writes are serialised per project**, so two concurrent writes cannot hit
  `SQLITE_BUSY`.
- `busy_timeout` is still set as a backstop.
- `journal_mode = WAL` and `foreign_keys = ON` on every connection.
- **One connection per project**, not a global pool, so the number of open file
  handles is bounded and countable.

## Complete example

A tiny data layer, in plain JavaScript:

```js
// db.js
const base = process.env.MOOGO_PROJECT_URL;
const headers = {
  Authorization: `Bearer ${process.env.MOOGO_SECRET_KEY}`,
  "Content-Type": "application/json",
};

async function sql(query, args = []) {
  // Route to the right endpoint: /query for reads, /exec for writes.
  const endpoint = /^(select|values|pragma|explain)\b/i.test(query.trim())
    ? "query"
    : "exec";

  const response = await fetch(`${base}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, args }),
  });

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message ?? "request failed");
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

// Reads come back as arrays; give callers objects instead.
export async function all(query, args = []) {
  const result = await sql(query, args);
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
}

export async function run(query, args = []) {
  return sql(query, args);
}
```

Using it:

```js
await run(
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, plan TEXT)",
);

await run("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [
  "7c1f",
  "ketut@example.com",
  "free",
]);

const proUsers = await all("SELECT id, email FROM users WHERE plan = ?", ["pro"]);
```

## Errors

Every error has the same shape, so you can branch on `code` instead of parsing
`message`:

```json
{
  "error": {
    "code": "sql_forbidden_keyword",
    "message": "this statement type is not allowed",
    "detail": "ATTACH"
  }
}
```

| Field | Notes |
|---|---|
| `code` | Stable and machine-readable. Safe to branch on. |
| `message` | Human-readable, safe to show a developer. |
| `detail` | Optional context. For SQL errors this is the driver's message. |

### SQL validation codes

| Code | Meaning |
|---|---|
| `sql_empty` | No statement was sent. |
| `sql_syntax_error` | Could not be tokenized — usually an unterminated string or comment. |
| `sql_multiple_statements` | More than one statement. |
| `sql_forbidden_keyword` | A blocked keyword or trigger was used. `detail` names it. |
| `sql_forbidden_function` | A blocked function name was used. |
| `sql_forbidden_pragma` | The PRAGMA is not on the allowlist. |
| `sql_too_long` | Statement over 64 KB. |
| `not_a_read` | A write was sent to `/query`. |
| `not_a_write` | A read was sent to `/exec`. |

### Runtime codes

| Code | Status | Meaning |
|---|---|---|
| `sql_error` | 400 | SQLite rejected the statement. Check `detail`. |
| `database_not_found` | 404 | The project database does not exist. |
| `database_too_large` | 413 | The database is at its 100 MB ceiling. |
| `statement_timeout` | 504 | The statement passed 15 seconds and was cancelled. |
| `quota_exceeded` | 429 | An account quota was reached. |
| `project_paused` | 403 | The project is paused. |
| `project_not_ready` | 403 | The project is still being created. |
| `body_too_large` | 413 | Request body over 1 MB. |
| `invalid_json` | 400 | The body was not valid JSON. |

See [Errors and troubleshooting](/docs/errors) for how to handle them.

## Next

- [Object storage](/docs/object-storage) — files under the same project
- [Security](/docs/security) — why these rules exist
- [Errors](/docs/errors) — every error code and what to do about it