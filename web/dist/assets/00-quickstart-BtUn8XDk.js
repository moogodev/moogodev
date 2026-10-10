var e=`# Quickstart

Two minutes from an account to a working query. If you already have an account,
start at [step 2](#2-create-a-project).

## 1. Register

Go to [moogo.dev/register](/register) and create an account with an email and a
password. One email is one account. Registration sends a confirmation link and
does not sign you in — follow the link first, then sign in.

Full detail: [Register](/docs/register).

## 2. Create a project

In the [dashboard](/app), click **New project**, name it, and confirm.

When it reaches the status \`ready\`, Moogo shows three values **once**:

\`\`\`
MOOGO_PROJECT_URL=https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_...
\`\`\`

**Copy them now.** The secret key is never displayed again — only a hash and an
eight-character prefix are stored. If you lose it, you can
[rotate it](/docs/credentials#rotating-a-key).

Put them in your environment:

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_PROJECT_ID="8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_SECRET_KEY="moogo_..."
\`\`\`

Full detail: [Create your first project](/docs/create-project).

## 3. Create a table

Creating a table is a **write**, so it goes to \`/exec\`:

\`\`\`bash
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT '"'"'free'"'"',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  }'
\`\`\`

Response:

\`\`\`json
{ "success": true, "rows_affected": 0, "size_bytes": 20480, "duration_ms": 1 }
\`\`\`

## 4. Insert data

Note the \`args\` array — values are bound parameters, never interpolated into the
SQL text.

\`\`\`bash
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    "args": ["7c1f", "ketut@example.com", "pro"]
  }'
\`\`\`

\`\`\`json
{ "success": true, "rows_affected": 1, "size_bytes": 24576, "duration_ms": 1 }
\`\`\`

## 5. Read it back

Reads go to \`/query\`:

\`\`\`bash
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"SELECT id, email, plan FROM users WHERE plan = ?","args":["pro"]}'
\`\`\`

\`\`\`json
{
  "success": true,
  "columns": ["id", "email", "plan"],
  "rows": [["7c1f", "ketut@example.com", "pro"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 1
}
\`\`\`

That is a working database.

## Several writes at once

When one change is several statements, send them as one batch:

\`\`\`bash
curl $MOOGO_PROJECT_URL/transaction \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "statements": [
      { "query": "INSERT INTO users (id, email) VALUES (?, ?)", "args": ["7c1f", "ketut@example.com"] },
      { "query": "UPDATE counters SET signups = signups + 1 WHERE name = ?", "args": ["total"] }
    ]
  }'
\`\`\`

Either both statements commit or neither does, so a request that half-succeeds
cannot leave your data in a state your code never intended. Full reference:
[\`POST /transaction\`](/docs/sql-api#post-transaction-writes-as-one-unit).

## The one rule to remember

| Endpoint | Accepts | Rejects |
|---|---|---|
| \`/query\` | Reads — \`SELECT\`, \`VALUES\`, \`PRAGMA\`, \`EXPLAIN\`, \`WITH\` that selects | Writes, with \`not_a_read\` |
| \`/exec\` | Writes — \`INSERT\`, \`UPDATE\`, \`DELETE\`, \`CREATE\`, \`ALTER\`, \`DROP\` | Reads, with \`not_a_write\` |

Sending the wrong kind of statement is the most common early mistake, and it is
rejected rather than silently accepted so you find out immediately.

## From JavaScript

The quickest way to integrate, since there is no driver to install:

\`\`\`js
const headers = {
  Authorization: \`Bearer \${process.env.MOOGO_SECRET_KEY}\`,
  "Content-Type": "application/json",
};

export async function sql(query, args = []) {
  // \`with\` covers CTE reads (WITH ... SELECT). A CTE that writes
  // (WITH ... INSERT) must be sent to /exec directly.
  const endpoint = /^(select|values|pragma|explain|with)\\b/i.test(query.trim())
    ? "query"
    : "exec";

  const response = await fetch(
    \`\${process.env.MOOGO_PROJECT_URL}/\${endpoint}\`,
    { method: "POST", headers, body: JSON.stringify({ query, args }) },
  );

  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "request failed");
  return body;
}
\`\`\`

\`\`\`js
const proUsers = await sql(
  "SELECT id, email FROM users WHERE plan = ?",
  ["pro"],
);
\`\`\`

\`rows\` come back as arrays aligned with \`columns\`. Full reference:
[SQL API](/docs/sql-api).

## From the dashboard

You never need a key to explore. Open the project's **Database** tab to browse
tables as a spreadsheet, build tables without writing DDL, and run SQL in a
console with the same rules the API applies.

## What to read next

- [SQL API](/docs/sql-api) — the full query, exec and transaction reference
- [Schema & migrations](/docs/schema-best-practices) — batch inserts, paging, indexes
- [Credentials](/docs/credentials) — keys, rotation, and storage credentials
- [Object storage](/docs/object-storage) — files under the same project
- [Limits](/docs/limits) — the quotas you are working within`;export{e as default};