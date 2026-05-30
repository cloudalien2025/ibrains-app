# Shopify Architecture (Sprint 009.4)

Last updated: 2026-05-30 (UTC)

## Core Rules

- Shopify remains source of truth for listing identity and publish state.
- Supplier intelligence augments Shopify records and must never replace Shopify authority.
- Supplier system names and source URLs are internal-only and must not appear in public PDP outputs.

## Data Flow

1. Shopify listing and variants are loaded for workspace/user.
2. Supplier catalog snapshot is resolved through internal supplier abstraction (`lib/ecomviper/suppliers/supplier-intelligence.ts`).
3. SKU normalization + matching selects one supplier product context.
4. Source-grounded intelligence generation maps trusted fields (ingredients, certs, COA, inventory, pricing) from source data.
5. Public-facing content fields are sanitized to prevent internal supplier disclosure.
6. Persisted PDP intelligence remains tenant-scoped per user/product.

## Supplier Intelligence Ingestion Boundary (Hotfix 009.4)

Rocktomic supplier ingestion now follows explicit deterministic boundaries:

1. Source config resolution
2. Source fetch (Google Sheets CSV + catalog PDF bytes)
3. Parse + normalize
4. Supplier product record mapping
5. SKU match lookup
6. Product Editor and PDP generator field hydration

Catalog PDF parsing now uses a universal extraction engine:

- page text extraction (inflated streams + raw text layer fallback)
- SKU detection
- product-block anchor detection
- field-label extraction
- hyperlink association (COA + label/mockup)
- per-SKU diagnostics (`extractionStatus`, `extractionErrors`, `coa_link_status`, `coa_link_error`)

Extraction is SKU-agnostic and no longer hardcoded to `ROC949`.

## Membership Pricing Engine (Hotfix 009.4)

- Pricing sheet parsing detects membership tier columns dynamically from PLDS/MSRP headers.
- User-selected membership tier is persisted per user via settings.
- Supplier product pricing context includes:
  - selected membership tier
  - selected source column
  - detected tier list
  - per-tier cost map
  - pricing status label
- Product Editor/PDP intelligence consume selected-tier wholesale cost and compute profit/margin from Shopify price without inventing values.

## Hard Rules

- No fake inventory quantities.
- No fake ingredient/certification/compliance facts.
- No fake COA claims or placeholder substitution when extraction fails.

## Internal Abstraction Boundary

- `getPrimarySupplierCatalogSnapshot()`
- `matchPrimarySupplierBySkus()`

Current platform implementation is Rocktomic-backed, but callers no longer couple directly to provider modules.
