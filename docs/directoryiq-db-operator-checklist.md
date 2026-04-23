# DirectoryIQ DB Split Operator Checklist

## Preflight (No Traffic Change)
1. Confirm shared/source DB URL (current `DATABASE_URL`) and destination `DIRECTORYIQ_DATABASE_URL` are both available.
2. Confirm destination DB is reachable.
3. Confirm destination DB is empty for all 18 `directoryiq_*` tables.
4. Confirm no cutover env change is applied yet.

## Apply Schema to Destination
```bash
DST_DATABASE_URL='postgresql://...'
psql "$DST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/directoryiq/001_directoryiq_schema_from_shared.sql
```

## Copy Data (Non-Destructive)
```bash
SRC_DATABASE_URL='postgresql://...shared...'
DST_DATABASE_URL='postgresql://...directoryiq...'
./scripts/directoryiq_copy_tables.sh
```

Notes:
- Script aborts if destination tables are not empty.
- Script performs per-table source/destination row-count checks.
- Script resets destination sequences after load.

## Validate Source vs Destination
```bash
SRC_DATABASE_URL='postgresql://...shared...'
DST_DATABASE_URL='postgresql://...directoryiq...'
./scripts/directoryiq_compare_validation.sh
```

## Cutover (Only After Validation)
1. Set `DIRECTORYIQ_DATABASE_URL` in deployment environment.
2. Keep `DATABASE_URL` unchanged for Siteforge/shared paths.
3. Roll out only DirectoryIQ-targeted runtime/config change.
4. Run DirectoryIQ smoke checks (read and write path).
5. Run Siteforge smoke checks.

## Rollback
1. Revert DirectoryIQ runtime/config to prior DB path.
2. Keep destination data intact for diagnosis.
3. Keep shared source tables untouched (already guaranteed by this plan).
