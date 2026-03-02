#!/usr/bin/env bash
set -euo pipefail

systemctl is-active ibrains-next

curl -fsS http://127.0.0.1:3001/api/health > /dev/null

response_headers=$(mktemp)
response_body=$(mktemp)

cleanup() {
  rm -f "$response_headers" "$response_body"
}
trap cleanup EXIT

curl -sS -D "$response_headers" -o "$response_body" -X POST \
  -H "Content-Type: application/json" \
  -d '{"limit":1}' \
  http://127.0.0.1:3001/api/brains/brilliant_directories/runs

status_code=$(sed -n 's/^HTTP\/[^ ]* \([0-9][0-9][0-9]\).*/\1/p' "$response_headers" | tail -n 1)

if [ "$status_code" = "202" ] && grep -q "run_id" "$response_body"; then
  echo "PASS: got 202 with run_id"
  exit 0
fi

echo "STATUS: $status_code"
echo "BODY:"
cat "$response_body"

if grep -q "UNHANDLED_ERROR" "$response_body"; then
  echo "FAIL: response contained UNHANDLED_ERROR"
  exit 1
fi

echo "FAIL: unexpected status"
exit 1
