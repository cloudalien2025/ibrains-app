#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
BRAIN_ID="${BRAIN_ID:-directoryiq}"
API_KEY="${API_KEY:-${BRAINS_MASTER_KEY:-${BRAINS_X_API_KEY:-}}}"
SOURCE_ITEM_ID="${SOURCE_ITEM_ID:-}"
LIMIT="${LIMIT:-20}"
FORCE_REINGEST="${FORCE_REINGEST:-false}"

if [ -z "${API_KEY}" ]; then
  echo "Missing API key: set API_KEY or BRAINS_MASTER_KEY/BRAINS_X_API_KEY"
  exit 1
fi

payload="{\"limit\":${LIMIT},\"force_reingest\":${FORCE_REINGEST}}"
if [ -n "${SOURCE_ITEM_ID}" ]; then
  payload="{\"source_item_id\":\"${SOURCE_ITEM_ID}\",\"limit\":${LIMIT},\"force_reingest\":${FORCE_REINGEST}}"
fi

curl -sS -X POST "${BASE_URL}/api/brains/${BRAIN_ID}/ingest-orchestrate" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "${payload}"
echo
