# Blueprint: Dead Export & Import Cleanup

All line numbers are as of 2026-06-03 (UTC) on `main` (these files were NOT touched by
MR `!317`/`!318`, so numbers should still hold — confirm before editing). Every symbol
below was verified `DEAD` = zero references outside its own file.

## A. `lib/ecomviper/walmart/walmart-products.ts`

Unused functions:
- `getWalmartProductBySku` (~L203) — superseded by the `...ForUser` variant used everywhere.
- `getEcomViperMarketplaceMetricsForUser` (~L3801)
- `getEcomViperMarketplaceMetrics` (~L3815)
- `logWalmartProductSync` (~L3829)

Unused types:
- `WalmartLocalProductRemovalResult` (~L253)
- `WalmartPostImportLiveHydrationQueueResult` (~L3091)
- `WalmartHistoricalContentBackfillQueueResult` (~L3097)

## B. `lib/ecomviper/walmart/walmart-optimization-rules.ts`

Module is live (`buildWalmartDocketOptimizationPromptContract`, `applyWalmartDocketOptimizationRules`
are consumed by `walmart-ai-optimizer.ts`). These standalone exports appear superseded by
the consolidated `applyWalmartDocketOptimizationRules` — **verify each is not called by the
two live functions before removing** (highest intra-file-usage risk in the sprint):
- Functions: `cleanWalmartOptimizedCopy` (~L432), `removeUnsupportedFlavorClaims` (~L471),
  `validateWalmartOptimizedCopy` (~L505), `validateWalmartOptimizedDocket` (~L863),
  `scoreWalmartOptimizedDocket` (~L985)
- Types/consts: `WalmartFieldOptimizationRule` (~L56), `WalmartDocketOptimizationRules` const (~L72),
  `WalmartDocketOptimizationInput` (~L160), `WalmartDocketOptimizationOutput` (~L172),
  `WalmartOptimizationRuleResult` (~L227)

## C. `lib/ecomviper/walmart/serpapi-walmart-images.ts`

Four unused exported types (module otherwise live):
- `WalmartPublicListingImageResolution` (~L78), `WalmartSearchCandidate` (~L93),
  `SerpApiWalmartBrandSearchHarvestResult` (~L122), `SerpApiWalmartBrandSearchMatchResult` (~L133)

## D. `lib/ecomviper/walmart/walmart-import-enrichment.ts`

Two unused exported types (module otherwise live):
- `WalmartPublicImportEnrichmentProgress`, `WalmartPublicImportEnrichmentResult`

## E. `lib/ecomviper/shopify/shopify-live-hydrator.ts`

Five unused exported summary/telemetry types. NOTE: `ShopifyLiveHydrationResult` (also
exported) IS live (7 refs) — do not touch it, and check whether any of these five are
composed into it as field types before removing:
- `ShopifyLiveShopSummary`, `ShopifyLiveCollectionSummary`, `ShopifyLivePageSummary`,
  `ShopifyLiveBlogArticleSummary`, `ShopifyLiveHydrationTelemetry`

## F. `lib/brains/brainCatalog.ts` + `lib/copy/aiSelectionCopy.ts`

- `brainCatalog.ts:143` `export const brainsDockCopy = aiSelectionCopy.brainsDock;` — zero consumers.
- Cascade: with `brainsDockCopy` gone, the `.brainsDock` key in `lib/copy/aiSelectionCopy.ts` is
  also unread. The `.directoryiq` / `.ecomviper` / `.studio` keys are already unread today.
  LOW confidence (config-like data) — treat removal of the `aiSelectionCopy` keys as OPTIONAL;
  prefer removing only `brainsDockCopy` unless the whole `aiSelectionCopy` object proves dead.

## G. Unused imports (trivial, safe)

- `lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts:3` —
  `import type { SupplierFactsPanelViewModel } ...` never used → remove line.
- `lib/ecomviper/suppliers/rocktomic/master-package-builder.ts:6` —
  `import { parseRfc4180Csv } ...` never used → remove line.

## Execution order (low-risk → higher-risk)

1. G (unused imports) — trivial.
2. C, D, E, A-types, F (`brainsDockCopy`) — pure type/const removals.
3. A-functions — function removals.
4. B — last; highest intra-file-usage risk, verify each against the two live functions.

Run the verification gate (`tsc --noEmit`, `vitest`) after each group, not just at the end,
so a regression localizes to the group that caused it.
