# Deploying Moogo

`../deploy-guide.md` is the complete reference: every environment variable and
its default, every error message the service can print, and the exact recovery
commands. This file is the walkthrough.

One node, one origin. This is a deliberate design, not a limitation of the
setup: `DECISIONS.md` D5 fixes a single node with the interfaces kept separate
so multi-node stays possible later.

## What has to be true before you start

- A Linux VPS with a domain pointing at it, and ports 80 and 443 open.
- PostgreSQL reachable from the VPS.
- A Google OAuth client **or** a Resend API key. Not both, but one of them:
  without a way to confirm an address, registration creates accounts that can
  never be signed in, and the service now refuses to start rather than do that.

```bash
# Google Cloud Console → APIs & Services → Credentials → Web application
# Authorized redirect URI: https://YOUR-DOMAIN/auth/google/callback
```

## Install

```bash
git clone https://github.com/moogodev/moogodev.git
cd moogodev
sudo ./deploy/deploy.sh moogo.example.com
```

The script refuses first and changes second: a missing `/etc/moogo/moogo.env`,
a duplicate nginx `server_name`, a `web/dist` or `news/dist` that differs from
git, or a failing `go vet` / `go test -race` gate all stop it before anything
is installed. After that it builds, creates the `moogo` service user, installs
a hardened unit and the nginx site configuration, schedules the nightly
backup, restarts both services onto the new binary and verifies the restart
took (MainPID changed, `NRestarts` 0), then runs a short list of local HTTP
checks.

Behind a Cloudflare Tunnel — detected by `/etc/cloudflared/config.yml` — the
nginx, certificate and certbot sections are skipped entirely: that machine
terminates TLS at Cloudflare with loopback-only, reload-only nginx and owns
its own configuration. The script never touches `/etc/cloudflared`.

Then fill in the environment file:

```bash
sudo install -m 0640 -o root -g moogo /dev/null /etc/moogo/moogo.env
sudo cp .env.production.example /etc/moogo/moogo.env   # then edit
sudo editor /etc/moogo/moogo.env
```

Check it before restarting:

```bash
sudo -u moogo env $(grep -v '^#' /etc/moogo/moogo.env | xargs) \
  /usr/local/bin/moogo --check-config
sudo systemctl restart moogo
```

Re-run `deploy.sh` with the same domain to deploy an update. A re-run backs up
both current binaries into `/var/backups/moogo-binaries` (the newest ten of
each are kept), installs, restarts and verifies — a running process never picks
up a replaced file by itself, so without the restart an update would not happen
at all. It never rewrites the environment file, because doing so would change
the session secret and sign everybody out.

Any failure after the install rolls the binaries back automatically. To roll
back later by hand:

```bash
sudo install -m 0755 /var/backups/moogo-binaries/<file> /usr/local/bin/moogo
sudo systemctl restart moogo
```

## What is running

| Piece | Where |
|---|---|
| Binary | `/usr/local/bin/moogo`, plain HTTP on `127.0.0.1:8080` |
| Previous binaries | `/var/backups/moogo-binaries`, newest ten of each, for rollback |
| What's-new binary (optional) | `/usr/local/bin/moogo-news`, plain HTTP on `127.0.0.1:8081` |
| TLS, certificates | nginx in front; certbot obtains and renews |
| Secrets | `/etc/moogo/moogo.env`, `root:moogo`, mode 640 |
| What's-new secrets (optional) | `/etc/moogo/news.env`, `root:moogo`, mode 640 |
| Control plane | PostgreSQL |
| Project databases | `$MOOGO_DATA_DIR/dbs/<uuid>.db` |
| Object storage | `$MOOGO_DATA_DIR/buckets/` |
| What's-new database | `$MOOGO_DATA_DIR/news/news.db` (SQLite) |
| Nightly backup | `/etc/cron.d/moogo-backup` at 03:17 |
| Restore check | the same file, 04:23, into a throwaway database |
| Health check | `/etc/cron.d/moogo-healthcheck`, every minute, public URL |

The binary does not terminate TLS, so nginx is not optional. Two things follow
that are easy to miss:

- **HSTS is set in the nginx site config**, not by the app. The app only sends it when
  `r.TLS != nil`, and behind a terminating proxy that is always nil.
- **`MOOGO_TRUSTED_PROXIES` must contain `127.0.0.1`.** Without it every request
  looks like it came from the proxy, and the rate limit on `/auth/login`
  becomes a limit on your entire user base.
- **`deploy.sh` leaves nginx alone behind a Cloudflare Tunnel**
  (`/etc/cloudflared/config.yml` present): no site file, no certificates, no
  reloads. That machine owns a loopback-only, reload-only nginx, and reload-only
  rules belong to it, not to this script.

## What's new (news.moogo.dev), optional

The changelog site is a **second binary**: `moogo-news`, its own port
(`127.0.0.1:8081`), its own SQLite file, its own single-admin login. It shares
nothing with the control plane — not the database, not the session secret, not
the admin account — so a compromise on either side does not travel to the
other. The main service runs fine without it, and `deploy.sh` builds and
installs it either way while only *enabling* it when configured.

To turn it on, three things are needed once:

**1. DNS.** An A record for `news.YOUR-DOMAIN` pointing at this VPS. `deploy.sh`
writes the site block as soon as `news.env` exists; with no record it simply
receives no traffic. Until it exists, the dashboard's "What's new" links do not
resolve.

**2. The environment file** — the script never writes it, for the same reason
as `moogo.env`:

```bash
sudo install -m 0640 -o root -g moogo /dev/null /etc/moogo/news.env
sudo editor /etc/moogo/news.env
```

| Variable | Value |
|---|---|
| `NEWS_ENV` | `production` |
| `NEWS_ADDR` | `127.0.0.1:8081` |
| `NEWS_DB` | `/var/lib/moogo/news/news.db` (a relative `news.db` works too) |
| `NEWS_SESSION_SECRET` | ≥32 random characters, **different** from `MOOGO_SESSION_SECRET` |
| `NEWS_ADMIN_EMAIL` | the single editor account |
| `NEWS_ADMIN_PASSWORD_HASH` | bcrypt hash, generated below |
| `NEWS_COOKIE_SECURE` | `true` (the default) |
| `NEWS_TRUSTED_PROXIES` | `127.0.0.1` (the default) — without it every client collapses into the proxy address and login rate limiting counts them as one |

Generate the hash on the server, where the binary is:

```bash
sudo -u moogo /usr/local/bin/moogo-news -hash-password 'choose-a-strong-password'
```

There is no sign-up and no password reset. Rotating the account means
replacing the two values and `systemctl restart moogo-news`.

**3. Re-run the deploy** so the unit is enabled:

```bash
sudo ./deploy/deploy.sh YOUR-DOMAIN
systemctl status moogo-news
curl -fsS http://127.0.0.1:8081/healthz     # {"status":"ok"}
journalctl -u moogo-news -f
```

The database seeds its first three posts on first start, so a fresh
deployment has a changelog to link to rather than an empty page.

## MCP Server (moogo-mcp), optional

The MCP server is a **third binary** (`moogo-mcp`) that exposes one project's
data plane (SQL + object storage) over the Model Context Protocol. It is
designed for coding agents (Claude, Cursor, etc.) and runs in two modes:

- **stdio** (default): the agent launches the binary directly, JSON-RPC on
  stdin/stdout. No network exposure, no systemd unit needed.
- **HTTP** (Streamable HTTP): the binary listens on `127.0.0.1:4618` by default
  at `/mcp`. Use this when the agent runs on a different machine — **always**
  behind an authenticated tunnel (SSH, WireGuard, Cloudflare Tunnel). Never
  bind `0.0.0.0` without a tunnel; the process holds the project secret.

To run it as a managed service on the VPS, three things are needed once:

**1. The environment file** — the script never writes it, for the same reason
as `moogo.env`:

```bash
sudo install -m 0640 -o root -g moogo /dev/null /etc/moogo/mcp.env
sudo editor /etc/moogo/mcp.env
```

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MOOGO_BASE_URL` | yes | — | API origin, e.g. `https://api.moogo.dev` |
| `MOOGO_PROJECT_ID` | yes | — | The project's UUID |
| `MOOGO_SQL_KEY` | yes | — | SQL credential (project key) |
| `MOOGO_MCP_TRANSPORT` | no | `stdio` | `stdio` or `http` |
| `MOOGO_MCP_ADDR` | no | `127.0.0.1:4618` | Only used when `transport=http` |
| `MOOGO_STORAGE_ACCESS_KEY_ID` | no* | — | Object tools need **both** this and the secret |
| `MOOGO_STORAGE_SECRET_KEY` | no* | — | Object tools need **both** this and the access key id |

\* Bucket tools are registered only when **both** bucket variables are set.
When neither is set, the server exposes SQL tools only.

**2. Re-run the deploy** so the binary, unit and service are enabled:

```bash
sudo ./deploy/deploy.sh YOUR-DOMAIN
systemctl status moogo-mcp
# If HTTP mode:
curl -fsS http://127.0.0.1:4618/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
journalctl -u moogo-mcp -f
```

The unit is `moogo-mcp.service` (not templated — one project per unit; copy
and rename for multiple projects). The deploy script installs the unit only
when `/etc/moogo/mcp.env` exists, so the default deploy is unchanged.

## Migrations

They run automatically at startup, one transaction per file, under an advisory
lock, and **a failure aborts the boot**.

That is the right behaviour and it has one sharp edge: migrations are not
idempotent, so never point a new binary at a database that was migrated by
hand. `0001_init.sql` runs `CREATE TABLE users`, which fails outright if the
table is already there, and the service will then refuse to start with:

```
moogo: control plane: migrate: run migration 0001_init: ERROR: relation "users" already exists (SQLSTATE 42701)
```

Against an empty database every migration applies cleanly; a fresh deployment
needs no manual steps. Upgrading an existing deployment is fine — the runner
records what it applied.

## Backups

`moogo-backup` writes `Postgres + per-project SQLite + buckets` to
`/var/backups/moogo/<timestamp>/`, keeps 14 days, and refuses to overwrite
itself with a concurrent run.

SQLite is copied with the `.backup` command rather than `cp`, because a `cp`
taken mid-write produces a file that opens as "database disk image is
malformed". **Install the `sqlite3` package.** Without it the script falls back
to copying, prints a warning, and exits non-zero — the archive is not trustworthy
in that state.

An archive is worth nothing unless you have restored one, so that is the part
`moogo-verify-backup` exists for. It runs at 04:23, an hour after the backup so
it never reads an archive that is still being written, and it:

- restores `control-plane.dump` into a throwaway `moogo_restore_check` database
  and counts the tables, users and projects that came back;
- runs `PRAGMA integrity_check` over every project database in the archive;
- reads the bucket tarball;
- drops the scratch database and exits.

It never touches the live database or `$MOOGO_DATA_DIR`, and it exits non-zero
on any failure, so a `cron` mail on
`/var/log/moogo-verify.log` is the alarm. Until that log is clean, treat the
backups as unproven.

Run both by hand after the first deploy:

```bash
sudo /usr/local/bin/moogo-backup
sudo /usr/local/bin/moogo-verify-backup
```

Restore into a stopped service:

```bash
sudo systemctl stop moogo
sudo -u postgres createdb moogo
pg_restore -d moogo /var/backups/moogo/<stamp>/control-plane.dump
sudo -u moogo cp -r /var/backups/moogo/<stamp>/dbs/.   /var/lib/moogo/dbs/
sudo -u moogo tar -C /var/lib/moogo -xf /var/backups/moogo/<stamp>/buckets.tar
sudo systemctl start moogo
```

## Knowing it is down

`moogo-healthcheck` probes the **public** URL, `/healthz` and `/readyz`, and
alerts on the transition rather than on every failed run. `deploy.sh` installs it
into cron every minute against `https://$DOMAIN` by default; set
`MOOGO_HEALTHCHECK_URL` when running `deploy.sh` to pin a different origin (an
`app.` subdomain, say) instead of having the entry rewritten to the argument on
every re-run.

Liveness and readiness are checked separately because they mean different
things. With Postgres stopped:

```
{"status":"ok"}                     <- /healthz, the process is fine
503                                 <- /readyz, it cannot reach the database
  - readiness /readyz did not answer 200 with a status
```

That alert says "the database is down" rather than "restart the service", which
is the difference between a two-minute fix and a pointless restart loop.

Exit codes, so any scheduler can use it:

| Code | Meaning |
|---|---|
| `0` | healthy, or still failing but already alerted — a repeat is not news |
| `1` | not answering, or answering wrong, and this run is the alert |
| `2` | the check cannot run: no URL, or `curl` missing |

Alerts go to `MOOGO_HEALTHCHECK_ALERT_WEBHOOK` and, with `mailx` installed, to
`MOOGO_HEALTHCHECK_ALERT_EMAIL`. It announces recovery as well as failure,
because silence after an outage reads as "still broken" to whoever is waiting.

**The cron entry is not enough, and no local check can be.** It only sees the
deployment while the VPS is alive. If the machine is gone — provider outage,
disk failure, someone pulling the plug — nothing on it sends a message. Point an
external monitor at the public URL:

```bash
MOOGO_HEALTHCHECK_URL=https://moogo.example.com /usr/local/bin/moogo-healthcheck
```

Healthchecks.io, Uptime Kuma or any uptime service will do, and if you would
rather install nothing at all, a plain external `GET /healthz` every minute
catches the same thing.

## Single node, and what that costs

`DECISIONS.md` D5 fixes one node. It is not a bug in the install: the data
plane keeps each project's SQLite file and each bucket's objects on local disk,
so a second node cannot serve them without either a shared filesystem or moving
buckets to object storage. Until one of those happens, the honest options are:

- **Fail fast and recover fast.** systemd restarts the process, the cron job
  writes and verifies the backup, `moogo-healthcheck` notices most failures
  within a minute, and `deploy.sh` rebuilds a dead machine in a few minutes.
  What is still missing is an external monitor: nothing outside the VPS knows
  when the whole machine goes.
- **Actual HA.** Move buckets to S3-compatible storage so any node can serve
  them, then route by project id at the proxy. That is D5 being revisited, and
  it is a project of its own rather than a config change.

Do not add a second node to the existing layout. A second node with its own data
directory would serve a different set of projects, which reads as random data
loss to anybody who reaches the wrong one.

## Operating it

```bash
systemctl status moogo
journalctl -u moogo -f
curl -fsS http://127.0.0.1:8080/readyz     # {"status":"ready"}
curl -fsS http://127.0.0.1:8080/healthz
```

`/healthz` is liveness, `/readyz` pings Postgres. Only `/readyz` failing means
the database is down.

Stops take up to 30 seconds, because in-flight requests are allowed to finish;
`TimeoutStopSec=45s` in the unit is deliberately longer. A `systemctl stop` that
takes 30 seconds is working, not hanging.

## MCP Server (optional, per-project)

The MCP binary (`moogo-mcp`) is a developer tool that proxies one project's
data plane (SQL + object storage) over the Model Context Protocol. It is **not**
started by `deploy.sh` — every project needs its own credentials.

### Quick start (manual)

```bash
# 1. Buat environment file per proyek
sudo mkdir -p /etc/moogo
cat >/etc/moogo/mcp.env <<'EOF'
MOOGO_BASE_URL=https://api.moogo.dev     # API origin, no path
MOOGO_PROJECT_ID=<project_id>            # the project's UUID
MOOGO_SQL_KEY=moogo_...                  # SQL credential (project key)
MOOGO_MCP_TRANSPORT=http               # atau stdio (default)
MOOGO_MCP_ADDR=127.0.0.1:4618          # default loopback — JANGAN 0.0.0.0
# Opsional: object storage tools
MOOGO_STORAGE_ACCESS_KEY_ID=moogo_ak_...
MOOGO_STORAGE_SECRET_KEY=moogo_sk_...
EOF
sudo chmod 0640 /etc/moogo/mcp.env
sudo chown root:moogo /etc/moogo/mcp.env

# 2. Install unit (copy, don't symlink — systemd follows symlinks but
#    the file must be readable by root:moogo)
sudo cp deploy/moogo-mcp.service /etc/systemd/system/moogo-mcp@myproject.service

# 3. Start
sudo systemctl daemon-reload
sudo systemctl enable --now moogo-mcp@myproject
journalctl -u moogo-mcp@myproject -f
```

### Keamanan

- **Default `127.0.0.1`**: MCP server memegang project secret. Binding ke
  `0.0.0.0` membuka SQL exec ke siapa saja yang bisa reach port. Gunakan SSH
  tunnel / WireGuard / Cloudflare Tunnel untuk akses remote.
- **Transport `stdio`**: Untuk agent lokal (Claude Desktop, Cursor, dll.),
  jalankan binary langsung tanpa systemd — stdout adalah JSON-RPC stream.
- **Credential terpisah**: Bucket tools hanya aktif bila **keduanya** diset.
  Tanpa keduanya, server hanya expose SQL tools.
- **Satu unit per proyek**: Gunakan instance systemd (`moogo-mcp@myproject`)
  dengan `EnvironmentFile` berbeda.

### Verifikasi

```bash
curl -fsS http://127.0.0.1:4618/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
# → 200 OK, serverInfo.name=moogo, tools: query,exec,transaction,list_schema,(+bucket tools)
```

curl -fsS http://127.0.0.1:4618/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
# → 200 OK, serverInfo.name=moogo, tools: query,exec,transaction,list_schema,(+bucket tools)

## Upgrading (Breaking Changes)

### v0.2.0 → v0.2.1 (BREAKING: env var standardization)

All legacy env vars removed. **Action required** before restart:

```bash
# /etc/moogo/moogo.env — replace old names with new names
# Old (removed):             # New (required):
MOOGO_API_URL               →  MOOGO_BASE_URL
MOOGO_BUCKET_ENDPOINT       →  MOOGO_BASE_URL
MOOGO_BUCKET_ACCESS_KEY_ID  →  MOOGO_STORAGE_ACCESS_KEY_ID
MOOGO_BUCKET_SECRET_KEY     →  MOOGO_STORAGE_SECRET_KEY
MOOGO_PROJECT_KEY           →  MOOGO_SQL_KEY
MOOGO_PROJECT_URL           →  MOOGO_BASE_URL (origin only) + MOOGO_PROJECT_ID
MOOGO_SECRET_KEY            →  MOOGO_SQL_KEY
```

`MOOGO_BASE_URL` is the **origin only** — `https://api.yourdomain.com`, no
`/p/<id>` and no `/bucket`. The project id lives in `MOOGO_PROJECT_ID`, and
clients append `/p/$MOOGO_PROJECT_ID/query` or `/p/$MOOGO_PROJECT_ID/bucket`
themselves. A value that still carries a path is rejected at startup.

Minimal working file after upgrade:

```bash
# The server itself
MOOGO_BASE_URL=https://api.yourdomain.com    # API origin, no path
MOOGO_PUBLIC_URL=https://app.yourdomain.com  # dashboard origin
MOOGO_DATABASE_URL=postgres://...
MOOGO_SESSION_SECRET=your-64-char-secret
MOOGO_COOKIE_SECURE=true
MOOGO_ENV=production
RESEND_API_KEY=re_xxx   # or MOOGO_GOOGLE_CLIENT_ID=xxx
```

Storage credentials are **not** server environment. Each project gets its own,
issued in the dashboard (**Bucket → Credentials**) and read only by the client
application or the MCP server, never by `moogo`. Set them where the client runs:

```bash
# A client application's own environment (any language)
MOOGO_BASE_URL=https://api.yourdomain.com
MOOGO_PROJECT_ID=your-project-uuid
MOOGO_SQL_KEY=moogo_...                # SQL (or MOOGO_STORAGE_* for storage)
MOOGO_STORAGE_ACCESS_KEY_ID=moogo_ak_...
MOOGO_STORAGE_SECRET_KEY=moogo_sk_...
```

Check config before restart:

```bash
sudo -u moogo env $(grep -v '^#' /etc/moogo/moogo.env | xargs) \
  /usr/local/bin/moogo --check-config
sudo systemctl restart moogo
```

**Deploy script enforces this:** `deploy.sh` now asserts that `base_url` from `/healthz` matches `MOOGO_BASE_URL` in the env file. A mismatch fails the deploy with a clear message.

### v0.1.x → v0.2.0 (BREAKING: SDK auth + env vars)

- SDK storage auth changed from HMAC to Bearer token (`Authorization: Bearer moogo_sk_...`)
- `createStorageClient()` / `createSQLClient()` factories added
- Legacy env vars still accepted with deprecation warnings (removed in v0.2.1)

## What this does not give you

- **No high availability.** One node. If the VPS is down the product is down.
- **No multi-tenancy across nodes.** Nothing can be moved to a second node
  without D5 being revisited.
- **No metrics.** Logs are structured JSON on stdout to journald. There is no
  exporter, so anything beyond "is it up" is a journal pattern match.