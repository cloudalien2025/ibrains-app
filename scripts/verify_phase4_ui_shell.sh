#!/usr/bin/env bash
set -euo pipefail

curl -fsS http://127.0.0.1:3001/api/health > /dev/null

status_code=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/brains)

if [ "$status_code" = "200" ]; then
  echo "PASS: /brains returned 200"
  exit 0
fi

echo "FAIL: /brains returned $status_code"
exit 1
