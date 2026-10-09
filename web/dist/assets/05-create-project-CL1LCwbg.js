var e=`# Create your first project

A project is one SQLite database, one object storage namespace, and one set of
credentials. Creating it takes a few seconds and gives you everything you need to
make your first query.

## Before you start

You need [an account](/docs/register). You get **2 projects** on the free tier, so
create a second one only when you have a reason to.

## Create the project

1. Sign in and go to the [dashboard](/app).
2. Click **New project**.
3. Give it a name. This is a label for you; nothing in the API depends on it.
4. Click **Create**.

The project is created in the background. Its status moves through:

| Status | Meaning |
|---|---|
| \`pending\` | The record exists; the database file is being prepared. |
| \`ready\` | Ready to use. The dashboard and the API both accept requests. |
| \`failed\` | Creation did not complete. Delete it and try again. |

A newly created project normally reaches \`ready\` within a second or two. If
something goes wrong the project is left in \`failed\` with a description, rather
than a spinner that never resolves — you always find out which state you are in.

## Save your credentials immediately

On creation, Moogo shows three values **once**:

\`\`\`
MOOGO_PROJECT_URL=https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_...
\`\`\`

| Value | What it is |
|---|---|
| \`MOOGO_PROJECT_URL\` | The base URL every API call hangs off. It already contains the project id. |
| \`MOOGO_PROJECT_ID\` | The project's UUID. Also identifies it in the dashboard and in URLs. |
| \`MOOGO_SECRET_KEY\` | The bearer token that authorises API calls. |

**Copy them now.** The secret key is never shown again — not in the project list,
not in settings, not by email. What Moogo keeps is a SHA-256 hash and an
eight-character prefix, so it genuinely cannot show you the key again.

If you lose it, [rotate it](/docs/credentials#rotating-a-key). Rotation is instant
and invalidates the old key immediately, so update your deployment before you
rotate.

### Put them in your environment

\`\`\`bash
# .env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_...
\`\`\`

Do not commit this file. The key is a real credential and it is the only thing
standing between your database and anyone who has it.

## Make your first query

\`\`\`bash
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, plan TEXT)"}'
\`\`\`

That is a write, so it goes to \`/exec\`: \`/query\` refuses writes and \`/exec\`
refuses reads. Use the right one for what you are doing:

\`\`\`bash
# Insert a row (a write, with a bound parameter)
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"INSERT INTO users (id, email, plan) VALUES (?, ?, ?)","args":["7c1f","ketut@example.com","free"]}'

# Read rows back (a read)
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"SELECT id, email, plan FROM users"}'
\`\`\`

The read returns:

\`\`\`json
{
  "success": true,
  "columns": ["id", "email", "plan"],
  "rows": [["7c1f", "ketut@example.com", "free"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 1
}
\`\`\`

The [SQL API page](/docs/sql-api) covers this in detail.

## Managing the project

Open the project from the dashboard, then use the tabs.

### Database tab

Browse tables as a spreadsheet, create tables with the table builder, edit rows,
and run SQL in the console. The console runs the same sanitizer and the same
read/write rules as the public API, so behaviour you see here is behaviour you
get there.

### Bucket tab

Upload and organise files. Covered in [Create a bucket](/docs/create-bucket).

### Settings tab

- **Project URL and id** — always visible, safe to copy.
- **Rotate key** — issues a new secret key and shows it once. The old key stops
  working immediately.
- **Pause / resume** — stops and restarts all API access for this project.
- **Download backup** — a \`.db\` file of the whole database. It uses your session,
  not a project key, so it works from the dashboard without the key.
- **Delete project** — permanent. Removes the database and every stored file.

### Pausing

Pausing makes the project refuse API requests for both SQL and storage. It does
not delete anything and does not change any credential, so resume puts it back
exactly as it was.

Pausing is immediate and is not billed differently — it exists so you can stop a
project you are not using without destroying it. Use it instead of deleting when
you might come back.

### Deleting

Deleting a project removes its database file and every object in its buckets. It
cannot be undone. If you only want to stop using it, pause it instead.

## Next

- [Credentials](/docs/credentials) — keys, rotation, and what is stored
- [SQL API](/docs/sql-api) — the full query and exec reference
- [Create a bucket](/docs/create-bucket) — object storage`;export{e as default};