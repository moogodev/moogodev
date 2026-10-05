#!/usr/bin/env bash
#
# Prove that the most recent backup can actually be restored.
#
# A backup nobody has restored is a hypothesis. This turns it into a fact or a
# failure: it restores the control plane into a throwaway database, runs
# SQLite's own integrity check over every project database, reads the bucket
# archive, and then throws all of it away.
#
# It never touches the live database and never touches $MOOGO_DATA_DIR.
#
# Install alongside moogo-backup, in /etc/cron.d/moogo-backup-verify:
#
#   23 4 * * * root . /etc/moogo/moogo.env && BACKUP_DIR=/var/backups/moogo \
#     /usr/local/bin/moogo-verify-backup >> /var/log/moogo-verify.log 2>&1
#
# Run it by hand after the first deploy. Restore is the part of disaster
# recovery that only ever works if it has been done before.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/moogo}"
# A separate database that is created and dropped. Never the live one.
SCRATCH_DB="${SCRATCH_DB:-moogo_restore_check}"

if [[ -z "${MOOGO_DATABASE_URL:-}" ]]; then
	echo "MOOGO_DATABASE_URL is not set; the control plane would be skipped." >&2
	exit 1
fi

# Derive the admin URL by swapping the database name in the connection string,
# so this needs no separate admin credential and cannot drift from the real one.
admin_url() {
	local url="$MOOGO_DATABASE_URL"
	# strip an existing query string, replace the /database part, put it back
	local query=""
	if [[ "$url" == *"?"* ]]; then
		query="?${url#*\?}"
		url="${url%%\?*}"
	fi
	printf '%s%s' "${url%/*}/$1" "$query"
}

WORK="$(mktemp -d "${TMPDIR:-/tmp}/moogo-verify.XXXXXX")"

LOCK="$BACKUP_DIR/.backup.lock"
mkdir -p "$BACKUP_DIR"
# One EXIT trap: a second replaces the first, and the scratch directory or the
# lock would then survive the run.
trap 'rm -rf "$WORK" "$LOCK"' EXIT

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

# The lock has the same name as the backup script's, so verification never runs
# against an archive that is still being written.
if ! acquire_lock "$LOCK"; then
	echo "a backup is running; nothing to verify" >&2
	exit 0
fi

latest="$(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d ! -name '.*' \
	| sort | tail -1)"

if [[ -z "$latest" ]]; then
	echo "no backup found in $BACKUP_DIR" >&2
	exit 1
fi

echo "verifying: $latest"
failed=0
note() { echo "    $*"; }
fail() { echo "    FAILED: $*" >&2; failed=1; }

ADMIN_URL="$(admin_url postgres)"

# --- 1. control plane -------------------------------------------------
echo "==> control plane"
if [[ ! -s "$latest/control-plane.dump" ]]; then
	fail "control-plane.dump is missing or empty"
else
	# Drop first: a run that was killed leaves the scratch behind, and createdb
	# would then fail and mask the real problem.
	psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $SCRATCH_DB" >/dev/null 2>&1 || true
	if createdb --maintenance-db="$ADMIN_URL" "$SCRATCH_DB" 2>"$WORK/createdb.err"; then
		if pg_restore --dbname="$(admin_url "$SCRATCH_DB")" \
			--no-owner --no-privileges "$latest/control-plane.dump" 2>"$WORK/restore.err"; then
			# A restore can succeed and still be missing the tables the app needs.
			# Count them rather than trusting the exit status.
			tables="$(psql "$(admin_url "$SCRATCH_DB")" -t -A -c \
				"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null)"
			users="$(psql "$(admin_url "$SCRATCH_DB")" -t -A -c \
				'SELECT count(*) FROM users' 2>/dev/null || echo "?")"
			projects="$(psql "$(admin_url "$SCRATCH_DB")" -t -A -c \
				'SELECT count(*) FROM projects' 2>/dev/null || echo "?")"
			note "restored: ${tables:-?} tables, ${users:-?} users, ${projects:-?} projects"
			if [[ "${tables:-0}" -lt 1 ]]; then
				fail "the restore produced no tables"
			fi
		else
			fail "pg_restore: $(head -3 "$WORK/restore.err" | tr '\n' ' ')"
		fi
	else
		fail "could not create the scratch database $SCRATCH_DB: $(head -2 "$WORK/createdb.err" | tr '\n' ' ')"
	fi
fi

# --- 2. project databases ---------------------------------------------
echo "==> project databases"
if ! command -v sqlite3 >/dev/null 2>&1; then
	echo "    SKIPPED: sqlite3 is not installed, so integrity_check cannot run" >&2
	failed=1
else
	shopt -s nullglob
	dbs=("$latest"/dbs/*.db)
	shopt -u nullglob
	if [[ ${#dbs[@]} -eq 0 ]]; then
		note "no project databases in the archive"
		if [[ -d "$MOOGO_DATA_DIR/dbs" ]]; then
			# An archive with none while the live directory has some means the
			# copy silently dropped them.
			if [[ -n "$(ls -A "$MOOGO_DATA_DIR/dbs" 2>/dev/null)" ]]; then
				fail "archive has no databases but $MOOGO_DATA_DIR/dbs is not empty"
			fi
		fi
	else
		for db in "${dbs[@]}"; do
			result="$(sqlite3 "$db" "PRAGMA integrity_check;" 2>&1)"
			if [[ "$result" == "ok" ]]; then
				note "$(basename "$db"): ok"
			else
				fail "$(basename "$db"): $result"
			fi
		done
	fi
fi

# --- 3. object storage ------------------------------------------------
echo "==> object storage"
if [[ -f "$latest/buckets.tar" ]]; then
	if tar -tf "$latest/buckets.tar" >/dev/null 2>&1; then
		objects="$(tar -tf "$latest/buckets.tar" | grep -cv '/$' || true)"
		note "archive readable, $objects entries"
		if [[ "${objects:-0}" -lt 1 ]]; then
			fail "the bucket archive is readable but empty"
		fi
	else
		fail "buckets.tar is not a readable archive"
	fi
else
	note "no bucket archive in this backup"
fi

# --- 4. leave nothing behind ------------------------------------------
echo "==> cleaning up the scratch database"
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $SCRATCH_DB" >/dev/null 2>&1 ||
	echo "    WARNING: could not drop $SCRATCH_DB; drop it by hand" >&2

echo
if [[ $failed -ne 0 ]]; then
	echo "RESTORE VERIFICATION FAILED for $latest" >&2
	echo "Treat the backups as unproven until this passes." >&2
	exit 1
fi

echo "restore verified: $latest can be recovered"