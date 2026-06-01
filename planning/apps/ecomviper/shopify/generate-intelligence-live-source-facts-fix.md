# Generate Intelligence Live Source Facts Fix (Phase 6.2.2-C)

Last updated: 2026-06-01 (UTC)

## Purpose

Fix live signed-in Generate Intelligence so the canonical Product Editor route uses real available source facts, applies precise missing-data semantics, and returns merchant-ready review-only proposals.

## Root Cause Found

The production issue was a multi-layer live-path parity gap, not a proxy/env failure:

1. Live copywriting input relied primarily on Product Editor `sourceFacts` + supplier snapshot (`supplierContext.product`), which could be stale/partial versus shared ecommerce DB facts.
2. Supplier facts read-model (`readSupplierFactsForShopifyProduct`) held richer evidence/facts, but key fields were not fully projected into copywriting input and Product Editor source projections.
3. Merchant-facing text included internal/dev wording through:
   - OCR-specific placeholder strings in source field display text.
   - eval/runner warnings (for example `source fact references include non-listed facts`) being surfaced as proposal compliance warnings.
4. Output guardrails did not fully suppress contradictory model notices when source facts were actually present.

## Layers Changed

### 1) Supplier facts read-model

- File: `lib/ecommerce/supplier-facts-read.ts`
- File: `lib/ecommerce/supplier-facts-types.ts`
- Added read-model projection for `ingredientAmounts` (`amountPerServing` mapping) so live consumers can use structured amount evidence from ecommerce DB rows.

### 2) Product Editor source-facts projection

- File: `lib/ecomviper/shopify/shopify-product-editor-state.ts`
- `buildSourceFacts(...)` now accepts supplier facts panel context and prefers read-model facts/evidence for:
  - active ingredients
  - amount per serving
  - serving size
  - servings per container
  - COA and asset evidence
- Merchant-facing placeholder strings were normalized:
  - removed OCR-directive phrasing (`require OCR extraction ...`)
  - replaced with plain user-facing availability language.

### 3) Live copywriting input builder parity

- File: `lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts`
- `buildProductCopywritingInputFromShopifyEditorState(...)` now merges supplement facts from:
  - source facts
  - supplier facts panel (shared DB read-model)
  - supplier snapshot
- Source evidence now also uses panel asset/evidence fields to prevent false blanket missing-facts states when structured/image/text evidence exists.

### 4) Runner output validation/sanitization hardening

- File: `lib/ecomviper/copywriting-agent/copywriting-agent-runner.ts`
- Added merchant-facing sanitation guardrails:
  - strips internal/debug phrases from notices/warnings.
  - drops contradictory missing notices when input evidence says facts are present/partial.
  - suppresses stale blanket `Supplement Facts missing`/`Ingredient amounts missing` when not true for final input.
  - keeps review-only behavior unchanged.

### 5) Live route diagnostics trace

- File: `app/api/ecomviper/pdp-intelligence/route.ts`
- Added safe per-request trace logging with compact redacted input/result summary and `trace_id` diagnostic field.
- No secrets, keys, or raw prompt contents are logged.

### 6) Product Editor merchant wording cleanup

- File: `app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx`
- Replaced stale/dev-like text (`...supplier intelligence update`) with plain merchant wording.

## Missing-Data Semantics (Live)

The live path now preserves partial-facts semantics:

- `supplementFactsMissing=true` only for true no-evidence cases.
- structured/partial facts with image/text evidence now map to precise notices:
  - `Serving size missing.`
  - `Servings per container missing.`
  - `Ingredient amounts missing.` (only when true and ingredient facts exist)
  - `Supplement Facts image available; ingredient details are not structured yet.`
- missing COA and missing pricing remain non-blocking notices.

## ROC123 (Oxy-Burn) Before/After Summary

### Before

- Live Product Editor/Generate Intelligence could surface:
  - blanket `Supplement Facts missing...`
  - false ingredient amount gaps
  - OCR/dev placeholder wording in merchant-facing tabs
  - internal eval warning text in proposal warnings

### After

- Live input path now consumes shared supplier read-model facts/evidence in addition to source snapshot.
- Structured/partial facts are projected with precise missing notices.
- Internal phrases and OCR placeholder wording are blocked from merchant proposal output.
- Review-only behavior preserved (no auto-save/no auto-publish).

## All-Product Dry-Run Counts

From `npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`:

- baseline before Phase 6.2.2-B:  
  - `supplementFactsMissing=164`
  - `coaMissing=164`
  - `pricingMissing=164`
- after Phase 6.2.2-B and preserved in 6.2.2-C run:
  - `supplementFactsMissing=16`
  - `coaMissing=40`
  - `pricingMissing=22`
  - `inventoryMissing=38`

## QA Status

### Local focused validation

- Focused live path/input/runner/UI tests passed.
- Prepare/evaluate fixture and all-product dry-run commands passed.
- `npm run build` passed in this run.

### Signed-in production browser QA

- Still required for closure:
  - `/ecomviper/products/opa-oxy-burn-thermogenic-support`
  - click `Generate Intelligence`
  - confirm no false blanket Supplement Facts missing warning when evidence exists
  - confirm no OCR/internal/dev phrasing
  - confirm review-only/no auto-save/no auto-publish
- This CLI run cannot execute authenticated browser QA directly.

## Safety/Boundary Confirmation

- no auto-save added
- no auto-publish added
- no model call during page render
- no supplier DB writes/import/OCR/.ai extraction/source fetch in render path
- no ecommerce schema change
- no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Phase 6.2.2-D Follow-Up Checkpoint (Local)

- state: `IMPLEMENTED_ONLY`
- branch: `sprint-6-2-2-d-live-supplier-facts-hydration`
- trigger: signed-in QA still showed ROC123 as `image_only` with zero structured ingredient counts in live traces.

### additional root cause detail

- live route input build lacked an explicit authoritative server-side supplier-facts rehydration step by SKU before generation.
- degraded editor/source snapshot states could still produce `image_only` despite available structured DB/read-model facts.

### additional implementation in 6.2.2-D

- added `lib/ecomviper/copywriting-agent/live-supplier-facts-hydration.ts`:
  - DB-first read by normalized SKU
  - read-only artifact fallback
  - merged hydrated facts back into supplier panel context used by live input builder
- route now records:
  - `supplier_facts_read_source` (`db|artifact|none|failed`)
  - `supplier_facts_read_found`
  - `supplier_facts_read_error_code` (safe code only)
- route trace input no longer logs `userId`.
- added snake_case fallback mapping in supplier read model for structured facts keys.
- added live parity CLI:
  - `npm run ecomviper:live-supplier-facts:parity -- --sku ROC123`

### local verification snapshot

- focused route/hydration tests: pass
- all-product dry-run counts unchanged from corrected baseline (`supplementFactsMissing=16`)
- full repository `npm test` still has unrelated baseline failures outside this sprint scope
- production deploy + signed-in browser trace verification pending
