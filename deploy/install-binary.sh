#!/usr/bin/env bash
#
# Install one Moogo binary with a rollback backup, independent of deploy.sh.
#
# Usage:
#   sudo ./deploy/install-binary.sh <name> <source> <dest>
#     name   : moogo | moogo-cli | moogo-news | moogo-mcp
#     source : path to the staged binary
#     dest   : install path (e.g. /usr/local/bin/moogo-api)
#
# Backs up the existing destination (if any) into /var/backups/moogo-binaries
# before installing, so a bad binary can be rolled back by hand. Keeps the
# newest ten backups per binary.
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "run as root: sudo $0 <name> <source> <dest>" >&2
	exit 1
fi
if [[ $# -ne 3 ]]; then
	echo "usage: sudo $0 <name> <source> <dest>" >&2
	exit 1
fi

name="$1"
source="$2"
dest="$3"
BINARY_BACKUP_DIR=/var/backups/moogo-binaries
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BINARY_BACKUP_DIR"
if [[ -f "$dest" ]]; then
	hash="$(md5sum "$dest" | cut -c1-8)"
	cp -p "$dest" "$BINARY_BACKUP_DIR/$name-$STAMP-$hash"
	echo "    backed up $dest -> $BINARY_BACKUP_DIR/$name-$STAMP-$hash"
fi
install -m 0755 "$source" "$dest"
echo "    installed $dest"
(ls -1t "$BINARY_BACKUP_DIR/$name-"[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-* 2>/dev/null || true) |
	tail -n +11 |
	while IFS= read -r old; do rm -f "$old"; done
echo "done"
