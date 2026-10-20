#!/usr/bin/env bash
#
# Start the Moogo API for local development.
#
#   ./dev.sh                 the default environment, called "dev"
#   ./dev.sh staging         a second one, running beside the first
#
# The Go server serves BOTH the API and the built frontend, so this one process
# is all that is needed: open the URL this script prints. Running the React app
# on its own (vite dev / preview) only serves files; it has no API without this
# process running behind it.
#
# An environment is one self-contained set of state: its own Postgres cluster,
# its own database, its own directory of per-project SQLite files, its own
# ports. Two environments never share a socket, a file or a connection, so a
# scratch one can be reset, broken or left running without touching the data
# you keep. The default environment ("dev") keeps the layout named environments
# inherited from, so anything already there is exactly where this script still
# looks for it.
#
# Every value can be overridden by exporting it before running this script.
set -euo pipefail

cd "$(dirname "$0")"

ENV_NAME="${1:-dev}"

# The name becomes a directory name and a database name, so it is held to what
# both accept without quoting or case folding.
if ! printf '%s' "$ENV_NAME" | grep -Eq '^[a-z][a-z0-9]*$'; then
  echo "An environment name starts with a lowercase letter and continues with" >&2
  echo "lowercase letters or digits — got \"$ENV_NAME\". Try: ./dev.sh staging" >&2
  exit 1
fi

MOOGO_DEV_ROOT="${MOOGO_DEV_ROOT:-$HOME/.moogo-dev}"

if [ "$ENV_NAME" = "dev" ]; then
  # The default environment keeps the original layout: the cluster and the data
  # of everyone who ran this script before environments were named.
  ENV_DIR="$MOOGO_DEV_ROOT"
  DB_NAME="moogo"
  PORT_OFFSET=0
  HTTP_PORT=8080
else
  ENV_DIR="$MOOGO_DEV_ROOT/$ENV_NAME"
  DB_NAME="moogo_$ENV_NAME"
  # The offset is derived from the name, not chosen at random, so the same
  # environment comes back on the same ports on every run and on another
  # machine — a URL saved in a notebook still points at it. It is a starting
  # point only: set MOOGO_HTTP_PORT / MOOGO_PGPORT if it lands on something
  # else you are already using.
  CRC="$(printf '%s' "$ENV_NAME" | cksum | awk '{print $1}')"
  PORT_OFFSET=$((1 + CRC % 498))
  # From 9000 rather than 8080, where the news service and the default port
  # live: a second environment should not have to know which of them is up to
  # pick a free port.
  HTTP_PORT=$((9000 + PORT_OFFSET))
fi
HTTP_PORT="${MOOGO_HTTP_PORT:-$HTTP_PORT}"

PGDATA="${MOOGO_PGDATA:-$ENV_DIR/pgdata}"
PGPORT="${MOOGO_PGPORT:-$((5432 + PORT_OFFSET))}"

# The connection string this script will hand to the server. When it is set from
# the environment it is taken as-is and the local instance is left alone; when it
# is not, the default points at this environment's own database.
MOOGO_DATABASE_LOCAL=1
if [ -n "${MOOGO_DATABASE_URL:-}" ]; then
  MOOGO_DATABASE_LOCAL=0
else
  MOOGO_DATABASE_URL="postgres://moogo@127.0.0.1:${PGPORT}/${DB_NAME}?sslmode=disable"
fi
export MOOGO_DATABASE_URL

# database_exists asks the cluster whether this environment's database is
# present. Going through the URL could not answer the question: the same
# "cannot connect" is what a cluster that is not running, a port held by
# another project, and a missing database all look like, and the three want
# three different responses.
database_exists() {
  psql -w -h 127.0.0.1 -p "$PGPORT" -U moogo -d postgres -tAc \
    "select 1 from pg_database where datname = '${DB_NAME}'" 2>/dev/null | grep -q 1
}

# can_connect_as_moogo separates "the database is missing" from "this cluster
# has no moogo role at all". Without it a cluster set up by hand would have
# createddb run against it, which fails, and set -e would turn a working
# environment into a startup error.
can_connect_as_moogo() {
  psql -w -h 127.0.0.1 -p "$PGPORT" -U moogo -d postgres -tAc 'select 1' >/dev/null 2>&1
}

if [ "$MOOGO_DATABASE_LOCAL" -eq 1 ]; then
  # A cluster directory that is not there yet is an environment on its first
  # run. Initdb it here rather than letting pg_ctl start fail below; trust auth
  # over loopback with no password is what a per-user development cluster uses,
  # and the directory is only reachable by this account.
  if [ ! -d "$PGDATA" ]; then
    echo "Initializing the \"$ENV_NAME\" Postgres cluster in $PGDATA ..." >&2
    mkdir -p "$ENV_DIR"
    initdb -D "$PGDATA" -U moogo -A trust -E UTF8 >/dev/null
  fi

  if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
    # A server already listening on the port is not ours — ours is not running.
    # Starting would fail on the port, and stopping theirs is not this script's
    # to do, so it says which is which instead.
    if pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
      echo "Port $PGPORT already serves a Postgres that is not this environment's:" >&2
      echo "  cluster:  $PGDATA (not running)" >&2
      echo "  database: $MOOGO_DATABASE_URL" >&2
      echo "Stop that server, or set MOOGO_PGPORT to a port it does not hold." >&2
      exit 1
    fi

    echo "Starting the \"$ENV_NAME\" Postgres in $PGDATA ..." >&2
    pg_ctl -D "$PGDATA" -l "$PGDATA/../pg.log" \
      -o "-p $PGPORT -c listen_addresses=127.0.0.1 -k $PGDATA/.." start >&2

    for _ in $(seq 1 60); do
      if pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
        break
      fi
      sleep 0.5
    done
  elif ! pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
    # The cluster is up, just not where this run was told to look. Silently
    # proceeding would connect to whatever else holds that port.
    echo "The $ENV_NAME cluster is running, but not on port $PGPORT:" >&2
    echo "  cluster: $PGDATA" >&2
    echo "Set MOOGO_PGPORT to the port it listens on, or stop it first." >&2
    exit 1
  fi

  # The cluster is ours and answering; the database for this environment may
  # still be missing — the first run, or one someone dropped. The default
  # environment usually already has it, and this then does nothing at all.
  if ! database_exists && can_connect_as_moogo; then
    echo "Creating the database $DB_NAME ..." >&2
    createdb -h 127.0.0.1 -p "$PGPORT" -U moogo "$DB_NAME"
  fi
fi

# Make sure that database is actually reachable before starting the server.
#
# A bare `pg_isready` is not enough here: it answers "accepting connections"
# for whatever Postgres holds the port, including one belonging to a different
# project that has none of our roles or data. The mismatch then only shows up
# much later as "role \"moogo\" does not exist" from the server. Logging in
# instead is the honest check.
if ! psql -w "$MOOGO_DATABASE_URL" -tAc "select 1" >/dev/null 2>&1; then
  echo "The database at $MOOGO_DATABASE_URL is still not reachable." >&2
  if [ "$MOOGO_DATABASE_LOCAL" -eq 1 ]; then
    echo "Check the Postgres log at $PGDATA/../pg.log" >&2
  fi
  exit 1
fi

# The frontend is embedded at build time, so make sure dist matches src.
if [ ! -f web/dist/index.html ]; then
  echo "Building the frontend once (web/dist is missing)..." >&2
  (cd web/ui && npm run build)
fi

export MOOGO_SESSION_SECRET="${MOOGO_SESSION_SECRET:-local-dev-session-secret-change-me-0123456789}"
export MOOGO_DATA_DIR="${MOOGO_DATA_DIR:-$ENV_DIR/data}"
export MOOGO_COOKIE_SECURE="${MOOGO_COOKIE_SECURE:-false}"
export MOOGO_ENV="${MOOGO_ENV:-development}"
export MOOGO_ADDR="${MOOGO_ADDR:-:$HTTP_PORT}"

# The public URL follows the port the server actually listens on, so an
# environment on 8085 does not hand its own clients a link to 8080 — where
# another environment would answer instead of it.
LISTEN_PORT="$HTTP_PORT"
if [ -n "${MOOGO_ADDR:-}" ]; then
  FROM_ADDR="${MOOGO_ADDR##*:}"
  case "$FROM_ADDR" in
    ''|*[!0-9]*) ;;
    *) LISTEN_PORT="$FROM_ADDR" ;;
  esac
fi
export MOOGO_PUBLIC_URL="${MOOGO_PUBLIC_URL:-http://localhost:$LISTEN_PORT}"

echo "Environment \"$ENV_NAME\" — $MOOGO_PUBLIC_URL (open $MOOGO_PUBLIC_URL/app)" >&2
echo "  data: $MOOGO_DATA_DIR" >&2
echo "  postgres: $MOOGO_DATABASE_URL" >&2
exec go run ./cmd/api
