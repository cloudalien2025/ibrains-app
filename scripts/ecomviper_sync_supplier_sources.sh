#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${ECOMVIPER_SYNC_BASE_URL:-https://app.ibrains.ai}}"
TOKEN="${ECOMVIPER_SYNC_INTERNAL_TOKEN:-}"
USER_ID="${ECOMVIPER_SYNC_USER_ID:-${2:-}}"

if [[ -z "${TOKEN}" ]]; then
  echo "ERROR: ECOMVIPER_SYNC_INTERNAL_TOKEN is required."
  exit 1
fi

if [[ -z "${USER_ID}" ]]; then
  USER_ID="__global__"
fi

curl -sS --max-time 120 \
  -X POST "${BASE_URL%/}/api/ecomviper/supplier-sources/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"userId\":\"${USER_ID}\"}" | tee /tmp/ecomviper_sync_supplier_sources.out

echo

echo "Sync status response saved to /tmp/ecomviper_sync_supplier_sources.out"
