#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SRC_DATABASE_URL=... DST_DATABASE_URL=... ./scripts/directoryiq_copy_tables.sh

if [[ -z "${SRC_DATABASE_URL:-}" ]]; then
  echo "Missing SRC_DATABASE_URL" >&2
  exit 1
fi
if [[ -z "${DST_DATABASE_URL:-}" ]]; then
  echo "Missing DST_DATABASE_URL" >&2
  exit 1
fi

sanitize_url() {
  local url="$1"
  # psql/pg clients that do not support sslaccept will fail if it is present.
  url="${url/&sslaccept=accept_invalid_certs/}"
  url="${url/?sslaccept=accept_invalid_certs&/?}"
  echo "$url"
}

SRC_URL="$(sanitize_url "$SRC_DATABASE_URL")"
DST_URL="$(sanitize_url "$DST_DATABASE_URL")"

TABLES=(
  directoryiq_policy_profiles
  directoryiq_authority_hubs
  directoryiq_authority_posts
  directoryiq_versions
  directoryiq_reinforcement_plans
  directoryiq_blog_posts
  directoryiq_blog_post_links
  directoryiq_blog_post_mentions
  directoryiq_blog_sync_runs
  directoryiq_bd_sites
  directoryiq_nodes
  directoryiq_settings
  directoryiq_signal_source_credentials
  directoryiq_listing_upgrades
  directoryiq_ingest_runs
  directoryiq_jobs
  directoryiq_audit_events
  directoryiq_blog_fixes
)

for t in "${TABLES[@]}"; do
  echo "--- ${t}: preflight destination emptiness check"
  dst_count=$(psql "$DST_URL" -X -v ON_ERROR_STOP=1 -At -c "SELECT count(*) FROM public.${t};")
  if [[ "$dst_count" != "0" ]]; then
    echo "Destination table public.${t} is not empty (${dst_count}). Aborting to avoid duplicate loads." >&2
    exit 1
  fi

done

for t in "${TABLES[@]}"; do
  echo "--- copying ${t}"
  psql "$SRC_URL" -X -v ON_ERROR_STOP=1 -c "\\copy (SELECT * FROM public.${t}) TO STDOUT WITH (FORMAT csv)" \
    | psql "$DST_URL" -X -v ON_ERROR_STOP=1 -c "\\copy public.${t} FROM STDIN WITH (FORMAT csv)"

  src_count=$(psql "$SRC_URL" -X -v ON_ERROR_STOP=1 -At -c "SELECT count(*) FROM public.${t};")
  dst_count=$(psql "$DST_URL" -X -v ON_ERROR_STOP=1 -At -c "SELECT count(*) FROM public.${t};")
  echo "    source=${src_count} destination=${dst_count}"
  if [[ "$src_count" != "$dst_count" ]]; then
    echo "Row-count mismatch for ${t}" >&2
    exit 1
  fi

done

echo "--- resetting destination sequences"
psql "$DST_URL" -X -v ON_ERROR_STOP=1 -f db/directoryiq/002_directoryiq_data_copy_and_sequences.sql

echo "DirectoryIQ copy completed successfully."
