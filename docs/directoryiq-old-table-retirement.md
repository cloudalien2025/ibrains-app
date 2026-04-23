# DirectoryIQ Old Shared-DB Table Retirement Plan

Date: 2026-04-23 (UTC)
Branch: `chore/directoryiq-old-table-retirement`

## Objective
Retire only the 18 legacy `directoryiq_*` tables from the old shared DB (`DATABASE_URL`) after safety re-verification and archive validation.

## Safety Boundaries
In scope (only):
- `directoryiq_audit_events`
- `directoryiq_authority_hubs`
- `directoryiq_authority_posts`
- `directoryiq_bd_sites`
- `directoryiq_blog_fixes`
- `directoryiq_blog_post_links`
- `directoryiq_blog_post_mentions`
- `directoryiq_blog_posts`
- `directoryiq_blog_sync_runs`
- `directoryiq_ingest_runs`
- `directoryiq_jobs`
- `directoryiq_listing_upgrades`
- `directoryiq_nodes`
- `directoryiq_policy_profiles`
- `directoryiq_reinforcement_plans`
- `directoryiq_settings`
- `directoryiq_signal_source_credentials`
- `directoryiq_versions`

Out of scope:
- Siteforge tables (`siteforge_*`)
- shared/ambiguous families (`authority_*`, `content_*`, `ssc_*`, `serp_*`, `integrations*`, `connected_sites`, `surfaces`, `site_nodes`, etc.)
- `users`, `schema_migrations`

## Runtime Re-Verification Evidence
- DirectoryIQ persistence uses dedicated pool preference:
  - `getDirectoryIqPool()` prefers `DIRECTORYIQ_DATABASE_URL` in `lib/brain-learning/db.ts`.
  - `lib/directoryiq/ingestion/engine.ts` uses `getDirectoryIqPool()`.
- Siteforge remains on shared DB path:
  - `lib/siteforge/repository/index.ts` uses `getBrainLearningPool()`.
  - `getBrainLearningPool()` reads `DATABASE_URL`.
- No direct runtime references to any of the 18 `directoryiq_*` table names in `lib/**` or `app/**`.
- DB dependency check found no foreign keys from non-DirectoryIQ tables into `directoryiq_*` tables.

## Archive/Export Strategy
Because local `pg_dump` (v14) is incompatible with server (v18), use fallback archive script:
- `scripts/archive_directoryiq_legacy_tables.sh`

Archive outputs:
- per-table CSV data exports for all 18 tables
- consistent snapshot row counts (`row_counts_snapshot.tsv`)
- sequence state (`sequence_state.tsv`)
- schema reference SQL copies:
  - `db/directoryiq/001_directoryiq_schema_from_shared.sql`
  - `db/directoryiq/002_directoryiq_data_copy_and_sequences.sql`
- exact source schema descriptions (`schema_describe.txt`)
- checksums (`SHA256SUMS.txt`)

Default archive path:
- `artifacts/directoryiq-legacy-archive/<UTC timestamp>/`

Executed archive (this lane run):
- `artifacts/directoryiq-legacy-archive/20260423T044849Z/`
- Validation: `row_count_validation.diff` is empty and all 18 table CSV files are present/non-empty.

## Drop Plan
Prepared SQL files:
- `db/directoryiq/retire_old_shared_directoryiq_tables.sql`
- `db/directoryiq/verify_old_shared_directoryiq_tables_removed.sql`

Drop plan characteristics:
- only the 18 `directoryiq_*` tables
- no `CASCADE`
- ordered for internal FK safety
- explicit verification query afterward

## Pre-Drop Test Gate
Run before destructive action:
- `tests/directoryiq_multi_source_ingestion.test.ts`
- `tests/directoryiq_ingest_route_youtube_modes.test.ts`
- `tests/siteforge_repository.test.ts`
- `tests/siteforge_persistence_policy.test.ts`

## Execution Notes
- Retain archive artifacts securely; do not commit data exports.
- If any dependency or validation check fails, stop before drop.
