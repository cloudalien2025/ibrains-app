#!/usr/bin/env bash
set -euo pipefail

status_code=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/mission-control)

if [ "$status_code" = "200" ]; then
  echo "PASS: /mission-control returned 200"
  exit 0
fi

echo "FAIL: /mission-control returned $status_code"
exit 1
