#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
BRAIN_ID="${BRAIN_ID:-directoryiq}"
API_KEY="${API_KEY:-${BRAINS_MASTER_KEY:-${BRAINS_X_API_KEY:-}}}"
SOURCE_ITEM_ID="${SOURCE_ITEM_ID:-}"
DOCUMENT_ID="${DOCUMENT_ID:-}"
CHUNK_ID="${CHUNK_ID:-}"
LIMIT="${LIMIT:-100}"
FORCE_RECLASSIFY="${FORCE_RECLASSIFY:-false}"
BOOTSTRAP_TEMPLATE_KEY="${BOOTSTRAP_TEMPLATE_KEY:-}"

if [ -z "${API_KEY}" ]; then
  echo "Missing API key: set API_KEY or BRAINS_MASTER_KEY/BRAINS_X_API_KEY"
  exit 1
fi

payload="{\"limit\":${LIMIT},\"force_reclassify\":${FORCE_RECLASSIFY}}"
if [ -n "${SOURCE_ITEM_ID}" ]; then
  payload="{\"source_item_id\":\"${SOURCE_ITEM_ID}\",\"limit\":${LIMIT},\"force_reclassify\":${FORCE_RECLASSIFY}}"
fi
if [ -n "${DOCUMENT_ID}" ]; then
  payload="{\"document_id\":\"${DOCUMENT_ID}\",\"limit\":${LIMIT},\"force_reclassify\":${FORCE_RECLASSIFY}}"
fi
if [ -n "${CHUNK_ID}" ]; then
  payload="{\"chunk_id\":\"${CHUNK_ID}\",\"limit\":${LIMIT},\"force_reclassify\":${FORCE_RECLASSIFY}}"
fi
if [ -n "${BOOTSTRAP_TEMPLATE_KEY}" ]; then
  payload="${payload%}}"
  payload="${payload},\"bootstrap_template_key\":\"${BOOTSTRAP_TEMPLATE_KEY}\"}"
fi

curl -sS -X POST "${BASE_URL}/api/brains/${BRAIN_ID}/taxonomy-enrich" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "${payload}"
echo
