# Acceptance Criteria: Dead Export & Import Cleanup

## Must pass

1. **No behavior change.** Only `export`/symbol/import removals. No edits to logic,
   signatures, or live call sites.
2. **Per-symbol intra-file check done.** For every candidate in `blueprint.md`, the builder
   confirmed it is unused within its own defining file before removal. Symbols found to be
   used internally were NOT deleted (kept, or `export` dropped only if safe) and are listed
   in the MR description with the reason.
3. **Verification gate green vs baseline:**
   - `node_modules/.bin/tsc --noEmit` → **155 errors** (unchanged from baseline; no new errors).
   - `node_modules/.bin/vitest run` → **10 failures** (unchanged; same pre-existing suites).
   - Zero `Cannot find module` / unresolved-symbol errors attributable to the removals.
   - (Local `next build` is blocked by the root-owned `.env.production.local`; rely on CI.)
4. **Re-grep proof.** Each removed symbol re-grepped repo-wide post-removal → zero references.
5. **Scope discipline.** No test-only orphans, docs, or `google-sheets-csv.ts` touched
   (those are out of scope per `requirements.md`).

## Should

- Removals grouped into logical commits (or at least the execution-order groups A–G), so a
  bisect can localize any regression.
- MR description lists exactly which symbols were removed vs. kept-with-reason.

## Definition of done

Clean `main` → branch → grouped removals → gate green after each group → push → MR →
green CI pipeline → squash-merge → delete remote+local branch → `git switch main && git pull`
→ verify clean → update `planning/state.md` (MR number, pipeline result, merge SHA, branch
cleanup, count of symbols removed).
