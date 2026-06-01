# EcomViper Overview

Last updated: 2026-06-01 (UTC)

EcomViper is the iBrains parent app family for multi-channel commerce operations.

## Workspace Route Contract

- `/ecomviper` is the standalone EcomViper brain console for EcomViper-specific workflows.
- OptiBay (`/optibay`), OptiWal (`/optiwal`), and OptiZon (`/optizon`) are standalone commerce brains, not nested `/ecomviper` modules.
- EcomViper console UX may reference other commerce brains only through `/brains` (My Brains), not direct launcher cards/links.

## Shared Shell Contract

- `/ecomviper` and all `/ecomviper/*` pages use the global iBrains header + EcomViper sidebar + workspace layout.
- Global header rules:
  - zero blank space above header
  - iBrains logo links to `/brains`
  - includes Settings, Notifications, signed-in user identity, and Clerk log out
- EcomViper sidebar baseline:
  - Products
  - Image Studio (placeholder)
  - Dropshipping
  - Agentic Visibility (placeholder)
  - Settings

## Channel Planning Structure

Channel-specific planning belongs under:

- `planning/apps/ecomviper/shopify/`
- `planning/apps/ecomviper/walmart/`
- `planning/apps/ecomviper/ebay/`
- `planning/apps/ecomviper/amazon/`

These planning roots are active in the current repository structure.

## Current Channel Surfaces

- Shopify: implemented workspace with established planning/sprint history.
- Walmart: implemented command-center workspace with implementation-derived planning baseline.
- eBay: implemented Phase 1 read-only mock-first dashboard with implementation-derived product intent baseline.
- Amazon: planning and route surface present, broader implementation pending.

## Sprint 006 Foundation Direction

- `/ecomviper` is Shopify-first for this foundation sprint.
- Parent EcomViper workspace now centers on a simple inventory/listings table and PDP editor route flow.
- Hub is not modeled as a separate app concept in this sprint IA.
- Rocktomic is the first dropshipping supplier intelligence source (SKU-match placeholder contract).

## Sprint 007 Foundation Direction

- Rocktomic placeholder contract has been advanced to a supplier intelligence engine foundation.
- `/ecomviper` PDP/editor now consumes Rocktomic SKU-match confidence/reason and supplier fact/status fields.
- Dropshipping -> Rocktomic route is now a dedicated platform-intelligence shell (source status + SKU lookup).

## Sprint 008 Foundation Direction

- `/ecomviper/products/[productId-or-handle]` now includes an AI PDP Intelligence workspace.
- PDP intelligence generation uses Shopify listing facts plus Rocktomic supplier facts when SKU matches.
- Generated intelligence is editable, saved server-side, and reloaded on reopen for the same signed-in user.
- OpenAI generation runs server-side only and degrades safely to `generation_unavailable` when credentials are missing.
- Image Studio remains a placeholder and is deferred to Sprint 009+.

## Product Editor Gallery Standard (Sprint 010)

- `/ecomviper/products/[productId-or-handle]` uses a top hero-gallery model:
  - large primary product image
  - selectable thumbnail gallery
  - compact product summary/action context beside gallery
- Product imagery is part of main workspace content, not sidebar navigation.
- Product Rail is removed from primary layout to avoid duplicate image rails.
- Gallery supports Shopify images plus hosted/generated asset URLs when available.
- Merchant identity zones avoid extraction-debug/internal key wording.

## Product Editor Final Layout Standard (Sprint 010.1)

- Product Editor workspace starts with a hero row:
  - left: Product Gallery
  - right: Product Summary (includes title + shipping)
- No oversized standalone header card above hero.
- Primary edit action row sits inside full-width edit area below hero and uses:
  - `Generate Intelligence`
  - `Save Changes`
  - `Publish`
- `Publish` refers to public `ecomviper.com` publish semantics and may be placeholder-disabled when backend is not enabled.
- Merchant Product Editor UI excludes internal developer diagnostics (for example Workspace Metadata/source debug keys).
- Gallery add-image workflow supports computer upload, URL add, and future Image Studio hook.

## Rocktomic Offline Data Package (Phase 1)

- Added offline supplier package generator for all-SKU audit output:
  - script: `scripts/ecomviper/build_rocktomic_supplier_data.ts`
  - command: `npm run ecomviper:build-rocktomic-supplier-data`
- Package target:
  - `data/ecomviper/suppliers/rocktomic/sources.json`
  - `data/ecomviper/suppliers/rocktomic/latest/*`
- Phase 1 is offline-only and does not change user-facing routes, Product Editor, Generate Intelligence, or admin runtime behavior.

## Shared Ecommerce Database Foundation (Phase 1.5)

- `ibrains-ecommerce-prod-postgres` is the target shared ecommerce platform database for EcomViper + related ecommerce brains/apps.
- `ecomviper-prod-postgres` is legacy/deprecated and ignored unless a future explicit recovery scope identifies required records.
- `DATABASE_URL` remains the core iBrains platform DB connection.
- `ECOMMERCE_DATABASE_URL` is the ecommerce platform DB connection.
- Phase 1.5 is a boundary/inventory/utilities step only:
  - no production data migration
  - no runtime route behavior switch
  - no Product Editor/Generate Intelligence behavior change

Detailed inventory and move-target mapping:

- `planning/apps/ecomviper/ecommerce-database-foundation.md`

## Rocktomic Validation Policy (Phase 2)

- Phase 2 converts the offline Rocktomic package into a formal validation contract:
  - blocking fields vs warning fields
  - SKU usability statuses
  - package promotion status (`pass`, `pass_with_warnings`, `fail`)
  - downstream readiness flags in package output only
- Phase 2 remains offline-only and does not:
  - import supplier data into shared ecommerce DB
  - switch runtime app behavior
  - bind Product Editor/Admin/Image Studio/OptiBay/OptiWal/Optizon to package validation results

Policy source-of-truth:

- `planning/apps/ecomviper/shopify/rocktomic-validation-policy.md`

## Rocktomic Admin Audit Visibility (Phase 3)

- `/admin/ecomviper/suppliers/rocktomic/audit` now renders offline package and validation visibility for operators.
- The page is read-only and consumes package artifacts only:
  - `data/ecomviper/suppliers/rocktomic/sources.json`
  - `data/ecomviper/suppliers/rocktomic/latest/*`
- Phase 3 does not:
  - import supplier data into shared ecommerce DB
  - change Product Editor / Generate Intelligence / Image Studio / OptiBay / OptiWal / Optizon runtime behavior
  - introduce sync buttons or background workers

Admin visibility contract source:

- `planning/apps/ecomviper/shopify/rocktomic-admin-audit-visibility.md`

## Rocktomic Asset + OCR Remediation (Phase 3.5)

- Phase 3.5 upgrades offline package extraction quality for:
  - catalog PDF annotation links (COA + template + pricing-sheet evidence)
  - templates page `.ai`/`.tif` per-SKU assets
  - OCR-derived supplement facts evidence with confidence/review metadata
- Phase 3.5 is still offline-only:
  - no DB import/migration
  - no runtime Product Editor/Generate Intelligence/Image Studio/OptiBay/OptiWal/OptiZon behavior changes
  - no OptiPixel runtime/UI in this phase
- OptiPixel direction:
  - OptiPixel is the future standalone ecommerce image intelligence brain
  - EcomViper/channel apps should eventually consume OptiPixel outputs instead of duplicating image-creation logic

Phase 3.5 contract source:

- `planning/apps/ecomviper/shopify/rocktomic-asset-ocr-remediation.md`

## Rocktomic AI Label Text Extraction (Phase 3.6)

- `.ai` label templates are now the primary supplement-facts extraction path for the offline package when PDF-compatible.
- OCR remains fallback-only for non-PDF/no-extractable AI cases.
- Large `.ai`/`.tif` binaries are not stored permanently; only metadata/evidence/facts are retained.
- New offline artifact:
  - `data/ecomviper/suppliers/rocktomic/latest/ai-label-text-evidence.json`
- Runtime boundaries remain unchanged:
  - no DB import/migration
  - no Product Editor/Generate Intelligence runtime switch
  - no extraction in user-facing routes or admin render

Phase 3.6 contract source:

- `planning/apps/ecomviper/shopify/rocktomic-ai-label-text-extraction.md`

## Shared Ecommerce DB Supplier Package Import (Phase 4)

- Phase 4 introduces the first shared ecommerce supplier-intelligence schema in the shared ecommerce DB:
  - target DB: `ibrains-ecommerce-prod-postgres`
  - connection boundary: `ECOMMERCE_DATABASE_URL` only
  - table family: `ecommerce_supplier_*`
- Phase 4 imports all Rocktomic SKUs from offline package artifacts, including:
  - `usable`
  - `usable_with_warnings`
  - `blocked`
  - `extraction_error`
- Import persists validation status, readiness, defects, source evidence, pricing/inventory/assets, and package import metadata.
- Phase 4 does not switch runtime app behavior:
  - no Product Editor binding changes
  - no Generate Intelligence binding changes
  - no OptiPixel runtime/UI
  - no admin-triggered import button
- Large `.ai`/`.tif` binaries remain remote assets; only metadata/evidence/facts are stored.

Phase 4 contract source:

- `planning/apps/ecomviper/shopify/rocktomic-shared-ecommerce-db-import.md`

## Planning Navigation

For family-level direction, start with:

- `planning/apps/ecomviper/product-intent.md`

For channel-specific implementation truth, use each channel's:

- `overview.md`
- `product-intent.md`
- sprint docs where present

## Rocktomic Validation Policy Calibration (Phase 4.3)

- Phase 4.3 recalibrates validation semantics for Phase 5 ingredient matching readiness.
- Missing COA (`assets.coaUrl`) is now a compliance-evidence warning, not a global ingredient-matching blocker.
- Validation output now includes use-case-specific readiness dimensions:
  - `ingredientMatchingReadiness`
  - `productEditorFactsReadiness`
  - `complianceEvidenceReadiness`
  - `optiPixelAssetReadiness`
  - `channelImageGenerationReadiness`
  - `generateIntelligenceReadiness`
  - `optiBayReadiness`, `optiWalReadiness`, `optiZonReadiness`
- Phase 4.3 updates offline artifacts (`validation-report.json`, `audit.csv`) and read-only admin summaries only.
- Product Editor and Generate Intelligence runtime behavior remain unchanged in this phase.

Phase 4.3 contract source:

- `planning/apps/ecomviper/shopify/rocktomic-validation-policy-calibration.md`

## Product Editor Supplier Facts Binding (Phase 5)

- Shopify Product Editor now reads supplier facts from shared ecommerce DB (`ecommerce_supplier_*`) in read-only mode.
- Canonical Product Editor route for all products/SKUs is:
  - `/ecomviper/products/[productId-or-handle]`
- Mistaken duplicate route family removed globally in Phase 5.1:
  - `/ecomviper/shopify/products/[productId-or-handle]`
- Product Editor matching/readiness gates use calibrated dimensions:
  - `ingredientMatchingReadiness`
  - `productEditorFactsReadiness`
- Missing COA is displayed as compliance warning only and does not block ingredient matching.
- Missing pricing is displayed as pricing readiness warning and does not block ingredient matching.
- No supplier writes/import/sync/extraction/OCR/AI-label processing are triggered from Product Editor render.
- Generate Intelligence behavior remains unchanged in this phase.

Phase 5 contract source:

- `planning/apps/ecomviper/shopify/product-editor-supplier-facts-binding.md`

## Product Editor Default Front/Primary Image Selection (Phase 5.2)

- Canonical merchant-facing Product Editor route remains:
  - `/ecomviper/products/[productId-or-handle]`
- On product open, Product Gallery now defaults to the best front/primary/featured image using deterministic global selection logic.
- Selection behavior is generic for all products/SKUs:
- no SKU/handle hardcoding

## Firecrawl Supplier Intelligence Foundation (Phase 6.3)

- Supplier Intelligence Extractor is now the intended upstream source of truth for supplier facts.
- Firecrawl is introduced as the backbone for controlled source acquisition + structured extraction.
- Foundation command:
  - `npm run ecomviper:rocktomic:supplier-intelligence`
- Phase 6.3 delivers:
  - Firecrawl wrapper with fixture/cache/live modes
  - normalized supplier intelligence schema + provenance model
  - ROC948 proof fixture with structured supplement facts
  - validation/audit artifacts for structured/partial/image_text_only/missing status
- Phase 6.3 preserves runtime safety boundaries:
  - no Product Editor auto-save/auto-publish
  - no model call during page render
  - no production DB writes/imports by extractor
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

## Firecrawl Live Source Parser Calibration (Phase 6.3.1, Local)

- State: `IMPLEMENTED_ONLY`
- Added catalog markdown fallback parser so cache/live markdown can produce SKU records when `scrape.json.records` is sparse.
- Added PyMuPDF evidence helper foundation (local PDF page/link extraction).
- Added Google Sheets CSV helper foundation (CSV export URL + parse + SKU row lookup).
- Added supplier toolbelt doctor command:
  - `npm run ecomviper:supplier-toolbelt:doctor`
- ROC948 cache regression now resolves to `records_extracted=1` and `sourceStatus=needs_review` (metadata present, supplement facts incomplete).

## Generate Intelligence Per-SKU Hydration + Compliance Calibration (Phase 6.2.2-E)

- Added per-SKU parity diagnostics and compare tooling for live supplier-facts hydration triage:
  - `npm run ecomviper:live-supplier-facts:parity -- --sku <SKU>`
  - `npm run ecomviper:live-supplier-facts:compare -- --sku <SKU_A> --compare-sku <SKU_B>`
- Live hydration read diagnostics now expose DB/artifact attempted/found/error state for trace parity.
- Live input source-fact summary now reflects effective merged facts state (`present/missing`) instead of stale source status tags.
- Compliance evaluator now supports source-backed ingredient highlight normalization (including title/supplier-name evidence) and removes unsupported highlights without blocking safe proposals.
- Guardrails remain strict for prohibited disease/treatment/cure/drug-comparison claims and unsupported factual claims.

## Generate Intelligence Live Supplier Facts Hydration (Phase 6.2.2-D, Local)

- Added an explicit server-side supplier-facts hydration layer for live PDP generation input.
- Hydration precedence now enforces:
  1. structured DB facts by SKU
  2. structured artifact fallback (read-only)
  3. AI label-text evidence
  4. image-only evidence
  5. none
- Live trace diagnostics now include supplier facts read source/found/error-code fields.
- Local focused tests and all-product dry-run counts passed with no regression (`supplementFactsMissing=16`).
- Production merge/deploy and signed-in trace/browser verification remain pending for this checkpoint.

## Generate Intelligence Production Hotfix (Phase 6.2.1)

- Phase 6.2.1 is a narrow signed-in production hotfix for Generate Intelligence reliability and messaging.
- Root issue includes incorrect localhost HTTPS proxy behavior on PDP intelligence API path.
- Canonical Generate Intelligence path remains explicit action-only:
  - browser/client request: relative `/api/ecomviper/pdp-intelligence`
- Hotfix preserves Phase 6.2 guardrails:
  - review-only proposal
  - no auto-save
  - no auto-publish
  - no model call during Product Editor page render
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
  - no product-specific branch logic
- Thumbnail interaction remains unchanged:
  - merchants can still click any thumbnail to switch the main image
  - manual selection is not force-reset during same-product interaction
- Non-goals preserved in this phase:
  - no Product Editor layout redesign
  - no Generate Intelligence behavior changes
  - no supplier write/import/sync/extraction/OCR/AI-label runtime behavior changes
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

Phase 5.2 contract source:

- `planning/apps/ecomviper/shopify/product-editor-image-selection.md`

## AI Copywriting Agent Contract + Eval Harness (Phase 6.1)

- Phase 6.1 introduces an all-product AI copywriting contract foundation:
  - typed `ProductCopywritingInput` for every product mode (supplier-backed, Shopify-only, supplement/non-supplement, and missing-data/no-match modes)
  - strict `ProductCopywritingOutput` validation/schema contract
  - source-facts + prompt contract for future structured-output model wiring
  - prepare/evaluate CLI harness for all-product selection (`--all`) and representative regression fixtures
- Golden fixtures are regression-quality representatives only and do not limit architecture scope to specific SKUs.
- Phase 6.1 keeps runtime behavior unchanged:
  - no Product Editor UI changes
  - no live Generate Intelligence behavior changes
  - no model calls from product page render
  - no auto-apply/publish
  - no supplier writes/import/sync/extraction/OCR in this phase
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration
- Future direction:
  - Phase 6.2 wires Generate Intelligence to this contract/model path
  - Phase 6.3 adds model-backed agentic-visibility optimization loop

Phase 6.1 contract sources:

- `planning/apps/ecomviper/shopify/ai-copywriting-agent-contract.md`
- `planning/apps/ecomviper/shopify/generate-intelligence-eval-harness.md`

## Generate Intelligence Copywriting Binding (Phase 6.2)

- Phase 6.2 wires canonical Product Editor `Generate Intelligence` to the Phase 6.1 all-product copywriting contract in review-only mode.
- Runtime behavior:
  - model call executes only when `Generate Intelligence` is explicitly invoked
  - no model call occurs during Product Editor page render
  - output is strict-schema validated before review rendering
- Merchant UX behavior:
  - generated proposal appears in review-only panel/state
  - plain missing-data notices are shown (for example COA/Pricing/Supplement Facts/supplier-match)
  - no internal readiness labels are surfaced in the review proposal UI
  - no auto-save and no auto-publish
- Phase 6.2 boundaries preserved:
  - no Product Editor layout redesign
  - no supplier writes/import/sync/extraction/OCR
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

Phase 6.2 contract source:

- `planning/apps/ecomviper/shopify/generate-intelligence-copywriting-agent-binding.md`

## Supplement Facts Input Mapping Hotfix (Phase 6.2.2-B)

- Phase 6.2.2-B normalizes all-product copywriting input mapping so supplement-facts evidence from the real source schema is preserved in `ProductCopywritingInput`.
- Primary root cause addressed:
  - `read_model_to_copywriting_input_gap` identified in Phase 6.2.2-A audit (148 products had evidence present but input flagged facts missing).
- Mapping now distinguishes true no-evidence from partial/incomplete facts:
  - true missing: `Supplement Facts missing.`
  - partial facts: serving-size/servings/amount notices
  - evidence-only states: image-only and AI-label-text-review notices
- Dry-run prep count improvement (`--all --dry-run`):
  - `supplementFactsMissing` reduced from `164` to `16`
- Guardrails unchanged:
  - Generate Intelligence remains review-only
  - no auto-save
  - no auto-publish
  - no Product Editor layout redesign
  - no supplier import/OCR/.ai extraction/source fetch
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

Phase 6.2.2-B contract source:

- `planning/apps/ecomviper/shopify/supplement-facts-input-mapping-hotfix.md`

## Generate Intelligence Live Source Facts Fix (Phase 6.2.2-C)

- Phase 6.2.2-C fixes the live signed-in Generate Intelligence source-facts parity gap (not an env/proxy issue).
- Live Product Editor Generate Intelligence now merges authoritative supplier facts/evidence from shared ecommerce DB read-model projection with Product Editor state mapping.
- Merchant-facing proposal hardening now blocks internal/debug wording from render paths, including:
  - `source fact references include non-listed facts`
  - OCR directive placeholder wording
  - readiness/debug labels
- Missing-data notices are now enforced as precise and contradiction-safe in live runner output:
  - partial-facts products avoid blanket `Supplement Facts missing.`
  - ingredient amounts notice appears only when truly missing
  - serving-size and servings-per-container are independent notices
- Review-only boundaries remain unchanged:
  - no auto-save
  - no auto-publish
  - no model call during Product Editor render
  - no supplier DB writes/imports/migrations
  - no OCR/.ai extraction/source fetch from Product Editor generate action
  - no duplicate `/ecomviper/shopify/products/[productId-or-handle]` route restoration

Phase 6.2.2-C contract source:

- `planning/apps/ecomviper/shopify/generate-intelligence-live-source-facts-fix.md`
