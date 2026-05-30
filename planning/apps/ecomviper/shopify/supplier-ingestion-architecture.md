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
- Max binary payload (PDF): `8MB`.
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

Use background refresh only where explicitly intended (dashboard ingestion path).  
Product editor, PDP generation, settings diagnostics, and Rocktomic diagnostics route run in cache-only mode by default.

## Data Integrity Constraints

1. Unknown fields remain unknown (no invented values).
2. Inventory quantity is never fabricated.
3. Membership pricing is source-derived only.
4. COA and supplement facts remain source-backed only.
