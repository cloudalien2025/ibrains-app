# Blueprint: Test-Only Orphan Modules — Wire-or-Remove

Module → test pairings (delete both together when "Remove" is chosen):

| Module | Test to remove with it |
|---|---|
| `lib/ecomviper/shopify/shopify-pdp-intelligence-generator.ts` | `tests/ecomviper_pdp_intelligence_generation.test.ts` + fix `tests/ecomviper_product_editor_route_contract.test.ts:61` (path-string assertion) |
| `lib/ecomviper/shopify/shopify-product-editor-publish-workflow.ts` | `tests/ecomviper_shopify_product_editor_publish_workflow.test.ts` |
| `lib/ecomviper/suppliers/google-sheets-csv.ts` | `tests/ecomviper_google_sheets_csv.test.ts` |
| `lib/ecomviper/suppliers/rocktomic/supplier-intelligence-read-model.ts` | `tests/ecommerce_supplier_facts_read.test.ts` — CAUTION: this test also exercises the live `lib/ecommerce/supplier-facts-read.ts`. Do NOT delete the whole test file; only remove the `toSupplierFactsReadModelProjection` import + the assertions that use it (the rest of the file must keep covering the live read path). |
| `lib/ecomviper/suppliers/rocktomic/templates-playwright.ts` | `tests/ecomviper_rocktomic_templates_playwright.test.ts` |
| `lib/ecomviper/walmart/walmart-docket-diagnostics.ts` | `tests/ecomviper_walmart_docket_diagnostics.test.ts` |
| `lib/brain-learning/answerOrchestration.ts` | `tests/brain_answer_orchestration.test.ts` |
| `lib/brain-learning/youtubeWatchDiscovery.ts` | `tests/youtube_watch_discovery.test.ts` |

## Pre-removal verification (per module, before deleting)

1. Re-run `grep -rEln "<module-basename>" app lib components tests src scripts` and confirm
   the ONLY non-self importer is the paired test (the candidate list above was verified
   2026-06-03 but re-confirm — these files may change).
2. Check the module exports nothing consumed by a sibling in the same directory.
3. For the read-model: confirm `toSupplierFactsReadModelProjection` is the only thing the
   test pulls from it, and that removing it leaves `ecommerce_supplier_facts_read.test.ts`
   still meaningful for the live module.

## Execution order

1. The three **Remove**-lean modules first (generator, publish-workflow, google-sheets-csv)
   — clearest evidence, includes the route-contract assertion fix.
2. Then each **Decide** module only after the owner has signed off in the MR thread.
3. Verification gate after each removal.

## Notes

- `google-sheets-csv.ts` removal also eliminates the `parseCsvTable`/`findCsvRowBySku`
  duplication of the live `rocktomic-csv-parser.ts` (`parseRfc4180Csv`/`lookupRowBySku`).
- Do not delete `lib/brain-learning/youtubeDiscovery.ts` — it is the LIVE one; only
  `youtubeWatchDiscovery.ts` is the orphan.
