#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://app.ibrains.ai}"
OUT_FILE="/tmp/verify_diagnostics_auth.out"

{
  echo "Base URL: ${BASE_URL}"
  echo "Starting run..."
  run_response=$(curl -sS -X POST "${BASE_URL}/api/brains/brilliant_directories/runs" \
    -H "Content-Type: application/json" \
    -d '{"limit":1}')

  run_id=$(printf "%s" "$run_response" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);const id=j.run_id||j.runId||j.id||"";if(!id)process.exit(2);process.stdout.write(id);}catch{process.exit(2);}})')

  if [ -z "$run_id" ]; then
    echo "FAIL: run_id not found"
    echo "Response: $run_response"
    exit 1
  fi

  echo "run_id: $run_id"
  echo "Fetching diagnostics..."

  http_code=$(curl -sS -o /tmp/verify_diagnostics_auth.body \
    -w "%{http_code}" \
    "${BASE_URL}/api/runs/${run_id}/diagnostics")

  echo "HTTP: $http_code"
  echo "Body preview:"
  head -c 400 /tmp/verify_diagnostics_auth.body || true
  echo

  if [ "$http_code" != "200" ]; then
    echo "FAIL: diagnostics returned HTTP $http_code"
    exit 1
  fi

  echo "PASS: diagnostics returned 200"
} | tee "$OUT_FILE"
