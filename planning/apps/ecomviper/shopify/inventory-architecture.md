# Inventory Architecture (Sprint 009.4)

Last updated: 2026-05-31 (UTC)

## Internal Status Model

- `in_stock`
- `low_stock`
- `out_of_stock`
- `unknown`
- `source_unavailable`

## Mapping Rules

1. Use supplier inventory status when supplier inventory is available and mapped.
2. If supplier inventory is unknown but source is available, fallback to Shopify-derived stock status.
3. If supplier inventory source is unavailable and Shopify signal is insufficient, return `source_unavailable`.
4. Never synthesize quantity counts from status-only supplier reports.
5. Supplier inventory report is qualitative only (`IN STOCK`, `LOW STOCK`, `OUT OF STOCK`); do not infer unit quantities.

## Customer-Facing Labels

- `in_stock` -> `Available`
- `low_stock` -> `Action Required: Mark Out of Stock`
- `out_of_stock` -> `Currently Unavailable`
- `unknown` -> `Availability Unknown`
- `source_unavailable` -> `Inventory Status Unavailable`

## Stabilization 009.6 Sync Dependency

- Inventory status is persisted from sync runs into `supplier_inventory_normalized`.
- Route render reads qualitative status only and never infers unit quantities.

## Hotfix 009.8 Global Inventory Binding

Product Editor reads inventory from the global normalized supplier inventory row for the matched normalized SKU.

Display labels:

- `in_stock` -> `Available`
- `low_stock` -> `Action Required: Mark Out of Stock`
- `out_of_stock` -> `Currently Unavailable`
- `unknown` -> `Availability Unknown`
- `source_unavailable` -> `Inventory Status Unavailable`

If a normalized inventory row exists, the UI must not collapse that SKU to `source_unavailable`, even when the source value is qualitative `unknown`. Unit quantities remain unavailable unless the source explicitly provides them.
