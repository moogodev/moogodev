# Moogo documentation

Moogo is a hosted SQLite database and object storage for serverless apps: one
file per project, SQL over HTTP, no connection string and no driver.

## Getting started

- [Quickstart](/docs/quickstart) — an account to a working query in two minutes

## Database

- [Schema & Migration Best Practices](/docs/schema-best-practices) — migration workflow, schema design, SQL style guide

## The two endpoints

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN`, `WITH` that selects | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Start at the [quickstart](/docs/quickstart).
