# Acceptance Criteria: Test-Only Orphan Modules — Wire-or-Remove

## Must pass

1. **Per-module decision recorded.** Every one of the 8 modules has an explicit
   Remove / Wire / Keep-as-scaffolding decision documented in the MR description, with the
   owner's sign-off for each **Decide**-lean module.
2. **Paired-deletion integrity.** Any module removed also has its dedicated test removed in
   the same commit. No test file is left importing a deleted module. The
   `supplier-intelligence-read-model` case removes only the read-model-specific import +
   assertions, NOT the whole `ecommerce_supplier_facts_read.test.ts` (which must still cover
   the live `lib/ecommerce/supplier-facts-read.ts`).
3. **Route-contract assertion handled.** If `shopify-pdp-intelligence-generator.ts` is
   removed, `tests/ecomviper_product_editor_route_contract.test.ts:61` no longer references
   the deleted path, and the test still asserts something meaningful.
4. **Verification gate vs baseline:**
   - `node_modules/.bin/tsc --noEmit` → 155 errors (unchanged; no new errors).
   - `node_modules/.bin/vitest run` → failure count = baseline 10 minus any removed suites,
     with NO newly-failing suites. (Removed modules' suites disappear cleanly.)
   - No `Cannot find module` errors.
5. **No wiring/feature work** merged under this sprint. If "Wire" is chosen for any module,
   that becomes a separate feature sprint and that module is left untouched here.

## Should

- One commit per module (or per decision group) so each removal is independently revertable.

## Definition of done

Clean `main` → branch → per-module commits → gate green → push → MR (with the decision table
in the description) → green CI → squash-merge → delete remote+local branch → sync main →
update `planning/state.md` (MR #, pipeline, merge SHA, branch cleanup, per-module outcome).
