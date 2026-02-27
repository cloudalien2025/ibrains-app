#!/usr/bin/env bash
set -euo pipefail

api_status=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/brains)
page_status=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/brains)

if [ "$api_status" = "200" ] && [ "$page_status" = "200" ]; then
  echo "PASS: /api/brains and /brains returned 200"
  exit 0
fi

echo "FAIL: /api/brains=$api_status /brains=$page_status"
exit 1
