# Rocktomic Validation Policy Calibration (Phase 4.3)

Last updated: 2026-05-31 (UTC)

## Purpose

Phase 4.3 recalibrates Rocktomic validation so global package defects are separated from use-case-specific readiness.

Primary business driver:

- ingredient matching for Phase 5 should not be globally blocked just because COA is missing.

## Scope Boundary

Included:

- validation policy recalibration (`lib/ecomviper/suppliers/rocktomic-validation-policy.ts`)
- offline report/audit shape updates (`validation-report.json`, `audit.csv`)
- read-only admin audit summary updates
- importer/verify compatibility for readiness JSON payloads

Not included:

- Product Editor runtime binding
- Generate Intelligence runtime binding
- OptiPixel UI
- admin write/import/sync actions
- route render extraction/fetch behavior changes

## Core Policy Changes

### Missing COA treatment

- `assets.coaUrl` moved from global blocking to warning/compliance-evidence defect.
- missing COA now contributes to:
  - `warningDefects`
  - `complianceEvidenceDefects`
  - `complianceEvidenceReadiness` downgrade/block
- missing COA does not, by itself, block:
  - `ingredientMatchingReadiness`
  - `productEditorFactsReadiness`

### Readiness dimensions

Per-SKU readiness now explicitly includes:

- `ingredientMatchingReadiness`
- `productEditorFactsReadiness`
- `complianceEvidenceReadiness`
- `optiPixelAssetReadiness`
- `channelImageGenerationReadiness`
- `generateIntelligenceReadiness`
- `optiBayReadiness`
- `optiWalReadiness`
- `optiZonReadiness`

Status values:

- `ready`
- `ready_with_warnings`
- `blocked`
- `not_applicable`
- `needs_review`

### Defect families

Policy now separates defect families for clearer downstream decisions:

- `blockingDefects` (global)
- `warningDefects` (global)
- `complianceEvidenceDefects`
- `assetReadinessDefects`
- `ingredientMatchingDefects`
- `productEditorFactsDefects`

## New/Updated Artifacts

- `data/ecomviper/suppliers/rocktomic/latest/validation-report.json`
  - readiness counts per dimension
  - missing COA warning counters
  - before/after global blocked counters
  - top blocking/warning defect summaries
  - `validationPolicyCalibrationReport`
- `data/ecomviper/suppliers/rocktomic/latest/validation-policy-calibration-report.json`
- `data/ecomviper/suppliers/rocktomic/latest/audit.csv`
  - readiness columns and defect-family columns for operators

## Calibration Snapshot (Phase 4.3 rebuild)

From `validation-report.json` after rebuild on 2026-05-31:

- SKUs validated: `164`
- global status:
  - usable: `8`
  - usable_with_warnings: `59`
  - blocked: `97`
  - extraction_error: `0`
- readiness:
  - ingredient matching: `ready=63`, `ready_with_warnings/needs_review=66`, `blocked=35`
  - product editor facts: `ready=63`, `ready_with_warnings/needs_review=7`, `blocked=94`
  - compliance evidence: `ready=121`, `ready_with_warnings=24`, `blocked=19`
- missing COA warning count: `40`
- missing COA no-longer-global-block count: `2`
- global blocked before calibration simulation: `99`
- global blocked after calibration: `97`

## Database Import Compatibility

Phase 4 import lane remains idempotent and preserves readiness JSON payloads in:

- `ecommerce_supplier_products.readiness`
- `ecommerce_supplier_validation_results.readiness`
- `ecommerce_supplier_validation_results.validation_result`

No schema churn is required for this calibration.

## Phase Boundary Confirmation

- `DATABASE_URL` remains core iBrains only.
- `ECOMMERCE_DATABASE_URL` remains ecommerce import/read lane.
- no use of `ecomviper-prod-postgres`.
- no runtime Product Editor/Generate Intelligence behavior changes.

## Phase 5 Consumption Contract

Phase 5 Product Editor binding consumes readiness dimensions from this calibration:

- matching gate: `ingredientMatchingReadiness`
- read-only supplier facts quality: `productEditorFactsReadiness`
- compliance warning lane: `complianceEvidenceReadiness`

Required semantics preserved for Product Editor:

- missing COA is not an ingredient-matching blocker
- missing pricing is not an ingredient-matching blocker
- global status alone is not the Product Editor matching gate
