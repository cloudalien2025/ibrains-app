# Product Editor Architecture (Sprint 010)

Last updated: 2026-05-31 (UTC)

## Layout

- Shared shell contract:
  - global iBrains header (flush top)
  - EcomViper sidebar
  - Product Editor workspace content
- Product Editor top section:
  - compact breadcrumb/action/status header
  - hero row with:
    - left: large Product Gallery card (main image + thumbnail selector)
    - right: Product Summary card (SKU/vendor/type/status/commerce/COA/timestamps)
- Tabbed workspace below hero:
  - `Overview`, `Ingredients`, `Trust & Compliance`, `Commerce`, `Agentic Visibility`, `Assets`, `SEO & Schema`
- Optional right rail is secondary-only (for example shipping/workspace metadata) and must not duplicate hero summary.
- The old small Product Rail is removed from primary layout.

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

## Product Gallery Rules

- Gallery uses native React UI (not copied eBay HTML/CSS output).
- Thumbnail selection updates the main displayed image.
- Object fit should preserve label readability (`object-contain`).
- If no valid image exists, show clean placeholder: `No product images available`.
- Null/empty URLs must not crash UI or render broken boxes.
- Deterministic ordering:
  - front/primary
  - supplement facts/back label
  - side/directions/warnings
  - 3-pack
  - 6-pack
  - lifestyle
  - source/original order fallback

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
- effective membership tier (including default-tier fallback label when used)
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

Hotfix 009.9 binding additions:

- Product Editor commerce surface must not show `Not selected` while computing costs from a fallback tier.
- `low_stock` inventory must render as `Action Required: Mark Out of Stock`.
- COA card must separate link availability from parsing progress:
  - `COA Link: View COA` when SKU link exists
  - `COA Document Parsing: pending` as non-blocking status.

## Merchant-Facing Language Rule

- Product Editor top identity/summary surfaces should not display extraction/debug/internal key terms (for example source diagnostics key/value internals).
- Internal diagnostics can remain in internal/admin workflows, not merchant identity sections.
