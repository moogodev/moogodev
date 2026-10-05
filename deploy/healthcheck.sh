#!/usr/bin/env bash
#
# Watch the deployment from outside the machine.
#
# systemd already restarts the process when it dies, so a probe from localhost
# proves nothing about whether the site is reachable. Nothing inside the box can
# tell you the VPS is gone, the disk is full, the certificate expired or Caddy
# stopped -- from in here those all look like "no answer", indistinguishable
# from the network being down. This has to run somewhere else, and this is what
# you point at Healthchecks.io, Uptime Kuma, or your own cron.
#
# Configure with:
#   MOOGO_HEALTHCHECK_URL       the public HTTPS URL, e.g. https://moogo.example.com
#   MOOGO_HEALTHCHECK_STATE     where to keep the failure state, default /var/lib/moogo/healthcheck.state
#   MOOGO_HEALTHCHECK_ALERT_WEBHOOK   optional POST on state change
#   MOOGO_HEALTHCHECK_ALERT_EMAIL     optional recipient; uses mailx if present
#
# Exit codes are meaningful so a scheduler can act on them:
#   0  healthy, or still failing but already alerted (a repeat is not news)
#   1  the service is not answering, or answered wrong, and this run is the alert
#   2  this script cannot run at all -- misconfigured, or curl is missing

set -uo pipefail

# No default on purpose. A fallback to 127.0.0.1 would make a misconfigured
# install report "healthy" for as long as the process was up locally, which is
# exactly the blindness this script is meant to remove.
URL="${MOOGO_HEALTHCHECK_URL:-}"
STATE_FILE="${MOOGO_HEALTHCHECK_STATE:-/var/lib/moogo/healthcheck.state}"
WEBHOOK="${MOOGO_HEALTHCHECK_ALERT_WEBHOOK:-}"
ALERT_EMAIL="${MOOGO_HEALTHCHECK_ALERT_EMAIL:-}"

# A probe that hangs is a failure, not a pass. Without this, a TCP connection
# that never completes leaves the check waiting indefinitely and it never
# reports anything at all.
CURL_TIMEOUT="${MOOGO_HEALTHCHECK_TIMEOUT:-10}"

if ! command -v curl >/dev/null 2>&1; then
	echo "healthcheck: curl is not installed" >&2
	exit 2
fi
if [[ -z "$URL" ]]; then
	echo "healthcheck: MOOGO_HEALTHCHECK_URL is not set" >&2
	exit 2
fi

mkdir -p "$(dirname "$STATE_FILE")" 2>/dev/null || true

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
previous="unknown"
if [[ -f "$STATE_FILE" ]]; then
	previous="$(cat "$STATE_FILE" 2>/dev/null || echo unknown)"
fi

# Liveness and readiness are checked separately on purpose. Liveness proves the
# process answers; readiness proves it can reach Postgres. A database outage
# leaves the process healthy, and the distinction decides whether a page is a
# "restart the service" instruction or a "the database is down" one.
probe() {
	local path="$1" body status
	body="$(curl -fsS --max-time "$CURL_TIMEOUT" \
		--retry 2 --retry-delay 1 \
		-o - -w $'\n%{http_code}' \
		"$URL$path" 2>/dev/null)"
	status="${body##*$'\n'}"
	body="${body%$'\n'*}"

	# -f already turns a non-2xx into a failure, so a bad status means the
	# body is empty. Guard anyway: an empty 200 is still not a healthy answer.
	[[ "$status" == "200" ]] || return 1
	[[ -n "$body" ]] || return 1
	printf '%s' "$body" | grep -q '"status":"ok"\|"status":"ready"'
}

problems=()
if ! probe /healthz; then
	problems+=("liveness /healthz did not answer 200 with a status")
fi
if ! probe /readyz; then
	problems+=("readiness /readyz did not answer 200 with a status")
fi

notify() {
	local subject="$1" body="$2"
	echo "$body" >&2

	if [[ -n "$WEBHOOK" ]]; then
		# Best effort. A failed webhook must not turn a recovered service into
		# a reported outage.
		curl -fsS --max-time "$CURL_TIMEOUT" -X POST \
			-H 'Content-Type: application/json' \
			-d "{\"text\":\"$subject\"}" \
			"$WEBHOOK" >/dev/null 2>&1 ||
			echo "healthcheck: the alert webhook could not be reached" >&2
	fi

	if [[ -n "$ALERT_EMAIL" ]] && command -v mailx >/dev/null 2>&1; then
		printf '%s\n' "$body" | mailx -s "$subject" "$ALERT_EMAIL" ||
			echo "healthcheck: mailx could not send the alert" >&2
	elif [[ -n "$ALERT_EMAIL" ]]; then
		echo "healthcheck: $ALERT_EMAIL is set but mailx is not installed" >&2
	fi
}

if [[ ${#problems[@]} -eq 0 ]]; then
	if [[ "$previous" == "failing" ]]; then
		# Say it came back. Silence after an outage is ambiguous: it reads as
		# "still broken" to whoever is waiting for a message.
		notify "Moogo is back up" "Moogo recovered at $now.

Checked $URL/healthz and $URL/readyz."
	fi
	echo "ok" >"$STATE_FILE"
	exit 0
fi

detail="$(printf '  - %s\n' "${problems[@]}")"

if [[ "$previous" == "failing" ]]; then
	# Already reported. Staying quiet keeps one outage from producing a message
	# every minute for as long as it lasts.
	echo "healthcheck: still failing (already alerted)" >&2
	echo "$detail" >&2
	exit 0
fi

notify "Moogo is DOWN" "Moogo did not answer at $now.

Checked:
$detail

This is the public URL, so the process may be fine and the machine, certificate
or proxy may be at fault. Check:

  systemctl status moogo
  journalctl -u moogo -n 50
  systemctl status caddy
  df -h ${MOOGO_DATA_DIR:-/var/lib/moogo}"
echo "failing" >"$STATE_FILE"
exit 1