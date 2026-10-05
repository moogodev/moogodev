# Moogo documentation

Moogo is a hosted SQLite database and object storage for serverless apps: one
file per project, SQL over HTTP, no connection string and no driver.

## Getting started

- [Quickstart](/docs/quickstart) — an account to a working query in two minutes

## Project

- [Architecture decisions](/docs/DECISIONS) — what has been locked in, and why

## The two endpoints

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN` | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Start at the [quickstart](/docs/quickstart).
