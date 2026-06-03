# Handoff Prompt: Dead Export & Import Cleanup

You are the Builder for the queued sprint **Dead Export & Import Cleanup (EcomViper + Brains)**.

Read first, in order:
1. `AGENTS.md` (builder execution contract)
2. `planning/state.md` (find this sprint under Program Status; confirm it is still `QUEUED`)
3. This sprint folder: `requirements.md`, `blueprint.md`, `acceptance-criteria.md`

## Task

Remove the unused exports and imports enumerated in `blueprint.md` from the listed live
modules. This is a **removal-only** sprint — no behavior change, no refactor.

## Hard rules

- These are EXPORTED symbols. Before deleting any one, check whether it is used *inside its
  own defining file* (e.g. an exported interface composed into a live result type). If used
  internally, do NOT delete it — keep it (or drop only the `export` keyword if nothing else
  in scope needs it) and record the decision in the MR description.
- Work in the execution order in `blueprint.md` (G → C/D/E/A-types/F → A-functions → B).
  Group B (`walmart-optimization-rules.ts`) is last and highest-risk — verify each symbol
  against the two live functions (`buildWalmartDocketOptimizationPromptContract`,
  `applyWalmartDocketOptimizationRules`).
- Treat the `aiSelectionCopy` key removals (item F cascade) as OPTIONAL/low-confidence;
  prefer removing only `brainsDockCopy`.

## Verification gate (run after EACH group, and at the end)

Baseline on `main` is **155 tsc errors** and **10 vitest failures** — all pre-existing.
```
node_modules/.bin/tsc --noEmit 2>&1 | grep -cE "error TS"     # must stay 155
node_modules/.bin/vitest run                                   # must stay 10 failed
```
Note: `pnpm` is broken in this sandbox (corepack needs `node:sqlite` on Node 20) — call the
local binaries in `node_modules/.bin/` directly. `next build` cannot run locally
(`.env.production.local` is root-owned) — rely on the CI pipeline for the build check.
If any group raises the count, a candidate was not dead → revert that specific removal.

After all removals, re-grep each removed symbol repo-wide to prove zero references.

## Delivery (GitLab flow)

`git switch main && git pull` → branch `chore/ecomviper-dead-export-cleanup` → grouped commits
→ push with `-o merge_request.create -o merge_request.target=main
-o merge_request.remove_source_branch` → wait for green pipeline → squash-merge → delete
remote+local branch → sync main → update `planning/state.md` with MR #, pipeline result,
merge SHA, branch cleanup, and the count of symbols removed vs. kept-with-reason.

Note on environment: pushes from this repo use `core.sshCommand` pointing at
`~/.ssh/id_ed25519` (an `ibrains`-owned key registered on the `@cloudalien` GitLab account).
Merging via the API needs a GitLab PAT with `api` scope (the operator supplies it out-of-band;
do not commit it).
