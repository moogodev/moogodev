#!/usr/bin/env bash
#
# Start the Moogo API for local development.
#
# The Go server serves BOTH the API and the built frontend, so this one process
# is all that is needed: open http://localhost:8080/app. Running the React app
# on its own (vite dev / preview) only serves files; it has no API without this
# process running behind it.
#
# Every value can be overridden by exporting it before running this script.
set -euo pipefail

cd "$(dirname "$0")"

PGDATA="${MOOGO_PGDATA:-$HOME/.moogo-dev/pgdata}"

if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "Postgres is not running. Start it with:" >&2
  echo "  pg_ctl -D \"$PGDATA\" -l \"$PGDATA/../pg.log\" \\" >&2
  echo "    -o \"-p 5432 -c listen_addresses=127.0.0.1 -k $PGDATA/..\" start" >&2
  exit 1
fi

# The frontend is embedded at build time, so make sure dist matches src.
if [ ! -f web/dist/index.html ]; then
  echo "Building the frontend once (web/dist is missing)..." >&2
  (cd web/ui && npm run build)
fi

export MOOGO_DATABASE_URL="${MOOGO_DATABASE_URL:-postgres://moogo@127.0.0.1:5432/moogo?sslmode=disable}"
export MOOGO_SESSION_SECRET="${MOOGO_SESSION_SECRET:-local-dev-session-secret-change-me-0123456789}"
export MOOGO_DATA_DIR="${MOOGO_DATA_DIR:-$HOME/.moogo-dev/data}"
export MOOGO_COOKIE_SECURE="${MOOGO_COOKIE_SECURE:-false}"
export MOOGO_ENV="${MOOGO_ENV:-development}"
export MOOGO_PUBLIC_URL="${MOOGO_PUBLIC_URL:-http://localhost:8080}"
export MOOGO_ADDR="${MOOGO_ADDR:-:8080}"

echo "Moogo listening on http://localhost:8080  (open /app)" >&2
exec go run ./cmd/api
