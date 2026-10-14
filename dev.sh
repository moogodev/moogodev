#!/usr/bin/env bash
#
# Start the Moogo API for local development.
#
# The Go server serves BOTH the API and the built frontend, so this one process
# is all that is needed: open http://localhost:8080/app. Running the React app
# on its own (vite dev / preview) only serves files; it has no API without this
# process running behind it.
#
# The development Postgres lives in MOOGO_PGDATA (a per-user directory, not the
# system one) and this script starts it if it is not already up. Every value can
# be overridden by exporting it before running this script.
set -euo pipefail

cd "$(dirname "$0")"

PGDATA="${MOOGO_PGDATA:-$HOME/.moogo-dev/pgdata}"
PGPORT="${MOOGO_PGPORT:-5432}"

# The connection string this script will hand to the server. When it is set from
# the environment it is taken as-is and the local instance is left alone; when it
# is not, the default points at the development Postgres the script manages.
if [ -n "${MOOGO_DATABASE_URL:-}" ]; then
  MOOGO_DATABASE_LOCAL=0
else
  MOOGO_DATABASE_LOCAL=1
  MOOGO_DATABASE_URL="postgres://moogo@127.0.0.1:${PGPORT}/moogo?sslmode=disable"
fi
export MOOGO_DATABASE_URL

# Make sure that database is actually reachable before starting the server.
#
# A bare `pg_isready` is not enough here: it answers "accepting connections" for
# whatever Postgres holds the port, including one belonging to a different
# project that has none of our roles or data. The mismatch then only shows up
# much later as "role \"moogo\" does not exist" from the server. Logging in
# instead is the honest check.
if ! psql -w "$MOOGO_DATABASE_URL" -tAc "select 1" >/dev/null 2>&1; then
  # The local instance is the one this script owns and can reason about. When
  # MOOGO_DATABASE_URL came from the environment it is the caller's to fix, so
  # the diagnostic below would be guessing about the wrong server.
  if [ "$MOOGO_DATABASE_LOCAL" -eq 1 ]; then
    if pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
      echo "A Postgres is listening on port $PGPORT, but this script cannot log in to it:" >&2
      echo "  $MOOGO_DATABASE_URL" >&2
      echo "Another project's Postgres on the same port is the usual cause. Stop it," >&2
      echo "or set MOOGO_PGPORT / MOOGO_DATABASE_URL to point at the right instance." >&2
      exit 1
    fi

    echo "Starting the development Postgres in $PGDATA ..." >&2
    pg_ctl -D "$PGDATA" -l "$PGDATA/../pg.log" \
      -o "-p $PGPORT -c listen_addresses=127.0.0.1 -k $PGDATA/.." start >&2

    for _ in $(seq 1 60); do
      if psql -w "$MOOGO_DATABASE_URL" -tAc "select 1" >/dev/null 2>&1; then
        break
      fi
      sleep 0.5
    done
  fi

  if ! psql -w "$MOOGO_DATABASE_URL" -tAc "select 1" >/dev/null 2>&1; then
    echo "The database at $MOOGO_DATABASE_URL is still not reachable." >&2
    if [ "$MOOGO_DATABASE_LOCAL" -eq 1 ]; then
      echo "Check the Postgres log at $PGDATA/../pg.log" >&2
    fi
    exit 1
  fi
fi

# The frontend is embedded at build time, so make sure dist matches src.
if [ ! -f web/dist/index.html ]; then
  echo "Building the frontend once (web/dist is missing)..." >&2
  (cd web/ui && npm run build)
fi

export MOOGO_SESSION_SECRET="${MOOGO_SESSION_SECRET:-local-dev-session-secret-change-me-0123456789}"
export MOOGO_DATA_DIR="${MOOGO_DATA_DIR:-$HOME/.moogo-dev/data}"
export MOOGO_COOKIE_SECURE="${MOOGO_COOKIE_SECURE:-false}"
export MOOGO_ENV="${MOOGO_ENV:-development}"
export MOOGO_PUBLIC_URL="${MOOGO_PUBLIC_URL:-http://localhost:8080}"
export MOOGO_ADDR="${MOOGO_ADDR:-:8080}"

echo "Moogo listening on ${MOOGO_PUBLIC_URL}  (open ${MOOGO_PUBLIC_URL}/app)" >&2
exec go run ./cmd/api
