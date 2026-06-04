# Shopify App Overview

Last updated: 2026-05-29 (UTC)

## Scope

The Shopify app under `apps/ecomviper/shopify` provides an agentic workspace backed by live Shopify hydration, with demo and unavailable fallbacks.

## Core Components

- Live hydrator: `lib/ecomviper/shopify/shopify-live-hydrator.ts`
- Policy capability utilities: `lib/ecomviper/shopify/shopify-policy-capabilities.ts`
- Workspace state composer: `lib/ecomviper/shopify/shopify-workspace-state.ts`
- Type contracts: `lib/ecomviper/shopify/shopify-agentic-types.ts`
- Main regression coverage: `tests/ecomviper_shopify_live_workspace.test.ts`

## Workspace Invariants To Preserve

- Existing workspace lanes/sections remain unchanged.
- Workspace source behavior remains unchanged (`live_shopify`, `demo`, `unavailable`).
- Fallback snapshot behavior remains unchanged when live hydration fails.
- Policy hydration remains optional/non-blocking for core catalog hydration.

## Sprint History (Implemented)

- Sprint 001: Stabilized Shopify hydration around policy-field schema mismatch risk (`privacyPolicy` and related fields), while preserving current workspace behavior.
- Sprint 002: Added explicit policy capability detection, cache, capability-aware policy hydration, runtime refresh, and telemetry/warning reporting.
- Sprint 003: Completed deterministic capability extraction precedence + warning code contract hardening.
- Sprint 004: Completed product editor review/dry-run publish workflow foundations.
- Sprint 005: Completed guarded publish route/service foundations with allowlist, confirmation token, idempotency, and stale guards.

## Current Sprint

- Sprint 008: AI PDP Intelligence engine foundation in `/ecomviper` product editor:
  - typed persisted PDP intelligence model for Shopify product + optional supplier linkage
  - server-side generation action using Shopify listing facts + Rocktomic supplier context when matched
  - deterministic compliance-risk phrase detection + review metadata
  - editable/save/reopen intelligence workflow for signed-in operators
  - explicit placeholders preserved for Buy Now links, Image Studio, and Publish controls
