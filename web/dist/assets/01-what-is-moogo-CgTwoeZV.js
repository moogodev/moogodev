var e=`# What is Moogo?

Moogo is a hosted backend that gives every project its own **SQLite database** and
its own **object storage**, reachable over plain HTTP. There is no connection
string, no driver, and no database client to install.

You create a project, and Moogo hands you three values:

\`\`\`
MOOGO_PROJECT_URL=https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_...
\`\`\`

Put those in your application's environment and it can read and write data:

\`\`\`bash
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"SELECT id, email FROM users WHERE plan = ?","args":["pro"]}'
\`\`\`

That is the whole integration. No SDK, no ORM, no connection pool to manage.

## The two planes

Everything about Moogo follows from one architectural decision: the service runs
in **two tiers**, and they never mix.

| Plane | Runs on | Holds | Touches your data? |
|---|---|---|---|
| **Control plane** | PostgreSQL | Accounts, projects, key hashes, quotas, the bucket catalog, activity logs | No |
| **Data plane** | SQLite, one \`.db\` file per project | Your tables and your rows | Yes |

The control plane knows that a project exists. The data plane holds what is in it.
A query never crosses between them, and a bug in the control plane cannot reach
your rows.

### Why this matters to you

Because the data plane is **one physical file per project**, isolation is not a
policy that can be misconfigured. Project A and project B are two different files
on disk. There is no shared connection, no shared buffer pool, and no query that
can be written to cross from one to the other. A project belonging to another
account answers \`404\`, not \`403\`, so an id cannot even be probed for existence.

## What you get

- **A real SQLite database.** Full SQLite, the engine you already know, with
  \`WAL\` journaling and foreign keys enabled on every connection.
- **Object storage per project.** Up to 250 MB of files, organized into buckets,
  with public URLs you can put in an \`<img>\` tag.
- **A dashboard.** Browse your tables as a spreadsheet, run SQL in a console, and
  watch the activity log. It needs no secret key from you.
- **Honest limits.** 250 MB per database, 15 seconds per statement, 1 MB per
  request body. Every one of them is reported in the response, so you find out
  from the API rather than from a hung tab.

## What Moogo is not

It is worth being direct about the edges.

- **It is not Postgres.** If you need \`PostGIS\`, logical replication, or
  concurrent analytical workloads, Moogo is the wrong tool.
- **It is not a global replica network.** One project is one file on one host.
  There is no read replica in another region.
- **It does not pause.** A project does not go to sleep after inactivity, so
  there is no cold start and no "first request after idle" latency. It also never
  pauses on its own — if you want to stop paying resources for an unused project,
  you pause it deliberately.

## Where to go next

- [Why Moogo](/docs/why-moogo) — the reasoning behind the design
- [Comparison](/docs/comparison) — how Moogo stacks up against Supabase and Turso
- [Register](/docs/register) — create an account
- [Quickstart](/docs/quickstart) — first query in about two minutes
`;export{e as default};