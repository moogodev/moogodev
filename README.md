<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/2.png">
    <img src="https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/1.png" alt="Moogo" height="72">
  </picture>
</p>

# Moogo

A true database for serverless apps. Every project gets its own SQLite file and
its own key, and you talk to it over HTTP — no connection string, no driver, no
connection pool to manage. Object storage lives under the same project, behind
its own credential.

This repository is the whole service: a Go API, the React dashboard that it
serves from the same origin, and the small news service behind the dashboard's
update feed.

## What you get

- **SQL over HTTP** — `POST /query` for reads, `POST /exec` for writes, with
  prepared statements only and a tokenizing sanitizer that runs before anything
  touches the database.
- **One database per project** — a real SQLite file you can back up, with its
  own secret key and its own quota (250 MB per database, 15 seconds per
  statement, 64 KB per statement text).
- **Object storage** — buckets under the same project, with their own storage
  credential: upload, preview, public/private objects.
- **Dashboard** — projects, a table browser with a visual table builder, a SQL
  console that runs pasted multi-statement scripts in order (with an examples
  shelf), a read-only schema visualizer with relationship edges, bucket
  browsing, and backups.
- **Accounts** — email + password with verification and reset flows, Google
  OAuth, rate limits on every sensitive route, and API keys scoped per project.
- **Docs built in** — the whole manual ships with the product at `/docs`, from
  quickstart to error codes to an [AI adoption prompt](https://moogo.dev/docs/ai-adoption-prompt)
  you can paste into any coding agent.

## What is in here

- **Control plane** — accounts, projects, quotas, credentials. Postgres, because
  it is internal state and needs transactions.
- **Data plane** — SQL and object storage for one project. SQLite, because that
  is what the customer actually owns.
- **Dashboard** — table browser, SQL console, schema visualizer and bucket
  browser, served from the same origin as the API so there is no CORS and one
  cookie jar.
- **News service** — a second binary (`cmd/news`, frontend in `news/`) behind
  the dashboard's announcement feed `GET /api/updates` and its own site.
  Separate process, separate database.

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

Frontend scripts (in `web/ui`):

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server — serves files and proxies `/auth` and `/api` to the Go API, which still runs separately |
| `npm run build` | `tsc -b && vite build` → `web/dist`, embedded by `go build` |
| `npm run lint` | oxlint |
| `npm run verify:docs` | renders every docs page outside a browser and checks links |

Run it against a Postgres instance and a data directory:

```bash
export MOOGO_DATABASE_URL='postgres://user:pass@localhost:5432/moogo?sslmode=disable'
export MOOGO_SESSION_SECRET="$(openssl rand -base64 32)"
export MOOGO_DATA_DIR=./data

./api
```

`dev.sh` exports the local defaults and starts the API if you would rather not
do it by hand. It expects a local Postgres to already be running (it prints the
command if not). It is development only — the session secret it defaults to is
published in this repository, and production refuses to start with it.

Every other setting has a default; `internal/config/config.go` is the list.

## The one rule

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN`, `WITH` that selects | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Sending the wrong kind of statement is rejected rather than quietly accepted, so
you find out immediately instead of after it has written something.

## Documentation

- [Deployment guide](deploy-guide.md) — every step, every setting, every failure
  mode, written for an agent operating the VPS
- [Quickstart](https://moogo.dev/docs/quickstart) — an account to a working
  query in two minutes (source: [`internal/docs/files/quickstart.md`](internal/docs/files/quickstart.md))
- [Architecture decisions](DECISIONS.md) — what is locked in, and why
- [`prd_moogo.md`](prd_moogo.md) — the product requirements this was built from
- [`deploy/README.md`](deploy/README.md) — systemd unit, nginx site, backup and
  healthcheck scripts
- [Contributing](CONTRIBUTING.md) — what makes a good change, and the gates to run
- [Security policy](SECURITY.md) — how to report a vulnerability

## Tests

```bash
# Unit tests and race detector; database integration tests skip themselves.
go test -race ./...

# Full suite, integration included — needs a scratch Postgres.
MOOGO_TEST_DATABASE_URL='postgres://user:pass@localhost:5432/moogo_test?sslmode=disable' \
  go test -race ./...
```

## Support Moogo — help, sponsor, fund

**Moogo is free, open source (MIT), and needs help to keep going.** If it is
useful to you, here is how to give back — all of it matters:

- **Use it & report issues** — a clear bug report with steps to reproduce is
  funding-grade help. [Open an issue](https://github.com/moogodev/moogodev/issues/new/choose)
  — the bug template asks for exactly what makes it actionable.
- **Contribute** — docs, fixes, tests, guides for your favourite framework.
  Small pull requests are welcome and reviewed — see
  [CONTRIBUTING.md](CONTRIBUTING.md).
- **Report security problems privately** — never in a public issue. See
  [SECURITY.md](SECURITY.md): email [moogo.dev@gmail.com](mailto:moogo.dev@gmail.com)
  with `[SECURITY]` in the subject, or use a private GitHub security advisory.
- **Sponsor / become a funder** — running the infrastructure, the VPS, domains,
  and ongoing development are paid for out of pocket. If Moogo saves you time,
  consider backing it: the **Sponsor** button on the repository leads to
  [GitHub Sponsors](https://github.com/sponsors/moogodev). Recurring funding is
  what makes this sustainable; one-time support counts too.

Sponsors get listed in the repository (with permission) and early access to the
roadmap discussions.

## License

MIT — see [LICENSE](LICENSE). Use it, change it, sell it; keep the notice.
