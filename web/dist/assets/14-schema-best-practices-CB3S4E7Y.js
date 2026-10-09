var e=`# Database Schema & Migrations

This guide covers how to create and evolve your database schema in Moogo, along with best practices for writing SQL.

---

## How Migrations Work in Moogo

Moogo doesn't have a built-in migration tool. Instead, you run DDL statements directly via the \`/exec\` endpoint. This gives you full control but requires discipline.

### The Migration Pattern

\`\`\`javascript
// Run DDL via /exec endpoint
await sql(\`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
\`);
\`\`\`

**Key points:**
- DDL runs through \`/exec\` (not \`/query\`)
- Use \`CREATE TABLE IF NOT EXISTS\` for idempotency
- Each migration = one or more \`exec\` calls
- Run migrations during deployment, before deploying app code

---

## Recommended Migration Workflow

### 1. Migration Files (Local)

\`\`\`
migrations/
  001_create_users.sql
  002_add_posts_table.sql
  003_add_indexes.sql
  004_add_foreign_keys.sql
\`\`\`

### 2. Migration Runner (Example)

\`\`\`javascript
// migrate.js
import fs from 'fs';
import path from 'path';
import { sql } from './lib/moogo';

const MIGRATIONS_DIR = './migrations';

async function runMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(\`Running migration: \${file}\`);
    const text = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    // Split on ';'. Correct as long as no statement keeps a semicolon
    // inside a string or comment — for those, split with a tokenizer
    // instead of a plain String.split.
    const statements = text.split(';').filter(s => s.trim());

    for (const stmt of statements) {
      await sql(stmt);
    }
    console.log(\`✓ \${file}\`);
  }
}
\`\`\`

### 3. Migration File Example

\`\`\`sql
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
\`\`\`

---

## Schema Design Best Practices

### 1. Primary Keys: Use TEXT (UUID)

\`\`\`sql
-- ✅ Good - UUID as TEXT
id TEXT PRIMARY KEY

-- ❌ Avoid - AUTOINCREMENT integer
id INTEGER PRIMARY KEY AUTOINCREMENT
\`\`\`

**Why:** UUIDs work better in distributed systems, no sequence contention, globally unique.

### 2. Timestamps: Use TEXT with ISO8601

\`\`\`sql
created_at TEXT DEFAULT (datetime('now')),
updated_at TEXT DEFAULT (datetime('now'))
\`\`\`

**Why:** SQLite has no native datetime type. TEXT with ISO8601 (\`YYYY-MM-DD HH:MM:SS\`) sorts correctly lexicographically.

### 3. Booleans: Use INTEGER (0/1)

\`\`\`sql
is_active INTEGER DEFAULT 1,
is_deleted INTEGER DEFAULT 0
\`\`\`

**Why:** SQLite has no native BOOLEAN. INTEGER 0/1 is standard.

### 4. JSON: Store as TEXT

\`\`\`sql
metadata TEXT DEFAULT '{}'  -- JSON string
\`\`\`

**Why:** SQLite has JSON functions (\`json_extract\`, \`json_set\`), but storing as TEXT is simplest. Use \`json_extract(metadata, '$.key')\` to query.

### 5. Foreign Keys: Always Define Explicitly

\`\`\`sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
\`\`\`

**Why:** Enables CASCADE DELETE, prevents orphan rows, documents relationships.

### 6. Indexes: Create Strategically

\`\`\`sql
-- Query patterns drive indexes
CREATE INDEX idx_users_email ON users(email);           -- WHERE email = ?
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC); -- WHERE user_id = ? ORDER BY created_at
CREATE INDEX idx_posts_published ON posts(published, created_at DESC); -- WHERE published = 1 ORDER BY created_at
\`\`\`

**Rules:**
- Index columns used in \`WHERE\`, \`JOIN\`, \`ORDER BY\`
- Composite indexes: equality columns first, then range/order columns
- Don't over-index — each index slows writes

---

## SQL Writing Best Practices

### 1. Always Use Prepared Statements

\`\`\`javascript
// ✅ Correct - parameterized
await sql("SELECT * FROM users WHERE email = ?", [email]);

// ❌ NEVER - string interpolation (SQL injection: the value becomes syntax)
await sql(\`SELECT * FROM users WHERE email = '\${email}'\`);
\`\`\`

### 2. Use Explicit Column Lists

\`\`\`sql
-- ✅ Good
SELECT id, email, name FROM users WHERE id = ?

-- ❌ Avoid SELECT *
SELECT * FROM users WHERE id = ?
\`\`\`

### 3. Use CTEs for Complex Queries

\`\`\`sql
-- ✅ Readable, performant
WITH active_users AS (
  SELECT * FROM users WHERE is_active = 1
)
SELECT u.*, COUNT(p.id) as post_count
FROM active_users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id;
\`\`\`

### 4. Use \`UPSERT\` for Idempotent Writes

\`\`\`sql
-- SQLite UPSERT (ON CONFLICT)
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  updated_at = datetime('now');
\`\`\`

### 5. Use \`RETURNING\` for Created Records

\`\`\`sql
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
RETURNING id, email, created_at;
\`\`\`

---

## Migration Checklist

Before running migrations in production:

- [ ] Test migrations on staging with production-like data
- [ ] Use \`IF NOT EXISTS\` / \`IF EXISTS\` for idempotency
- [ ] Run during low-traffic window
- [ ] Have rollback plan (backup before migrate)
- [ ] Run \`PRAGMA foreign_keys = ON\` (Moogo does this by default)
- [ ] Test rollback locally first

---

## Common Patterns

### Soft Delete

\`\`\`sql
-- Add deleted_at column
ALTER TABLE users ADD COLUMN deleted_at TEXT;

-- Query active only
SELECT * FROM users WHERE deleted_at IS NULL;

-- Soft delete
UPDATE users SET deleted_at = datetime('now') WHERE id = ?;
\`\`\`

### Optimistic Locking

\`\`\`sql
ALTER TABLE users ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE users SET name = ?, version = version + 1
WHERE id = ? AND version = ?;
-- Check rows affected == 1
\`\`\`

### Audit Trail

\`\`\`sql
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
\`\`\`

---

## Dashboard Table Builder

For simple schemas, use the **Dashboard Table Builder** (\`/app/projects/{id}/database\` → Tables tab):

- Visual column definition
- Auto-generates \`CREATE TABLE\`
- Sets up indexes and foreign keys
- No hand-written DDL needed

> **Tip:** Use the builder for initial schema, then hand-write migrations for complex changes.

---

## Quick Reference

| Task | SQL |
|------|-----|
| Create table | \`CREATE TABLE IF NOT EXISTS ...\` |
| Add column | \`ALTER TABLE t ADD COLUMN c TEXT\` |
| Drop column | \`ALTER TABLE t DROP COLUMN c\` (SQLite 3.35+) |
| Rename column | \`ALTER TABLE t RENAME COLUMN a TO b\` (SQLite 3.25+) |
| Add index | \`CREATE INDEX IF NOT EXISTS idx ON t(c)\` |
| Drop index | \`DROP INDEX IF EXISTS idx\` |
| Add FK | Requires table recreate in SQLite |

---

## Related

- [SQL API](/docs/sql-api) - \`/exec\` endpoint details
- [Dashboard](/docs/dashboard) - Table builder
- [Security](/docs/security) - Prepared statements, sanitizer`;export{e as default};