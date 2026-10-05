# Moogo Deployment Guide

Written for an agent or operator taking this service onto a VPS for the first
time. Everything here was verified against a running instance; the error strings
in the troubleshooting section are real output, not guesses.

`deploy/README.md` is the human-facing overview. This file is the one to follow.

---

## 1. What you are deploying

One Go binary that serves three things from a single origin on one port:

| | |
|---|---|
| Control plane | accounts, projects, quotas, credentials — stored in **PostgreSQL** |
| Data plane | SQL and object storage for one project — stored as **SQLite files on local disk** |
| Dashboard | React SPA, built into `web/dist` and embedded in the binary |

There is no frontend to build at deploy time on a fresh clone: `web/dist` is
committed, because `web/web.go` embeds it and an embed directive with no
matching files is a compile error.

The binary serves **plain HTTP only**. `cmd/api/main.go` calls
`ListenAndServe()` and nothing else. TLS terminates in Caddy. This is not
optional.

---

## 2. Hard facts

| | |
|---|---|
| Listen address | `:8080`, must be reachable by Caddy on `127.0.0.1` |
| systemd unit | `moogo.service`, user `moogo`, no login shell |
| Binary | `/usr/local/bin/moogo` |
| Secrets | `/etc/moogo/moogo.env`, `root:moogo`, mode `0640` |
| Working directory | `/opt/moogo` |
| Writable data | `/var/lib/moogo` (this is the only writable path for the service) |
| Backups | `/var/backups/moogo/<UTC-timestamp>/` |
| Control plane | PostgreSQL, migrations run automatically at startup |
| Liveness | `GET /healthz` → `{"status":"ok"}` |
| Readiness | `GET /readyz` → `{"status":"ready"}` or `503` |
| Graceful stop | up to **30 seconds** — `systemctl stop` taking 30s is correct |
| Quota ceiling | 256 MB per project, not configurable upward |

Systemd sandboxing is `ProtectSystem=strict` with `ReadWritePaths=/var/lib/moogo`.
If the service cannot write somewhere, that is usually why — do not add paths
until you know why.

---

## 3. Prerequisites

```bash
# all must be present or deploy.sh exits before changing anything
command -v go caddy systemctl

# needed for trustworthy backups, see §9
command -v sqlite3 pg_dump pg_restore
```

| Package | Why it is not optional |
|---|---|
| `sqlite3` | Without it, backups fall back to `cp`, which can capture a torn SQLite file. The script warns and exits non-zero. |
| `caddy` | TLS terminator |
| `postgresql-client` | `pg_dump`/`pg_restore` for backup and restore |

PostgreSQL must already exist and be reachable. `deploy.sh` does not install or
configure a database.

---

## 4. Deploy

### 4.1 Decide the sign-in path first

**This blocks everything.** `MOOGO_ENV=production` refuses to start unless the
service has at least one way to verify an account. Pick one:

**Option A — Google OAuth** (free)

1. Google Cloud Console → APIs & Services → Credentials → Create Credentials →
   Web application.
2. Authorized redirect URI, exactly:
   ```
   https://YOUR-DOMAIN/auth/google/callback
   ```
3. Put the client id and secret in the environment file.

**Option B — Resend** (paid after the free allowance)

1. resend.com → API keys.
2. Verify the sending domain.
3. Put the key and a verified `MOOGO_MAIL_FROM` in the environment file.

Neither is worse. Google is one OAuth client; Resend also delivers password
resets. With **neither**, registration creates accounts that can never be signed
into and the process refuses to boot.

### 4.2 Install

```bash
git clone https://github.com/moogodev/moogodev.git
cd moogodev
sudo ./deploy/deploy.sh moogo.example.com
```

The script builds, creates the `moogo` user and directories, installs the unit,
the Caddyfile (with your domain substituted), the backup and healthcheck
scripts, the cron entries, then validates the environment and starts.

**It stops before enabling anything if `/etc/moogo/moogo.env` is missing.** That
is intentional: it will print the commands to create it and exit 0 having
started nothing.

### 4.3 Create the environment file

```bash
sudo install -m 0640 -o root -g moogo /dev/null /etc/moogo/moogo.env
sudo cp .env.production.example /etc/moogo/moogo.env
sudo editor /etc/moogo/moogo.env
```

### 4.4 Validate before starting

```bash
sudo -u moogo bash -c 'set -a; . /etc/moogo/moogo.env; set +a; \
  /usr/local/bin/moogo --check-config'
```

Expected output:

```
configuration is valid
  environment:   production
  addr:          :8080
  public url:    https://moogo.example.com
  data dir:      /var/lib/moogo
  cookie secure: true
  mail provider: true
  google signin: false
```

`--check-config` validates and exits without opening a database or binding a
port. Use it freely; it has no side effects.

### 4.5 Start

```bash
sudo systemctl start moogo
sudo systemctl reload caddy
sleep 5
curl -fsS http://127.0.0.1:8080/readyz   # {"status":"ready"}
```

### 4.6 Verify end to end

```bash
for p in /readyz / /login /register /plan /app /docs /docs/quickstart /api/docs; do
  printf '%-22s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://moogo.example.com$p")"
done
```

Every route is `200`. `/docs/quickstart` must **not** contain `<div id="root">` —
that would mean the SPA shell was served where a document was expected.

---

## 5. Configuration reference

Only `MOOGO_DATABASE_URL` and `MOOGO_SESSION_SECRET` are strictly required by
the parser. In practice production requires more, and the service will tell you
which one it wants.

### Required in production

| Variable | Notes |
|---|---|
| `MOOGO_DATABASE_URL` | `postgres://` or `postgresql://` |
| `MOOGO_SESSION_SECRET` | ≥ 32 characters. Must **not** be the value `dev.sh` defaults to — that one is published in the repository and production refuses it. |
| `MOOGO_ENV` | `production` |
| `MOOGO_COOKIE_SECURE` | must be `true` in production |
| `MOOGO_PUBLIC_URL` | the origin people type; email links are built from it |
| `MOOGO_DATA_DIR` | must match the unit's `ReadWritePaths` |

### At least one of

`RESEND_API_KEY` · `MOOGO_GOOGLE_CLIENT_ID` (+ `MOOGO_GOOGLE_CLIENT_SECRET`)

### Set this when behind a proxy

`MOOGO_TRUSTED_PROXIES=127.0.0.1/32,::1/128`

Without it, `X-Forwarded-For` is ignored and **every request appears to come
from 127.0.0.1**. The rate limit on `/auth/login` is per client address, so
every visitor on the internet counts as one client and the limit becomes a
limit on your whole user base.

### Defaults, verbatim from `internal/config/config.go`

| Variable | Default |
|---|---|
| `MOOGO_ADDR` | `:8080` |
| `MOOGO_DATA_DIR` | `/data` |
| `MOOGO_PUBLIC_URL` | `http://localhost:8080` |
| `MOOGO_ENV` | `development` |
| `MOOGO_COOKIE_SECURE` | `true` |
| `MOOGO_TRUSTED_PROXIES` | `""` (header ignored) |
| `MOOGO_SESSION_TTL` | `168h` (7 days) |
| `MOOGO_DB_MAX_CONNS` | `8` |
| `MOOGO_DB_MIN_CONNS` | `2` |
| `MOOGO_DB_CONNECT_TIMEOUT` | `10s` |
| `MOOGO_QUERY_TIMEOUT` | `15s` |
| `MOOGO_READ_TIMEOUT` | `15s` (applied as **ReadHeaderTimeout**) |
| `MOOGO_WRITE_TIMEOUT` | `30s` (**not used anywhere** — see §8) |
| `MOOGO_IDLE_TIMEOUT` | `120s` |
| `MOOGO_SHUTDOWN_TIMEOUT` | `20s` (**not used anywhere** — see §8) |
| `MOOGO_DEFAULT_MAX_PROJECTS` | `2` |
| `MOOGO_DEFAULT_MAX_DB_BYTES` | 100 MB |
| `MOOGO_DEFAULT_MAX_STORAGE_BYTES` | 256 MB |
| `MOOGO_MAX_STORAGE_BYTES` | 256 MB — **rejected if above the ceiling**, not clamped |
| `MOOGO_MAX_BODY_BYTES` | 1 MB (JSON requests) |
| `MOOGO_MAX_OBJECT_BYTES` | 256 MB (one upload) |
| `MOOGO_PASSWORD_RESET_TTL` | `1h` |
| `MOOGO_VERIFICATION_TTL` | `24h` |
| `MOOGO_ACTIVITY_LOG_RETENTION_DAYS` | `7` |
| `MOOGO_MAIL_FROM` | `Moogo <onboarding@resend.dev>` |
| `RESEND_API_KEY` | `""` (empty disables sending) |

### Quoting

**Any value containing a space must be quoted**, because `/etc/moogo/moogo.env`
is `source`d by `moogo-backup` and by the check command:

```bash
MOOGO_MAIL_FROM="Moogo <noreply@moogo.example.com>"
```

Unquoted, the shell splits it into three words and the value is silently wrong.

---

## 6. The two proxy traps

**HSTS is not sent.** The app sets `Strict-Transport-Security` only when
`r.TLS != nil`. Behind a terminating proxy `r.TLS` is always `nil`, so no header
is emitted. `deploy/Caddyfile` sets it. Do not remove that block expecting the
app to take over.

**Certificates are Caddy's job.** It obtains and renews them. If TLS stops
working, check `systemctl status caddy` before touching Moogo.

---

## 7. Troubleshooting

Each of these is real output from this codebase.

### `moogo: control plane: ping postgres: failed to connect to ... connection refused`

Postgres is not running, or is not listening where the URL points.

```bash
sudo systemctl status postgresql
PGPASSWORD= psql "$MOOGO_DATABASE_URL" -c 'select 1'
```

### `moogo: control plane: migrate: run migration 0011_add_plan_column: ERROR: column "billing_plan" of relation "users" already exists (SQLSTATE 42701)`

**The single most likely first-deploy failure.** A migration is not idempotent:
`0011` runs `ALTER TABLE users ADD COLUMN billing_plan`, which fails if the
column already exists. The runner treats that as fatal and the service will not
boot.

It happens when the database was migrated by hand, or by an earlier build with a
different migration set.

**Pick one of these. Do not improvise.**

**Option 1 — a fresh database (preferred).** Point `MOOGO_DATABASE_URL` at an
empty database and let the runner apply all twelve. This is the right answer for
a new deployment and the only one with no risk of a schema and a migration log
disagreeing.

**Option 2 — record the migration as applied.** Only when the existing schema is
already correct and you have confirmed the column exists with the right type and
default.

The bookkeeping table is:

```sql
CREATE TABLE schema_migrations (
    version    integer     PRIMARY KEY,
    name       text        NOT NULL,
    checksum   text        NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
)
```

`checksum` is `NOT NULL`, and the runner **compares it against the SHA-256 of the
file as it is in the binary**. A wrong or missing checksum does not get you past
the error above; it produces a different one:

```
migration 0011_add_plan_column was already applied with a different checksum;
add a new migration instead of editing an applied one
```

So compute it from the same file:

```bash
cd /opt/moogo   # or wherever the repo is checked out
sha256sum internal/dbcontrol/migrations/postgres/0011_add_plan_column.sql
```

then insert that hex digest with the filename as the name (the runner stores the
entry name, e.g. `add_plan_column`, which it derives from the file):

```sql
INSERT INTO schema_migrations (version, name, checksum)
VALUES (11, 'add_plan_column', '<the hex digest from sha256sum>');
```

Verify what is actually recorded before assuming:

```sql
SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version;
```

**Never "fix" this by editing the migration file to add `IF NOT EXISTS`.** The
checksum of every already-applied migration is verified at startup, so editing
one that has been applied anywhere turns this failure into a different one. Add a
new numbered migration instead.

### `MOOGO_SESSION_SECRET must be at least 32 characters`

Too short. `openssl rand -base64 32`.

### `MOOGO_SESSION_SECRET is the published development default; generate a real one with 'openssl rand -base64 32'`

You are using the value `dev.sh` ships. It is in a public repository, so anyone
can sign their own session cookies with it.

### `no sign-in path: set RESEND_API_KEY for email confirmation, or MOOGO_GOOGLE_CLIENT_ID for Google sign-in, otherwise registration creates accounts that can never be verified`

See §4.1. This is the intended behaviour, not a bug: registration is mounted
unconditionally, and an account whose `email_verified_at` is `NULL` is refused at
login with nothing able to unblock it.

### `MOOGO_COOKIE_SECURE must be true in production`

Set it. Do not work around it: without `Secure`, session cookies travel in
clear.

### `moogo: serve: listen tcp :8080: bind: address already in use`

A previous instance is still running.

```bash
sudo ss -tlnp | grep 8080
sudo systemctl status moogo
```

### `flock: command not found`

You are running an old copy of `deploy/backup.sh`. Current versions use a
directory lock. Re-run `deploy.sh`, or just update the file:

```bash
sudo cp deploy/backup.sh /usr/local/bin/moogo-backup
```

### `/healthz` answers `ok` but `/readyz` answers `503`

The process is fine; **the database is not**. Restarting the service will not
help. Check Postgres.

### `could not open output file ".../control-plane.dump": No such file or directory`

An old `backup.sh` that did not create the archive directory. The control plane
was never captured — check that today's archive is non-empty, then update the
script from `deploy/backup.sh`.

### `database creation failed: ERROR: database "postgres://..." already exists`

An old `verify-backup.sh` passing a conninfo URI as the database name. `createdb`
reads its **first positional as the database name**; the maintenance connection
must be named explicitly with `--maintenance-db`. Update from
`deploy/verify-backup.sh`.

### `remote: Permission to <owner>/<repo>.git denied to <other-user>.git`

You have more than one GitHub account and git is using the wrong credential.
`gh auth status` shows which is active; `gh auth switch --user NAME` changes it.
If git still picks the wrong one, the scoped helper is not set:

```bash
gh auth setup-git
git config --global --get-all credential.https://github.com.helper
```

It must contain `!/path/to/gh auth git-credential`. A system-wide
`credential.helper=osxkeychain` may still exist — the github.com-scoped helper
wins for GitHub URLs, so do not remove the system one.

### Sign-in succeeds but every route 404s

The binary is running but no route is mounted, which means `New()` returned
early or the frontend is missing. Check:

```bash
sudo -u moogo env MOOGO_DATA_DIR=/var/lib/moogo /usr/local/bin/moogo --check-config
curl -sI http://127.0.0.1:8080/ | head -1
```

A `500 frontend_missing` means `web/dist` was not in the tree the binary was
built from.

---

## 8. Settings that do nothing

Verified by grepping the whole tree. Do not spend time tuning them.

| Variable | Reality |
|---|---|
| `MOOGO_SHUTDOWN_TIMEOUT` | parsed into config, **never read**. `cmd/api/main.go` uses a hardcoded `shutdownGrace = 30 * time.Second`. Change the constant and rebuild, or change `TimeoutStopSec` in the unit. |
| `MOOGO_WRITE_TIMEOUT` | parsed, **never used**. Deliberate: a write timeout shorter than a long query would cut off successful results. |
| `MOOGO_READ_TIMEOUT` | used as `ReadHeaderTimeout`, **not** a whole-request read deadline. Intentional. |

---

## 9. Backups and restore

```
/etc/cron.d/moogo-backup
  03:17  backup    → /usr/local/bin/moogo-backup
  04:23  verify    → /usr/local/bin/moogo-verify-backup
/etc/cron.d/moogo-healthcheck
  every minute       → /usr/local/bin/moogo-healthcheck
```

The gap between 03:17 and 04:23 is deliberate: the verifier must not read an
archive that is still being written.

**Run both by hand after the first deploy.** A backup nobody has restored is a
hypothesis.

```bash
sudo /usr/local/bin/moogo-backup
sudo /usr/local/bin/moogo-verify-backup     # exits 0 only if it truly restores
```

The verifier restores the control plane into a throwaway `moogo_restore_check`
database, runs `PRAGMA integrity_check` over every project database, reads the
bucket tarball, drops the scratch database, and exits non-zero on any failure.

### Archive layout

```
/var/backups/moogo/20261005T031700Z/
  MANIFEST.txt
  control-plane.dump     pg_dump --format=custom
  dbs/<uuid>.db          one per project, taken with sqlite3 .backup
  buckets.tar            tar of $MOOGO_DATA_DIR/buckets
```

### Restoring

```bash
sudo systemctl stop moogo
sudo -u postgres createdb moogo
pg_restore -d moogo /var/backups/moogo/<stamp>/control-plane.dump
sudo -u moogo cp -r /var/backups/moogo/<stamp>/dbs/. /var/lib/moogo/dbs/
sudo -u moogo tar -C /var/lib/moogo -xf /var/backups/moogo/<stamp>/buckets.tar
sudo systemctl start moogo
curl -fsS http://127.0.0.1:8080/readyz
```

Ownership matters: the files must be `moogo:moogo` or the sandboxed service
cannot open them.

---

## 10. Health monitoring

```bash
MOOGO_HEALTHCHECK_URL=https://moogo.example.com /usr/local/bin/moogo-healthcheck
```

| Exit | Meaning |
|---|---|
| `0` | healthy, or still failing but already alerted |
| `1` | not answering, and this run is the alert |
| `2` | cannot run — no URL, or `curl` missing |

It probes the **public** URL and has **no default**. A `127.0.0.1` fallback
would make a misconfigured install report healthy for as long as the process was
up locally, which is exactly the blindness it exists to remove.

**The local cron entry cannot detect the machine being gone.** Nothing running
on a dead machine sends a message. Point an external monitor at
`https://moogo.example.com/healthz` — Healthchecks.io, Uptime Kuma, or anything
that does an HTTP GET every minute.

Alerts can go to `MOOGO_HEALTHCHECK_ALERT_WEBHOOK` (Slack/Discord/Drops
format) and, if `mailx` is installed, to `MOOGO_HEALTHCHECK_ALERT_EMAIL`.

---

## 11. Routine operations

```bash
sudo systemctl status moogo
sudo journalctl -u moogo -f
sudo journalctl -u moogo -n 200 --no-pager
sudo systemctl restart moogo
curl -fsS http://127.0.0.1:8080/readyz
df -h /var/lib/moogo
```

Logs are structured JSON on stdout to journald. There is no metrics exporter.

### Updating

```bash
cd moogo && git pull
sudo ./deploy/deploy.sh moogo.example.com
```

It never rewrites `/etc/moogo/moogo.env`, because changing the session secret
would sign every user out.

### Restoring capacity after a disk fills

```bash
sudo du -sh /var/lib/moogo/dbs /var/lib/moogo/buckets
sudo journalctl -u moogo --since "-2 hours" | grep -c '"level":"ERROR"'
```

The per-project quota is enforced before work commits, so a full disk shows up
as rejected uploads rather than as corruption.

---

## 12. Constraints — do not violate these

**One node.** `DECISIONS.md` D5. The data plane keeps each project's SQLite file
and each bucket's objects on local disk. A second node with its own data
directory would serve a **different set of projects**, which reads as random data
loss to whoever reaches the wrong one. Do not add a second node to this layout.

Real HA means moving buckets to S3-compatible storage so any node can serve
them, then routing by project id at the proxy. That is D5 being revisited, and
it is a project of its own.

**256 MB per project is a product decision,** not a tuning knob. A larger value
is rejected at startup rather than quietly clamped, because a config that looks
like it works and does not is the hardest thing to debug from outside. The same
number appears in the dashboard, the pricing page and the prompt given to a
coding assistant.

**`web/dist` is committed on purpose.** The binary embeds it.

---

## 13. What does not exist

Do not assume these are installed and do not go looking for them:

- No Dockerfile, no container image
- No CI workflow
- No HA, no multi-node routing, no load balancer config
- No metrics exporter or Prometheus endpoint
- No automatic restore — the verifier proves restorability, it does not restore
- No database migration rollback; migrations are forward-only
- No admin CLI; administration is through the dashboard
- No log shipping; journald only