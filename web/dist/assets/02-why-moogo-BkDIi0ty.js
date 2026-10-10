var e=`# Why Moogo?

Most hosted databases are Postgres with a nice wrapper. Moogo is not. It is built
around a different bet: **for a large class of applications, one SQLite file per
project is a better fit than a shared Postgres cluster**, and the ergonomics of
the API matter more than the feature list of the engine.

This page explains the reasoning, including the trade-offs that come with it.

## The problem Moogo is solving

If you are building a serverless function, a small SaaS, an internal tool, or an
AI agent that needs to remember things, you run into the same three problems.

**1. Connection management is your problem.** A serverless function has no
long-lived process. Every cold start means a new connection. You end up writing a
connection pool, or putting PgBouncer in front, or paying for a driver that
manages sockets for you.

**2. A shared database means shared risk.** In a multi-tenant Postgres, isolation
is a set of row-level security policies. They are well understood and they work —
until a policy is written with one too few \`WHERE\` clauses, and one tenant reads
another tenant's rows. This is not a hypothetical; it is the most common
multi-tenant data breach in the ecosystem.

**3. You do not need Postgres.** A huge fraction of applications are a few
tables, a handful of queries, and a few megabytes of data. What they need is
reliability, speed, and not having to think about the database at all. SQLite has
been the most-used embedded database in the world for over a decade, and it is
fast enough for essentially all of this.

Moogo takes that bet: **give each project a whole SQLite file, and expose it over
HTTP, and most of the operational work disappears.**

## The decisions that follow from that

### One file per project, not a shared cluster

This is the decision everything else follows from.

Isolation becomes structural instead of policy-based. There is no \`tenant_id\` to
filter on because there is no shared table. A query physically cannot reach
another project's data, because it is running against a different file opened by
a different file handle.

It is also why Moogo is fast. A write goes straight into the project's own file
with no row-level security evaluation, no cross-tenant index contention, and no
neighbour making your \`INSERT\` slow.

### Prepared statements only, enforced

Values never travel inside your SQL text. They are bound parameters:

\`\`\`json
{ "query": "SELECT id FROM users WHERE email = ?", "args": ["ketut@example.com"] }
\`\`\`

The engine only ever sees a parameterised statement. This means a value can never
become syntax, which is the whole class of SQL injection bugs — not "mostly
prevented", but structurally impossible on this path.

Every statement is also **tokenized and inspected before it runs**. \`ATTACH\`,
\`readfile\`, \`writefile\`, \`load_extension\`, stacked statements, and triggers are
rejected outright. See [Security](/docs/security) for the full list and why each
one is refused.

### No drivers, no cold starts

A \`moogo_...\` key and a URL are the entire integration. There is no driver to
install, no version to keep in sync with your runtime, and no connection to leak
when your function is frozen and thawed.

The project never pauses either. There is no idle timeout, so there is no cold
start to design around and no "first request is slow" to apologise for.

### Keys you can throw away

The project key is shown **once**, when the project is created and when it is
rotated. What is stored is a SHA-256 hash plus an eight-character prefix.

The consequence is worth stating plainly: a leaked database dump does not hand an
attacker a list of working keys. A key that appears in a log, a screenshot, or a
public repository is a key you need to rotate, but it is not a key that reveals
the others.

### Limits you can see

Every request has a time budget and every project has a size ceiling. Both come
back in the response, and both are enforced *before* the work is committed rather
than discovered afterwards. A write that would cross the size limit is refused; it
is not silently truncated.

## The trade-offs, stated honestly

Moogo is not the right tool for everything, and pretending otherwise would waste
your time.

| You probably want something else if | Why |
|---|---|
| You need \`PostGIS\` or spatial queries | SQLite has \`R-Tree\`, but it is not PostGIS |
| You need cross-region replicas | One project is one file on one host |
| You need concurrent analytical scans | SQLite is a single-writer engine |
| You need a database larger than 250 MB | That is the ceiling, and it is enforced |
| You need row-level security across tenants | You do not need it; you get file isolation instead |
| You need \`GRANT\` / \`REVOKE\` and multiple roles | Moogo has one role per project key |

On the free tier you also get **2 projects per account**, 250 MB per database,
and 250 MB of storage per project. There is no billing in the current version, so
every account is on the same plan. If you need more than that, the constraint is
a real one and you should know about it before you build.

## What is deliberately missing

Some things are absent on purpose, not by accident:

- **No triggers.** A trigger body contains semicolons, so detecting stacked
  statements correctly needs a real parser. Rather than ship a check that fails
  open on input SQLite accepts, triggers are declined. Write your invariants in
  your application.
- **No \`ATTACH\`.** It would turn the write endpoint into a file reader for the
  whole host.
- **No idle pausing.** It is a feature you would have to design around, and
  Moogo is always on.
- **No self-hosting yet.** It is planned, and it is not in this version.

Next: [Comparison](/docs/comparison) puts these decisions next to Supabase and
Turso, or [Register](/docs/register) if you would rather just try it.
`;export{e as default};