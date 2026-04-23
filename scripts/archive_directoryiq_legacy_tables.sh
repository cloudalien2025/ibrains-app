#!/usr/bin/env bash
set -euo pipefail

# Read-only archive of legacy DirectoryIQ tables from old shared DB.
# Uses a single repeatable-read transaction for consistent CSV + row-count snapshot.
# Fallback for pg_dump client/server major-version mismatch.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL" >&2
  exit 1
fi

sanitize_url() {
  local url="$1"
  url="${url/&sslaccept=accept_invalid_certs/}"
  url="${url/?sslaccept=accept_invalid_certs&/?}"
  echo "$url"
}

SRC_URL="$(sanitize_url "$DATABASE_URL")"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTDIR="${1:-artifacts/directoryiq-legacy-archive/${STAMP}}"
mkdir -p "$OUTDIR"
chmod 700 "$OUTDIR"

TABLES=(
  directoryiq_audit_events
  directoryiq_authority_hubs
  directoryiq_authority_posts
  directoryiq_bd_sites
  directoryiq_blog_fixes
  directoryiq_blog_post_links
  directoryiq_blog_post_mentions
  directoryiq_blog_posts
  directoryiq_blog_sync_runs
  directoryiq_ingest_runs
  directoryiq_jobs
  directoryiq_listing_upgrades
  directoryiq_nodes
  directoryiq_policy_profiles
  directoryiq_reinforcement_plans
  directoryiq_settings
  directoryiq_signal_source_credentials
  directoryiq_versions
)

printf '%s\n' "${TABLES[@]}" > "$OUTDIR/tables.txt"

cat > "$OUTDIR/README.txt" <<EOF
DirectoryIQ legacy old-shared-db archive
created_at_utc=${STAMP}
source=DATABASE_URL (sanitized)
mode=read-only repeatable-read single-session export
format=data_csv + row_counts + sequence_state + schema_reference + schema_describe
EOF

# Copy executable schema references already used by the migration lane.
cp db/directoryiq/001_directoryiq_schema_from_shared.sql "$OUTDIR/schema_reference_directoryiq_schema_from_shared.sql"
cp db/directoryiq/002_directoryiq_data_copy_and_sequences.sql "$OUTDIR/schema_reference_directoryiq_sequences.sql"

# Generate a psql script so all table copies + counts happen in one consistent snapshot.
PSQL_SCRIPT="$OUTDIR/export.sql"
{
  echo "\\pset pager off"
  echo "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  union_sql=""
  for i in "${!TABLES[@]}"; do
    t="${TABLES[$i]}"
    piece="SELECT '${t}'::text AS table_name, count(*)::bigint AS row_count FROM public.${t}"
    if [[ "$i" -eq 0 ]]; then
      union_sql="$piece"
    else
      union_sql="${union_sql} UNION ALL ${piece}"
    fi
  done
  echo "\\copy (${union_sql}) TO '${OUTDIR}/row_counts_snapshot.tsv' WITH (FORMAT csv, DELIMITER E'\\t', HEADER true);"

  for t in "${TABLES[@]}"; do
    echo "\\copy public.${t} TO '${OUTDIR}/${t}.csv' WITH (FORMAT csv, HEADER true);"
  done

  echo "\\copy (SELECT schemaname, sequencename, last_value, increment_by, cycle FROM pg_sequences WHERE schemaname='public' AND sequencename LIKE 'directoryiq_%' ORDER BY sequencename) TO '${OUTDIR}/sequence_state.tsv' WITH (FORMAT csv, DELIMITER E'\\t', HEADER true);"

  echo "COMMIT;"
} > "$PSQL_SCRIPT"

psql "$SRC_URL" -X -v ON_ERROR_STOP=1 -f "$PSQL_SCRIPT"

# Capture detailed schema descriptions for exact old-shared shape (including FK-to-users).
SCHEMA_DESCRIBE="$OUTDIR/schema_describe.txt"
: > "$SCHEMA_DESCRIBE"
for t in "${TABLES[@]}"; do
  {
    echo "===== TABLE public.${t} ====="
    psql "$SRC_URL" -X -v ON_ERROR_STOP=1 -c "\\d+ public.${t}"
    echo
  } >> "$SCHEMA_DESCRIBE"
done

# Validate archive completeness and row counts vs current live source counts.
for t in "${TABLES[@]}"; do
  if [[ ! -s "$OUTDIR/${t}.csv" ]]; then
    echo "Missing or empty export file: $OUTDIR/${t}.csv" >&2
    exit 1
  fi

done

awk -F'\t' 'NR==1{next}{print $1"\t"$2}' "$OUTDIR/row_counts_snapshot.tsv" | sort > "$OUTDIR/row_counts_snapshot_sorted.tsv"
LIVE_COUNTS_QUERY="$OUTDIR/live_counts.sql"
{
  for i in "${!TABLES[@]}"; do
    t="${TABLES[$i]}"
    if [[ "$i" -eq 0 ]]; then
      printf "SELECT '%s'::text AS table_name, count(*)::bigint AS row_count FROM public.%s\n" "$t" "$t"
    else
      printf "UNION ALL SELECT '%s'::text AS table_name, count(*)::bigint AS row_count FROM public.%s\n" "$t" "$t"
    fi
  done
  echo "ORDER BY table_name;"
} > "$LIVE_COUNTS_QUERY"

psql "$SRC_URL" -X -v ON_ERROR_STOP=1 -P pager=off -f "$LIVE_COUNTS_QUERY" \
  | awk 'BEGIN{FS="|"} /^[[:space:]]*directoryiq_/ {gsub(/[[:space:]]/,"",$1); gsub(/[[:space:]]/,"",$2); print $1"\t"$2}' \
  | sort > "$OUTDIR/row_counts_live_sorted.tsv"

diff -u "$OUTDIR/row_counts_snapshot_sorted.tsv" "$OUTDIR/row_counts_live_sorted.tsv" > "$OUTDIR/row_count_validation.diff" || {
  echo "Row-count validation failed. See $OUTDIR/row_count_validation.diff" >&2
  exit 1
}

sha256sum "$OUTDIR"/* > "$OUTDIR/SHA256SUMS.txt"

echo "Archive completed: $OUTDIR"
echo "Validated: all 18 tables exported and snapshot row counts match live source counts."
