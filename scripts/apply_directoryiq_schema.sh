#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="${ROOT_DIR}/db/directoryiq/001_directoryiq_schema_from_shared.sql"

if [ -f "${ROOT_DIR}/.env.production.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${ROOT_DIR}/.env.production.local"
  set +a
fi

CONNECTION_STRING="${DIRECTORYIQ_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "${CONNECTION_STRING}" ]; then
  echo "Missing DIRECTORYIQ_DATABASE_URL or DATABASE_URL for DirectoryIQ schema parity" >&2
  exit 1
fi

if [ ! -f "${SCHEMA_FILE}" ]; then
  echo "Missing DirectoryIQ schema file: ${SCHEMA_FILE}" >&2
  exit 1
fi

if [ -n "${DIRECTORYIQ_DATABASE_URL:-}" ] && [ -n "${DATABASE_URL:-}" ] && [ "${DIRECTORYIQ_DATABASE_URL}" = "${DATABASE_URL}" ]; then
  echo "Warning: DIRECTORYIQ_DATABASE_URL equals DATABASE_URL; applying schema to the resolved DirectoryIQ database." >&2
fi

sanitize_url() {
  printf '%s' "$1" | sed -E \
    -e 's/([?&])sslaccept=[^&]*&?/\1/g' \
    -e 's/([?&])sslmode=no-verify([&]|$)/\1sslmode=require\2/g' \
    -e 's/[?&]$//'
}

CLEAN_URL="$(sanitize_url "${CONNECTION_STRING}")"

psql "${CLEAN_URL}" -X -v ON_ERROR_STOP=1 -f "${SCHEMA_FILE}"

missing="$(
  psql "${CLEAN_URL}" -X -v ON_ERROR_STOP=1 -At <<'SQL'
WITH required(name) AS (
  VALUES
    ('directoryiq_audit_events'),
    ('directoryiq_authority_hubs'),
    ('directoryiq_authority_posts'),
    ('directoryiq_bd_sites'),
    ('directoryiq_blog_fixes'),
    ('directoryiq_blog_post_links'),
    ('directoryiq_blog_post_mentions'),
    ('directoryiq_blog_posts'),
    ('directoryiq_blog_sync_runs'),
    ('directoryiq_ingest_runs'),
    ('directoryiq_jobs'),
    ('directoryiq_listing_upgrades'),
    ('directoryiq_nodes'),
    ('directoryiq_policy_profiles'),
    ('directoryiq_reinforcement_plans'),
    ('directoryiq_settings'),
    ('directoryiq_signal_source_credentials'),
    ('directoryiq_versions')
)
SELECT COALESCE(string_agg(name, ', ' ORDER BY name), '')
FROM required
WHERE to_regclass('public.' || name) IS NULL;
SQL
)"

if [ -n "${missing}" ]; then
  echo "DirectoryIQ schema parity failed; missing tables: ${missing}" >&2
  exit 1
fi

echo "DirectoryIQ schema parity verified."
