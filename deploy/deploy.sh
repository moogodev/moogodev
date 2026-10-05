#!/usr/bin/env bash
#
# Install or update a Moogo deployment on one VPS.
#
# The service is a single node by design (DECISIONS.md D5), so this targets one
# machine with a local data directory and a Postgres it can reach.
#
# Run as root:
#   sudo ./deploy/deploy.sh moogo.example.com
#
# It is safe to re-run: that is how an update is deployed.

set -euo pipefail

DOMAIN="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_USER=moogo
DATA_DIR=/var/lib/moogo
BACKUP_DIR=/var/backups/moogo
BIN_PATH=/usr/local/bin/moogo
INSTALL_DIR=/opt/moogo
ENV_FILE=/etc/moogo/moogo.env

if [[ $EUID -ne 0 ]]; then
	echo "run as root: sudo $0 <domain>" >&2
	exit 1
fi
if [[ -z "$DOMAIN" ]]; then
	echo "usage: sudo $0 <domain>" >&2
	exit 1
fi

echo "==> checking prerequisites"
missing=()
for tool in go caddy systemctl; do
	command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if [[ ${#missing[@]} -gt 0 ]]; then
	echo "missing: ${missing[*]}" >&2
	exit 1
fi

echo "==> service user and directories"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
	useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR"
install -d -m 0700 -o root -g "$SERVICE_USER" "$BACKUP_DIR"
install -d -m 0750 -o root -g "$SERVICE_USER" /etc/moogo

echo "==> building"
# The frontend is embedded, so it has to exist before the Go build. A fresh
# clone has web/dist committed; a checkout that changed web/ui does not.
if [[ -d "$REPO_ROOT/web/dist" ]]; then
	(cd "$REPO_ROOT/web/ui" && npm install --no-audit --no-fund && npm run build)
fi
(cd "$REPO_ROOT" && go test ./... && go build -trimpath -o "$BIN_PATH" ./cmd/api)
echo "    built $BIN_PATH"

echo "==> installing unit and proxy config"
install -m 0644 "$REPO_ROOT/deploy/moogo.service" /etc/systemd/system/moogo.service
install -m 0644 "$REPO_ROOT/deploy/backup.sh" /usr/local/bin/moogo-backup
install -m 0644 "$REPO_ROOT/deploy/verify-backup.sh" /usr/local/bin/moogo-verify-backup
install -m 0644 "$REPO_ROOT/deploy/healthcheck.sh" /usr/local/bin/moogo-healthcheck
chmod 0755 /usr/local/bin/moogo-backup /usr/local/bin/moogo-verify-backup /usr/local/bin/moogo-healthcheck

# Refuse to overwrite an environment file: it holds the session secret and the
# database password, and regenerating them would sign every cookie out.
if [[ ! -f "$ENV_FILE" ]]; then
	echo
	echo "!! $ENV_FILE does not exist."
	echo "!! Create it from .env.production.example before starting the service:"
	echo "!!"
	echo "!!   install -m 0640 -o root -g $SERVICE_USER /dev/null $ENV_FILE"
	echo "!!   editor $ENV_FILE"
	echo "!!"
	echo "!! Nothing has been started. Stopping here so nothing comes up"
	echo "!! unconfigured and answers every request with an error."
	exit 1
fi
chown root:"$SERVICE_USER" "$ENV_FILE"
chmod 0640 "$ENV_FILE"

# The domain is the one argument, so the proxy config cannot drift from the
# certificate Caddy will actually request.
sed "s/moogo\.example\.com/$DOMAIN/g" "$REPO_ROOT/deploy/Caddyfile" >/etc/caddy/Caddyfile
echo "    /etc/caddy/Caddyfile now points at $DOMAIN"

echo "==> validating configuration before enabling anything"
# A mistyped environment file would otherwise produce a service that restarts
# in a loop every five seconds.
systemctl daemon-reload
if ! systemd-run --wait --pipe --quiet \
	--property=User="$SERVICE_USER" \
	--property=EnvironmentFile="$ENV_FILE" \
	--setenv=MOOGO_ADDR=127.0.0.1:0 \
	"$BIN_PATH" --check-config; then
	echo
	echo "!! the service refused its configuration. Nothing has been enabled." >&2
	echo "!! Check $ENV_FILE. The most common causes are:" >&2
	echo "!!   - MOOGO_SESSION_SECRET shorter than 32 characters, or still the dev default"
	echo "!!   - MOOGO_COOKIE_SECURE not true, or MOOGO_ENV not production"
	echo "!!   - neither RESEND_API_KEY nor MOOGO_GOOGLE_CLIENT_ID set (no sign-in path)"
	exit 1
fi

echo "==> nightly backup at 03:17"
# moogo-backup refuses to run without MOOGO_DATABASE_URL, so the entry has to
# source the same file the service reads. cron runs with a minimal environment
# and does not inherit anything from the service.
cat >/etc/cron.d/moogo-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3 * * * root . /etc/moogo/moogo.env && BACKUP_DIR=$BACKUP_DIR MOOGO_DATA_DIR=$DATA_DIR /usr/local/bin/moogo-backup >> /var/log/moogo-backup.log 2>&1
EOF
chmod 0644 /etc/cron.d/moogo-backup

# A local healthcheck catches the things that happen while the machine is still
# up: Caddy refusing to start, an expired certificate, Postgres unreachable, the
# service crash-looping. It cannot catch the machine itself being gone, and this
# script cannot be the whole answer to that -- see deploy/README.md.
echo "==> local healthcheck every minute"
cat >/etc/cron.d/moogo-healthcheck <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * root . /etc/moogo/moogo.env && MOOGO_HEALTHCHECK_URL=https://$DOMAIN MOOGO_HEALTHCHECK_STATE=$DATA_DIR/healthcheck.state MOOGO_DATA_DIR=$DATA_DIR /usr/local/bin/moogo-healthcheck >> /var/log/moogo-healthcheck.log 2>&1
EOF
chmod 0644 /etc/cron.d/moogo-healthcheck

cat <<'NOTE'

================================================================================
 Still needed: a check that runs OFF this machine.

 The cron entry just added only sees the deployment while the VPS is alive.
 If the machine is gone -- provider outage, disk failure, someone pulling the
 plug -- nothing here sends a message, because nothing here is running.

 Point an external monitor at the public URL:

   MOOGO_HEALTHCHECK_URL=https://YOUR-DOMAIN /usr/local/bin/moogo-healthcheck

 Healthchecks.io, Uptime Kuma or any uptime service will do; the script exits
 1 on failure and 0 otherwise, so a plain HTTP GET on /healthz from outside is
 enough if you would rather not install anything here.
================================================================================
NOTE

echo "==> starting"
systemctl enable --now moogo
systemctl reload caddy || systemctl restart caddy

echo
echo "waiting for readiness"
for _ in $(seq 1 30); do
	if curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then
		echo "ready: https://$DOMAIN"
		exit 0
	fi
	sleep 2
done

echo "service did not become ready; last log lines:" >&2
journalctl -u moogo -n 40 --no-pager >&2
exit 1