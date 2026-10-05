# Comparison

Moogo is not a replacement for every database. This page is an honest comparison
against the two services people usually weigh it against, so you can pick the
right tool rather than the fashionable one.

## At a glance

| | **Moogo** | **Supabase** | **Turso / libSQL** |
|---|---|---|---|
| Engine | SQLite, your own file | PostgreSQL, shared cluster | libSQL (SQLite fork), replicated |
| Isolation | One `.db` file per project | Shared Postgres, row-level security | Per-database, replicated globally |
| Connection | HTTP, no driver | Postgres wire protocol + REST/GraphQL | libSQL client (HTTP or WebSocket) |
| Serverless fit | Built for it, stateless, no pool | Pooling required, proxy adds latency | Edge replicas, sync complexity |
| Free tier pause | **Never pauses** | Pauses after 1 week inactive | Varies by plan |
| Max database size | 100 MB per project | Much larger | Larger than Moogo |
| Object storage | 256 MB per project, included | Separate, billed | Not included on lower tiers |
| AI context file | `moogo.md` for assistants | No standard format | No standard format |
| Licence | MIT | Apache 2 / MIT, varies by component | MPL 2.0 (the libSQL fork) |

## The three real differences

### Isolation: files versus policies

Supabase runs many tenants in one Postgres database and separates them with
row-level security. That model is genuinely powerful — it is what lets a single
cluster serve thousands of tenants cheaply — and it is also a policy that has to
be correct on every single table and every single query.

Moogo puts each project in its own file. A bug in one project's queries cannot
expose another's rows, because there is no shared table to query. The trade is
scale: you cannot fit thousands of projects onto one host the way you can with a
shared cluster, because each project is a real file.

If you are building a product for many customers and the isolation guarantee is
the core of your pitch, that trade is worth examining carefully. If you are
building *your* application, the shared-cluster problem is one you probably do
not have.

### Connection: HTTP versus a socket

Turso and Supabase both work by giving you a real database protocol. You install
a driver, and the driver manages sockets, reconnects, and pooling for you.

Moogo gives you HTTP. There is no socket to manage and no driver to keep in sync
with your runtime, which removes a category of deployment problem rather than
solving it with a library.

What you give up is transactions across requests and streaming query results.
For a serverless function issuing a handful of independent statements, this is
usually a good trade. For a reporting job that streams millions of rows, it is
not.

### Scale and ceiling

This is the clearest tradeoff, and you should check it first.

Moogo caps a database at **100 MB**. That is generous for an application and
small for a dataset. If you are storing user records, sessions, and a few
thousand uploads, you will never notice. If you are ingesting events, storing
media metadata at volume, or building a data warehouse, you should stop reading
this documentation and use a database sized for that.

Supabase and Turso both scale past 100 MB comfortably. They also cost more, and
they ask you to manage a connection from code that runs to completion.

## When to choose something else

Choose another tool if any of these are true:

- You need `PostGIS`, or Postgres extensions generally.
- You need a database larger than 100 MB per logical unit of data.
- You need many concurrent writers to the same tables. SQLite serialises writes
  per database; this is a property of the engine, not a Moogo setting.
- You need cross-region replicas or a multi-region write path.
- You need fine-grained roles, `GRANT` / `REVOKE`, or row-level security policies
  between your own teams.
- You need long-running analytical scans that would hold a write lock.

## When Moogo is the right call

Moogo fits well when:

- You are building a **serverless function, edge handler, or small SaaS** and want
  a real database with zero infrastructure.
- You want **SQL, not a proprietary client** — you should be able to point the
  official SQLite tooling at your data and understand it.
- Your dataset is **modest** and you would rather not pay for capacity you do not
  use.
- You want **object storage next to the database**, under the same key and the
  same quota model.
- You want your **AI assistant to be able to use the database directly**, via the
  `moogo.md` context file.
- You want to **never think about cold starts**, because nothing ever pauses.

## A note on the comparison table

The versions described here are the ones documented at the time of writing.
Supabase and Turso both move quickly and change their free tiers regularly, so
verify the current limits on their own sites before you commit to a decision
based on this page.

If you find something in this table that is out of date, please
[tell us](/docs/feedback) — corrections are welcome and credited.
