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
NEWS_BIN_PATH=/usr/local/bin/moogo-news
INSTALL_DIR=/opt/moogo
ENV_FILE=/etc/moogo/moogo.env
NEWS_ENV_FILE=/etc/moogo/news.env

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
for tool in go nginx systemctl; do
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
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR" "$DATA_DIR/news"
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

# The What's-new service (news.moogo.dev) is a second binary with its own
# embedded frontend and its own SQLite. Building and installing it is
# unconditional so an update never leaves a stale binary behind; whether it
# runs still depends on NEWS_ENV_FILE, checked below.
if [[ -d "$REPO_ROOT/news/dist" ]]; then
	(cd "$REPO_ROOT/news" && npm install --no-audit --no-fund && npm run build)
fi
(cd "$REPO_ROOT" && go build -trimpath -o "$NEWS_BIN_PATH" ./cmd/news)
echo "    built $NEWS_BIN_PATH"

echo "==> installing unit and proxy config"
install -m 0644 "$REPO_ROOT/deploy/moogo.service" /etc/systemd/system/moogo.service
install -m 0644 "$REPO_ROOT/deploy/news.service" /etc/systemd/system/moogo-news.service
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

# The What's-new service has its own environment file with its own admin
# account. Missing is allowed here — the main service runs without news, and
# the unit is only enabled when this file exists. Nothing is ever written to
# it for the same reason as moogo.env above.
if [[ -f "$NEWS_ENV_FILE" ]]; then
	chown root:"$SERVICE_USER" "$NEWS_ENV_FILE"
	chmod 0640 "$NEWS_ENV_FILE"
else
	echo "    note: $NEWS_ENV_FILE does not exist — news.moogo.dev stays disabled."
	echo "    note: see deploy/README.md (What's new) to create it, then re-run."
fi

# The domain is the one argument, so the proxy config cannot drift from the
# certificate that will actually be requested. Everything below manages the
# nginx site in front of the service: refuse a duplicate server_name, reuse an
# existing certificate or obtain one with certbot over HTTP-01, write the site
# config, test it, and reload. Re-running the script rewrites the config.
echo "==> nginx site for $DOMAIN"

# nginx comes in two layouts: Debian and Ubuntu keep per-site files in
# sites-available linked from sites-enabled, other distributions include
# /etc/nginx/conf.d from nginx.conf. Use whichever this machine has.
NGINX_SITE_FILE=""
NGINX_SITE_LINK=""
NGINX_INCLUDE_HINT=""
if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
	NGINX_SITE_FILE=/etc/nginx/sites-available/moogo.conf
	NGINX_SITE_LINK=/etc/nginx/sites-enabled/moogo.conf
	NGINX_INCLUDE_HINT="include /etc/nginx/sites-enabled/*;"
elif [[ -d /etc/nginx/conf.d ]]; then
	NGINX_SITE_FILE=/etc/nginx/conf.d/moogo.conf
	NGINX_INCLUDE_HINT="include /etc/nginx/conf.d/*.conf;"
else
	echo "!! nginx has neither /etc/nginx/sites-available nor /etc/nginx/conf.d." >&2
	echo "!! Check the installation (apt install nginx / dnf install nginx) and" >&2
	echo "!! re-run." >&2
	exit 1
fi

news_enabled=0
if [[ -f "$NEWS_ENV_FILE" ]]; then
	news_enabled=1
fi

# A duplicate server_name is legal nginx and silently wrong: nginx keeps the
# first block it loaded, so the config written here would never receive
# traffic and the deploy would look like it ran without changing anything.
# Refuse up front instead, the way the environment file refusal refuses.
echo "    checking that no existing site already serves $DOMAIN"
existing_names="$(
	for f in /etc/nginx/nginx.conf /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
		if [[ ! -f "$f" ]]; then
			continue
		fi
		if [[ "$f" == "$NGINX_SITE_FILE" || "$f" == "$NGINX_SITE_LINK" ]]; then
			continue
		fi
		awk '
			/^[ \t]*server_name[ \t]/ {
				line = $0
				sub(/^[ \t]*server_name[ \t]+/, "", line)
				sub(/;.*/, "", line)
				n = split(line, toks, /[ \t]+/)
				for (i = 1; i <= n; i++) {
					if (toks[i] != "" && toks[i] != "default_server") print toks[i]
				}
			}' "$f"
	done | sort -u
)"
conflicts=()
if [[ -n "$existing_names" ]]; then
	while IFS= read -r name; do
		if [[ "$name" == "$DOMAIN" ]]; then
			conflicts+=("$DOMAIN")
		fi
		if [[ $news_enabled -eq 1 && "$name" == "news.$DOMAIN" ]]; then
			conflicts+=("news.$DOMAIN")
		fi
	done <<<"$existing_names"
fi
if [[ ${#conflicts[@]} -gt 0 ]]; then
	echo >&2
	echo "!! nginx already has a server_name for: ${conflicts[*]}" >&2
	echo "!! Remove or disable those blocks first -- nginx keeps only the first" >&2
	echo "!! one it loaded, so this deployment would never receive traffic:" >&2
	echo "!!   grep -rn server_name /etc/nginx" >&2
	echo "!! then re-run this script." >&2
	exit 1
fi

# http2 changed syntax in nginx 1.25.1: the parameter on `listen` became its
# own `http2 on;` directive. Emit the form this nginx expects, so re-runs do
# not accumulate deprecation warnings on a current build.
nginx_version="$(nginx -v 2>&1 | sed -n 's/^.*nginx\/\([0-9][0-9.]*\).*/\1/p')"
nginx_http2_lines() {
	if [[ -n "$nginx_version" ]] &&
		[[ "$(printf '%s\n' 1.25.1 "$nginx_version" | sort -V | head -n 1)" == "1.25.1" ]]; then
		printf '	listen 443 ssl;\n	listen [::]:443 ssl;\n	http2 on;\n'
	else
		printf '	listen 443 ssl http2;\n	listen [::]:443 ssl http2;\n'
	fi
}

nginx_proxy_headers() {
	cat <<'EOF'
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		# Stream uploads instead of buffering them to disk first: an object
		# can be as large as the 256 MB storage ceiling.
		proxy_request_buffering off;
EOF
}

# nginx_site_80 SERVER_NAME plain|tls UPSTREAM_PORT ACCESS_LOG
nginx_site_80() {
	local name="$1" mode="$2" port="$3" logfile="$4"
	cat <<'EOF'

server {
	listen 80;
	listen [::]:80;
EOF
	printf '	server_name %s;\n' "$name"
	printf '	access_log %s;\n' "$logfile"
	cat <<'EOF'
	client_max_body_size 256m;
	server_tokens off;

	# Plain HTTP exists only for the ACME challenge that obtains the
	# certificate, and from then on for redirecting to https. Serving the
	# site over it would put every session cookie on the wire in clear.
	location /.well-known/acme-challenge/ {
		root /var/www/certbot;
	}

EOF
	if [[ "$mode" == "tls" ]]; then
		cat <<'EOF'
	location / {
		return 301 https://$host$request_uri;
	}
}
EOF
	else
		# No certificate yet: proxy instead of redirecting, so http:// keeps
		# answering while certbot obtains one (or when certbot is absent).
		printf '	location / {\n		proxy_pass http://127.0.0.1:%s;\n' "$port"
		nginx_proxy_headers
		cat <<'EOF'
	}
}
EOF
	fi
}

# nginx_site_443 SERVER_NAME CERT KEY UPSTREAM_PORT ACCESS_LOG
nginx_site_443() {
	local name="$1" cert="$2" key="$3" port="$4" logfile="$5"
	cat <<'EOF'

server {
EOF
	nginx_http2_lines
	printf '	server_name %s;\n' "$name"
	printf '	ssl_certificate %s;\n' "$cert"
	printf '	ssl_certificate_key %s;\n' "$key"
	cat <<'EOF'
	ssl_protocols TLSv1.2 TLSv1.3;

	# HSTS belongs at this layer: the app only sends it when r.TLS != nil,
	# which is never true behind a terminating proxy.
	add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

	# 256 MB is StorageCeilingBytes, the largest upload the app itself allows.
	client_max_body_size 256m;
	server_tokens off;
EOF
	printf '	access_log %s;\n' "$logfile"
	cat <<'EOF'

	gzip on;
	gzip_comp_level 5;
	gzip_min_length 256;
	gzip_vary on;
	gzip_types text/plain text/css application/json application/javascript
		application/xml image/svg+xml font/woff2;

	# Everything goes to the same origin, including /healthz and /readyz,
	# which the healthcheck and any external monitor poll.
	location / {
EOF
	printf '		proxy_pass http://127.0.0.1:%s;\n' "$port"
	nginx_proxy_headers
	cat <<'EOF'
	}
}
EOF
}

# write_nginx_site MAIN_MODE NEWS_MODE -- write the site, test it, reload. A
# failed test restores the previous file and exits without reloading: a half
# written proxy config is worse than the one already running.
write_nginx_site() {
	local main_mode="$1" news_mode="$2" backup="" test_out="" dump=""
	if [[ -f "$NGINX_SITE_FILE" ]]; then
		backup="$(mktemp)"
		cp -p "$NGINX_SITE_FILE" "$backup"
	fi
	{
		cat <<'EOF'
# Written by moogo deploy.sh: re-running the script overwrites this file.
#
# TLS terminates here; the binary only speaks plain HTTP. HSTS is set at this
# layer because the app sends it only when r.TLS != nil, which is never true
# behind a proxy. /etc/moogo/moogo.env must keep 127.0.0.1 in
# MOOGO_TRUSTED_PROXIES, or every client collapses into the proxy address and
# the per-client rate limit stops counting clients.
EOF
		nginx_site_80 "$DOMAIN" "$main_mode" 8080 /var/log/nginx/moogo-access.log
		if [[ "$main_mode" == "tls" ]]; then
			nginx_site_443 "$DOMAIN" "$main_cert" "$main_key" 8080 /var/log/nginx/moogo-access.log
		fi
		if [[ "$news_mode" != "off" ]]; then
			nginx_site_80 "news.$DOMAIN" "$news_mode" 8081 /var/log/nginx/moogo-news-access.log
			if [[ "$news_mode" == "tls" ]]; then
				nginx_site_443 "news.$DOMAIN" "$news_cert" "$news_key" 8081 /var/log/nginx/moogo-news-access.log
			fi
		fi
	} >"$NGINX_SITE_FILE"

	if [[ -n "$NGINX_SITE_LINK" ]]; then
		ln -sfn "$NGINX_SITE_FILE" "$NGINX_SITE_LINK"
	fi

	if ! test_out="$(nginx -t 2>&1)"; then
		printf '%s\n' "$test_out" >&2
		if [[ -n "$backup" ]]; then
			cp -p "$backup" "$NGINX_SITE_FILE"
			echo "!! the previous configuration was restored; nginx was not reloaded." >&2
		else
			rm -f "$NGINX_SITE_FILE"
			if [[ -n "$NGINX_SITE_LINK" ]]; then
				rm -f "$NGINX_SITE_LINK"
			fi
			echo "!! the new file was removed; nginx was not reloaded." >&2
		fi
		exit 1
	fi
	if [[ -n "$backup" ]]; then
		rm -f "$backup"
	fi

	# nginx -t passes on a file nothing includes, and that would deploy a
	# site nobody can reach. Prove the config actually loaded.
	dump="$(nginx -T 2>/dev/null || true)"
	if [[ "$dump" != *"server_name $DOMAIN;"* ]]; then
		echo "!! nginx tested a configuration that does not include $NGINX_SITE_FILE." >&2
		echo "!! Add this line to /etc/nginx/nginx.conf, then re-run:" >&2
		echo "!!   $NGINX_INCLUDE_HINT" >&2
		exit 1
	fi

	systemctl reload nginx
}

# obtain_cert FQDN -- ask certbot for one certificate over the webroot
# challenge. Returns certbot's status; the caller decides if that is fatal.
obtain_cert() {
	local fqdn="$1" email="" email_args=()
	if [[ -n "${MOOGO_CERTBOT_EMAIL:-}" ]]; then
		email_args=(--email "$MOOGO_CERTBOT_EMAIL")
	elif [[ -t 0 ]]; then
		printf 'email for certificate expiry notices (enter to skip): '
		read -r email || email=""
		if [[ -n "$email" ]]; then
			email_args=(--email "$email")
		else
			email_args=(--register-unsafely-without-email)
			echo "    note: no email -- certbot will not warn before this certificate expires"
		fi
	else
		email_args=(--register-unsafely-without-email)
		echo "    note: no MOOGO_CERTBOT_EMAIL and no terminal; registered without an email"
	fi
	certbot certonly --webroot -w /var/www/certbot -d "$fqdn" \
		--non-interactive --agree-tos --keep-until-expiring "${email_args[@]}"
}

# Certificates: reuse what is already on disk, or obtain one. Renewal is
# certbot's timer, which reloads nginx through the hook installed below.
live_cert="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
live_key="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
main_cert=""
main_key=""
if [[ -n "${MOOGO_SSL_CERT:-}" || -n "${MOOGO_SSL_KEY:-}" ]]; then
	if [[ ! -f "${MOOGO_SSL_CERT:-}" || ! -f "${MOOGO_SSL_KEY:-}" ]]; then
		echo "!! MOOGO_SSL_CERT and MOOGO_SSL_KEY must both name files that exist:" >&2
		echo "!!   sudo MOOGO_SSL_CERT=/path/fullchain.pem MOOGO_SSL_KEY=/path/privkey.pem $0 $DOMAIN" >&2
		exit 1
	fi
	main_cert="$MOOGO_SSL_CERT"
	main_key="$MOOGO_SSL_KEY"
elif [[ -f "$live_cert" && -f "$live_key" ]]; then
	if ! command -v openssl >/dev/null 2>&1 ||
		openssl x509 -checkend 0 -noout -in "$live_cert" >/dev/null 2>&1; then
		main_cert="$live_cert"
		main_key="$live_key"
	else
		echo "    note: the certificate for $DOMAIN has expired; a new one will be requested"
	fi
fi

have_certbot=0
if command -v certbot >/dev/null 2>&1; then
	have_certbot=1
fi
if [[ -z "$main_cert" && $have_certbot -eq 0 ]]; then
	echo "!! there is no certificate for $DOMAIN and certbot is not installed." >&2
	echo "!! Install it (apt install certbot / dnf install certbot), or point the" >&2
	echo "!! script at certificates you already have:" >&2
	echo "!!   sudo MOOGO_SSL_CERT=/path/fullchain.pem MOOGO_SSL_KEY=/path/privkey.pem $0 $DOMAIN" >&2
	exit 1
fi

news_cert=""
news_key=""
news_live_cert="/etc/letsencrypt/live/news.$DOMAIN/fullchain.pem"
news_live_key="/etc/letsencrypt/live/news.$DOMAIN/privkey.pem"
if [[ $news_enabled -eq 1 && -f "$news_live_cert" && -f "$news_live_key" ]]; then
	if ! command -v openssl >/dev/null 2>&1 ||
		openssl x509 -checkend 0 -noout -in "$news_live_cert" >/dev/null 2>&1; then
		news_cert="$news_live_cert"
		news_key="$news_live_key"
	fi
fi
attempt_news=0
if [[ $news_enabled -eq 1 && -z "$news_cert" && $have_certbot -eq 1 ]]; then
	# Without a resolving DNS record the challenge cannot reach this machine,
	# so do not sit through certbot's timeout; the note at the end says why.
	if ! command -v getent >/dev/null 2>&1 || getent hosts "news.$DOMAIN" >/dev/null 2>&1; then
		attempt_news=1
	fi
fi
need_main=0
if [[ -z "$main_cert" ]]; then
	need_main=1
fi

if ! systemctl enable --now nginx; then
	echo "!! nginx did not start; 'nginx -t' says why:" >&2
	nginx -t >&2 || true
	exit 1
fi

install -d -m 0755 /var/www/certbot
if [[ $have_certbot -eq 1 ]]; then
	# A renewed certificate is only live once nginx reads it again.
	install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
	cat >/etc/letsencrypt/renewal-hooks/deploy/moogo-reload-nginx <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
	chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/moogo-reload-nginx
	if systemctl cat certbot.timer >/dev/null 2>&1; then
		if ! systemctl enable --now certbot.timer >/dev/null 2>&1; then
			echo "    note: certbot.timer exists but could not be enabled -- check" >&2
			echo "    note: 'systemctl status certbot.timer' or certificates will expire." >&2
		fi
	fi
fi

# While a certificate is missing for anything, http must keep working and
# serve the ACME challenge: redirecting to https now would bounce every
# request at a port nothing is listening on yet.
main_mode="plain"
if [[ $need_main -eq 0 ]]; then
	main_mode="tls"
fi
news_mode="off"
if [[ $news_enabled -eq 1 ]]; then
	news_mode="plain"
	if [[ -n "$news_cert" ]]; then
		news_mode="tls"
	fi
fi
if [[ $need_main -eq 1 || $attempt_news -eq 1 ]]; then
	echo "    writing the site configuration (a certificate is still missing)"
	write_nginx_site "$main_mode" "$news_mode"
fi

if [[ $need_main -eq 1 ]]; then
	echo "    requesting a certificate for $DOMAIN"
	if ! obtain_cert "$DOMAIN"; then
		echo >&2
		echo "!! certbot could not obtain a certificate for $DOMAIN." >&2
		echo "!! The usual cause is that the domain's A record does not point at this" >&2
		echo "!! machine, or that port 80 cannot be reached from the internet. The" >&2
		echo "!! site is being served over plain http for now (no redirect). Fix the" >&2
		echo "!! record and re-run this script." >&2
		exit 1
	fi
	if [[ ! -f "$live_cert" || ! -f "$live_key" ]]; then
		echo "!! certbot reported success but $live_cert is missing;" >&2
		echo "!! check 'certbot certificates' and re-run." >&2
		exit 1
	fi
	main_cert="$live_cert"
	main_key="$live_key"
fi

if [[ $attempt_news -eq 1 ]]; then
	echo "    requesting a certificate for news.$DOMAIN"
	if obtain_cert "news.$DOMAIN" && [[ -f "$news_live_cert" && -f "$news_live_key" ]]; then
		news_cert="$news_live_cert"
		news_key="$news_live_key"
		news_mode="tls"
	fi
fi

echo "    writing the site configuration"
write_nginx_site "tls" "$news_mode"
echo "    $NGINX_SITE_FILE now points at $DOMAIN"
if [[ $news_enabled -eq 1 && -z "$news_cert" ]]; then
	echo "    note: news.$DOMAIN has no certificate, so it is served over plain http" >&2
	echo "    note: (its Secure-only login cookie will not be sent there). Once its" >&2
	echo "    note: DNS record points here, run:" >&2
	echo "    note:   certbot certonly --webroot -w /var/www/certbot -d news.$DOMAIN" >&2
	echo "    note: and re-run this script." >&2
fi

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
17 3 * * * root set -a && . $ENV_FILE && set +a && BACKUP_DIR=$BACKUP_DIR MOOGO_DATA_DIR=$DATA_DIR /usr/local/bin/moogo-backup >> /var/log/moogo-backup.log 2>&1
EOF
chmod 0644 /etc/cron.d/moogo-backup

# A local healthcheck catches the things that happen while the machine is still
# up: nginx refusing to start, an expired certificate, Postgres unreachable, the
# service crash-looping. It cannot catch the machine itself being gone, and this
# script cannot be the whole answer to that -- see deploy/README.md.
echo "==> local healthcheck every minute"
cat >/etc/cron.d/moogo-healthcheck <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * root set -a && . $ENV_FILE && set +a && MOOGO_HEALTHCHECK_URL=https://$DOMAIN MOOGO_HEALTHCHECK_STATE=$DATA_DIR/healthcheck.state MOOGO_DATA_DIR=$DATA_DIR /usr/local/bin/moogo-healthcheck >> /var/log/moogo-healthcheck.log 2>&1
EOF
chmod 0644 /etc/cron.d/moogo-healthcheck

# The backup above is only worth what the verifier proves it can restore.
# README documents a 04:23 run, an hour after the backup so it never reads an
# archive that is still being written; install it alongside the others.
echo "==> nightly restore verification at 04:23"
cat >/etc/cron.d/moogo-backup-verify <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
23 4 * * * root set -a && . $ENV_FILE && set +a && BACKUP_DIR=$BACKUP_DIR MOOGO_DATA_DIR=$DATA_DIR /usr/local/bin/moogo-verify-backup >> /var/log/moogo-verify.log 2>&1
EOF
chmod 0644 /etc/cron.d/moogo-backup-verify

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
if [[ -f "$NEWS_ENV_FILE" ]]; then
	systemctl enable --now moogo-news
	echo "    news: enabled — https://news.$DOMAIN (the DNS record must already point here)"
else
	echo "    news: skipped — create $NEWS_ENV_FILE and re-run to enable it"
fi
systemctl reload nginx || systemctl restart nginx

echo
echo "waiting for readiness"
for _ in $(seq 1 30); do
	if curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then
		# The proxy path is only proven from outside. A failure here does not
		# undo a good deploy (DNS may still be propagating), so it warns.
		if curl -fsS --max-time 10 "https://$DOMAIN/healthz" >/dev/null 2>&1; then
			echo "ready: https://$DOMAIN"
		else
			echo "ready on localhost; https://$DOMAIN did not answer yet"
			echo "check DNS, ports 80/443 and 'systemctl status nginx'"
		fi
		exit 0
	fi
	sleep 2
done

echo "service did not become ready; last log lines:" >&2
journalctl -u moogo -n 40 --no-pager >&2
exit 1