# Moogo documentation

Moogo is a hosted SQLite database and object storage for serverless apps: one
file per project, SQL over HTTP, no connection string and no driver.

Every page below is available as bare Markdown at `/docs/<slug>.md` — the same
text the site renders, served for anything that does not run JavaScript.

## Getting started

- [Before you start](/docs/before-start) — the mental model, and what Moogo is not
- [Quickstart](/docs/quickstart) — an account to a working query in two minutes
- [What is Moogo?](/docs/what-is-moogo) — the two planes and why they never mix
- [Why Moogo](/docs/why-moogo) — where SQLite over HTTP fits
- [Comparison](/docs/comparison) — against managed Postgres, Firebase and friends
- [Register](/docs/register) — accounts, email verification, sign-in
- [AI adoption prompt](/docs/ai-adoption-prompt) — a prompt an agent can be given to adopt Moogo

## Using Moogo

- [Create your first project](/docs/create-project) — projects, keys, first query
- [Credentials](/docs/credentials) — the three credential types and where each is accepted
- [SQL API](/docs/sql-api) — `/query`, `/exec`, `/transaction`, `/maintenance`
- [Create a bucket](/docs/create-bucket) — buckets, access keys, signed links
- [Object storage](/docs/object-storage) — upload, download, list, publish, CDN
- [JavaScript client](/docs/javascript-client) — the `@moogodev/client` SDK
- [Dashboard](/docs/dashboard) — the project UI
- [Backups](/docs/backups) — scheduled off-site copies and how to restore one
- [Command line client](/docs/cli) — `moogo`: apply, seed and reset a database, list and delete objects

## Language guides

- [JavaScript / TypeScript (Vanilla)](/docs/javascript-vanilla)
- [React](/docs/react)
- [Next.js](/docs/nextjs)
- [Nuxt](/docs/nuxt)
- [Vue](/docs/vue)
- [Astro](/docs/astro)
- [Python (Vanilla)](/docs/python-vanilla)
- [FastAPI](/docs/fastapi)
- [Flask](/docs/flask)
- [Django](/docs/django)
- [PHP (Vanilla)](/docs/php-vanilla)
- [Laravel](/docs/laravel)
- [Go](/docs/go)
- [Ruby on Rails](/docs/ruby-rails)
- [Java / Kotlin](/docs/java-kotlin)

## Database

- [Schema, migrations & patterns](/docs/schema-best-practices) — migration workflow, schema design, SQL style guide

## Reference

- [Limits](/docs/limits) — size caps, timeouts, row limits, rate limits
- [Security](/docs/security) — how keys, isolation and sandboxing work
- [Errors](/docs/errors) — every error code and what to do about it
- [Feedback](/docs/feedback) — how to report a problem

## The five environment variables

```
MOOGO_BASE_URL=https://api.moogo.dev      # API origin, no path
MOOGO_PROJECT_ID=<project-id>              # the project's UUID
MOOGO_SQL_KEY=moogo_...                    # SQL: /query, /exec, /transaction
MOOGO_STORAGE_ACCESS_KEY_ID=moogo_ak_...   # object storage
MOOGO_STORAGE_SECRET_KEY=moogo_sk_...      # object storage
```

SQL endpoints are `$MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/query` (also `/exec`,
`/transaction`, `/maintenance`); object storage is
`$MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/bucket`.

## The two endpoints

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN`, `WITH` that selects | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Start at the [quickstart](/docs/quickstart).

## Machine-readable

- [OpenAPI 3.0 document](/openapi.yaml) — every route, request shape, response
  shape and error code, as YAML. Unauthenticated, and the same document the
  dashboard's TypeScript types are generated from.
