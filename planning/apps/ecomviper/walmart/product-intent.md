# Walmart Product Intent

Last updated: 2026-05-18 (UTC)

This document describes the Walmart app based on existing code, routes, UI, tests, and data models in this repository.

For the focused Command Center implementation audit and next-step operator workflow plan, see:

- `planning/apps/ecomviper/walmart/command-center-foundation.md`

For the AI visibility workflow foundation derived from current implementation, see:

- `planning/apps/ecomviper/walmart/ai-visibility.md`

For canonical Walmart score semantics and cross-surface score ownership, see:

- `planning/apps/ecomviper/walmart/score-contract.md`

For the first canonical `ai_visibility_score` API payload boundary, see:

- `planning/apps/ecomviper/walmart/ai-visibility-api-boundary.md`

For app-level orientation and navigation pointers, see:

- `planning/apps/ecomviper/walmart/overview.md`

## 1) What This Walmart App Is Supposed To Do

The Walmart app is an operator-facing "Agentic Commerce Command Center" inside EcomViper for managing Walmart catalog quality, draft operations, AI-assisted optimization, and guarded publish/feed preparation.

It combines:

- Walmart connection + permission health,
- Walmart catalog import/hydration and enrichment,
- draft-first editing and validation,
- AI-generated content/image support,
- iBrains destination-aware intelligence recommendations,
- and guarded, preview-first publish/feed workflows.

Current implementation emphasis is "safe staging and preview," not broad direct live mutation.

## 2) Who It Is For

Primary users in current code appear to be:

- ecommerce operators managing Walmart listings,
- catalog/content teams improving discoverability and compliance,
- AI-assisted workflow operators (BYO OpenAI + SerpApi),
- multi-channel operators using Shopify as a source catalog for Walmart image reconciliation.

This is an internal operations workspace, not a shopper-facing product.

## 3) Main User Workflow

Typical flow from implemented UI/routes:

1. Open `/apps/ecomviper/walmart` and review command center health/queues.
2. Go to `Network Connections` (`/connect`) and set Walmart credentials; optionally configure OpenAI, SerpApi, Shopify source catalog, and WordPress destinations/guardrails.
3. Import Walmart products from `Products` lane (`/products`) and optionally run Shopify sync/reconciliation plus historical content backfill.
4. Open a SKU at `/products/[sku]` for the single-docket editor:
   - review current listing + provenance,
   - run AI optimization and image/label-fact tools,
   - stage edits and save drafts,
   - run guarded publish preview/confirmation flow.
5. Use `Drafts` to validate/submit/discard staged drafts.
6. Use `Feeds`, `Inventory`, and `Pricing` lanes for feed status and guarded update flows.
7. Use `iBrains Intelligence` for destination-aware recommendation drafts (approval-first).
8. Use `Settings` safety actions for controlled reset/disconnect operations.

## 4) What Each Section/Page Is Responsible For

- `Command Center` (`/apps/ecomviper/walmart`): connection health, catalog metrics, activity timeline, capability map, optimization coverage, and next-best-action/missing-from-code panels.
- `Products` (`/products`): product table, filtering/sorting, import progress diagnostics, Shopify sync trigger, historical content backfill trigger, remove-local-product action, and jump to SKU editor.
- `Product Editor` (`/products/[sku]`): single-docket editing workflow (content/media/pricing/search-browse), live hydration fallback handling, AI optimization, generated media, catalog backfill preview, ITEM report request/poll/download/apply, and guarded publish preview lanes.
- `iBrains Intelligence` (`/ibrains-intelligence`): product-level recommendation run that scores opportunities and generates destination-aware draft copy, including WordPress destination fit.
- `Drafts` (`/drafts`): list + mutate draft lifecycle (`validate`, `submit`, `discard`).
- `Prompt Match` nav lane currently routes to `Activity Log` (`/activity`): audit timeline of marketplace actions.
- `Trust Signals` nav lane currently routes to `Feeds` (`/feeds`): feed submission history/status/payload/error preview (submission guarded/disabled by gates).
- `Semantic Gaps` nav lane currently routes to `Inventory` (`/inventory`): inventory update workspace with draft/live-disabled behavior.
- `Product Opportunities` nav lane currently routes to `Pricing` (`/pricing`): pricing workspace with draft/live-disabled behavior.
- `Network Connections` (`/connect`): Walmart/OpenAI/SerpApi/Shopify connection management plus WordPress property guardrails.
- `Settings` (`/settings`): workspace defaults and danger-zone reset/disconnect actions with confirmations and draft-protection checks.
- `AI Optimizer` route (`/ai-optimizer`): redirects to products/product-editor; dedicated tabbed optimizer flow is no longer primary.

## 5) What Problem The App Solves

The app solves the operational problem:

"How do we safely improve Walmart listing quality and agentic discoverability without unsafe direct writes?"

It gives teams one place to:

- connect systems and verify readiness,
- import/hydrate catalog state from multiple sources,
- stage and validate edits before submission,
- generate AI-assisted improvements with compliance checks,
- and track activity/drafts/feeds with guardrails.

## 6) What Is Already Built

Based on code/tests, currently implemented:

- Full Walmart workspace shell with lane navigation and command-center metrics.
- Auth-gated Walmart API routes for connection, products, drafts, inventory, pricing, feeds, reports, AI, and settings reset actions.
- Durable per-user product and draft repositories with DB-backed paths (and test fallback stores).
- Product import pipeline with:
  - Walmart token/read checks,
  - catalog + inventory fetch,
  - item detail hydration,
  - image enrichment flow (Item Search/SerpApi),
  - Shopify reconciliation integration,
  - import diagnostics and error categorization.
- Live hydration and catalog backfill preview paths for product editor.
- ITEM report request/status/download/apply workflow with freshness/merge diagnostics.
- Draft lifecycle and draft overlay merging into product views.
- iBrains intelligence scoring/opportunity engine with destination guardrail fit for WordPress connections.
- BYO OpenAI and SerpApi connection management (encrypted storage pattern and test coverage).
- Generated Walmart media workflow (preview assets, SEO filename/alt text metadata).
- Security behaviors with redaction/masking tests for secrets/tokens.
- Guarded publish/feed scaffolding:
  - publish lane preview diffing and validation,
  - explicit confirmation UX,
  - feed submission gate checks (approval + write flag),
  - preview/staged messaging.

## 7) What Is Missing Or Unclear

- Broad live mutation is intentionally not enabled by default in major flows (pricing/inventory/publish/feed remain guarded or preview-first).
- Product editor "Publish to Walmart" currently resolves to preview confirmation and `preview_only_no_publish_route`; direct execution path is unclear/pending architecture interview.
- Feed submit route enforces approval + feature flag, but feed handling is still preview/staged oriented; live downstream execution contract is unclear/pending architecture interview.
- Some lane labels map to operational pages rather than literal semantic lane behavior:
  - `Prompt Match` -> activity log,
  - `Semantic Gaps` -> inventory,
  - `Product Opportunities` -> pricing.
  Product/UX intent behind this naming is unclear/pending architecture interview.
- Network connections repository is currently fallback-store based (no obvious durable DB table path in this module yet).
- Activity logs and feed submission storage currently depend on runtime store patterns for several paths; long-term retention/audit requirements are unclear.
- Formal business KPIs/persona boundaries (beyond operator workflows) are not codified and are pending architecture interview.

## 8) Recommended Product Roadmap Based On Current Code

1. Finalize guarded execute semantics for publish/feed lanes:
   - keep strict allowlists and explicit confirmation/idempotency controls,
   - preserve preview-first defaults.
2. Clarify lane taxonomy and UX naming so nav labels match implemented page responsibilities.
3. Standardize persistence strategy:
   - align activity/feed/network-connection durability with existing per-user repository patterns where appropriate.
4. Expand end-to-end integration coverage for execute-gated paths (still with live-write protections).
5. Formalize operator KPIs and workflow success signals (currently implicit in metrics/coverage panels).
6. Run architecture interview to settle unclear production-write rollout policy, approval governance, and long-term destination publishing model.

## 9) Source-of-Truth Implementation Pointers

Primary references used:

- `app/apps/ecomviper/walmart/*`
- `app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx`
- `app/api/ecomviper/walmart/*`
- `lib/ecomviper/walmart/walmart-products.ts`
- `lib/ecomviper/walmart/walmart-native-state.ts`
- `lib/ecomviper/walmart/walmart-live-item-hydrator.ts`
- `lib/ecomviper/walmart/walmart-live-catalog-backfill.ts`
- `lib/ecomviper/walmart/walmart-item-report-backfill.ts`
- `lib/ecomviper/walmart/walmart-publish-lanes.ts`
- `lib/ecomviper/walmart/walmart-ibrains-intelligence.ts`
- `lib/ecomviper/walmart/walmart-product-repository.ts`
- `lib/ecomviper/walmart/walmart-draft-repository.ts`
- `lib/ecomviper/shopify/walmart-shopify-reconciliation.ts`
- `tests/ecomviper_walmart_*`
