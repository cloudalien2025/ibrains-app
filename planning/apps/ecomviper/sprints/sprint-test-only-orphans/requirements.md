# Sprint: Test-Only Orphan Modules — Wire-or-Remove (EcomViper + Brains)

Status: `QUEUED` (planning-only; not started)
Queued: 2026-06-03 (UTC)
Origin: Deferred tier from the repo cleanup audit (see `planning/state.md` cleanup closures).
Related: depends on / overlaps nothing in the queued `sprint-dead-export-cleanup`, but
`google-sheets-csv.ts` below is the same dead duplicate that the dead-export sprint
deliberately left out of scope.

## Problem

Eight modules are reachable **only from their own unit test** — no production route, CLI
script, or other `lib` module imports them. They are not broken (tests pass), but they are
unwired: either abandoned scaffolding or features that were never connected. Each needs an
explicit **wire-or-remove decision**, then action.

## Candidate modules (verified 2026-06-03: only importer is the listed test)

| Module | Only importer(s) | Audit note | Default lean |
|---|---|---|---|
| `lib/ecomviper/shopify/shopify-pdp-intelligence-generator.ts` | `tests/ecomviper_pdp_intelligence_generation.test.ts` (+ a path-string assertion in `tests/ecomviper_product_editor_route_contract.test.ts:61`) | Superseded — the live PDP route imports `-intelligence`/`-repository`/`-compliance` directly, never the generator. | **Remove** |
| `lib/ecomviper/shopify/shopify-product-editor-publish-workflow.ts` | `tests/ecomviper_shopify_product_editor_publish_workflow.test.ts` | Distinct from the live `shopify-product-publish-service.ts`/`-repository.ts`; looks like an unused dry-run scaffold. | **Remove** |
| `lib/ecomviper/suppliers/google-sheets-csv.ts` | `tests/ecomviper_google_sheets_csv.test.ts` | Dead naive CSV parser; duplicates the live RFC-4180 `rocktomic-csv-parser.ts`. | **Remove** |
| `lib/ecomviper/suppliers/rocktomic/supplier-intelligence-read-model.ts` | `tests/ecommerce_supplier_facts_read.test.ts` (real import + call) | `toSupplierFactsReadModelProjection` not used by the live read path. | **Decide** |
| `lib/ecomviper/suppliers/rocktomic/templates-playwright.ts` | `tests/ecomviper_rocktomic_templates_playwright.test.ts` | `extractTemplateLinksWithPlaywright`; no prod/CLI caller (may be intended offline tooling). | **Decide** |
| `lib/ecomviper/walmart/walmart-docket-diagnostics.ts` | `tests/ecomviper_walmart_docket_diagnostics.test.ts` | `buildWalmartDocketDiagnostics`; distinct from live `walmart-docket-freshness.ts`/`-source-metadata.ts`. | **Decide** |
| `lib/brain-learning/answerOrchestration.ts` | `tests/brain_answer_orchestration.test.ts` | `runCoBrainAnswerOrchestration`; no API/lib wires it. | **Decide** |
| `lib/brain-learning/youtubeWatchDiscovery.ts` | `tests/youtube_watch_discovery.test.ts` | `runYoutubeWatchDiscovery`; distinct from the live `youtubeDiscovery.ts`. | **Decide** |

## Decision required (operator/product owner) — this is NOT a blind-removal sprint

For each module, the owner picks one:
- **Remove** — delete the module AND its dedicated test. For
  `shopify-pdp-intelligence-generator.ts`, also update/remove the path-string assertion at
  `tests/ecomviper_product_editor_route_contract.test.ts:61` (it asserts the file path) so
  that test stays meaningful.
- **Wire** — connect it to its intended production/CLI entry point (out of scope here; if
  chosen, spin a separate feature sprint instead of removing).
- **Keep as scaffolding** — leave untouched, but add a one-line `// scaffolding: not yet
  wired (see planning)` note so it isn't re-flagged by the next audit.

The three **Remove**-lean modules are well-evidenced as superseded/duplicate; the five
**Decide** modules need an explicit owner call before any deletion.

## Scope (out)

- The dead-export-in-live-modules tier (separate queued sprint).
- Stale docs (separate queued sprint).
- Wiring work itself (becomes its own feature sprint if "Wire" is chosen for any module).

## Verification gate

After any removals: `tsc --noEmit` and `vitest` must drop ONLY the removed modules' tests
and otherwise match baseline (155 tsc errors; 10 pre-existing vitest failures, none of which
are the removed modules' suites). No new failures; no orphaned test files left behind.
