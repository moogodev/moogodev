# Errors and troubleshooting

Every error from the Moogo API has the same shape. Branch on `code`, not on
`message`.

## The error envelope

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
| `message` | Human-readable. Safe to show a developer. |
| `detail` | Optional. For SQL errors, the offending token or the driver's message. |

There is exactly one shape across the whole API. You do not need to guess whether
a failure is `{"error": "..."}` or `{"message": "..."}`, so you do not need a
`try/catch` variant per endpoint.

## Handling errors

```js
async function sql(query, args = []) {
  const response = await fetch(`${base}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, args }),
  });

  const body = await response.json();
  if (!response.ok) {
    // code is stable and safe to branch on.
    throw Object.assign(new Error(body.error.message), {
      code: body.error.code,
      detail: body.error.detail,
      status: response.status,
    });
  }
  return body;
}
```

A useful rule: **retry only on `429` and `5xx`.** Everything else is a decision the
code already made, and retrying the same request will produce the same error.

## SQL validation errors

These mean the statement was refused **before** it touched the database. All are
`400`.

| Code | Meaning | Fix |
|---|---|---|
| `sql_empty` | No statement was sent. | Check that `query` is present and not an empty string. |
| `sql_syntax_error` | Could not be tokenized. | Usually an unterminated string literal or comment. `detail` gives the byte offset. |
| `sql_multiple_statements` | More than one statement. | Send one statement per request. Split them. |
| `sql_forbidden_keyword` | A blocked keyword or a trigger. | `detail` names it. See [what is rejected](/docs/sql-api#what-is-rejected). |
| `sql_forbidden_function` | A blocked function name. | Usually a column named `readfile` or `edit`. Rename it. |
| `sql_forbidden_pragma` | PRAGMA not on the allowlist. | Use one of the [allowed pragmas](/docs/sql-api#pragma). |
| `sql_too_long` | Statement over 64 KB. | Split it into several requests. |
| `not_a_read` | A write was sent to `/query`. | Send it to `/exec`. |
| `not_a_write` | A read was sent to `/exec`. | Send it to `/query`. |
| `invalid_json` | Body was not valid JSON. | Check quoting, especially around SQL that contains `"`. |

### A note on `sql_too_long`

A statement over 64 KB is refused. If you are generating SQL programmatically,
this usually means you are building one giant `INSERT`. Send batches instead:

```js
const batch = 500;
for (let index = 0; index < rows.length; index += batch) {
  const slice = rows.slice(index, index + batch);
  const placeholders = slice.map(() => "(?, ?, ?)").join(", ");
  const values = slice.flatMap((row) => [row.id, row.email, row.plan]);
  await run(
    `INSERT INTO users (id, email, plan) VALUES ${placeholders}`,
    values,
  );
}
```

## Runtime SQL errors

| Code | Status | Meaning |
|---|---|---|
| `sql_error` | 400 | SQLite rejected the statement. `detail` has the driver's message. |
| `database_not_found` | 404 | The project database does not exist. |
| `statement_timeout` | 504 | Passed 15 seconds and was cancelled. |
| `database_too_large` | 413 | The database is at its 100 MB ceiling. |

### `sql_error` — read `detail`

This is SQLite's own message and it is usually specific:

| `detail` contains | Cause |
|---|---|
| `no such table` | The table does not exist, or the name is wrong. |
| `no such column` | The column does not exist in this table. |
| `UNIQUE constraint failed` | A duplicate value in a unique column or primary key. |
| `FOREIGN KEY constraint failed` | The referenced row does not exist. Foreign keys are on. |
| `datatype mismatch` | A value's type does not fit the column. |
| `NOT NULL constraint failed` | A required column was omitted or null. |

SQLite reports these as one generic error, so `detail` is where the actual
explanation lives. Log it.

## Request errors

| Code | Status | Meaning |
|---|---|---|
| `body_too_large` | 413 | Request body over 1 MB. |
| `invalid_project_id` | 400 | The id in the URL is not a valid UUID. |
| `invalid_body` | 400 | Body was not a JSON object with the expected fields. |
| `unsupported_media_type` | 415 | `Content-Type` was not `application/json`. |
| `not_found` | 404 | No such endpoint. Check the path. |
| `rate_limited` | 429 | Too many requests from one client address. Comes with a `Retry-After` header. |

`invalid_body` usually means a **typo in a field name**. Unknown fields are
rejected rather than ignored, so `{"is_pubic": true}` is an error rather than a
success that did nothing.

## Authentication and authorization

| Code | Status | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing, malformed, wrong, or revoked key. |
| `project_not_found` | 404 | No such project, **or** it is not yours. |
| `project_paused` | 403 | The project is paused. Resume it. |
| `project_not_ready` | 403 | The project is still being created. |
| `method_not_allowed` | 405 | Wrong HTTP method for this route. |

### When you get `rate_limited`

The sign-in endpoints are limited: `/auth/login`, `/auth/register`,
`/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` and
`/auth/resend-verification`, at 10 attempts a minute per client address, with
the allowance shared across all six — moving from one to the next does not
reset it. Other routes have ceilings of their own (the data plane, the
dashboard's update list); see [Limits](/docs/limits).

The `429` carries a `Retry-After` header in seconds. Honour it rather than
retrying immediately — the header says how long until a whole attempt is back,
not when a window resets, so waiting exactly that long is enough.

Two things worth knowing if you are seeing this when you did not expect it:

- Behind a reverse proxy, set `MOOGO_TRUSTED_PROXIES` to the proxy's address. See
  [running behind a proxy](/docs/security#running-behind-a-proxy). Without it
  every visitor shares one bucket, and the limit becomes a shared outage rather
  than a per-caller ceiling.
- The limiter is in memory and resets when the process restarts, and it keys on
  the address the request came from. It is a brake on casual guessing, not a
  substitute for one at the edge.

### When you get `unauthorized`

1. **Is it the right key?** Check `secret_key_prefix` in the dashboard against the
   start of your key.
2. **Is it the right scheme?** Only `Bearer` is accepted — not Basic, not a bare
   token.
3. **Did you rotate?** Rotation invalidates the old key immediately.
4. **Did you include the header on every request?** Some HTTP clients drop headers
   on redirects.

For storage, also check that you are sending **both** headers:
`X-Moogo-Access-Key-Id` and `Authorization: Bearer`.

### `project_not_found` when the project exists

This code covers two cases on purpose: the project does not exist, **or** it is
not yours. If you are certain the project is yours, check that the id in the URL
matches the one you expect — this is what a copy-paste of the wrong project id
looks like.

## Storage errors

| Code | Status | Meaning |
|---|---|---|
| `missing_key` | 400 | No object key in the path. |
| `invalid_key` | 400 | The key breaks the [naming rules](/docs/create-bucket#keys-are-strict). |
| `invalid_prefix` | 400 | The prefix for a folder delete is not valid. |
| `key_taken` | 409 | An object with that key already exists. |
| `not_found` | 404 | No such object or bucket. |
| `object_too_large` | 413 | Over the bucket's per-object cap. |
| `quota_exceeded` | 507 | The project storage total is full. |
| `storage_error` | 500 | The request could not be completed. |

### `key_taken`

Object keys are unique within a project. To overwrite, send to the same key with a
different operation — `PATCH` to change it, or delete first and upload again. A
plain `POST` to an existing key is refused rather than silently replacing the file.

## Common problems

### "Everything works in the dashboard but not in my app"

The dashboard uses your **session**, not a project key. So the SQL and the data
are fine, and the difference is the credential. Check:

- Is `MOOGO_SECRET_KEY` in the deployed environment, not just your shell?
- Did you restart after adding it?
- Is there a trailing newline or quotes in the value?
- Did a deploy rotate the key? Get the current prefix from the dashboard.

### "My query works but my insert says `no such column`"

A column name is case-sensitive in SQLite but not in the error message. Check the
exact spelling from `PRAGMA table_info(your_table)` rather than assuming.

### "The response says `truncated: true`"

A row cap was hit. The result is not the whole table — do not treat it as
complete. Page the query with `LIMIT` and `OFFSET`.

### "It suddenly started returning 403 project_paused"

Something paused the project, most likely a person. Check the project's Settings
tab, and note that pausing affects both the dashboard and the API.

### "Uploads succeed but `<img>` shows a broken image"

You are pointing an `<img>` at `url`, which needs a storage credential a browser
tab does not have. Use `public_url` after publishing the object, or `preview_url`
in the dashboard.

### "I get 401 on storage but SQL works"

You are probably sending the **project key** to a storage endpoint. Storage rejects
it by design. Create a [storage credential](/docs/credentials).

## Next

- [SQL API](/docs/sql-api) — the request and response reference
- [Limits](/docs/limits) — what causes the size and timeout errors
- [Feedback](/docs/feedback) — if something here is wrong or unclear