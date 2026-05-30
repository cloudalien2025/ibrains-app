# EcomViper Supplier Ingestion Architecture (Stabilization)

Last updated: 2026-05-30 (UTC)

## Objective

Keep supplier ingestion as internal/background intelligence only and prevent origin saturation or route blocking.

## Ingestion Safety Rules

1. Shopify remains listing source of truth.
2. Supplier ingestion is supplemental and internal-only.
3. Normal route loads must use cached/stale-safe snapshots.
4. Cold-cache request paths can return seed fallback diagnostics instead of blocking.
5. Fetch timeouts are mandatory.
6. Payload-size limits are mandatory.
7. Errors must be redacted and bounded.
8. Duplicate in-flight refreshes must be deduped.

## Current Runtime Protections

### Timeouts
- Source fetch timeout: `12_000ms`.

### Payload Limits
- Max text payload (CSV/export): `4MB`.
- Max binary payload (default): `8MB`.
- Trusted Rocktomic catalog PDF (`https://rocktomicplatform.blob.core.windows.net/client-resources/Supplement-&-Apparel-Catalog.pdf`) sync cap: `32MB`.
- Oversize payloads are rejected with safe diagnostics.

### Dedupe / Anti-Storm
- Per-cache-key single-flight (`inFlightByCacheKey`).
- Per-URL fetch dedupe during a refresh pass.

### Stale Safety
- Fresh cache returns immediately.
- Stale cache returns immediately and can refresh in background.
- Cache-only mode returns without synchronous refresh.

### No-Source Fallback
- When refresh is disabled and cache is absent:
  - return seed fallback snapshot,
  - mark diagnostics as deferred/scheduled,
  - keep route render non-blocking.

## Diagnostics Contract

Snapshot includes route-facing diagnostics fields:

- `cacheState`: `fresh | stale | seed_fallback`
- `refreshState`: `idle | refreshing`
- per-source:
  - `configured`
  - `fetchable`
  - `parsed`
  - `recordCount`
  - `lastError` (redacted)

## Background Refresh Policy

Use background refresh only from explicit operator refresh or background job paths, not normal dashboard navigation.
Product editor, PDP generation, settings diagnostics, and Rocktomic diagnostics route run in cache-only mode by default.

Current expected modes:

1. `/ecomviper`, `/ecomviper/settings`, `/ecomviper/dropshipping/rocktomic`, PDP generation, product editor:
   - `allowRefresh: false`
   - `triggerBackgroundRefresh: false`

## Data Integrity Constraints

1. Unknown fields remain unknown (no invented values).
2. Inventory quantity is never fabricated.
3. Membership pricing is source-derived only.
4. COA and supplement facts remain source-backed only.

## Stabilization 009.6 Normalized Pipeline

Supplier ingestion now has an explicit durable pipeline:

1. Source sync trigger (`POST /api/ecomviper/supplier-sources/sync` or `scripts/ecomviper_sync_supplier_sources.sh`)
2. Bounded fetch + parse during sync only
3. Normalization/persistence in:
   - `supplier_products_normalized`
   - `supplier_inventory_normalized`
   - `supplier_pricing_normalized`
   - `supplier_assets_normalized`
4. Route reads from normalized snapshot only (`allowRefresh: false`, `triggerBackgroundRefresh: false`)
5. Product Editor + PDP generation consume normalized facts and show explicit sync-required diagnostics when missing

`/ecomviper`, `/ecomviper/settings`, `/ecomviper/dropshipping/rocktomic`, Product Editor, and PDP generation remain forbidden from triggering live source downloads/parsing during page render.

## Hotfix 009.8 Global Supplier Data Boundary

Normalized supplier intelligence is platform-managed global data. The durable normalized tables still carry the legacy `user_id` scope column, but supplier sync and route reads treat `__global__` as the only valid platform supplier scope for Rocktomic records.

Global supplier data:

- `supplier_products_normalized`
- `supplier_inventory_normalized`
- `supplier_pricing_normalized`
- `supplier_assets_normalized`
- `supplier_source_sync_status`
- `supplier_source_sync_runs`
- `supplier_source_sync_locks`

Merchant/workspace data remains signed-in-user scoped:

- Shopify connection and imported Shopify products
- selected supplier membership tier
- saved PDP intelligence
- marketplace/buy-now/publish settings

Repository boundary:

- global supplier reads use `lib/ecomviper/suppliers/global-supplier-data.ts`
- merchant tier settings use `getMerchantSupplierMembershipTier` / `setMerchantSupplierMembershipTier`
- normal page render uses normalized records only and passes `includeSeedFallbackProducts: false` where SKU matching is product-facing
- product-facing cache-only reads prefer the persisted normalized snapshot before any process-local in-memory supplier snapshot, so Product Editor and Generate Intelligence do not serve stale supplier facts after a sync

Authenticated merchants may view global supplier diagnostics after auth, but supplier records are not public. Source sync runs as a platform/global sync and persists under `__global__`; it no longer creates merchant-specific supplier rows for normal operation.
