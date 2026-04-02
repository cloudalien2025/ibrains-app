#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3001}"
OUT_FILE="/tmp/verify_worker_key_routing.out"

{
  echo "Base URL: ${BASE_URL}"
  echo "Starting run..."

  run_http_code=$(curl -sS -o /tmp/verify_worker_key_routing.run.body \
    -w "%{http_code}" \
    -X POST "${BASE_URL}/api/brains/brilliant_directories/ingest" \
    -H "Content-Type: application/json" \
    -d '{"keyword":"brilliant directories","selected_new":1,"n_new_videos":1,"max_candidates":50,"mode":"audio_first"}')

  run_response=$(cat /tmp/verify_worker_key_routing.run.body)
  run_id=$(python3 -c 'import json,sys;d=sys.stdin.read();j=json.loads(d);print(j.get("run_id") or j.get("runId") or j.get("id") or "")' <<<"$run_response" 2>/dev/null || true)

  if [ "$run_http_code" = "200" ] || [ "$run_http_code" = "202" ]; then
    echo "run_start: ${run_http_code} OK"
  else
    echo "run_start: ${run_http_code} FAIL"
  fi

  if [ "$run_http_code" = "401" ]; then
    echo "FAIL: run_start returned HTTP 401"
    echo "Response preview:"
    printf "%s" "$run_response" | head -c 400 || true
    echo
    exit 1
  fi

  if [ -z "$run_id" ]; then
    echo "FAIL: run_id not found"
    echo "Response preview:"
    printf "%s" "$run_response" | head -c 400 || true
    echo
    exit 1
  fi

  echo "run_id: $run_id"
  echo "Fetching diagnostics..."

  diag_http_code=$(curl -sS -o /tmp/verify_worker_key_routing.body \
    -w "%{http_code}" \
    "${BASE_URL}/api/runs/${run_id}/diagnostics")

  if [ "$diag_http_code" = "200" ] || [ "$diag_http_code" = "202" ]; then
    echo "diagnostics: ${diag_http_code} OK"
  else
    echo "diagnostics: ${diag_http_code} FAIL"
  fi

  echo "Body preview:"
  head -c 400 /tmp/verify_worker_key_routing.body || true
  echo

  if [ "$diag_http_code" = "401" ]; then
    echo "FAIL: diagnostics returned HTTP 401"
    exit 1
  fi

  if [ "$diag_http_code" != "200" ] && [ "$diag_http_code" != "202" ]; then
    echo "FAIL: diagnostics returned HTTP $diag_http_code"
    exit 1
  fi

  echo "PASS: worker key routing ok"
} | tee "$OUT_FILE"
