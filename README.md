# Moogo

A true database for serverless apps. Every project gets its own SQLite file and
its own key, and you talk to it over HTTP — no connection string, no driver, no
connection pool to manage. Object storage lives under the same project and the
same credentials.

This repository is the whole service: a Go API and the React dashboard that it
serves from the same origin.

## What is in here

- **Control plane** — accounts, projects, quotas, credentials. Postgres, because
  it is internal state and needs transactions.
- **Data plane** — SQL and object storage for one project. SQLite, because that
  is what the customer actually owns.
- **Dashboard** — table browser, SQL console and bucket browser, served from the
  same origin as the API so there is no CORS and one cookie jar.

The two planes share no tables. A client on the data plane never learns whether
a project exists on the control plane; a signed-in user never holds a secret
they did not ask for.

## Build

The binary embeds the built frontend, so the frontend has to exist first. In a
fresh clone `web/dist` is committed, so this is only needed after changing
`web/ui`:

```bash
cd web/ui && npm install && npm run build && cd ../..
go build ./cmd/api
```

Run it against a Postgres instance and a data directory:

```bash
export MOOGO_DATABASE_URL='postgres://user:pass@localhost:5432/moogo?sslmode=disable'
export MOOGO_SESSION_SECRET="$(openssl rand -base64 32)"
export MOOGO_DATA_DIR=./data

./api
```

`dev.sh` wires up a local Postgres and the rest of the defaults if you would
rather not do it by hand. It is development only — the session secret it
defaults to is published in this repository, and production refuses to start
with it.

Every other setting has a default; `internal/config/config.go` is the list.

## The one rule

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN` | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Sending the wrong kind of statement is rejected rather than quietly accepted, so
you find out immediately instead of after it has written something.

## Documentation

- [Deployment guide](deploy-guide.md) — every step, every setting, every failure
  mode, written for an agent operating the VPS
- [Quickstart](quickstart.md) — an account to a working query in two minutes
- [Architecture decisions](DECISIONS.md) — what is locked in, and why
- [`prd_moogo.md`](prd_moogo.md) — the product requirements this was built from

## Tests

```bash
go test ./...
```

## License

MIT — see [LICENSE](LICENSE). Use it, change it, sell it; keep the notice.
