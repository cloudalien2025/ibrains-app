# Supplement Facts Input Mapping Hotfix (Phase 6.2.2-B)

Last updated: 2026-06-01 (UTC)

## Purpose

Normalize all-product copywriting input mapping so supplement-facts evidence is preserved from real source schema instead of being dropped by shape mismatch.

## Root Cause Confirmed

Primary defect from Phase 6.2.2-A:

- `read_model_to_copywriting_input_gap` in all-product preparation path (`copywriting-agent-data.ts`).

Specific mismatch families:

- `sourceFacts.supplementFacts.*` nested fields were not mapped to `ProductCopywritingInput.supplementFacts`.
- `assets.json` top-level URLs (`coaUrl`, `labelTemplateUrl`, `labelTemplateAiUrl`, `mockupUrl`) were treated as nested objects and resolved empty.
- AI-label evidence rows were not included in all-product input source evidence.
- Missing-data flags were overly broad and treated partial facts as fully missing.

## Hotfix Scope

Included:

- all-product source mapping normalization in `lib/ecomviper/copywriting-agent/copywriting-agent-data.ts`
- more precise missing-data flags in input contract/builder
- plain notice mapping updates in runner
- focused regression tests for ROC123-like data shape and partial-facts behavior

Not included:

- Product Editor layout changes
- supplier import/OCR/.ai extraction/source fetch changes
- DB schema changes
- auto-save/auto-publish behavior changes
- duplicate route restoration

## Input Contract Changes

`ProductCopywritingInput.sourceEvidence` now tracks:

- `supplementFactsImagePresent`
- `aiLabelTextEvidenceStatus`
- `aiLabelTextNeedsReview`
- `structuredSupplementFactsPresent`
- `supplementFactsSource` (`db|artifact|ai_label_text|image_only|none|unknown`)

`ProductCopywritingInput.missingData` now tracks:

- `structuredSupplementFactsMissing`
- `servingSizeMissing`
- `servingsPerContainerMissing`
- `ingredientAmountsMissing`
- `supplementFactsImageOnly`
- `supplementFactsTextNeedsReview`

`supplementFactsMissing` is now reserved for true no-evidence cases:

- no structured facts
- no AI label-text evidence
- no supplement-facts image evidence

## Plain Notice Behavior

Runner now emits specific notices when applicable:

- `Serving size missing.`
- `Servings per container missing.`
- `Ingredient amounts missing.`
- `Supplement Facts image available; ingredient details are not structured yet.`
- `Supplement Facts text needs review.`

And preserves existing notices:

- `COA missing.`
- `Pricing missing.`
- `Inventory missing.`
- `Supplier match not found.`
- `Supplement Facts missing.` (true no-evidence only)

## Before / After (All-Product Dry-Run)

From `npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`:

- before (Phase 6.2.2-A):  
  `supplementFactsMissing=164`, `coaMissing=164`, `pricingMissing=164`
- after (Phase 6.2.2-B hotfix):  
  `supplementFactsMissing=16`, `coaMissing=40`, `pricingMissing=22`

## ROC123 Outcome (No Hardcoding)

ROC123-like conditions now map as:

- structured ingredient facts present (active ingredients + amounts)
- serving fields may still be missing
- `supplementFactsMissing=false`
- `ingredientFactsMissing=false`
- `ingredientAmountsMissing=false` when amounts are present
- serving-field notices are emitted instead of blanket `Supplement Facts missing.`

## Guardrails Preserved

- Generate Intelligence remains review-only.
- No auto-save / auto-publish.
- No model call during Product Editor render.
- No supplier writes/imports/migrations from this hotfix.
- No OCR/.ai extraction/source fetch added.
- No duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restored.
