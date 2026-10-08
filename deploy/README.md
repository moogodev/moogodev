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

The script builds the binary, creates the `moogo` service user, installs a
hardened unit and the nginx site configuration, schedules the nightly backup and
starts everything. It stops before enabling anything if `/etc/moogo/moogo.env`
is missing — the script will tell you to create it and exit.

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

Re-run `deploy.sh` with the same domain to deploy an update. It never rewrites
the environment file, because doing so would change the session secret and sign
everybody out.

## What is running

| Piece | Where |
|---|---|
| Binary | `/usr/local/bin/moogo`, plain HTTP on `127.0.0.1:8080` |
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
into cron every minute against `https://$DOMAIN`.

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

## What this does not give you

- **No high availability.** One node. If the VPS is down the product is down.
- **No multi-tenancy across nodes.** Nothing can be moved to a second node
  without D5 being revisited.
- **No metrics.** Logs are structured JSON on stdout to journald. There is no
  exporter, so anything beyond "is it up" is a journal pattern match.