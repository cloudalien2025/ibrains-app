#!/usr/bin/env bash
set -euo pipefail

response_headers=$(mktemp)
response_body=$(mktemp)

cleanup() {
  rm -f "$response_headers" "$response_body"
}
trap cleanup EXIT

curl -sS -D "$response_headers" -o "$response_body" -X POST \
  -H "Content-Type: application/json" \
  -d '{"keyword":"brilliant directories","selected_new":1,"n_new_videos":1,"max_candidates":50,"mode":"audio_first"}' \
  http://127.0.0.1:3001/api/brains/brilliant_directories/ingest

status_code=$(sed -n 's/^HTTP\/[^ ]* \([0-9][0-9][0-9]\).*/\1/p' "$response_headers" | tail -n 1)

if [ "$status_code" = "202" ] && grep -q "run_id" "$response_body"; then
  echo "PASS: got 202 with run_id"
  exit 0
fi

echo "STATUS: $status_code"
echo "BODY:"
cat "$response_body"

echo "FAIL: expected 202 with run_id"
exit 1
