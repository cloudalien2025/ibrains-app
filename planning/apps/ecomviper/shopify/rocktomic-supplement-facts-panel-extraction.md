# Rocktomic Supplement Facts Panel Extraction (Phase 6.3.2)

Last updated: 2026-06-01 (UTC)

## Status

- State: `IMPLEMENTED_ONLY`
- Branch: `sprint-6-3-2-rocktomic-supplement-facts-panel-extraction`

## Objective

Promote Firecrawl-discovered ROC SKU records from metadata-only `needs_review` into provenance-backed structured supplement facts when real page evidence supports it.

## Implemented Strategy

1. Deterministic catalog PDF acquisition/cache lane:
   - `lib/ecomviper/suppliers/rocktomic/pdf-source-cache.ts`
   - saves local catalog PDF + metadata (`sourceUrl`, hash, download time, size, source version query token)
2. Expanded PyMuPDF evidence extraction:
   - `scripts/ecomviper/pdf_evidence_extract.py`
   - `lib/ecomviper/suppliers/rocktomic/pdf-evidence.ts`
   - returns candidate pages with:
     - `pageNumber`
     - `pdfPageIndex`
     - `catalogPageLabel` (when available)
     - page text
     - URI links
     - rendered page/panel artifact paths (when enabled)
     - source hash + structured errors
3. Deterministic supplement-facts parser/validator:
   - `lib/ecomviper/suppliers/rocktomic/supplement-facts-panel.ts`
   - extracts:
     - `servingSize`
     - `servingsPerContainer`
     - `nutrientFacts[]`
     - `activeIngredients[]`
     - `otherIngredients[]`
   - strict structured promotion gate:
     - identity present (`sku`, `productName`)
     - serving fields present
     - facts present
     - per-fact provenance present
4. Controlled OpenAI vision fallback (optional, gated, cached):
   - `lib/ecomviper/suppliers/rocktomic/openai-vision-supplement-facts.ts`
   - disabled unless both:
     - CLI flag `--use-openai-vision`
     - env `ECOMVIPER_SUPPLIER_OPENAI_VISION_ENABLED=1`
   - cache key: `image_hash + model + schema_version`
5. CLI support for panel extraction and candidate artifacts:
   - `scripts/ecomviper/build_rocktomic_supplier_intelligence.ts`
   - flags:
     - `--extract-panels`
     - `--render-pdf-pages`
     - `--use-openai-vision`
     - `--write-candidates`
     - `--candidate-dir <path>`
     - `--debug-panel`

## ROC948 Current Outcome (Phase 6.3.2 Local)

- before (Phase 6.3.1): `records_extracted=1`, `sourceStatus=needs_review`, facts incomplete
- after (Phase 6.3.2 local):
  - deterministic catalog PDF acquisition works (downloaded then cached)
  - PyMuPDF candidate page extraction works (`page-76` candidate in local run)
  - rendered candidate artifacts are generated when requested
  - deterministic parser runs and emits explicit validation failure reasons when facts are not provable
  - ROC948 remains `needs_review` in current cache evidence path because extracted page text does not provide complete/valid Supplement Facts rows

This is an acceptable fallback state for this phase because no fake structured facts are emitted.

## SourceStatus Decision (Exact)

- `structured` only when parser/validator passes serving-size + servings-per-container + facts + provenance gates.
- `needs_review` when page evidence exists but deterministic/vision extraction cannot prove complete panel data.
- extraction warnings explicitly include validation failure reasons (`panel_validation_*`) and incomplete parse markers.

## Runtime/Architecture Boundaries Kept

- no Product Editor behavior change
- no Product Editor auto-save or auto-publish
- no model call during page render
- no production DB writes/imports/migrations
- no SKU hardcoding
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
- tests do not require Firecrawl or OpenAI live API access

