# Quickstart

Two minutes from an account to a working query. If you already have an account,
start at [step 2](#2-create-a-project).

## 1. Register

Go to [/register](/register) and create an account with an email and a
password. One email is one account, and you are signed in immediately — there is
no confirmation email to wait for.

Full detail: [Register](/docs/register).

## 2. Create a project

In the [dashboard](/app), click **New project**, name it, and confirm.

When it reaches the status `ready`, Moogo shows three values **once**:

```text
MOOGO_PROJECT_URL=https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
```

**Copy them now.** The secret key is never displayed again — only a hash and an
eight-character prefix are stored.

Put them in your environment:

```bash
export MOOGO_PROJECT_URL="https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_PROJECT_ID="8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_SECRET_KEY="moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK"
```

## 3. Create a table

Creating a table is a **write**, so it goes to `/exec`:

```bash
curl $MOOGO_PROJECT_URL/exec \
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  }'
```

## 4. Insert data

Values are bound parameters, never interpolated into the SQL text.

```bash
curl $MOOGO_PROJECT_URL/exec \
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    "args": ["7c1f", "ketut@example.com", "pro"]
  }'
```

## 5. Read it back

Reads go to `/query`:

```bash
curl $MOOGO_PROJECT_URL/query \
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id, email, plan FROM users WHERE plan = ?","args":["pro"]}'
```

That is a working database.

## The one rule to remember

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN` | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Sending the wrong kind of statement is the most common early mistake, and it is
rejected rather than silently accepted so you find out immediately.

## From JavaScript

```js
const headers = {
  Authorization: `Bearer ${process.env.MOOGO_SECRET_KEY}`,
  "Content-Type": "application/json",
};

export async function sql(query, args = []) {
  const endpoint = /^(select|values|pragma|explain)\b/i.test(query.trim())
    ? "query"
    : "exec";

  const response = await fetch(
    `${process.env.MOOGO_PROJECT_URL}/${endpoint}`,
    { method: "POST", headers, body: JSON.stringify({ query, args }) },
  );

  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "request failed");
  return body;
}

const proUsers = await sql(
  "SELECT id, email FROM users WHERE plan = ?",
  ["pro"],
);
```

`rows` come back as arrays aligned with `columns`. Full reference:
[SQL API](/docs/sql-api).

## From the dashboard

You never need a key to explore. Open the project's **Database** tab to browse
tables as a spreadsheet, build tables without writing DDL, and run SQL in a
console with the same rules the API applies.

## What to read next

- [SQL API](/docs/sql-api) — the full query and exec reference
- [Credentials](/docs/credentials) — keys, rotation, and storage credentials
- [Object storage](/docs/object-storage) — files under the same project
- [Limits](/docs/limits) — the quotas you are working within
