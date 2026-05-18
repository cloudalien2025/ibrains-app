# Planning State

Last updated: 2026-05-18 (UTC)

## Program Status

- Track: `EcomViper Shopify Agentic Workspace`.
- Sprint 001: Completed (stabilization scope).
- Sprint 002: Completed (capability detection + telemetry scope).
- Sprint 003: Completed (deterministic extraction precedence + extraction-source metadata + stable warning codes).
- Sprint 004: Planned (typed warning/telemetry code contract).

## Current Implemented Baseline (from code in repo)

- Live hydration remains split into `core`, `policy`, and `content` requests so policy failures do not block core catalog hydration.
- Policy-field capability detection remains cached in memory by `storeDomain + apiVersion` with 15-minute TTL.
- Unsupported policy field extraction now has deterministic precedence: `error.path` before `error.message` fallback.
- Extraction-source metadata is implemented: `none`, `path`, `message`, `mixed`.
- Hydration telemetry now includes probe/runtime extraction source and machine-readable warning codes.
- Existing Shopify workspace behavior remains preserved (`live_shopify`, `demo`, `unavailable`) including fallback snapshot behavior.

## Evidence Files

- `lib/ecomviper/shopify/shopify-policy-capabilities.ts`
- `lib/ecomviper/shopify/shopify-live-hydrator.ts`
- `tests/ecomviper_shopify_live_workspace.test.ts`
- `tests/ecomviper_shopify_policy_capabilities.test.ts`

## Next Milestone

- Execute Sprint 004 to define and apply a typed warning/telemetry code contract shared across Shopify capability and hydration consumers.
