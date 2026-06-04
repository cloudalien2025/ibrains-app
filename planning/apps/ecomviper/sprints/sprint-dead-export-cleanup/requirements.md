# Sprint: Dead Export & Import Cleanup (EcomViper + Brains)

Status: `QUEUED` (planning-only; not started)
Queued: 2026-06-03 (UTC)
Origin: Follow-up tier from the repo cleanup audit (see `planning/state.md` →
"Repo Cleanup Sprint" / "Repo Hygiene Sprint" closures). The zero-risk orphaned-file
tier shipped in MR `!317`; this sprint covers the deferred **dead-exports-in-live-modules** tier.

## Problem

Several live, actively-imported modules export symbols (functions, consts, types)
that are never imported anywhere else in the repo. They are dead weight that
inflates the public surface of these modules and obscures what is actually wired.
This sprint removes the genuinely-unused exports without touching any live behavior.

## Scope (in)

Remove the unused exports / imports listed in `blueprint.md`, spanning:
- `lib/ecomviper/walmart/walmart-products.ts`
- `lib/ecomviper/walmart/walmart-optimization-rules.ts`
- `lib/ecomviper/walmart/serpapi-walmart-images.ts`
- `lib/ecomviper/walmart/walmart-import-enrichment.ts`
- `lib/ecomviper/shopify/shopify-live-hydrator.ts`
- `lib/brains/brainCatalog.ts` (+ cascading unused `lib/copy/aiSelectionCopy.ts` keys)
- Two unused imports (`copywriting-agent-input-builder.ts`, `master-package-builder.ts`)

All candidates were verified at queue time as having **zero references outside their
own defining file** (word-boundary repo-wide grep across `app/ lib/ components/ tests/ src/ scripts/ types/`).

## Scope (out) — deliberately excluded

- **Test-only "production orphans"** (e.g. `lib/brain-learning/answerOrchestration.ts`,
  `youtubeWatchDiscovery.ts`, and the six test-covered `lib/ecomviper` modules incl.
  `suppliers/google-sheets-csv.ts`). Those have dedicated tests and require a
  delete-code-plus-test decision — they belong to a separate follow-up sprint.
- Stale `docs/directoryiq-*` migration docs.
- Any behavior change, refactor, or rename. Removal only.

## Risk & nuance (must be honored)

These are **exported** symbols. "No external importer" ≠ "deletable" for **types**:
an exported interface may be used *internally* as a field type of another type that
IS live (e.g. a sub-type composed into a used result type). Each candidate must get a
per-symbol **intra-file usage check** before removal:
- Symbol unused even within its own file → delete it.
- Symbol used only internally → it is over-exported, not dead; drop the `export`
  keyword only if nothing else in scope needs it, otherwise leave as-is and note it.
- When in doubt, leave it and record why. This sprint must not delete anything reachable.

## Verification gate

`tsc --noEmit` error count and `vitest` pass/fail counts must be **identical** to the
pre-sprint baseline (currently 155 tsc errors / 10 vitest failures — all pre-existing).
Any new error means a candidate was not actually dead → revert that removal.
