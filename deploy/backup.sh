#!/usr/bin/env bash
#
# Back up everything a Moogo deployment cannot rebuild from the repository:
# the control plane, the per-project databases, and the object stores.
#
# Nothing here is recoverable from git. The data directory holds what customers
# own, and a lost VPS with no archive is a lost product.
#
# Install as a cron job, e.g. nightly at 03:17:
#   17 3 * * * /usr/local/bin/moogo-backup >> /var/log/moogo-backup.log 2>&1
#
# Every setting comes from the environment, normally the same file the service
# uses: /etc/moogo/moogo.env.

set -euo pipefail

MOOGO_DATA_DIR="${MOOGO_DATA_DIR:-/var/lib/moogo}"
MOOGO_DATABASE_URL="${MOOGO_DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/moogo}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ -z "$MOOGO_DATABASE_URL" ]]; then
	echo "MOOGO_DATABASE_URL is not set; the control plane would be skipped." >&2
	exit 1
fi

# Take the lock first. Two overlapping runs would write the same archive name and
# the pruning step would then delete the newer one.
mkdir -p "$BACKUP_DIR"
# flock is not everywhere -- it is missing on macOS and on Alpine, and a backup
# script that silently does nothing on those is worse than no script. mkdir is
# atomic on every filesystem that matters, so the lock is a directory.
#
# A lock left behind by a killed run has to be recoverable, or one crash stops
# every future backup. The owning pid is written inside it, and a lock whose
# process is gone is removed.
acquire_lock() {
	local dir="$1"
	if mkdir "$dir" 2>/dev/null; then
		echo $$ >"$dir/pid"
		return 0
	fi

	local owner
	owner="$(cat "$dir/pid" 2>/dev/null || true)"
	if [[ -z "$owner" ]] || ! kill -0 "$owner" 2>/dev/null; then
		echo "clearing a stale lock left by pid ${owner:-unknown}" >&2
		rm -rf "$dir"
		if mkdir "$dir" 2>/dev/null; then
			echo $$ >"$dir/pid"
			return 0
		fi
	fi
	return 1
}

LOCK="$BACKUP_DIR/.backup.lock"

if ! acquire_lock "$LOCK"; then
	echo "another backup is already running; nothing to do" >&2
	exit 0
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/moogo-backup.XXXXXX")"
DEST="$BACKUP_DIR/$STAMP"
# One trap, both cleanups: a second EXIT trap replaces the first rather than
# adding to it, and a run that leaves its scratch directory behind fills /tmp.
trap 'rm -rf "$WORK" "$LOCK"' EXIT

# pg_dump runs before anything else creates a directory below DEST, and it will
# not create the directory itself: without this the very first step fails with
# "could not open output file ... No such file or directory".
mkdir -p "$DEST"

failed=0

echo "==> control plane (Postgres)"
# --format=custom is compressed and restorable with pg_restore, and it is a
# consistent snapshot even while Moogo is writing.
if pg_dump --dbname="$MOOGO_DATABASE_URL" --format=custom \
	--file="$DEST/control-plane.dump" 2>"$WORK/pgdump.err"; then
	echo "    ok ($(du -h "$DEST/control-plane.dump" | cut -f1))"
else
	echo "    FAILED: $(cat "$WORK/pgdump.err")" >&2
	failed=1
fi

echo "==> project databases (SQLite)"
mkdir -p "$DEST/dbs"
db_count=0
for db in "$MOOGO_DATA_DIR"/dbs/*.db; do
	[[ -e "$db" ]] || continue

	# Never cp a live SQLite file. A copy taken while a write is in flight
	# captures a page and a journal that disagree, and the result opens as
	# "database disk image is malformed". The .backup command takes a lock and
	# produces a consistent file instead.
	name="$(basename "$db")"
	if command -v sqlite3 >/dev/null 2>&1; then
		if sqlite3 "$db" ".backup '$DEST/dbs/$name'" 2>"$WORK/sqlite.err"; then
			db_count=$((db_count + 1))
		else
			echo "    FAILED $name: $(cat "$WORK/sqlite.err")" >&2
			failed=1
		fi
	else
		echo "    WARNING: sqlite3 not installed; copying $name while the service runs." >&2
		echo "    WARNING: this can produce a corrupt copy. Install sqlite3." >&2
		cp "$db" "$DEST/dbs/$name"
		db_count=$((db_count + 1))
		failed=1
	fi
done
echo "    $db_count database(s)"

echo "==> object storage"
# Buckets are plain files written whole, so a tar is consistent as long as the
# service is not mid-upload; the upload is atomic at the object level.
mkdir -p "$DEST/buckets"
if [[ -d "$MOOGO_DATA_DIR/buckets" ]]; then
	if tar -C "$MOOGO_DATA_DIR" -cf "$DEST/buckets.tar" buckets 2>"$WORK/tar.err"; then
		echo "    ok ($(du -h "$DEST/buckets.tar" | cut -f1))"
	else
		echo "    FAILED: $(cat "$WORK/tar.err")" >&2
		failed=1
	fi
else
	echo "    no buckets directory yet"
fi

echo "==> manifest"
cat >"$DEST/MANIFEST.txt" <<EOF
moogo backup $STAMP
host:      $(hostname)
data dir:  $MOOGO_DATA_DIR
databases: $db_count
buckets:   $([[ -f "$DEST/buckets.tar" ]] && echo present || echo absent)
EOF

echo "==> pruning archives older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime "+$RETENTION_DAYS" \
	-exec rm -rf {} + 2>/dev/null || true

echo "==> verifying the archive is not empty"
if [[ ! -s "$DEST/control-plane.dump" ]]; then
	echo "    control plane dump is missing or empty" >&2
	failed=1
fi

if [[ "$failed" -ne 0 ]]; then
	echo
	echo "BACKUP COMPLETED WITH ERRORS in $DEST" >&2
	echo "An operator has to look at this; do not treat the run as successful." >&2
	exit 1
fi

echo
echo "backup complete: $DEST"
echo "restore it with: pg_restore -d <db> $DEST/control-plane.dump, then copy dbs/ and untar buckets.tar"