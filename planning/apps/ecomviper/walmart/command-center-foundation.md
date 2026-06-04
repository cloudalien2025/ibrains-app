# Walmart Command Center Foundation

Last updated: 2026-05-18 (UTC)

## Sprint Scope

Sprint: `sprint-001-walmart-command-center-foundation`  
Type: Docs and planning only (no application code changes)

Goal: Define what the Walmart Command Center currently does in real code, what is still staged/placeholder behavior, and what the first real operator workflow should be.

## Current Command Center Role (Implemented)

The Command Center at `/optiwal` is the operational read/triage hub for Walmart workflows, not a direct live-write console.

What it currently does in code:

- Auth-scoped dashboard render with per-user snapshot loading where available.
- Computes connection status UX (`Connected` / `Failed` / `Not Connected`) using both persisted credential health and recent successful operational signals.
- Shows top-level operating metrics:
  - `Command Center Health`
  - `Catalog Coverage`
  - `Action Queue`
  - `Trust Signal Alerts`
  - `Priority Opportunities`
- Shows triage panels:
  - `AI Visibility Queue` (recent products)
  - `Signal Timeline` (recent activity)
  - `Listings Needing Intervention`
  - `Command Center Lanes`
  - `Walmart Agentic Optimization Coverage` (including next-best actions and missing-from-code surfacing)
- Provides primary next-step CTAs:
  - Connect/manage Walmart credentials
  - Review AI visibility (`/products`)
  - Review trust signals (`/feeds`)

Source pointers:

- `app/optiwal/page.tsx`
- `lib/ecomviper/walmart/walmart-products.ts` (`getWalmartDashboardSnapshotForUser`)
- `lib/ecomviper/walmart/walmart-auth.ts` (`getWalmartConnectionHealthForUser`)
- `lib/ecomviper/walmart/walmart-command-center-score-rollup.ts`
- `lib/ecomviper/walmart/walmart-ai-visibility-score.ts`
- `tests/ecomviper_walmart_route_contract.test.tsx`

### Canonical score rollup boundary (implemented)

Command Center readiness/confidence rollups now consume the canonical `ai_visibility_score` adapter boundary through:

- `lib/ecomviper/walmart/walmart-command-center-score-rollup.ts`
- `lib/ecomviper/walmart/walmart-ai-visibility-score.ts`
- `app/optiwal/page.tsx`

This keeps existing UI labels stable while sourcing rollup values from canonical score semantics.

## What Is Real vs Placeholder Right Now

### Real/working behavior

- Connection save/test/disconnect routes are implemented and auth-scoped.
- Import pipeline is implemented with bounded segment execution, diagnostics, continuation cursor handling, and post-import background hydration queueing.
- Product editor runs real draft staging, validation, AI assistance, and multi-source hydration/backfill helpers.
- Draft lifecycle routes (`create`, `validate`, `submit`, `discard`) are implemented and persisted per user.
- Command Center cards/queues reflect actual imported product, draft, feed, and activity state from current repositories/stores.

### Placeholder or staged behavior

- Product editor publish confirmation is explicitly preview-only:
  - status moves to `preview_only_no_publish_route`
  - no live submit route call is executed
- Inventory/pricing update paths are intentionally write-disabled for live mutation and primarily support draft staging.
- Feed submission route has approval/feature-flag gates and still returns staged/preview semantics.
- Network connections are currently backed by in-memory fallback store patterns (not durable repository tables).
- Activity log and feed lists are runtime store patterns (not long-term durable audit storage).
- Optimization coverage matrix is intentionally static/scaffolded reference logic with dynamic scoring overlays, not end-to-end live capability execution.

Source pointers:

- `app/optiwal/products/[sku]/product-editor-client.tsx`
- `lib/ecomviper/walmart/walmart-publish-lanes.ts`
- `lib/ecomviper/walmart/walmart-inventory.ts`
- `lib/ecomviper/walmart/walmart-pricing.ts`
- `lib/ecomviper/walmart/walmart-feeds.ts`
- `lib/ecomviper/walmart/walmart-network-connections-repository.ts`
- `lib/ecomviper/core/activity-log.ts`
- `tests/ecomviper_walmart_tabbed_workflow.test.tsx`
- `tests/ecomviper_walmart_publish_lanes.test.ts`
- `tests/ecomviper_walmart_approval_gates.test.ts`

## Real Current Operator Workflow Represented by the Command Center

This is the concrete workflow currently represented by code:

1. Open Command Center and check health badge + queue counts.
2. If not connected, go to `Network Connections` and complete/test Walmart credentials.
3. Run bounded product import from `Products`; monitor import diagnostics and continuation behavior.
4. Triage `Listings Needing Intervention` and open selected SKU.
5. In product editor:
   - review current/hydrated listing state
   - run AI optimization where needed
   - stage/save draft
   - run guarded publish preview + explicit confirmation (still preview-only)
6. Use `Drafts` for validation/submit/discard state management.
7. Use `Feeds`, `Semantic Gaps` (inventory), and `Product Opportunities` (pricing) as guarded lanes with current live-write protections.
8. Return to Command Center to verify queue movement and activity timeline.

## First Real Operator Workflow to Promote Next

Most direct first operational hub workflow based on existing implementation:

`Command Center triage -> open SKU -> fix listing draft -> guarded publish execute lane (single scoped path) -> observe status return in Command Center timeline/cards.`

This aligns with existing guardrails and avoids broad mutation rollout.

## Scoped Next-Step Roadmap (Command Center-Centric)

1. Promote action-queue triage into explicit worklist states:
   - deterministic issue classes (content, media, price, inventory, trust)
   - owner-ready queue ordering
2. Keep publish path narrow:
   - enable one guarded execute lane first
   - preserve explicit confirmation + idempotency + stale-state protection
3. Close observability loop:
   - persist publish-attempt/status records through existing repository patterns where lightweight
   - expose per-lane submit/result timeline directly in Command Center
4. Improve lane semantics clarity:
   - align nav wording and Command Center lane labels with actual route behavior
5. Add command-center-focused integration tests:
   - queue movement after draft/publish-preview actions
   - status-card consistency with connection/import/draft changes

## Non-Goals for This Sprint

- No broad live Walmart mutation rollout
- No infrastructure/schema expansion beyond planning
- No non-Walmart application changes
