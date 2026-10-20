# Moogo documentation

Moogo is a hosted SQLite database and object storage for serverless apps: one
file per project, SQL over HTTP, no connection string and no driver.

## Getting started

- [Quickstart](/docs/quickstart) — an account to a working query in two minutes

## Database

- [Schema & Migration Best Practices](/docs/schema-best-practices) — migration workflow, schema design, SQL style guide

## Command line

- [Command line client](/docs/cli) — `moogo`: apply, seed and reset a database, list and delete objects, from a terminal

## Backups

- [Backups](/docs/backups) — scheduled off-site copies of a project's database, and how to restore one

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
