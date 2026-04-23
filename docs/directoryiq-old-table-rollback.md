# DirectoryIQ Old Shared-DB Table Retirement Rollback

Date: 2026-04-23 (UTC)

## Preconditions
- A validated archive directory exists from `scripts/archive_directoryiq_legacy_tables.sh`.
- You have `DATABASE_URL` access to the old shared DB.
- Drop was limited to the 18 legacy `directoryiq_*` tables.

## Rollback Inputs
From archive directory `artifacts/directoryiq-legacy-archive/<STAMP>/`:
- `schema_reference_directoryiq_schema_from_shared.sql`
- `schema_reference_directoryiq_sequences.sql`
- `directoryiq_*.csv` (18 files)
- `sequence_state.tsv`
- `row_counts_snapshot.tsv`

## Rollback Steps
1. Recreate schema objects:
   - apply `schema_reference_directoryiq_schema_from_shared.sql`
2. Rehydrate table data (per table):
   - `\copy public.<table> FROM '<archive>/<table>.csv' WITH (FORMAT csv, HEADER true)`
3. Reapply sequence values:
   - apply `schema_reference_directoryiq_sequences.sql`
   - optionally use `sequence_state.tsv` for exact last_value reconciliation
4. Validate restored row counts:
   - compare live counts to `row_counts_snapshot.tsv`

## Post-Rollback Verification
- Confirm all 18 `directoryiq_*` tables exist.
- Confirm row counts match archive snapshot.
- Confirm Siteforge tables remain untouched.

## Notes
- Rollback restores historical legacy data shape for emergency recovery.
- Keep this rollback package with archive checksums (`SHA256SUMS.txt`).
