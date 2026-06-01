# Firecrawl Supplier Intelligence Extractor (Phase 6.3)

Last updated: 2026-06-01 (UTC)

## Purpose

Make supplier intelligence extraction the upstream source of truth for Product Editor and Generate Intelligence by introducing a Firecrawl-backed acquisition + structured extraction foundation.

## Firecrawl Role

Firecrawl is used as the supplier source acquisition/extraction backbone for controlled source URLs.

- scrape supplier URLs into markdown
- parse PDF/catalog content through Firecrawl parser mode
- run schema-based JSON extraction for structured fields
- optionally map source URLs in bounded mode only

No unbounded crawl is allowed.

## Source Acquisition Flow

Rocktomic sources -> Firecrawl client (fixture/cache/live) -> normalized supplier intelligence package -> read model consumers.

Package outputs are produced as candidate artifacts before any promotion/import:

- `sourceFacts.json`
- `pricing.json`
- `inventory.json`
- `assets.json`
- `validation-report.json`
- `audit.csv`

## Normalized Schema

Canonical record type: `NormalizedSupplierIntelligenceRecord`.

Required shape includes:

- identity: `supplierId`, `supplierName`, `sku`, `productName`
- structured supplement facts: `nutrientFacts[]`, `activeIngredients[]`
- dimensions: `labelSize`, `containerSize`, `productWeight`
- assets/evidence: `coaUrl`, `labelTemplateUrl`, `mockupUrl`, `imageUrls[]`
- commercial: `pricing`, `inventory`
- source quality: `sourceStatus`, `missingFields[]`, `confidence`
- provenance: per-field provenance and record-level provenance

Every generated fact must carry provenance or be marked missing.

## Provenance Model

Each provenance entry stores:

- `sourceType`
- `sourceUrl`
- `pageNumber`
- `extractedAt`
- `extractor`
- `rawSnippet`
- `confidence`

Allowed source types include `catalog_pdf`, `supplier_page`, `coa`, `label_template`, `pricing_sheet`, `inventory_sheet`, `policy_page`, and `manual_fixture`.

## Dry-Run and Import Separation

Foundation builder command:

- `npm run ecomviper:rocktomic:supplier-intelligence -- --fixtures --sku ROC948 --dry-run`

Write behavior:

- default dry-run/no-write mode for safe verification
- package writes only to timestamped `data/ecomviper/suppliers/rocktomic/candidates/<timestamp>/`
- no production DB write/import is performed by this extractor task

## ROC948 Proof (Fixture Baseline)

ROC948 fixture proves structured extraction representation for:

- SKU/product name
- serving size + servings per container
- nutrient facts (Vitamin C, Niacin, Vitamin B12, Sodium, carbohydrates, sugars)
- active ingredients (Beet Root Powder Extract, Grape Seed Extract, L-Arginine, L-Citrulline)
- label/container/weight fields
- COA/template/mockup link presence
- provenance per fact from catalog/template/pricing/inventory sources

## Product Editor and Generate Consumption

- Product Editor should consume normalized supplier package/read-model projection fields.
- Generate Intelligence should consume the same normalized supplier package as downstream input.
- Generate Intelligence remains downstream writer only; it does not extract supplier sources.

## Boundaries

- no Product Editor auto-save
- no Product Editor auto-publish
- no model call during page render
- no production DB writes/imports in this phase
- no OCR/image extraction as default path
- no SKU-specific hardcoding in implementation
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Remaining Gaps

- live Firecrawl extraction mapping beyond fixture baseline still needs expanded per-SKU parsers and confidence calibration
- candidate promotion workflow to `latest/` is still a follow-up step
- controlled import command for normalized package -> ecommerce DB remains separately gated

## Phase 6.3.1 Live Parser Calibration Update (IMPLEMENTED_ONLY)

Root cause for `records_extracted=0` with ROC948:
- Firecrawl acquisition/cache worked, but extractor trusted only `scrape.json.records`.
- Cached/live catalog markdown contained ROC948, while Firecrawl JSON extraction omitted that row.
- Result: valid markdown evidence existed but no normalized record boundary was created.

Implemented calibration:
- Added markdown boundary parser fallback for catalog rows in `firecrawl-catalog-markdown-parser.ts`.
- Parser now finds SKU windows, parses row/cell patterns, and emits normalized metadata records with provenance raw snippets.
- Added explicit no-record reasons (`sku_not_found`, `parser_no_record_boundary`, `source_unavailable`) and parser warnings.
- Added source merge path: Firecrawl JSON records remain primary; markdown fallback fills missing SKU records.
- Added optional PyMuPDF evidence integration hook for page/link enrichment when local catalog PDF is available.

ROC948 regression result:
- command: `npm run ecomviper:rocktomic:supplier-intelligence -- --sku ROC948 --use-firecrawl --cache --dry-run`
- now returns `records_extracted=1`, `productName=Premium Nitric Oxide Gummies`, `sku=ROC948`, `sourceStatus=needs_review`.
- supplement facts remain incomplete in this source slice, so status is not promoted to `structured`.

Boundaries preserved:
- no Product Editor auto-save/publish changes
- no Product Editor render-time source fetch
- no DB writes/imports/migrations
- no OCR/vision default extraction path
