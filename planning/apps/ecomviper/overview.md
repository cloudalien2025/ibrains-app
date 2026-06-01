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
