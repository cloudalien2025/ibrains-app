# Handoff Prompt: Test-Only Orphan Modules — Wire-or-Remove

You are the Builder for the queued sprint **Test-Only Orphan Modules — Wire-or-Remove**.

Read first: `AGENTS.md`, `planning/state.md` (confirm this sprint is still `QUEUED`), then
this folder's `requirements.md`, `blueprint.md`, `acceptance-criteria.md`.

## Task

Eight modules are imported only by their own unit test (verified 2026-06-03). For each, the
product owner must choose **Remove** / **Wire** / **Keep-as-scaffolding** (see the decision
table in `requirements.md`). This sprint executes the **Remove** decisions only.

## Hard rules

- **Do not delete a module without an owner decision.** The three Remove-lean modules
  (generator, publish-workflow, google-sheets-csv) are well-evidenced; the five Decide
  modules need explicit sign-off captured in the MR thread before removal.
- When removing a module, remove its paired test in the same commit (see `blueprint.md`
  mapping). **Exception:** for `supplier-intelligence-read-model.ts`, only strip the
  read-model import + its assertions from `tests/ecommerce_supplier_facts_read.test.ts` —
  that test must continue covering the live `lib/ecommerce/supplier-facts-read.ts`.
- If `shopify-pdp-intelligence-generator.ts` is removed, fix the path-string assertion at
  `tests/ecomviper_product_editor_route_contract.test.ts:61`.
- Re-confirm each module's importers with grep before deleting — do not trust the queued list
  blindly; files may have changed.
- "Wire" decisions are OUT of scope — they become separate feature sprints; leave those
  modules untouched.

## Verification gate (after each removal)

Baseline: 155 tsc errors / 10 vitest failures (all pre-existing). `pnpm` is broken in this
sandbox — use `node_modules/.bin/` binaries directly. `next build` can't run locally
(root-owned `.env.production.local`) — rely on CI.
```
node_modules/.bin/tsc --noEmit 2>&1 | grep -cE "error TS"   # stays 155
node_modules/.bin/vitest run                                 # no NEW failures; removed suites vanish cleanly
```

## Delivery (GitLab flow)

`git switch main && git pull` → branch `chore/ecomviper-test-only-orphan-cleanup` →
per-module commits → push `-o merge_request.create -o merge_request.target=main
-o merge_request.remove_source_branch` → green pipeline → squash-merge → delete
remote+local branch → sync main → update `planning/state.md` with MR #, pipeline, merge SHA,
and the per-module outcome (removed / wired-deferred / kept).

Env note: pushes use `core.sshCommand` → `~/.ssh/id_ed25519` (`ibrains`-owned key on the
`@cloudalien` GitLab account). API merge needs a GitLab PAT (`api` scope) supplied
out-of-band; never commit it.
