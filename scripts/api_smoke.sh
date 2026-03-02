#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
BRAIN_ID="${BRAIN_ID:-brilliant_directories}"

URL="${BASE_URL}/api/brains/${BRAIN_ID}/runs"

tmp_headers=$(mktemp)
tmp_body=$(mktemp)
trap 'rm -f "$tmp_headers" "$tmp_body"' EXIT

if ! curl -sS -D "$tmp_headers" -o "$tmp_body" --max-redirs 0 -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{"limit":1}'; then
  printf 'FAIL: curl failed for %s\n' "$URL"
  exit 1
fi

code=$(awk 'NR==1 {print $2}' "$tmp_headers")

if [ -z "$code" ]; then
  printf 'FAIL: empty status code\n'
  exit 1
fi

case "$code" in
  308|405)
    printf 'FAIL: %s returned %s\n' "$URL" "$code"
    exit 1
    ;;
esac

printf 'PASS: %s returned %s\n' "$URL" "$code"
