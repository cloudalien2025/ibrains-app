#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SRC_DATABASE_URL=... DST_DATABASE_URL=... ./scripts/directoryiq_compare_validation.sh

if [[ -z "${SRC_DATABASE_URL:-}" ]]; then
  echo "Missing SRC_DATABASE_URL" >&2
  exit 1
fi
if [[ -z "${DST_DATABASE_URL:-}" ]]; then
  echo "Missing DST_DATABASE_URL" >&2
  exit 1
fi

sanitize_url() {
  local url="$1"
  url="${url/&sslaccept=accept_invalid_certs/}"
  url="${url/?sslaccept=accept_invalid_certs&/?}"
  echo "$url"
}

SRC_URL="$(sanitize_url "$SRC_DATABASE_URL")"
DST_URL="$(sanitize_url "$DST_DATABASE_URL")"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "--- running validation SQL on source"
psql "$SRC_URL" -X -v ON_ERROR_STOP=1 -P pager=off -f db/directoryiq/003_directoryiq_validation.sql > "$tmpdir/source.txt"

echo "--- running validation SQL on destination"
psql "$DST_URL" -X -v ON_ERROR_STOP=1 -P pager=off -f db/directoryiq/003_directoryiq_validation.sql > "$tmpdir/dest.txt"

if diff -u "$tmpdir/source.txt" "$tmpdir/dest.txt"; then
  echo "Validation outputs match."
else
  echo "Validation outputs differ. Review diff above." >&2
  exit 1
fi
