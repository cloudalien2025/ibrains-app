# EcomViper Shopify Performance Architecture (Sprint Stabilization Audit)

Last updated: 2026-05-30 (UTC)

## Scope

This document defines the production-safe route performance model for Shopify-first EcomViper.

It is a stabilization contract, not a feature expansion plan.

## Root Causes Confirmed

1. Route-coupled supplier ingestion risk:
   - supplier ingestion was reachable from route load paths that should have remained cache-only.
2. Missing payload limits:
   - upstream source fetches accepted unbounded payload sizes.
3. Missing hard timeout behavior for PDP OpenAI generation:
   - generation had no explicit request abort budget.
4. Product editor and PDP route supplier lookup risk:
   - supplier abstraction could trigger source refresh behavior if cache was cold/stale.
5. Client runtime crash risk:
   - nullable/invalid date + money rendering paths in dashboard/editor clients could trigger client-side exceptions on mobile hydration.
6. Release metadata reliability gap:
   - deploy metadata file writes were non-atomic, allowing intermittent partial/null reads during deploy windows.

## Route Performance Model

### `/`
- Auth/public shell only.
- No supplier ingestion.
- No Shopify import writes.
- Must remain fast under signed-out load.

### `/brains`
- Launcher render only.
- No supplier ingestion.
- No redirect loops.

### `/ecomviper`
- Protected.
- Shopify status/import state fetched first.
- Supplier diagnostics are optional and bounded by soft timeout.
- Supplier ingestion is skipped when Shopify is disconnected.
- Product rows render from Shopify durable data with optional supplier enrichment.

### `/ecomviper/settings`
- Protected.
- Shopify status/import/OpenAI status loads first.
- Supplier diagnostics are cache-only (`allowRefresh: false`, `triggerBackgroundRefresh: false`).
- Never blocks on source refresh/download.

### `/ecomviper/dropshipping/rocktomic`
- Protected diagnostics surface.
- Uses cache-only supplier snapshot (`allowRefresh: false`, `triggerBackgroundRefresh: false`).
- Shows cache/refresh state in UI for operator diagnostics.

### `/ecomviper/products/[productId-or-handle]`
- Protected.
- Shopify product load remains primary.
- Supplier lookup uses abstraction in cache-only mode (`allowRefresh: false`, `triggerBackgroundRefresh: false`).
- Product editor never performs synchronous source refresh/download.

### `/api/ecomviper/pdp-intelligence`
- Protected.
- Save/generate operations remain tenant-scoped.
- Supplier context lookup uses cache-only abstraction (`allowRefresh: false`, `triggerBackgroundRefresh: false`).
- OpenAI calls are bounded by timeout and prompt-context limits.

### `/api/health`
- Public.
- Must respond quickly even during degraded supplier/OpenAI conditions.

### `/api/meta/release`
- Public.
- File/env metadata only.
- No external ingestion.
- Must return non-null `git_sha` and `build_id` with explicit diagnostics when metadata is incomplete.

## Forbidden Synchronous Work

The following work must not run synchronously during normal page render:

1. Large PDF download for supplier catalog parsing.
2. Large Google Sheets export download and parse.
3. Source refresh fanout across routes/users.
4. OpenAI generation without timeout.

## Cache/Stale Policy

Supplier ingestion now has three request-safe cache modes:

1. `fresh`
2. `stale`
3. `seed_fallback` (no cache; source refresh deferred)

UI diagnostics should surface cache/refresh state so operators can distinguish data freshness from route availability.
