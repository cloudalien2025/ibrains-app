# Sprint 004 Requirements

Status: Planned

# Sprint 004
Shopify Product Editor Draft-to-Publish Workflow

## Product Source Of Truth

This sprint is aligned to:

- `planning/apps/shopify/product-intent.md`

Specifically, `product-intent.md` states that Step 3 in the product editor is currently draft-prep only and does not publish updates to Shopify.

## Problem Statement

The current product editor (`/apps/ecomviper/shopify/products/[productId-or-handle]`) supports:

- review current listing,
- generate optimization proposal,
- edit draft,
- and "Save draft" / "Prepare update" actions.

But it does not provide a safe end-to-end review-to-publish workflow.

## Goal

Move the Shopify product editor from draft preparation toward a safe review-to-publish workflow.

## Sprint Focus

1. Inspect current Step 3 behavior and identify what is local-only today.
2. Define guarded publish workflow design to Shopify Admin API.
3. Add workflow foundations for:
   - diff preview,
   - explicit confirmation,
   - audit trail,
   - failure recovery.
4. Do not implement live publishing mutations in this sprint.

## Functional Requirements

1. Document and codify current Step 3 local-only actions/limits.
2. Define a publish-intent payload contract from draft state to a publish service boundary.
3. Provide deterministic diff preview model between current listing and editable draft.
4. Define confirmation gate requirements before any publish attempt is allowed.
5. Define audit-trail event model for review/publish lifecycle events (attempted, confirmed, blocked, failed, succeeded).
6. Define failure-recovery behavior for partial/failed publish paths.
7. Preserve existing product editor flow and existing Shopify workspace behavior.

## Non-Goals

- Do not execute Shopify Admin write mutations in Sprint 004.
- Do not redesign the broader Shopify workspace lanes.
- Do not add marketplace feature expansion.
- Do not add unrelated AI workflow refactors.

## Constraints

- Use current code/UI structure as source of truth.
- Keep changes scoped to product editor workflow and adjacent contracts/tests.
- If persistence is needed for audit trail, use it only when a clear existing pattern is present; otherwise keep audit trail non-persistent for this sprint and document follow-up.
