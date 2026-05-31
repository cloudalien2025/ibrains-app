# Rocktomic AI Label Text Extraction + OCR Fallback (Phase 3.6)

Last updated: 2026-05-31 (UTC)

## Purpose

Phase 3.6 makes `.ai` label templates the primary supplement-facts extraction path for the offline Rocktomic package.

OCR remains fallback-only when `.ai` extraction is unavailable or fails.

## Scope Boundary (Phase 3.6)

- Offline package pipeline only (`npm run ecomviper:build-rocktomic-supplier-data`).
- No data import into `ibrains-ecommerce-prod-postgres`.
- No ecommerce DB schema migration.
- No Product Editor / Generate Intelligence / OptiBay / OptiWal / OptiZon runtime behavior changes.
- No OptiPixel runtime UI in this phase.
- No extraction/OCR from user-facing routes or admin render.
- No permanent storage of large `.ai` / `.tif` binaries in repo or production app storage.

## Primary Extraction Contract

1. Read per-SKU `.ai` URL from template asset evidence.
2. Read remote metadata (HEAD first when possible):
   - `ETag`
   - `Last-Modified`
   - `Content-Length`
   - `Content-Type`
   - template-page `Last Updated`
3. Reuse prior extraction evidence when metadata is unchanged.
4. Download `.ai` only when needed and only as temporary bytes.
5. Detect compatibility:
   - `%PDF` header => `pdf_compatible`
   - otherwise => `non_pdf_ai` (OCR fallback eligible)
6. Extract text from PDF-compatible `.ai`.
7. Parse structured facts and label sections.
8. Persist derived evidence/facts/metadata only.
9. Keep OCR path for fallback evidence only.

## New Offline Module

- `lib/ecomviper/suppliers/rocktomic-ai-label-text.ts`
  - remote metadata read/check logic
  - change detection (`shouldDownloadForExtraction`)
  - URL masking for logs
  - PDF compatibility detection
  - label text extraction for PDF-compatible `.ai`
  - supplement-facts parser for AI text

## Updated Artifacts

`data/ecomviper/suppliers/rocktomic/latest/`:

- added `ai-label-text-evidence.json`
- updated `sourceFacts.json` with `ai_pdf_text` provenance
- updated `assets.json` with remote freshness/extraction metadata
- updated `validation-report.json` with AI coverage counters
- updated `audit.csv` with AI extraction/status columns
- retained `ocr-evidence.json` for fallback evidence

## Evidence and Metadata Storage Rules

Stored:

- remote URL + file name + format
- template page `Last Updated`
- `ETag`, `Last-Modified`, `Content-Length`, `Content-Type` when available
- `lastCheckedAt`, `extractedAt`
- extraction status/method
- normalized/raw extracted text evidence
- parsed facts + confidence + review flags + parse warnings

Not stored:

- permanent `.ai` binaries
- permanent `.tif` binaries
- large binary source assets in Git or `data/.../latest/`

## Validation Policy Effects

Phase 3.6 policy updates:

- `ai_pdf_text` is preferred evidence over OCR when both exist.
- supplement evidence blocking field is AI-or-OCR provenance.
- low-confidence/review-needed AI extractions remain warning-level when required facts are present.
- missing serving size / servings per container / ingredient facts remain blocking for supplement SKUs.

New package-level counters include:

- `aiTextFactsCoverage`
- `ocrFactsCoverage`
- `supplementFactsCoverageTotal`
- `aiLabelTextExtractionAttempted`
- `aiLabelTextExtractionSucceeded`
- `aiLabelTextNeedsReview`
- `aiLabelTextNonPdfCompatible`
- `aiLabelTextNoExtractableText`
- `aiLabelTextExtractionErrors`

## Admin Visibility

`/admin/ecomviper/suppliers/rocktomic/audit` remains read-only and now displays:

- AI extraction attempted/succeeded/review/error counters
- non-PDF and no-extractable-text counts
- supplement-facts AI/OCR/total coverage summaries
- artifact presence for `ai-label-text-evidence.json`

## Forward Phases

- Phase 4: controlled import/read of validated supplier data into/from shared ecommerce DB.
- Future OptiPixel phase: runtime UI and processing model for image intelligence based on remote asset references and on-demand downloads.

## Phase 4 Handoff

Phase 3.6 outputs feed Phase 4 import in these ways:

- `ai-label-text-evidence.json` is persisted as supplier evidence payload.
- `sourceFacts.json` supplement facts with `ai_pdf_text` provenance are imported as structured facts/evidence.
- `assets.json` remote freshness metadata (`ETag`, `Last-Modified`, `Content-Length`, `Content-Type`, template-page `Last Updated`) is imported for supplier assets.

Phase 4 continues to avoid permanent binary storage:

- no permanent `.ai`/`.tif` file persistence in repo DB artifacts
- URLs + metadata + extracted evidence only

## Phase 4.2 Reliability Follow-up

Phase 4.2 keeps Phase 3.6 extraction semantics, but improves operational freshness/reuse behavior:

- bounded remote concurrency for metadata/extraction
- request timeout budgets for remote checks
- metadata-change detection reason codes
- conditional GET support (`If-None-Match`, `If-Modified-Since`) with `304` cache reuse
- additional evidence fields:
  - `reusedFromPreviousBuild`
  - `previousExtractedAt`
  - `changedDetected`
  - `changeReason`
  - `extractionSkippedReason`

Large `.ai` binaries remain temp-only and are not persisted.
