# Phase 6.2.2-A Supplement Facts / Missing Data Audit (All Products)

Date: 2026-06-01 (UTC)
Scope: Audit only. No app/runtime behavior changes.

## Scope and Constraints Applied

- Audited all discoverable Rocktomic SKUs from latest package + shared ecommerce DB.
- Did not modify app runtime code, prompts, UI, DB schema, or imports.
- Did not run OCR or source package rebuild/import.
- DB access was read-only (`SELECT` only) through `ECOMMERCE_DATABASE_URL`.

## Data Sources Used

- Package artifacts under `data/ecomviper/suppliers/rocktomic/latest/*`
- Shared ecommerce DB tables:
  - `ecommerce_supplier_products`
  - `ecommerce_supplier_product_facts`
  - `ecommerce_supplier_pricing`
  - `ecommerce_supplier_inventory`
  - `ecommerce_supplier_assets`
  - `ecommerce_supplier_validation_results`
- Copywriting all-product preparation path behavior:
  - `npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`
  - `lib/ecomviper/copywriting-agent/copywriting-agent-data.ts`

## Key Audit Result

Generate Intelligence missing-data behavior is dominated by a mapping/data-contract gap in the all-product input path, not by truly absent evidence across catalog.

- `164/164` all-product prepared inputs are currently flagged `supplementFactsMissing=true`.
- `148/164` of those are incorrect classifications (facts evidence exists in artifacts and/or DB).
- `130/164` have structured supplement facts in ecommerce DB but no supplement facts in generated `ProductCopywritingInput` (all-product path).

## Summary Metrics

- Total products audited: `164`
- Supplier-backed products: `164`
- Shopify-only/unmatched in this audit set: `0`
- Supplement products: `164`
- Supplement Facts missing accurate: `16`
- Facts image available but structured facts missing: `18`
- AI label text available but not mapped into copywriting input path: `147`
- Structured facts in artifacts but DB missing: `0`
- Structured facts in DB but input missing: `130`
- Input missing despite evidence existing: `148`
- Missing COA: `40`
- Missing pricing: `0`
- Missing inventory: `0`
- Likely weak/unsafe ingredient copy (missing flags): `164`

## Category Counts (A-H)

- A Fully structured facts available: `0` (classification precedence routes structured-but-input-missing to E)
- B Facts label/image available, structured missing: `1`
- C AI label text evidence available, not mapped: `17`
- D Structured source facts available, DB missing: `0`
- E DB structured facts available, ProductCopywritingInput missing: `130`
- F No facts evidence: `16`
- G Non-supplement/not applicable: `0`
- H Ambiguous/manual review: `0`

## Top Suspected Root Causes (ranked)

1. `read_model_to_copywriting_input_gap` (`130`)
2. `ai_label_text_mapping_gap` (`17`)
3. `true_missing_source_data` (`16`)
4. `label_text_extraction_gap` (`1`)

## Top 20 Affected SKUs

- ROC010, ROC011, ROC012, ROC013, ROC014, ROC015, ROC016, ROC017, ROC018
- ROC102, ROC105, ROC107M, ROC110M, ROC1120, ROC1125, ROC1205, ROC121, ROC1215, ROC123, ROC126

## Required Questions: Answers

1. Products with Supplement Facts image/label assets: `148` (supplier label/template evidence in package/DB). Shopify-specific image-role audit was not available from offline artifacts.
2. Products with AI label text evidence: `147`
3. Products with parsed/structured supplement facts (artifacts): `130`
4. Serving size present (artifacts): `69`
5. Servings per container present (artifacts): `68`
6. Active ingredient names present (artifacts): `130`
7. Ingredient amounts present (artifacts): `112`
8. Other ingredients present: sparse; mostly absent in current structured outputs
9. Suggested use/directions present: sparse; mostly absent
10. Warnings present: sparse; mostly absent
11. COA links present: `124`
12. Pricing present: `164`
13. Inventory present: `164`
14. Shopify-supplier match status in this audit dataset: supplier-backed SKU set; no unmatched rows in audited set
15. Incorrectly classified as Supplement Facts missing despite evidence: `148`
16. Label image evidence but no structured extracted facts: `18`
17. AI label text evidence but copywriting input not using it: `147`
18. Structured source facts in artifacts but not ecommerce DB: `0`
19. Structured source facts in ecommerce DB but not ProductCopywritingInput: `130`
20. Source data in supplier snapshot/assets but not Generate Intelligence input: `148`

Note on Shopify Product Editor asset-tab fields: this audit used supplier package + shared ecommerce DB + all-product input prep path. Full per-product Shopify asset-role attribution (for every signed-in Product Editor row) requires authenticated Shopify workspace enumeration and was out of scope for this offline audit pass.

## ROC123 / Oxy-Burn Deep Dive

Product: `/ecomviper/products/opa-oxy-burn-thermogenic-support`
SKU: `ROC123`

Evidence locations:

- Facts/label asset exists: yes (`labelTemplateAiUrl`, `mockupTemplateTifUrl` present in `assets.json` and DB assets table)
- AI label text evidence exists: yes (`ai-label-text-evidence.json`, `extractionStatus: reused_cached`)
- Structured supplement facts in artifact: yes (active ingredients + amount-per-serving arrays present)
- Structured supplement facts in DB: yes (`active_ingredients_count=1`, `amount_per_serving_count=4`)
- Serving size and servings/container: absent in both artifact + DB for this SKU

Where missing flag is introduced:

- In all-product copywriting data path (`lib/ecomviper/copywriting-agent/copywriting-agent-data.ts`), source row mapping expects top-level source fields (`servingSize`, `activeIngredients`, `amountPerServing`) and nested asset fields (`assets.coa.url`, `assets.labelTemplate.url`), while current artifact shape is primarily nested under `sourceFacts.supplementFacts` and top-level asset URLs (`coaUrl`, `labelTemplateUrl`).
- Result: ROC123 input loses available structured facts and is marked `supplementFactsMissing=true`, `ingredientFactsMissing=true`, with notices including `Supplement Facts missing.`

Suspected root cause for ROC123:

- Primary: `read_model_to_copywriting_input_gap` (data-contract mismatch in all-product input preparation)
- Secondary: low-confidence AI extraction quality (`needsReview=true`, parse warnings include missing serving size/servings per container)

Recommended next fix lane (separate task, not in this audit):

- `read_model_to_copywriting_input_gap` + `ai_label_text_mapping_gap`
- Specifically align all-product input builder mapping to actual artifact/DB schema before setting missing-data flags.

## Concrete Mapping Gap Evidence (code)

In `lib/ecomviper/copywriting-agent/copywriting-agent-data.ts`:

- Source facts expected as top-level fields (`servingSize`, `activeIngredients`, `amountPerServing`) at lines ~86-91.
- Assets expected as nested objects (`assets.coa.url`, `assets.labelTemplate.url`) at lines ~97 and ~159.
- Actual package shape uses nested supplement facts object (`sourceFacts.supplementFacts.*`) and top-level asset URLs (`coaUrl`, `labelTemplateUrl`).

## Commands and Verification Notes

Executed:

- `npm run ecomviper:copywriting-agent:prepare -- --fixtures --dry-run`
- `npm run ecomviper:copywriting-agent:evaluate -- --fixtures --dry-run`
- `npm run ecomviper:copywriting-agent:prepare -- --all --dry-run`
- `npm run ecomviper:copywriting-agent:evaluate -- --all --dry-run`
- Read-only `psql` queries against `ecommerce_supplier_*`

Observed:

- All-product dry-run currently reports `supplementFactsMissing: 164` and `pricingMissing: 164`.
- `npm run ecommerce:verify-rocktomic-import` failed in this environment due TLS chain issue (`self-signed certificate in certificate chain`) despite successful read-only `psql` access.

## Audit Artifacts

Generated:

- `data/ecomviper/copywriting-agent/latest/missing-data-audit.json`
- `data/ecomviper/copywriting-agent/latest/missing-data-audit.csv`
- `data/ecomviper/copywriting-agent/latest/missing-data-audit-summary.json`

These are audit outputs only.

## No-Change Confirmation

- No application runtime behavior was changed.
- No DB writes/imports/migrations were run.
- No Product Editor/Generate Intelligence behavior was changed in this task.

## Phase 6.2.2-B Follow-On Status

Phase 6.2.2-B implementation addresses the primary audit root cause (`read_model_to_copywriting_input_gap`) by normalizing nested supplement-facts and source-evidence mapping in all-product input preparation.

Before/after all-product dry-run (`prepare --all --dry-run`) from Phase 6.2.2-B branch:

- before: `supplementFactsMissing=164`
- after: `supplementFactsMissing=16`

This confirms the audit’s Category E failure class is substantially reduced via mapping normalization rather than source rebuild/import.
