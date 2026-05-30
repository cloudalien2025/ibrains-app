# Product Editor Architecture (Sprint 009.3)

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

## COA Link Handling

- COA link is mapped from catalog PDF hyperlink extraction by matched SKU row.
- If hyperlink extraction fails for a matched SKU, diagnostics must include:
  - `coa_link_status: extraction_failed`
  - `coa_link_error: PDF hyperlink not found for matched SKU row`
- UI must not silently collapse extraction failures to generic "Not available".

## Interaction Model

- Generate: server-side source-grounded intelligence generation
- Save: persistence with tenant/workspace isolation
- Tabs reduce vertical scroll and keep high-priority controls above fold
