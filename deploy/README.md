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
hardened unit and the Caddy configuration, schedules the nightly backup and
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
| TLS, certificates | Caddy in front, renewing on its own |
| Secrets | `/etc/moogo/moogo.env`, `root:moogo`, mode 640 |
| Control plane | PostgreSQL |
| Project databases | `$MOOGO_DATA_DIR/dbs/<uuid>.db` |
| Object storage | `$MOOGO_DATA_DIR/buckets/` |
| Nightly backup | `/etc/cron.d/moogo-backup` at 03:17 |
| Restore check | the same file, 04:23, into a throwaway database |
| Health check | `/etc/cron.d/moogo-healthcheck`, every minute, public URL |

The binary does not terminate TLS, so Caddy is not optional. Two things follow
that are easy to miss:

- **HSTS is set in the Caddyfile**, not by the app. The app only sends it when
  `r.TLS != nil`, and behind a terminating proxy that is always nil.
- **`MOOGO_TRUSTED_PROXIES` must contain `127.0.0.1`.** Without it every request
  looks like it came from the proxy, and the rate limit on `/auth/login`
  becomes a limit on your entire user base.

## Migrations

They run automatically at startup, one transaction per file, under an advisory
lock, and **a failure aborts the boot**.

That is the right behaviour and it has one sharp edge: migrations are not
idempotent, so never point a new binary at a database that was migrated by
hand. `0011_add_plan_column.sql` runs `ALTER TABLE users ADD COLUMN
billing_plan`, which fails outright if the column is already there, and the
service will then refuse to start with:

```
control plane: migrate: run migration 0011_add_plan_column: ERROR: column "billing_plan" already exists
```

Against an empty database every migration applies cleanly. Upgrading an existing
deployment is fine — the runner records what it applied.

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