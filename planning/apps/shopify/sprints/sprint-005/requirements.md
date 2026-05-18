# Sprint 005 Requirements

Status: Planned

# Sprint 005
Shopify Guarded Publish Execution

## Product Source Of Truth

This sprint is aligned to:

- `planning/apps/shopify/product-intent.md`
- `planning/apps/shopify/sprints/sprint-004/requirements.md`
- `planning/apps/shopify/sprints/sprint-004/blueprint.md`
- `planning/apps/shopify/sprints/sprint-004/acceptance-criteria.md`

Sprint 004 established local Step 3 review/publish workflow contracts and dry-run blocking. Sprint 005 adds the first guarded server-side execution path.

## Problem Statement

Current Step 3 behavior is still local-only:

- `Request publish (dry-run)` is evaluated in client workflow logic only.
- No server-side publish route exists for Shopify product editor drafts.
- No persisted publish-attempt records exist for Shopify Step 3 publish lifecycle.

This blocks safe, auditable progression from draft review to constrained Shopify execution.

## Goal

Add the first safe server-side publish execution path for Shopify product editor drafts while preserving Sprint 004 dry-run semantics.

## Sprint Focus

1. Add a guarded server publish service boundary for Step 3.
2. Limit execution to explicitly scoped fields only.
3. Require confirmation-bound token and idempotency key for execution.
4. Add stale listing guard (optimistic concurrency) before mutation.
5. Persist publish attempts/audit records using existing repository patterns when practical.
6. Keep dry-run path non-mutating and behavior-compatible with Sprint 004.

## Functional Requirements

1. Define server-side Step 3 publish request/response contracts for `dry_run` and `execute` modes.
2. Enforce explicit allowlist for mutation fields. Initial execution scope should be narrow and explicit (for example: title, description HTML/text, SEO title/description, tags, product type).
3. Disallow broad or implicit Shopify mutations outside the allowlist.
4. Require confirmation gate for all publish requests and require confirmation-bound publish token for `execute`.
5. Require idempotency key for `execute`; repeated submissions with same key must be deterministic and non-duplicative.
6. Add stale listing guard by comparing current live listing freshness/fingerprint (for example `updatedAt` and/or deterministic baseline hash) before mutation.
7. Preserve existing Step 3 dry-run behavior and messaging contract from Sprint 004.
8. Return structured, machine-readable publish result/audit codes for blocked, failed, stale, duplicate, and success outcomes.
9. Add/extend publish attempt persistence for Shopify using existing repository + migration style used in the codebase (DB table + test fallback store).

## Non-Goals

- No broad product mutation support across all editable fields.
- No inventory/price/status bulk publish implementation.
- No workspace lane redesign.
- No unrelated Shopify hydration refactors.

## Constraints

- Keep mutation scope minimal and explicit.
- Require authenticated user context and existing Shopify connection resolution.
- Require write-scope validation before execution (for example `write_products`).
- Preserve existing product editor tab flow and dry-run guardrails.
- Keep changes scoped to Shopify Step 3 publish modules, API route, repository/migration, and focused tests.
