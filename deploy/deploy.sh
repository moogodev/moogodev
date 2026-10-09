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
# It is safe to re-run: that is how an update is deployed. A re-run rebuilds,
# backs up the current binaries, installs, RESTARTS both services onto the new
# code and verifies the restart took (MainPID changed, NRestarts 0), then runs
# a short list of local HTTP checks. Replacing the file on disk never changes
# what a running process executes -- the inode is swapped and the old process
# keeps its old code -- so without the restart an update would silently not
# happen while the readiness probe still answered.
#
# Everything that can refuse runs BEFORE anything is changed: missing env file,
# duplicate nginx server_name, a web/dist or news/dist that differs from git
# (both are committed and embedded), and the go vet / go test -race gates.
# Binary backups live in /var/backups/moogo-binaries (newest 10 kept), and any
# failure after an install rolls them back.
#
# Behind a Cloudflare Tunnel (detected by /etc/cloudflared/config.yml) the
# nginx, certificate and certbot sections are skipped entirely: that machine
# terminates TLS at Cloudflare with loopback-only, reload-only nginx and owns
# its own configuration. /etc/cloudflared is never touched.

set -Eeuo pipefail

DOMAIN="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_USER=moogo
DATA_DIR=/var/lib/moogo
BACKUP_DIR=/var/backups/moogo
BINARY_BACKUP_DIR=/var/backups/moogo-binaries
BIN_PATH=/usr/local/bin/moogo
NEWS_BIN_PATH=/usr/local/bin/moogo-news
INSTALL_DIR=/opt/moogo
ENV_FILE=/etc/moogo/moogo.env
NEWS_ENV_FILE=/etc/moogo/news.env
NGINX_SITE_FILE=""
NGINX_SITE_LINK=""
NGINX_INCLUDE_HINT=""
BEHIND_TUNNEL=0
news_enabled=0

if [[ $EUID -ne 0 ]]; then
	echo "run as root: sudo $0 <domain>" >&2
	exit 1
fi
if [[ -z "$DOMAIN" ]]; then
	echo "usage: sudo $0 <domain>" >&2
	exit 1
fi

echo "==> checking prerequisites"
# gcc because the gates below run go test -race, which needs a C compiler;
# curl because the readiness loop and the post-deploy checks use it. nginx is
# only required when this machine's nginx will actually be managed.
if [[ -f /etc/cloudflared/config.yml ]]; then
	BEHIND_TUNNEL=1
fi
missing=()
tools=(go systemctl curl gcc)
if [[ $BEHIND_TUNNEL -eq 0 ]]; then
	tools+=(nginx)
fi
for tool in "${tools[@]}"; do
	command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if [[ ${#missing[@]} -gt 0 ]]; then
	echo "missing: ${missing[*]}" >&2
	echo "gcc is needed for 'go test -race'; curl for the readiness checks." >&2
	exit 1
fi

# --- Helpers used by the failure paths ---

# binary_dest NAME -- the install path of a binary this script manages.
binary_dest() {
	case "$1" in
	moogo) printf '%s' "$BIN_PATH" ;;
	moogo-news) printf '%s' "$NEWS_BIN_PATH" ;;
	*) return 1 ;;
	esac
}

# newest_backup NAME -- the newest backup file for that binary, or empty.
newest_backup() {
	ls -1t "$BINARY_BACKUP_DIR/$1-"* 2>/dev/null | head -n 1 || true
}

# die_rolledback MESSAGE RESTART NAME... -- put the newest backup of each named
# binary back, restart the units that were already running, and stop with 1.
#
# RESTART=1 means the services were already restarted onto the new binary, so
# the restored files have to be restarted onto again. RESTART=0 means the
# running process was never restarted -- it still serves the previous code --
# so only the file on disk is put back, without a pointless bounce.
die_rolledback() {
	local msg="$1" do_restart="$2" name dest newest
	shift 2
	echo >&2
	echo "!! $msg" >&2
	for name in "$@"; do
		if ! dest="$(binary_dest "$name")"; then
			echo "!! (unknown binary $name; nothing restored)" >&2
			continue
		fi
		newest="$(newest_backup "$name")"
		if [[ -z "$newest" ]]; then
			echo "    $name: no backup on disk (first install?) -- nothing to restore." >&2
			continue
		fi
		install -m 0755 "$newest" "$dest"
		echo "    restored $dest from $newest" >&2
		if [[ "$do_restart" == "1" ]]; then
			echo "    restarting $name on the restored binary" >&2
			if ! systemctl restart "$name"; then
				echo "!! restart of $name failed; see 'systemctl status $name'" >&2
			fi
		fi
	done
	echo "!! nothing after this point was changed." >&2
	exit 1
}

# restart_and_verify UNIT -- restart and prove the restart actually happened.
#
# Three things can make a restart look like it worked while it did not: the
# unit refuses the new binary and stays down (SubState), it crash-loops
# (NRestarts), or -- the subtle one -- nothing restarts at all, because the
# MainPID never changes and the old process keeps serving old code. Each is
# checked separately so the message says which.
restart_and_verify() {
	local unit="$1" before after nrest state
	before="$(systemctl show -p MainPID --value "$unit" 2>/dev/null || true)"
	before="${before:-0}"
	if ! systemctl restart "$unit"; then
		echo "!! systemctl restart $unit failed; last log lines:" >&2
		journalctl -u "$unit" -n 20 --no-pager >&2 || true
		return 1
	fi
	# One second so a unit that dies immediately is observed as dead rather
	# than as the activation that just returned success.
	sleep 1
	after="$(systemctl show -p MainPID --value "$unit" 2>/dev/null || true)"
	after="${after:-0}"
	nrest="$(systemctl show -p NRestarts --value "$unit" 2>/dev/null || true)"
	state="$(systemctl show -p SubState --value "$unit" 2>/dev/null || true)"
	if [[ "$state" != "running" ]]; then
		echo "!! $unit SubState is '${state:-unknown}', expected 'running':" >&2
		journalctl -u "$unit" -n 20 --no-pager >&2 || true
		return 1
	fi
	if [[ "$nrest" != "0" ]]; then
		echo "!! $unit NRestarts is $nrest right after a manual restart (expected 0)" >&2
		echo "!! -- it is crash-looping on the new binary:" >&2
		journalctl -u "$unit" -n 40 --no-pager >&2 || true
		return 1
	fi
	if [[ "$before" != "0" && "$after" == "$before" ]]; then
		echo "!! $unit MainPID is still $after -- the restart did not replace the process," >&2
		echo "!! so the old code would keep serving while this deploy reports success." >&2
		return 1
	fi
	echo "    $unit: MainPID $before -> $after, NRestarts 0, running"
	return 0
}

# Any failure that set -e catches gets one shared explanation, because the
# silent exits the script used to be able to reach were the worst part of a
# half-finished run. An intentional 'exit 1' does not fire this.
on_error() {
	echo >&2
	echo "!! deploy.sh stopped unexpectedly at: ${BASH_COMMAND:-unknown}" >&2
	echo "!! Binary backups (if any were made): $BINARY_BACKUP_DIR" >&2
	echo "!! A running service is only restarted if a restart step above said so;" >&2
	echo "!! otherwise the old process is still serving the old code." >&2
}
trap on_error ERR

# --- Pre-flight: every refusal that can run read-only, before any change ---

echo "==> pre-flight (nothing has been changed yet)"

if [[ $BEHIND_TUNNEL -eq 1 ]]; then
	echo "    Cloudflare Tunnel detected (/etc/cloudflared/config.yml):"
	echo "    TLS terminates at Cloudflare, nginx is loopback-only and reload-only."
	echo "    nginx site, certificates and certbot are skipped; /etc/cloudflared is"
	echo "    never touched."
fi

# Refuse to run without an environment file: it holds the session secret and
# the database password, and starting unconfigured would answer every request
# with an error. Checked here, read-only, so nothing has been built or copied
# by the time the script says stop.
if [[ ! -f "$ENV_FILE" ]]; then
	echo
	echo "!! $ENV_FILE does not exist."
	echo "!! Create it from .env.production.example before starting the service:"
	echo "!!"
	echo "!!   install -m 0640 -o root -g $SERVICE_USER /dev/null $ENV_FILE"
	echo "!!   editor $ENV_FILE"
	echo "!!"
	echo "!! Nothing has been changed. Stopping here so nothing comes up"
	echo "!! unconfigured and answers every request with an error."
	exit 1
fi

# The What's-new service is optional: it runs only when its own env file
# exists, and the duplicate server_name check below has to know whether
# news.$DOMAIN would be claimed too.
if [[ -f "$NEWS_ENV_FILE" ]]; then
	news_enabled=1
fi

if [[ $BEHIND_TUNNEL -eq 0 ]]; then
	# nginx comes in two layouts: Debian and Ubuntu keep per-site files in
	# sites-available linked from sites-enabled, other distributions include
	# /etc/nginx/conf.d from nginx.conf. Use whichever this machine has.
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

	# A duplicate server_name is legal nginx and silently wrong: nginx keeps
	# the first block it loaded, so the config written here would never
	# receive traffic and the deploy would look like it ran without changing
	# anything. Refuse before anything is built or installed, so an abort
	# never leaves binaries replaced and nginx untouched.
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
		echo "!! then re-run this script. Nothing has been changed." >&2
		exit 1
	fi
fi

echo "==> service user and directories"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
	useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR" "$DATA_DIR/news"
install -d -m 0700 -o root -g "$SERVICE_USER" "$BACKUP_DIR"
install -d -m 0700 -o root -g root "$BINARY_BACKUP_DIR"
install -d -m 0750 -o root -g "$SERVICE_USER" /etc/moogo

echo "==> environment files"
chown root:"$SERVICE_USER" "$ENV_FILE"
chmod 0640 "$ENV_FILE"
# The What's-new env file is never written either, for the same reason as
# moogo.env above. Missing is allowed: the main service runs without news.
if [[ -f "$NEWS_ENV_FILE" ]]; then
	chown root:"$SERVICE_USER" "$NEWS_ENV_FILE"
	chmod 0640 "$NEWS_ENV_FILE"
else
	echo "    note: $NEWS_ENV_FILE does not exist — news.moogo.dev stays disabled."
	echo "    note: see deploy/README.md (What's new) to create it, then re-run."
fi

echo "==> building"
# The frontends are embedded (//go:embed all:dist in web and news), so they
# have to be rebuilt alongside the Go code. A fresh clone has both dist
# directories committed; rebuilding them is what keeps an edit in web/ui from
# shipping an old UI.
#
# npm ci, not npm install: install re-resolves the tree with whatever npm the
# server runs and rewrites the lockfiles in passing, which dirties a clean
# checkout on every deploy. ci installs exactly what the committed lockfiles
# say and never writes them.
if [[ -d "$REPO_ROOT/web/dist" ]]; then
	(cd "$REPO_ROOT/web/ui" && npm ci --no-audit --no-fund && npm run build)
fi
if [[ -d "$REPO_ROOT/news/dist" ]]; then
	(cd "$REPO_ROOT/news" && npm ci --no-audit --no-fund && npm run build)
fi

# dist is committed and embedded: a binary built from a dirty dist would
# contain code that no commit has, and "which code is in production" would
# have no answer. Stop here and let the operator commit before anything is
# installed.
if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	dirty_dist="$(git -C "$REPO_ROOT" status --porcelain -- web/dist news/dist)"
	if [[ -n "$dirty_dist" ]]; then
		echo >&2
		echo "!! web/dist or news/dist differs from git after the build:" >&2
		printf '%s\n' "$dirty_dist" >&2
		echo "!! Both are committed and embedded into the binary, so a build from a" >&2
		echo "!! dirty dist ships code git does not have. Commit the source and dist" >&2
		echo "!! change (git add web/ui web/dist news news/dist && git commit), then" >&2
		echo "!! re-run. Nothing has been installed." >&2
		exit 1
	fi
fi

echo "==> gates: go vet and go test -race"
# Integration tests skip themselves without MOOGO_TEST_DATABASE_URL, so this
# is safe on a machine that has no test database.
(cd "$REPO_ROOT" && go vet ./... && go test -race ./...)

echo "==> building binaries"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT
(cd "$REPO_ROOT" &&
	go build -trimpath -o "$STAGE_DIR/moogo" ./cmd/api &&
	go build -trimpath -o "$STAGE_DIR/moogo-news" ./cmd/news)
echo "    built into $STAGE_DIR"

echo "==> installing units and helper scripts"
install -m 0644 "$REPO_ROOT/deploy/moogo.service" /etc/systemd/system/moogo.service
install -m 0644 "$REPO_ROOT/deploy/news.service" /etc/systemd/system/moogo-news.service
install -m 0644 "$REPO_ROOT/deploy/backup.sh" /usr/local/bin/moogo-backup
install -m 0644 "$REPO_ROOT/deploy/verify-backup.sh" /usr/local/bin/moogo-verify-backup
install -m 0644 "$REPO_ROOT/deploy/healthcheck.sh" /usr/local/bin/moogo-healthcheck
chmod 0755 /usr/local/bin/moogo-backup /usr/local/bin/moogo-verify-backup /usr/local/bin/moogo-healthcheck
systemctl daemon-reload

echo "==> installing binaries (previous copies kept for rollback)"
STAMP="$(date +%Y%m%d-%H%M%S)"
install_binary() {
	local name="$1" staging="$2" dest="$3" hash=""
	if [[ -f "$dest" ]]; then
		hash="$(md5sum "$dest" | cut -c1-8)"
		cp -p "$dest" "$BINARY_BACKUP_DIR/$name-$STAMP-$hash"
		echo "    backed up $dest -> $BINARY_BACKUP_DIR/$name-$STAMP-$hash"
	fi
	# install writes a new file and renames it over the old one, so the
	# running process keeps its old inode instead of hitting ETXTBSY.
	install -m 0755 "$staging" "$dest"
	echo "    installed $dest"
	# Keep the last ten backups of each binary: enough for a rollback,
	# bounded disk on a machine that re-runs this script every deploy.
	(ls -1t "$BINARY_BACKUP_DIR/$name-"* 2>/dev/null || true) |
		tail -n +11 |
		while IFS= read -r old; do rm -f "$old"; done
}
install_binary moogo "$STAGE_DIR/moogo" "$BIN_PATH"
install_binary moogo-news "$STAGE_DIR/moogo-news" "$NEWS_BIN_PATH"

echo "==> validating configuration before restarting anything"
# A mistyped environment file would otherwise produce a service that restarts
# in a loop every five seconds. Failing here rolls the binaries back: the
# running process was never restarted, so it still serves the old code.
if ! systemd-run --wait --pipe --quiet \
	--property=User="$SERVICE_USER" \
	--property=EnvironmentFile="$ENV_FILE" \
	--setenv=MOOGO_ADDR=127.0.0.1:0 \
	"$BIN_PATH" --check-config; then
	die_rolledback "the service refused its configuration; the previous binary has been put back." 0 moogo
fi

# --- nginx (skipped entirely behind a Cloudflare Tunnel) ---
if [[ $BEHIND_TUNNEL -eq 0 ]]; then
	echo "==> nginx site for $DOMAIN"

	# http2 changed syntax in nginx 1.25.1: the parameter on `listen` became
	# its own `http2 on;` directive. Emit the form this nginx expects, so
	# re-runs do not accumulate deprecation warnings on a current build.
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
		# Overwrite rather than $proxy_add_x_forwarded_for: the app reads
		# the LEFTMOST entry of X-Forwarded-For (the RealIP middleware and
		# the rate limiter both do), and with an appended chain the
		# leftmost value is whatever the client chose to send -- a
		# spoofed identity per request, which poisons the access log and
		# hands every request its own rate-limit bucket.
		proxy_set_header X-Forwarded-For $remote_addr;
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

	# Timeouts that bound the connection, not the work. client_body_timeout
	# and send_timeout measure gaps between byte transfers, not the whole
	# transfer, so a slow upload or a slow client stream is allowed as long
	# as it keeps moving -- what gets cut is a peer that has stalled. This
	# is the network floor under the app's own MOOGO_REQUEST_TIMEOUT: the
	# Go server deliberately has no ReadTimeout/WriteTimeout because one
	# would kill a large upload mid-flight, so these are what refuse to
	# hold a connection open forever at the edge.
	client_body_timeout 300s;
	client_header_timeout 60s;
	send_timeout 300s;
	keepalive_timeout 65s;

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

	# HSTS belongs at this layer as the authoritative copy. The app now
	# sends it too when X-Forwarded-Proto reports https, so the two agree;
	# keeping both means removing either one cannot silently downgrade the
	# site's transport policy to no HSTS at all.
	add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

	# The app sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy
	# and Content-Security-Policy on every response itself, and news does
	# the same for its own pages -- duplicating those here would send each
	# header twice. Only the three it never sends live at this layer.
	add_header Permissions-Policy "camera=(), geolocation=(), microphone=(), payment=()" always;
	add_header Cross-Origin-Resource-Policy "same-origin" always;
	add_header X-Permitted-Cross-Origin-Policies "none" always;

	# 256 MB is StorageCeilingBytes, the largest upload the app itself allows.
	client_max_body_size 256m;
	server_tokens off;

	# Gap-based timeouts, same rationale as the port-80 block: a transfer in
	# progress survives as long as bytes keep moving, a stalled peer does
	# not. The app has no ReadTimeout/WriteTimeout by design (uploads and
	# long queries), so the edge is where a frozen connection gets refused.
	client_body_timeout 300s;
	client_header_timeout 60s;
	send_timeout 300s;
	keepalive_timeout 65s;
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
		cat <<'EOF'
		# Gap between reads from the app, not a total response time: a
		# streamed backup or a long query stays open while it keeps
		# producing bytes, and 300s sits above the app's own QueryTimeout
		# so nginx never cuts a request the app would still finish.
		proxy_read_timeout 300s;
		proxy_send_timeout 300s;
EOF
		nginx_proxy_headers
		cat <<'EOF'
	}
}
EOF
	}

	# write_nginx_site MAIN_MODE NEWS_MODE -- write the site, test it, reload.
	# A failed test restores the previous file and exits without reloading: a
	# half written proxy config is worse than the one already running. There
	# is deliberately no "restart nginx" fallback anywhere: a reload that
	# fails because the config is broken must leave the old, working nginx
	# serving, not try to start from a config nginx already rejected.
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
# layer as the authoritative copy; the app sends its own when X-Forwarded-Proto
# reports https, so both agree and removing either leaves the other. X-Forwarded-
# For is overwritten instead of appended because the app reads its leftmost entry,
# and an appended chain would carry the client's own value in that position.
# /etc/moogo/moogo.env must keep 127.0.0.1 in MOOGO_TRUSTED_PROXIES, or every
# client collapses into the proxy address and the per-client rate limit stops
# counting clients.
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

		# nginx -t passed above, so this reload only fails for reasons worth
		# stopping for -- and with set -e (plus the ERR trap) it stops here
		# with nginx still on the configuration it was already running.
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
		# Without a resolving DNS record the challenge cannot reach this
		# machine, so do not sit through certbot's timeout; the note at the
		# end says why.
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
			echo "!! record and re-run this script. The binaries are installed but no" >&2
			echo "!! service was restarted -- the old process is still serving." >&2
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
else
	echo "==> nginx: managed by this machine's tunnel setup -- not touched"
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
#
# The URL defaults to this deployment's domain; set MOOGO_HEALTHCHECK_URL when
# running deploy.sh to keep a different origin (an app. subdomain, say) instead
# of having the cron entry rewritten to the argument every re-run.
HEALTHCHECK_URL="${MOOGO_HEALTHCHECK_URL:-https://$DOMAIN}"
echo "==> local healthcheck every minute ($HEALTHCHECK_URL)"
cat >/etc/cron.d/moogo-healthcheck <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * root set -a && . $ENV_FILE && set +a && MOOGO_HEALTHCHECK_URL=$HEALTHCHECK_URL MOOGO_HEALTHCHECK_STATE=$DATA_DIR/healthcheck.state MOOGO_DATA_DIR=$DATA_DIR /usr/local/bin/moogo-healthcheck >> /var/log/moogo-healthcheck.log 2>&1
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

echo "==> restarting the services onto the new binary"
# Two things make an update take effect, and skipping either produces a deploy
# that reports success without changing what users see: the file on disk has to
# be replaced (done above -- the path gets a new inode while the running
# process keeps its old one), and the process has to be restarted, because
# 'systemctl enable --now' on an active unit is a no-op. enable first for boot
# persistence, then the restart, then proof the restart happened.
systemctl enable moogo
if ! restart_and_verify moogo; then
	die_rolledback "moogo did not come back cleanly on the new binary." 1 moogo
fi
if [[ $news_enabled -eq 1 ]]; then
	systemctl enable moogo-news
	if ! restart_and_verify moogo-news; then
		die_rolledback "moogo-news did not come back cleanly on the new binary." 1 moogo-news
	fi
else
	echo "    news: skipped — create $NEWS_ENV_FILE and re-run to enable it"
fi

echo
echo "waiting for readiness"
ready=0
for _ in $(seq 1 30); do
	if curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then
		ready=1
		break
	fi
	sleep 2
done
if [[ $ready -ne 1 ]]; then
	echo "service did not become ready; last log lines:" >&2
	journalctl -u moogo -n 40 --no-pager >&2 || true
	die_rolledback "moogo did not become ready within 60 seconds on the new binary." 1 moogo
fi

# The proxy path is only proven from outside. A failure here does not undo a
# good deploy (DNS may still be propagating), so it warns.
if curl -fsS --max-time 10 "https://$DOMAIN/healthz" >/dev/null 2>&1; then
	echo "ready: https://$DOMAIN"
else
	echo "ready on localhost; https://$DOMAIN did not answer yet"
	if [[ $BEHIND_TUNNEL -eq 1 ]]; then
		echo "check DNS and 'systemctl status cloudflared'"
	else
		echo "check DNS, ports 80/443 and 'systemctl status nginx'"
	fi
fi

echo "==> verifying the deployment"
# /readyz alone only proves the port is open. These checks prove the app
# answers, that the embedded frontend is the one just built (the served page
# has to reference the bundle in web/dist), and that news answers when it is
# enabled. A failure rolls the binaries back and restarts.
main_failed=0
news_failed=0
verify_base=http://127.0.0.1:8080
if ! curl -fsS --max-time 5 "$verify_base/healthz" >/dev/null; then
	echo "!! check failed: $verify_base/healthz did not answer 200" >&2
	main_failed=1
fi
if ! curl -fsS --max-time 5 "$verify_base/auth/session" >/dev/null; then
	echo "!! check failed: $verify_base/auth/session did not answer 2xx" >&2
	main_failed=1
fi
bundle_src="$(grep -o 'src="[^"]*index-[A-Za-z0-9_-]*\.js"' "$REPO_ROOT/web/dist/index.html" 2>/dev/null |
	head -n 1 | sed -e 's/^src="//' -e 's/"$//' || true)"
if [[ -n "$bundle_src" ]]; then
	app_html="$(curl -fsS --max-time 5 "$verify_base/app/" 2>/dev/null || true)"
	if [[ -z "$app_html" ]]; then
		echo "!! check failed: $verify_base/app/ did not answer 200" >&2
		main_failed=1
	elif [[ "$app_html" != *"$bundle_src"* ]]; then
		echo "!! check failed: /app/ does not reference $bundle_src" >&2
		echo "!! the served page and web/dist differ -- the binary embeds an old frontend." >&2
		main_failed=1
	fi
	if ! curl -fsS --max-time 5 "$verify_base$bundle_src" >/dev/null; then
		echo "!! check failed: $bundle_src did not answer 200" >&2
		main_failed=1
	fi
fi
if [[ $news_enabled -eq 1 ]]; then
	if ! curl -fsS --max-time 5 http://127.0.0.1:8081/healthz >/dev/null; then
		echo "!! check failed: news /healthz did not answer 200" >&2
		news_failed=1
	fi
fi
if [[ $main_failed -eq 1 && $news_failed -eq 1 ]]; then
	die_rolledback "post-deploy verification failed (see above)." 1 moogo moogo-news
elif [[ $main_failed -eq 1 ]]; then
	die_rolledback "post-deploy verification failed (see above)." 1 moogo
elif [[ $news_failed -eq 1 ]]; then
	die_rolledback "post-deploy verification failed (see above)." 1 moogo-news
fi
echo "    /healthz, /auth/session, the app shell and the embedded bundle all answer"
if [[ $news_enabled -eq 1 ]]; then
	echo "    news /healthz answers"
fi

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

echo
echo "deploy complete: $DOMAIN"
echo "  previous binaries kept in $BINARY_BACKUP_DIR (newest 10 per binary)"
echo "  manual rollback:"
echo "    sudo install -m 0755 $BINARY_BACKUP_DIR/<file> $BIN_PATH"
echo "    sudo systemctl restart moogo"
