#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="/root/ibrains-app/_artifacts/phase3"
mkdir -p "${ARTIFACT_DIR}"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)

LOCAL_URL="http://127.0.0.1:3001/api/brains/brilliant_directories/ingest"
PUBLIC_URL="https://app.ibrains.ai/api/brains/brilliant_directories/ingest"

note() { printf '%s\n' "$*"; }

run_check() {
  local name="$1"
  local url="$2"

  local headers_file="${ARTIFACT_DIR}/${STAMP}_${name}_headers.txt"
  local body_file="${ARTIFACT_DIR}/${STAMP}_${name}_body.txt"
  local tmp_headers="/tmp/${STAMP}_${name}_headers.txt"
  local tmp_body="/tmp/${STAMP}_${name}_body.txt"

  if ! curl -sS -i --max-redirs 0 -X POST "$url" \
    -H "Content-Type: application/json" \
    -d '{"keyword":"brilliant directories","selected_new":1,"n_new_videos":1,"max_candidates":50,"mode":"audio_first"}' \
    -D "$tmp_headers" \
    -o "$tmp_body"; then
    note "${name}: curl failed (see ${tmp_headers} / ${tmp_body})"
    return 1
  fi
  cp "$tmp_headers" "$headers_file"
  cp "$tmp_body" "$body_file"

  local code
  code=$(awk 'NR==1 {print $2}' "$headers_file")

  note "${name}: ${url} -> ${code}"

  if [ -z "$code" ]; then
    note "${name}: empty status code"
    return 1
  fi

  if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
    note "${name}: non-2xx response"
    note "${name}: headers saved to ${headers_file}"
    note "${name}: body saved to ${body_file}"
    return 1
  fi

  return 0
}

failures=0

if ! run_check "local_post" "$LOCAL_URL"; then
  failures=$((failures+1))
fi

if ! run_check "public_post" "$PUBLIC_URL"; then
  failures=$((failures+1))
fi

if [ "$failures" -eq 0 ]; then
  note "PASS: verify_runs_post"
  exit 0
fi

note "FAIL: ${failures} check(s) failed"
exit 1
