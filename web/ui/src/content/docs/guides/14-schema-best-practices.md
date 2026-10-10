# Database Schema, Migrations & Application Patterns

This guide covers how to create and evolve your database schema in Moogo, the
client helpers that make bulk work practical, and the patterns worth following
once an app outgrows a single table.

---

## How Migrations Work in Moogo

Moogo doesn't have a built-in migration tool. Instead, you run DDL statements
directly via the `/exec` endpoint — or, better, as one
[`/transaction`](/docs/sql-api#post-transaction-writes-as-one-unit) batch per
migration file. This gives you full control but requires discipline.

### The Migration Pattern

```javascript
// Run DDL via /exec endpoint
await sql(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
```

**Key points:**
- DDL runs through `/exec` (not `/query`)
- Use `CREATE TABLE IF NOT EXISTS` for idempotency
- Each migration = one `/transaction` call, not several `/exec` calls
- Run migrations during deployment, before deploying app code

A migration is a batch of DDL and data statements that should land together:

```javascript
// Adding a NOT NULL column without a default: the backfill and the constraint
// change are one batch, so no row is ever caught between the two.
await transaction([
  { query: "ALTER TABLE users ADD COLUMN email TEXT" },
  { query: "UPDATE users SET email = name || '@example.com' WHERE email IS NULL" },
]);
```

A batch commits completely or rolls back completely, so a migration that fails on
its sixth statement leaves no half-migrated schema to debug.

---

## Recommended Migration Workflow

### 1. Migration Files (Local)

```
migrations/
  001_create_users.sql
  002_add_posts_table.sql
  003_add_indexes.sql
  004_add_foreign_keys.sql
```

### 2. Migration Runner (Example)

```javascript
// migrate.js
import fs from 'fs';
import path from 'path';
import { transaction } from './lib/moogo';

const MIGRATIONS_DIR = './migrations';

async function runMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const text = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    // Split on ';'. Correct as long as no statement keeps a semicolon
    // inside a string or comment — for those, split with a tokenizer
    // instead of a plain String.split.
    const statements = text.split(';').filter(s => s.trim());

    // One entry per statement, one request per file. The batch is atomic: a
    // migration that fails half way leaves nothing applied. Batches are capped
    // at 100 statements, so split a longer file into numbered parts.
    await transaction(statements.map((query) => ({ query })));
    console.log(`✓ ${file}`);
  }
}
```

### 3. Migration File Example

```sql
-- 001_create_users.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
```

---

## Transactions

`POST /transaction` takes an array of statements and runs them as one unit.
Either every statement commits, or the batch is rolled back and you get an
error naming the position of the statement that failed.

```javascript
await transaction([
  { query: "INSERT INTO todos (id, title) VALUES (?, ?)", args: [id, title] },
  { query: "INSERT INTO activity (todo_id, action) VALUES (?, ?)", args: [id, "created"] },
  { query: "UPDATE counters SET todos = todos + 1 WHERE name = ?", args: ["total"] },
]);
```

**What to put in one batch:** writes that are only correct together. Creating a
row, logging it, and updating a counter is one change to the world, so it is one
request. Two requests means a window where a crash, a timeout, or a retry leaves
the world in a state your code never intended.

**What not to put in one batch:** reads. A `SELECT` is refused with `not_a_write`;
reads go to `/query`. A write that looks like it needs to read first usually does
not:

```sql
-- No read needed: the database does the read and the write as one statement.
UPDATE counters SET todos = todos + 1 WHERE name = ?;
```

**Limits:** up to 100 statements, one 15-second budget for the whole batch, and
one statement per entry. The project's write lock is held throughout, which is
what makes the batch atomic — and why a batch is bounded rather than open-ended.

Full reference: [`POST /transaction`](/docs/sql-api#post-transaction-writes-as-one-unit).

---

## Client helpers

These four cover most of what a busy application needs. They build on the client
from the [SQL API reference](/docs/sql-api).

### `transaction(statements)`

Shown above. Any write that must not be able to half-apply.

### `batchInsert(table, rows)`

`INSERT ... VALUES (?,?),(?,?),(?,?)` is one statement and one request, so a
thousand rows do not cost a thousand round trips.

```javascript
// rows: [{ id, title }, { id, title }, ...]
async function batchInsert(table, rows) {
  if (rows.length === 0) return;

  // One statement per chunk. SQLite caps the number of terms in a VALUES clause,
  // so a large import is split rather than refused.
  const CHUNK = 200;
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);
    const columns = Object.keys(chunk[0]);
    const placeholders = columns.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    const args = chunk.flatMap((row) => columns.map((column) => row[column]));

    await sql(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`,
      args,
    );
  }
}
```

### `queryPaginated(statement, args, pageSize)`

A read returns at most 1000 rows and sets `truncated: true` when there were
more. This walks the pages for you. Put a `LIMIT`/`OFFSET`-friendly ordering in
the statement — without an `ORDER BY`, page two is not guaranteed to continue
where page one stopped.

```javascript
async function queryPaginated(statement, args = [], pageSize = 1000) {
  const rows = [];
  let offset = 0;

  for (;;) {
    const page = await all(`${statement} LIMIT ? OFFSET ?`, [...args, pageSize, offset]);
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += pageSize;
  }
}
```

Prefer paging in SQL when the caller can ask for one page at a time — a `LIMIT
?` on an indexed query is much cheaper than reading everything to hand back a
slice.

### `queryIndexes(table)` and `createIndex(table, columns)`

Index management is ordinary SQL, but reading the existing indexes back is not —
there is no endpoint for it, and `PRAGMA index_list` is what answers it.

```javascript
async function queryIndexes(table) {
  const result = await all(`PRAGMA index_list(${quoteIdent(table)})`);
  return result.map((row) => ({
    name: row.name,
    unique: Boolean(row.unique),
    origin: row.origin, // "c" = CREATE INDEX, "u" = UNIQUE, "pk" = PRIMARY KEY
  }));
}

async function createIndex(table, columns) {
  const name = `idx_${table}_${columns.join("_")}`;
  await sql(
    `CREATE INDEX IF NOT EXISTS ${quoteIdent(name)} ON ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")})`,
  );
  return name;
}
```

`quoteIdent` is the standard `'"' + name.replace(/"/g, '""') + '"'`. Index names
and column names cannot be bound as parameters in SQLite — they are identifiers,
not values — so quoting is what keeps a computed name safe.

Indexes are not free: every index is written on every insert and every update.
Index the columns you filter and sort on, put equality columns first in a
composite index, and re-check `queryIndexes` before adding another.

---

## Schema Design Best Practices

### 1. Primary Keys: Use TEXT (UUID)

```sql
-- ✅ Good - UUID as TEXT
id TEXT PRIMARY KEY

-- ❌ Avoid - AUTOINCREMENT integer
id INTEGER PRIMARY KEY AUTOINCREMENT
```

**Why:** UUIDs work better in distributed systems, no sequence contention, globally unique.

### 2. Timestamps: Use TEXT with ISO8601

```sql
created_at TEXT DEFAULT (datetime('now')),
updated_at TEXT DEFAULT (datetime('now'))
```

**Why:** SQLite has no native datetime type. TEXT with ISO8601 (`YYYY-MM-DD HH:MM:SS`) sorts correctly lexicographically.

### 3. Booleans: Use INTEGER (0/1)

```sql
is_active INTEGER DEFAULT 1,
is_deleted INTEGER DEFAULT 0
```

**Why:** SQLite has no native BOOLEAN. INTEGER 0/1 is standard.

### 4. JSON: Store as TEXT

```sql
metadata TEXT DEFAULT '{}'  -- JSON string
```

**Why:** SQLite has JSON functions (`json_extract`, `json_set`), but storing as TEXT is simplest. Use `json_extract(metadata, '$.key')` to query.

### 5. Foreign Keys: Always Define Explicitly

```sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Why:** Enables CASCADE DELETE, prevents orphan rows, documents relationships.

### 6. Indexes: Create Strategically

```sql
-- Query patterns drive indexes
CREATE INDEX idx_users_email ON users(email);           -- WHERE email = ?
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC); -- WHERE user_id = ? ORDER BY created_at
CREATE INDEX idx_posts_published ON posts(published, created_at DESC); -- WHERE published = 1 ORDER BY created_at
```

**Rules:**
- Index columns used in `WHERE`, `JOIN`, `ORDER BY`
- Composite indexes: equality columns first, then range/order columns
- Don't over-index — each index slows writes

---

## SQL Writing Best Practices

### 1. Always Use Prepared Statements

```javascript
// ✅ Correct - parameterized
await sql("SELECT * FROM users WHERE email = ?", [email]);

// ❌ NEVER - string interpolation (SQL injection: the value becomes syntax)
await sql(`SELECT * FROM users WHERE email = '${email}'`);
```

### 2. Use Explicit Column Lists

```sql
-- ✅ Good
SELECT id, email, name FROM users WHERE id = ?

-- ❌ Avoid SELECT *
SELECT * FROM users WHERE id = ?
```

### 3. Use CTEs for Complex Queries

```sql
-- ✅ Readable, performant
WITH active_users AS (
  SELECT * FROM users WHERE is_active = 1
)
SELECT u.*, COUNT(p.id) as post_count
FROM active_users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id;
```

### 4. Use `UPSERT` for Idempotent Writes

```sql
-- SQLite UPSERT (ON CONFLICT)
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  updated_at = datetime('now');
```

### 5. Use `RETURNING` for Created Records

```sql
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
RETURNING id, email, created_at;
```

---

## Migration Checklist

Before running migrations in production:

- [ ] Test migrations on staging with production-like data
- [ ] Use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- [ ] Run during low-traffic window
- [ ] Have rollback plan (backup before migrate)
- [ ] Run `PRAGMA foreign_keys = ON` (Moogo does this by default)
- [ ] Test rollback locally first
- [ ] Send each file as one `/transaction` batch, so a failure applies nothing

---

## Common Patterns

### Soft Delete

```sql
-- Add deleted_at column
ALTER TABLE users ADD COLUMN deleted_at TEXT;

-- Query active only
SELECT * FROM users WHERE deleted_at IS NULL;

-- Soft delete
UPDATE users SET deleted_at = datetime('now') WHERE id = ?;
```

### Optimistic Locking

```sql
ALTER TABLE users ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE users SET name = ?, version = version + 1
WHERE id = ? AND version = ?;
-- Check rows affected == 1
```

### Audit Trail

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data TEXT,         -- JSON
  new_data TEXT,         -- JSON
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Building an application on Moogo

The API is small on purpose. Four patterns cover what a larger codebase needs.

### Put a repository layer in front of it

Wrap the client in one module per entity, so business logic stops being scattered
across route handlers:

```javascript
// repositories/todos.js
import { all, sql, transaction } from "../lib/moogo.js";

export const todos = {
  byId: (id) => all("SELECT * FROM todos WHERE id = ?", [id]).then((r) => r[0] ?? null),

  open: (id, title) =>
    transaction([
      { query: "INSERT INTO todos (id, title) VALUES (?, ?)", args: [id, title] },
      { query: "INSERT INTO activity (todo_id, action) VALUES (?, 'created')", args: [id] },
    ]),

  done: (id, at = new Date().toISOString()) =>
    sql("UPDATE todos SET done = 1, completed_at = ? WHERE id = ?", [at, id]),
};
```

Now a route handler says `await todos.open(id, title)` and the rule about keeping
those two writes together lives in exactly one place.

### Use CTEs for the queries that need them

`WITH ... SELECT` is a read and goes to `/query`:

```sql
WITH open_by_user AS (
  SELECT user_id, count(*) AS open
  FROM todos WHERE done = 0 GROUP BY user_id
)
SELECT users.id, coalesce(open_by_user.open, 0) AS open
FROM users LEFT JOIN open_by_user ON open_by_user.user_id = users.id;
```

Readability is the honest reason. A CTE that *writes* (`WITH ... INSERT`) is a
write and goes to `/exec` or into a `/transaction` batch.

### Cache the schema, not the data

`PRAGMA table_info` is a round trip per call. Read it once per process and keep
it — it changes only when a migration runs, which is exactly when your process
is usually restarting anyway.

```javascript
let cachedColumns = null;

export async function columnsOf(table) {
  cachedColumns ??= new Map();
  if (!cachedColumns.has(table)) {
    const rows = await all(`PRAGMA table_info(${quoteIdent(table)})`);
    cachedColumns.set(table, rows.map((row) => ({
      name: row.name,
      type: row.type,
      notNull: Boolean(row.notnull),
    })));
  }
  return cachedColumns.get(table);
}
```

Do not cache rows. What you cache is what you stop being able to trust.

### Always check `truncated`

A read returns at most 1000 rows and says so:

```javascript
const result = await sql("SELECT * FROM todos ORDER BY created_at");
if (result.truncated) {
  // Not the whole table. Page through it, or narrow the query.
}
```

Treating `truncated: true` as "that is everything" is the one silent way to ship
a bug that only appears once a table grows.

### Let the database enforce relations

Foreign keys are **on** for every Moogo connection, so a `REFERENCES` clause is
enforced, not decorative: an orphan insert is refused with a constraint error
rather than being written. What that requires of you is the clause itself:

```sql
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
```

Declare `ON DELETE` explicitly. Without it, deleting a user is refused while
their todos still reference them — which is the database protecting you, but it
reads like a bug until you know it is doing its job.

To see which constraints a table actually has — which is the question that
matters, since a column without `REFERENCES` is still a plain column:

```json
{ "query": "PRAGMA foreign_key_list('todos')" }
```

An empty `rows` array means nothing is declared, and nothing is enforced. You
cannot read `PRAGMA foreign_keys` back: it is not on the
[PRAGMA allowlist](/docs/sql-api#pragma), because a pragma that can be *set*
would let a caller switch enforcement off.

---

## Dashboard Table Builder

For simple schemas, use the **Dashboard Table Builder** (`/app/projects/{id}/database` → Tables tab):

- Visual column definition
- Auto-generates `CREATE TABLE`
- Sets up indexes and foreign keys
- No hand-written DDL needed

> **Tip:** Use the builder for initial schema, then hand-write migrations for complex changes.

---

## Quick Reference

| Task | SQL |
|------|-----|
| Create table | `CREATE TABLE IF NOT EXISTS ...` |
| Add column | `ALTER TABLE t ADD COLUMN c TEXT` |
| Drop column | `ALTER TABLE t DROP COLUMN c` (SQLite 3.35+) |
| Rename column | `ALTER TABLE t RENAME COLUMN a TO b` (SQLite 3.25+) |
| Add index | `CREATE INDEX IF NOT EXISTS idx ON t(c)` |
| Drop index | `DROP INDEX IF EXISTS idx` |
| Add FK | Requires table recreate in SQLite |
| Several writes, all or nothing | `POST /transaction` — see [Transactions](#transactions) |

---

## Related

- [SQL API](/docs/sql-api) - `/query`, `/exec` and `/transaction`
- [Dashboard](/docs/dashboard) - Table builder
- [Security](/docs/security) - Prepared statements, sanitizer
- [Limits](/docs/limits) - quotas, request limits, retention