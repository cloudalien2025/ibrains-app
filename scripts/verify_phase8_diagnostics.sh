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

if [ "$status_code" != "202" ]; then
  echo "FAIL: expected 202 from start run, got $status_code"
  cat "$response_body"
  exit 1
fi

run_id=$(grep -oE '"run_id"[[:space:]]*:[[:space:]]*"[^"]+"' "$response_body" | head -n 1 | sed -E 's/.*"run_id"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

if [ -z "$run_id" ]; then
  echo "FAIL: missing run_id in response"
  cat "$response_body"
  exit 1
fi

echo "Started run: $run_id"

attempts=0
while [ $attempts -lt 12 ]; do
  status_code=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/runs/"$run_id"/diagnostics)
  if [ "$status_code" = "200" ]; then
    echo "PASS: diagnostics endpoint returned 200"
    exit 0
  fi
  attempts=$((attempts + 1))
  sleep 2
done

echo "FAIL: diagnostics endpoint did not return 200"
exit 1
