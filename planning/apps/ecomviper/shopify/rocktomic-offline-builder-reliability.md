# Rocktomic Offline Builder Reliability (Phase 4.2)

Last updated: 2026-05-31 (UTC)

## Why Phase 4.2 Exists

Phase 4.1 proved shared ecommerce DB migration/import/verification, but `npm run ecomviper:build-rocktomic-supplier-data` could still time out after source enumeration in some operator environments. Phase 4.2 hardens the offline build lane before any Phase 5 Product Editor DB binding.

## Scope

Phase 4.2 is offline-pipeline reliability only.

- No Product Editor binding
- No Generate Intelligence binding
- No runtime supplier fetching
- No admin-triggered build/import
- No background workers
- No ecommerce runtime behavior changes
- No permanent storage of large `.ai`/`.tif` binaries

## Reliability Changes

### Stage Timing + Diagnostics

The builder now records stage-level timing and emits:

- `data/ecomviper/suppliers/rocktomic/latest/build-timing-report.json` on success
- `data/ecomviper/suppliers/rocktomic/builds/<buildId>/build-timing-report.json` on failure

Timing report includes status, total duration, per-stage duration/status, slowest stages, timeout entries, and error summaries.

### Timeout Budgets

Supported environment controls:

- `ROCKTOMIC_BUILD_STAGE_TIMEOUT_MS`
- `ROCKTOMIC_BUILD_TOTAL_TIMEOUT_MS`
- `ROCKTOMIC_BUILD_NETWORK_TIMEOUT_MS`
- `ROCKTOMIC_BUILD_ASSET_CONCURRENCY`
- `ROCKTOMIC_BUILD_AI_EXTRACTION_MODE` (`incremental|force|skip`)
- `ROCKTOMIC_BUILD_FORCE_REFRESH=1`
- `ROCKTOMIC_BUILD_SKIP_AI_EXTRACTION=1`
- `ROCKTOMIC_BUILD_DRY_RUN=1`

When a stage or total build budget is exceeded, the command fails with stage-specific actionable errors instead of hanging silently.

### Atomic Artifact Promotion

Build outputs are written to:

- `data/ecomviper/suppliers/rocktomic/builds/<buildId>/`

Only successful runs are promoted to:

- `data/ecomviper/suppliers/rocktomic/latest/`

Failed runs keep diagnostics in `builds/<buildId>` and do not overwrite a previously valid `latest` package.

### Incremental Freshness + Caching

AI label text extraction now reuses prior evidence when remote metadata is unchanged.

Freshness checks compare:

- template page Last Updated
- HTTP `ETag`
- HTTP `Last-Modified`
- HTTP `Content-Length`
- HTTP `Content-Type`
- asset URL/file name

Additional behavior:

- conditional GET (`If-None-Match`, `If-Modified-Since`) can return `304` and reuse cached evidence
- unchanged assets skip temp download/extraction
- changed/missing evidence triggers re-extraction
- `.ai` temp downloads are not persisted

### Controlled Concurrency

Remote asset listing and extraction now use bounded concurrency (default 4, configurable), avoiding unbounded Promise fan-out across 100+ SKU assets.

## Operator Flow

Recommended command flow:

1. `npm run ecomviper:build-rocktomic-supplier-data`
2. inspect `latest/build-timing-report.json`
3. rerun command to confirm incremental speedup
4. if failed, inspect `builds/<buildId>/build-timing-report.json` for exact failing stage

## Artifact Set

Phase 4.2 preserves existing artifacts and adds reliability artifacts.

Existing artifacts remain:

- `sourceFacts.json`
- `pricing.json`
- `inventory.json`
- `assets.json`
- `audit.csv`
- `validation-report.json`
- `catalog-link-evidence.json`
- `template-asset-evidence.json`
- `ai-label-text-evidence.json`
- `ocr-evidence.json`

Added:

- `build-timing-report.json`
- `build-cache-summary.json`

## Architecture Boundaries

Phase 4.2 preserves:

- `DATABASE_URL` for core iBrains only
- `ECOMMERCE_DATABASE_URL` for ecommerce DB import/read lanes only
- `ecomviper-prod-postgres` remains deprecated/ignored
- no runtime render-path extraction/OCR/AI label processing

## Next Phase

Phase 5 remains:

- Product Editor read-only binding to shared ecommerce supplier facts
- only consume data already imported/validated in shared ecommerce DB

## Phase 4.3 Artifact Note

Phase 4.3 adds calibration-focused outputs that continue to use the same reliable builder flow:

- `validation-report.json` now includes readiness breakdown and calibration counters.
- new artifact: `validation-policy-calibration-report.json`.
- `audit.csv` now includes readiness-dimension columns for operator triage.

Reliability guarantees from Phase 4.2 remain unchanged (timing report, atomic promotion, incremental cache reuse).
