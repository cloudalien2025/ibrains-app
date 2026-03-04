#!/usr/bin/env bash
set -euo pipefail

brains_status=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/brains)
runs_status=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/runs)
mission_status=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/mission-control)

if [ "$brains_status" = "200" ] && [ "$runs_status" = "200" ] && [ "$mission_status" = "200" ]; then
  echo "PASS: UI pages returned 200"
  exit 0
fi

echo "FAIL: /brains=$brains_status /runs=$runs_status /mission-control=$mission_status"
exit 1
