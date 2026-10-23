#!/usr/bin/env bash
#
# Sync the embedded documentation mirror from the docs source.
#
# The manual has one source of truth: web/ui/src/content/docs/. It is served to
# a browser through the site build, and to anything that does not run JavaScript
# through two flattened copies:
#
#   internal/docs/files/*.md   embedded in the binary, served at /api/docs/<slug>
#   web/dist/docs/*.md         written by web/ui/scripts/build-llms.mjs, served
#                              at /docs/<slug>.md (rebuilt with `npm run build`)
#
# The embedded copy is named <slug>.md -- the numeric prefix that orders the
# sidebar is dropped, because the slug is what a URL and a person use. Keeping it
# here rather than hand-copying is what stops the three copies from drifting:
# three agents read the same question from three different files.
#
# Run with: scripts/sync-docs.sh
#
# It overwrites the mirror in place. Files that exist only in the mirror
# (index.md, DECISIONS.md) are left alone: they are not published to the site and
# have no source counterpart.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/web/ui/src/content/docs"
mirror="$root/internal/docs/files"

if [ ! -d "$src" ]; then
  echo "sync-docs: source not found: $src" >&2
  exit 1
fi

# Remove the flattened copies that came from the source, then recreate them. A
# source file deleted upstream must not survive here as a stale page.
for file in "$src"/*.md "$src"/guides/*.md; do
  base="$(basename "$file")"
  slug="${base#[0-9]*-}"
  dest="$mirror/$slug"
  cp "$file" "$dest"
  echo "synced $slug"
done
