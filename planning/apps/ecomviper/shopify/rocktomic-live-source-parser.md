# Rocktomic Live Source Parser (Phase 6.3.1)

Last updated: 2026-06-01 (UTC)

## Status

- State: `IMPLEMENTED_ONLY`
- Branch: `sprint-6-3-1-rocktomic-live-source-parser`

## Problem

`--use-firecrawl --cache --sku ROC948` returned `records_extracted=0` even though cached catalog markdown clearly contained ROC948 and related terms.

Root cause:
- extractor consumed only Firecrawl structured JSON (`scrape.json.records`)
- Firecrawl JSON response omitted ROC948 row for this run
- markdown evidence existed but no parser fallback generated a normalized record

## Implemented Fix

### 1. Firecrawl markdown parser fallback

Added `lib/ecomviper/suppliers/rocktomic/firecrawl-catalog-markdown-parser.ts`.

Parser capabilities:
- detect ROC SKU tokens in markdown
- build bounded context window per SKU
- parse row-style fields for:
  - product name
  - SKU
  - label size
  - container size
  - product weight
  - serving size / servings per container when available
- emit provenance with rawSnippet for audit
- emit `missingFields` + `extractionWarnings`
- emit explicit reason codes when no record is returned

### 2. Firecrawl merge strategy

Updated `firecrawl-supplier-intelligence.ts`:
- keep Firecrawl JSON records as primary source
- merge markdown fallback records by SKU when JSON is incomplete
- prevent `records_extracted=0` when SKU exists in cached markdown

### 3. PyMuPDF PDF evidence foundation

Added:
- `scripts/ecomviper/pdf_evidence_extract.py`
- `lib/ecomviper/suppliers/rocktomic/pdf-evidence.ts`

Supported behavior:
- check PyMuPDF (`fitz`) availability
- search PDF pages for SKU term
- extract page snippets and link annotations
- return deterministic JSON payload for merge/enrichment

Current default behavior:
- if local catalog PDF path is unavailable, record remains valid but adds warning (`pdf_source_unavailable`)
- no OCR/vision fallback path added

### 4. Google Sheets CSV foundation

Added `lib/ecomviper/suppliers/google-sheets-csv.ts`:
- build public CSV export URL from sheet URL/id (+ optional gid)
- parse CSV rows deterministically
- SKU row lookup helper for pricing/inventory integration

### 5. Playwright templates foundation

Added `lib/ecomviper/suppliers/rocktomic/templates-playwright.ts`:
- controlled, opt-in extraction interface
- default `not_run` path for CI-safe behavior
- no live browser execution required by tests

### 6. Toolbelt doctor

Added:
- `lib/ecomviper/suppliers/supplier-toolbelt-doctor.ts`
- `scripts/ecomviper/supplier_toolbelt_doctor.ts`
- npm script: `ecomviper:supplier-toolbelt:doctor`

Checks include Node/npm/python/playwright/chrome/PyMuPDF/pandas/openpyxl/Firecrawl-env/cache-dir, with key masking.

## ROC948 Before/After

Before:
- source `firecrawl`
- `records_extracted=0`

After:
- source `firecrawl`
- `firecrawl_source=cache`
- `records_extracted=1`
- `sku=ROC948`
- `productName=Premium Nitric Oxide Gummies`
- `sourceStatus=needs_review`

Reason for `needs_review`:
- markdown row provided product metadata but incomplete structured supplement-facts payload
- parser correctly avoids fabricating complete structured facts

## Validation Behavior Update

Validation summary now includes:
- `structuredSupplementFactsCount`
- `partialCount`
- `needsReviewCount`
- `parserWarningsCount`
- `provenanceMissingCount`
- `linkExtractionMissingCount`
- `supplementFactsIncompleteCount`

## Confirmed Boundaries

- no Product Editor behavior change
- no Product Editor auto-save/publish
- no DB writes/imports/migrations
- no OCR/vision default extraction path
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Phase 6.3.2 Addendum (Panel Extraction Layer)

Phase 6.3.2 extends this parser baseline with page-level panel extraction support:

- deterministic catalog PDF acquisition/cache helper
- PyMuPDF candidate page JSON enriched with:
  - `pdfPageIndex`
  - `catalogPageLabel`
  - page render path/panel crop path when enabled
- strict deterministic supplement-facts parsing + validation gate before `structured` promotion
- optional OpenAI vision fallback remains explicit (`--use-openai-vision`) and env-gated

Current ROC948 cache behavior after addendum remains safe:
- record is preserved (`records_extracted=1`)
- candidate page evidence/artifacts are produced
- `sourceStatus=needs_review` is retained when panel facts cannot be confidently proven from evidence
