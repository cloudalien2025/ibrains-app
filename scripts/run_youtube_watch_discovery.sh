#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
BRAIN_ID="${BRAIN_ID:-directoryiq}"
API_KEY="${API_KEY:-${BRAINS_MASTER_KEY:-${BRAINS_X_API_KEY:-}}}"
WATCH_ID="${WATCH_ID:-}"
DRY_RUN="${DRY_RUN:-false}"

if [ -z "${API_KEY}" ]; then
  echo "Missing API key: set API_KEY or BRAINS_MASTER_KEY/BRAINS_X_API_KEY"
  exit 1
fi

payload="{\"dry_run\":${DRY_RUN}}"
if [ -n "${WATCH_ID}" ]; then
  payload="{\"watch_id\":\"${WATCH_ID}\",\"dry_run\":${DRY_RUN}}"
fi

curl -sS -X POST "${BASE_URL}/api/brains/${BRAIN_ID}/discover" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "${payload}"
echo
