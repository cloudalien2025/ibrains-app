# Pricing Architecture (Hotfix 009.4)

Last updated: 2026-05-30 (UTC)

## Source Inputs

- PLDS/MSRP pricing sheet (Google Sheets CSV export)
- Shopify variant pricing (`price`, `compareAtPrice`)
- User settings: selected `Supplier Membership Tier`

## Membership Tier Selection

- Settings surface: `/ecomviper/settings`
- Field: `Supplier Membership Tier`
- Tier options detected dynamically from pricing sheet headers where possible.
- Selection is persisted per user and consumed by supplier ingestion/matching.

## Pricing Model

Per matched SKU, compute:

- `wholesale_cost` from selected membership tier column
- `msrp` from source sheet, when available
- `shopify_price` from Shopify variant
- `compare_at_price` from Shopify variant
- `estimated_profit = shopify_price - wholesale_cost` (when both available)
- `margin_percent = estimated_profit / shopify_price` (when both available and price > 0)

## Status Rules

- If no tier selected:
  - prompt in Product Editor: `Select membership tier in Settings to calculate cost and profit.`
  - pricing status should indicate tier selection required.
- If tier selected but no cost in that column:
  - pricing status should indicate source unavailable for selected tier.
- Never fabricate cost/profit/margin values when source inputs are missing.

## Stabilization 009.6 Sync Dependency

- Membership tiers and SKU cost maps are persisted in `supplier_pricing_normalized` during source sync.
- If pricing source has not been synced, settings should prompt `Run source sync to detect membership tiers.`
- Product Editor must show `Cost not found for selected tier.` when tier cost is unavailable.

## Hotfix 009.8 Global Pricing + Merchant Tier Binding

Pricing records are global supplier facts under the platform supplier scope. The selected membership tier is merchant-scoped and is read separately from the signed-in merchant setting.

Rules:

- Settings reads tier options from global normalized pricing records.
- Settings saves the selected tier per merchant/user.
- Product Editor looks up the selected tier in the global SKU pricing record.
- If no merchant tier is selected, Product Editor shows `Select membership tier in Settings to calculate cost and profit.` and does not calculate wholesale/profit/margin.
- If a tier is selected but the SKU/tier cost is missing, Product Editor shows `Cost not found for selected tier.`
- If no pricing record exists for the SKU, Product Editor shows `Pricing record not found for SKU.`
- Any fallback/default tier must be explicitly labeled; silent default-cost calculation is not allowed.
