# Product Editor Architecture (Sprint 009.4)

Last updated: 2026-05-30 (UTC)

## Layout

- iBrains Dashboard compact header
- status-chip row (Shopify, supplier match, inventory, COA)
- left rail: product identity and gallery
- center: tabbed workspace (`Overview`, `Ingredients`, `Trust & Compliance`, `Commerce`, `Agentic Visibility`, `Assets`, `SEO & Schema`)
- right rail: commerce intelligence, shipping, COA cards

## Deterministic Supplier Field Model

For matched supplier SKUs, Product Editor must hydrate deterministic source fields before any AI generation:

1. Supplement Facts Panel
2. Active Ingredients
3. Amount Per Serving
4. Other Ingredients
5. Serving Size
6. Servings Per Container
7. Ingredient Highlights
8. Allergen / Dietary Attributes

Unknown is allowed only when the source lacks the field or deterministic extraction fails.

Stabilization 009.6 guardrail:
- If supplier source is configured but normalized SKU facts are missing, Product Editor must render:
  - `Supplier data has not been synced for this SKU. Run source sync.`
- Do not silently collapse this state to generic `Unknown`.

## COA Link Handling

- COA link is mapped from catalog PDF hyperlink extraction by matched SKU row.
- If hyperlink extraction fails for a matched SKU, diagnostics must include:
  - `coa_link_status: extraction_failed`
  - `coa_link_error: PDF hyperlink not found for matched SKU row`
- UI must not silently collapse extraction failures to generic "Not available".

## Commerce Tier Context (Hotfix 009.4)

- Commerce tab and right rail must show selected membership tier context.
- If no tier is selected, show explicit prompt: `Select membership tier in Settings to calculate cost and profit.`
- Commerce values are source-grounded:
  - wholesale cost from selected membership tier column
  - MSRP from pricing sheet when available
  - Shopify price/compare-at from Shopify
  - estimated profit and margin derived from Shopify price and selected-tier cost
- Do not render fabricated costs or inferred quantity values.

## Interaction Model

- Generate: server-side source-grounded intelligence generation
- Save: persistence with tenant/workspace isolation
- Tabs reduce vertical scroll and keep high-priority controls above fold

## Source Sync Dependency

- Product Editor reads normalized supplier records only.
- Product Editor must not download PDFs, parse Google Sheets, or run OCR on route render.

## Hotfix 009.8 Source Facts Boundary

Product Editor now composes two separate data layers:

1. `sourceFacts`
   - current merchant Shopify product
   - normalized global supplier product by SKU
   - normalized global pricing by SKU
   - normalized global inventory by SKU
   - normalized global assets/COA by SKU
   - current merchant selected membership tier
2. `generatedIntelligence`
   - merchant-scoped saved PDP intelligence and generated copy

Source-owned fields in Product Editor must render from `sourceFacts` first. Saved generated PDP values must not override source facts for supplement facts, ingredients, serving metadata, pricing, inventory, COA, or source diagnostics.

Product-facing supplier lookups must prefer persisted normalized records over process-local supplier cache snapshots. In-memory cache may protect source-fetch paths, but it must not cause Product Editor or Generate Intelligence to show stale source facts after the normalized sync updates.

Internal Source Diagnostics must include:

- Shopify product id/handle/SKU
- normalized SKU
- global product/pricing/inventory/assets record found flags
- selected membership tier
- last global supplier sync
- last generated intelligence timestamp
- stale intelligence flag
- missing fields and status reasons

Missing-data states use explicit statuses:

- `extracted`
- `partial`
- `ocr_required`
- `source_sync_required`
- `source_missing`
- `extraction_failed`
- `not_applicable`

`Unknown` is not a valid replacement for a known pipeline state such as OCR required or source sync required.
