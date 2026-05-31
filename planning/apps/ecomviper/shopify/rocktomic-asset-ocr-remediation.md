# Rocktomic Asset + OCR Remediation (Phase 3.5)

Last updated: 2026-05-31 (UTC)

## Purpose

Phase 3.5 improves the offline Rocktomic supplier package so it can move toward Phase 4 import/read readiness without changing runtime app behavior.

Primary remediation targets:

- Catalog PDF annotation link extraction (`coaUrl`, template links, pricing-sheet links).
- Templates page extraction for per-SKU `.ai` and `.tif` files.
- Supplement/Nutrition Facts OCR evidence parsing with provenance and review flags.

## Scope Boundary (Phase 3.5)

- Offline package pipeline only (`npm run ecomviper:build-rocktomic-supplier-data`).
- No data import into `ibrains-ecommerce-prod-postgres`.
- No production ecommerce schema migration.
- No Product Editor / Generate Intelligence / OptiBay / OptiWal / OptiZon runtime behavior changes.
- No OptiPixel UI/runtime in this phase.
- No admin-triggered extraction/OCR.

## New Offline Modules

- `lib/ecomviper/suppliers/rocktomic-pdf-assets.ts`
  - extracts catalog PDF link annotations
  - captures page + rect + URL + nearby text evidence
  - classifies links into:
    - `coaUrl`
    - `labelAnd3dMockupTemplateUrl`
    - `pricingSheetUrl`
    - `unknownLink`
- `lib/ecomviper/suppliers/rocktomic-template-assets.ts`
  - extracts per-SKU template assets from templates page HTML
  - captures `.ai` label template and `.tif` 3D mockup template metadata/evidence
- `lib/ecomviper/suppliers/rocktomic-supplement-facts-ocr.ts`
  - parses OCR raw text into supplement-facts candidate fields
  - emits confidence + `needsReview` + parse warnings

## Artifact Changes

`data/ecomviper/suppliers/rocktomic/latest/` now includes:

- `catalog-link-evidence.json`
- `template-asset-evidence.json`
- `ocr-evidence.json`

Updated existing artifacts:

- `sourceFacts.json`
  - includes structured supplement facts candidates
  - preserves OCR provenance/confidence/review state
- `assets.json`
  - includes reusable asset roles and readiness fields
  - includes template `.ai`/`.tif` URLs when available
- `validation-report.json`
  - adds Phase 3.5 policy version and coverage/readiness summaries
- `audit.csv`
  - includes expanded asset/OCR/readiness columns

## Validation/Readiness Alignment

Phase 3.5 extends validation to recognize:

- COA link coverage from catalog PDF annotations.
- Label/mockup template coverage from templates source.
- OCR supplement facts evidence presence and review status.
- OptiPixel-oriented readiness flags in offline outputs.

Policy remains truth-first:

- Missing fields remain explicit defects.
- Low-confidence OCR remains review-needed.
- Counts are improved only when real fields are recovered.

## OptiPixel Direction

OptiPixel is the future standalone ecommerce image intelligence brain.

Phase 3.5 prepares source asset readiness for future OptiPixel workflows (template transformation, mockup generation, channel-ready image output), but does not introduce OptiPixel runtime UI/features.

## Forward Phases

- Phase 4: controlled import/read of validated supplier data into/from shared ecommerce DB.
- Future OptiPixel phase: define OptiPixel-specific runtime UI/data model once asset readiness is stable.
