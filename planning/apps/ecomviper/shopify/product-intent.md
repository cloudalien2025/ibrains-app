# Shopify Product Intent

Last updated: 2026-05-29 (UTC)

This document describes the Shopify app as it exists today in this repository.

## Sprint 008 Addendum (AI PDP Intelligence Engine Foundation)

- `/ecomviper/products/[productId-or-handle]` now supports AI PDP intelligence generation/edit/save/reopen.
- PDP intelligence generation is server-side only and combines:
  - Shopify product/listing facts (source of truth)
  - Rocktomic supplier intelligence when SKU match exists
  - existing saved intelligence when present
- Compliance guardrails include deterministic risky phrase detection, risk level, and safer rewrite notes.
- FAQ entries now support schema-ready fields (`question`, `answer`, `category`, `schema_eligible`, `compliance_status`).
- When OpenAI credentials are missing for the signed-in user/environment, generation returns an explicit unavailable state and does not break editor workflow.
- Image Studio remains deferred for execution (placeholder only) until Sprint 009+.

## Sprint 007 Addendum (Rocktomic Supplier Intelligence Engine Foundation)

- Rocktomic is the first platform-managed supplier intelligence source for `/ecomviper`.
- Shopify remains the merchant listings source of truth; Rocktomic augments PDP/editor intelligence by SKU.
- Merchants do not upload Rocktomic files in normal workflow.
- Rocktomic source references (catalog/templates/policy and pending feeds) are modeled server-side.
- Product editor Supplier Intelligence now renders match confidence/reason and richer supplier fact/status fields.
- Dropshipping -> Rocktomic route now exposes source status, product count, catalog reference status, and deterministic SKU lookup.
- AI PDP generation remains deferred to Sprint 008+.

## Sprint 006 Addendum (`/ecomviper` Shopify Inventory Foundation)

- EcomViper parent route now provides a Shopify-first listings surface at `/ecomviper`.
- Shopify is the source of truth for listings in this foundation flow.
- Product rows open PDP editor route: `/ecomviper/products/[productId-or-handle]`.
- Rocktomic is the first supplier intelligence source via SKU matching.
- Rocktomic data is platform-managed; merchants should not manually upload Rocktomic files in normal workflow.
- Image Studio is modeled as a dashboard module with documented output contracts and future GPT-image execution.
- Buy Now Links are modeled on PDP surfaces.
- EcomViper.com remains future public optimized PDP surface (not fully implemented in this sprint).

## 1) What This Shopify App Is Supposed To Do

The app is an "Agentic Workspace" for Shopify stores. It pulls live Shopify catalog/content/policy data and turns it into:

- readiness scores,
- trust/policy coverage signals,
- AI prompt-match diagnostics,
- prioritized next actions,
- and a product-level editing workflow for listing optimization drafts.

It is designed to help operators understand whether their storefront content is ready for AI-driven discovery/referrals, not just traditional storefront browsing.

## 2) Who It Is For

Primary users appear to be:

- Shopify operators/ecommerce managers,
- content/SEO teams managing product and policy content,
- AI/automation operators connecting OpenAI + SerpAPI,
- teams running multi-channel operations (Shopify first, with Walmart reconciliation support available in adjacent APIs).

The current UX and data model are built for internal operators, not end shoppers.

## 3) Main User Workflow

Typical flow based on implemented routes/UI:

1. Open `/ecomviper/shopify`.
2. If disconnected, go to `Settings` lane.
3. Enter Shopify credentials, test connection, and save.
4. Run `Sync Now` to import/hydrate Shopify product data.
5. Optionally connect OpenAI (for optimization proposals) and SerpAPI (for visibility scans).
6. Review `Command Center` and lane diagnostics (Knowledge Base, Prompt Match, Trust Signals, Semantic Gaps, Marketplace Health).
7. Open `Products` lane and click a product to enter `/ecomviper/shopify/products/[productId-or-handle]`.
8. Use 3-step product editor:
   - Step 1: review current listing snapshot,
   - Step 2: generate AI proposal (if OpenAI connected),
   - Step 3: edit draft and prepare update.

Important current behavior: Step 3 is draft-prep oriented; it does not auto-publish product updates to Shopify.

## 4) What Each Section/Page Is Responsible For

### A. Main Workspace Page

Route: `/ecomviper/shopify`

- Loads signed-in user state + optional explicit demo mode (`?demo=1`/`true`/`demo`).
- Renders sidebar lanes and status pills (environment, store, mode, connection states, sync timestamps).
- Shows source warnings/errors.

### B. Workspace Lanes

1. `Command Center`
- Overall readiness summary cards.
- MCP endpoint candidates + diagnostics.
- Knowledge base summary metrics.
- AI test queries and next best actions.

2. `Products`
- Product readiness table (facts/content/alt/schema/FAQ).
- Links to product editor route when stable product id/handle exists.

3. `Knowledge Base`
- Question table with current answer, generated answer, coverage status, gap reason.
- Copy-ready FAQ bundle output block.

4. `Prompt Match`
- Test query match status (`matched`/`partial`/`gap`), confidence, missing warnings, suggested answer.

5. `Trust Signals`
- Trust signal inventory (brand/support/shipping/marketplace/checkout policy confidence).

6. `Semantic Gaps`
- Missing topic/intent coverage with severity and recommended action.

7. `Product Opportunities`
- Ranked product-facing actions by impact/effort.

8. `Marketplace Health`
- Summary health view across catalog, KB, MCP, policy, compliance, AI readiness, counts, and timestamps.

9. `Settings`
- Credential management and tests for Shopify/OpenAI/SerpAPI.
- Sync trigger and visibility scan trigger.
- Explicit demo mode on/off controls.

### C. Product Editor Page

Route: `/ecomviper/shopify/products/[productId-or-handle]`

- Loads product state from live, fallback snapshot, demo, or unavailable mode.
- Step 1: read-only current listing docket.
- Step 2: generate optimization proposal (OpenAI-gated; deterministic fallback exists).
- Step 3: editable draft with staged change summary and "Save draft"/"Prepare update" interactions.

## 5) What Problem The App Solves

The app solves a practical operations problem:

"How ready is my Shopify storefront content for AI agents and answer engines, and what should I fix first?"

It combines live Shopify data with policy/trust/semantic checks so operators can:

- identify content gaps that reduce AI referral confidence,
- prioritize highest-impact fixes,
- and prepare better product listing drafts using an explicit workflow.

It also reduces hydration fragility by handling Shopify policy schema variability safely.

## 6) What Is Already Built

Based on current code/tests, the following is already implemented:

- Live workspace hydration with explicit source modes:
  - `live_shopify`, `demo`, `fallback_snapshot`, `unavailable`.
- Non-blocking policy hydration path separate from core catalog hydration.
- Deterministic unsupported policy field extraction precedence:
  - `error.path` before `error.message` fallback.
- Extraction-source metadata:
  - `none`, `path`, `message`, `mixed`.
- Policy capability telemetry/warning codes in hydration output.
- In-memory policy capability cache (store+apiVersion key, TTL-based).
- Workspace lane UI with diagnostics and action prioritization.
- Product editor 3-step docket workflow with OpenAI gating and local draft changes.
- Credential APIs for Shopify/OpenAI/SerpAPI with secure encrypted storage pattern where DB relation is available.
- Import/sync APIs for Shopify product catalog data.
- SerpAPI visibility scan endpoint and status recording.
- Walmart reconciliation endpoint that can apply Shopify image matching in the Walmart workflow.
- Regression coverage for workspace rendering, hydration stability/capability handling, product editor tabs, and product navigation.

## 7) What Is Missing Or Unclear

Key gaps/uncertainties visible in current code:

1. No end-to-end publish action from product editor to Shopify Admin write APIs.
- Step 3 currently prepares/saves draft state in-client only.

2. Knowledge Base workflow is analysis-heavy but not a full authoring/publish system.
- Generated/copy-ready outputs exist, but direct CMS/policy publishing loop is not present.

3. Marketplace/health diagnostics are partly heuristic.
- MCP live probing is environment-flag driven; default behavior is mock diagnostics.
- Query log in KB summary is explicitly placeholder text.

4. Telemetry contract is still largely string-based in producers/consumers.
- Stable codes exist, but shared typed contract adoption is planned (Sprint 004).

5. Manual operational cadence.
- Sync and scans are user-triggered; no explicit scheduled/automatic sync orchestration is visible.

6. API surface overlap can be confusing.
- `/sync` and `/import` are both product import-style flows; distinction may not be clear to users.

7. Product success criteria and persona boundaries are implicit.
- The app clearly targets operators, but formal product KPIs and role-based workflows are not codified in UI copy/contracts.

## 8) Recommended Product Roadmap Based On Current Code

### Near-term (next sprint)

1. Implement typed warning/telemetry code contract across Shopify capability + hydrator producers/consumers.
2. Keep behavior stable while replacing raw string drift risk with shared typed exports and tests.

### Short-term

3. Add "review-to-publish" integration for product editor drafts:
- explicit diff preview,
- guarded write scopes,
- publish confirmation/audit trace,
- failure recovery messaging.

4. Add stronger KB lifecycle support:
- move from "analysis output" to "editable answer set" and publish-ready/exportable workflow.

### Mid-term

5. Improve operational automation:
- scheduled sync jobs,
- stale-data detection,
- alerting on repeated hydration failures/capability mismatches.

6. Strengthen marketplace health from heuristic to evidence-backed:
- persist scan history,
- trend charts for readiness dimensions,
- clear confidence grades per lane.

### Longer-term

7. Expand cross-channel loop (Shopify to marketplaces) with explicit governance:
- controlled reconciliation pipelines,
- channel-specific constraints,
- and change approval controls.

## Source-of-Truth Pointers

Primary implementation references:

- `app/ecomviper/shopify/page.tsx`
- `app/ecomviper/shopify/shopify-workspace-client.tsx`
- `app/ecomviper/shopify/_components/*`
- `app/ecomviper/shopify/products/[productId-or-handle]/*`
- `lib/ecomviper/shopify/shopify-workspace-state.ts`
- `lib/ecomviper/shopify/shopify-live-hydrator.ts`
- `lib/ecomviper/shopify/shopify-policy-capabilities.ts`
- `app/api/ecomviper/shopify/*`
- `tests/ecomviper_shopify_*`
