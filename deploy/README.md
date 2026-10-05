# Deploying Moogo

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

An archive is worth nothing unless you have restored one. After the first deploy:

```bash
sudo /usr/local/bin/moogo-backup
ls /var/backups/moogo/
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
- **No automated restore.** The backup is written; nobody verifies it restores.
  A backup you have never restored is a hypothesis.
- **No metrics.** Logs are structured JSON on stdout to journald. There is no
  exporter, so alerting is a journal pattern match today.