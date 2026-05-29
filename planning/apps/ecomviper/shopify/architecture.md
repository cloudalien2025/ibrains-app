# Shopify Architecture (Sprint 009)

Last updated: 2026-05-29 (UTC)

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

## Internal Abstraction Boundary

- `getPrimarySupplierCatalogSnapshot()`
- `matchPrimarySupplierBySkus()`

Current platform implementation is Rocktomic-backed, but callers no longer couple directly to provider modules.
