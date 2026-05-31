# Shared Ecommerce Database Foundation (Phase 1.5)

Last updated: 2026-05-31 (UTC)

## Canonical Database Boundary

- `ibrains-ecommerce-prod-postgres` is the target shared ecommerce platform database.
- `ecomviper-prod-postgres` is legacy/deprecated and should be ignored for current architecture work.
- `DATABASE_URL` remains the core iBrains platform database connection (users, auth/session, shell/global concerns, billing/global controls).
- `ECOMMERCE_DATABASE_URL` is the ecommerce platform database connection for shared commerce data and future cross-app ecommerce workloads.
- Ecommerce brains must move to `ECOMMERCE_DATABASE_URL` only through explicit future migration/binding phases.

## Phase 1.5 Constraints

- No production data migration.
- No schema migration to production databases.
- No Rocktomic import into database.
- No runtime route/component behavior switch.
- No Product Editor or Generate Intelligence behavior changes.

## Current Repository Database Access Pattern

Primary ecommerce-access entrypoint today:

- `app/api/ecomviper/_utils/db.ts` -> `getDirectoryIqPool()` from `lib/brain-learning/db.ts`
- `getDirectoryIqPool()` currently resolves `DIRECTORYIQ_DATABASE_URL || DATABASE_URL`.

This means ecommerce-domain modules are still coupled to the legacy shared pool path and are not yet bound to `ECOMMERCE_DATABASE_URL`.

## Current Ecommerce-Oriented Usage Inventory

Modules currently using the shared ecommerce query path (`@/app/api/ecomviper/_utils/db`):

- Shopify repos/settings:
  - `lib/ecomviper/shopify/shopify-connection.ts`
  - `lib/ecomviper/shopify/shopify-product-repository.ts`
  - `lib/ecomviper/shopify/shopify-pdp-intelligence-repository.ts`
  - `lib/ecomviper/shopify/shopify-product-publish-repository.ts`
  - `lib/ecomviper/shopify/openai-connection.ts`
  - `lib/ecomviper/shopify/serpapi-connection.ts`
  - `lib/ecomviper/settings/supplier-membership.ts`
- Walmart repos/settings:
  - `lib/ecomviper/walmart/walmart-connection-repository.ts`
  - `lib/ecomviper/walmart/walmart-product-repository.ts`
  - `lib/ecomviper/walmart/walmart-draft-repository.ts`
  - `lib/ecomviper/walmart/walmart-generated-media-store.ts`
  - `lib/ecomviper/walmart/walmart-openai-connection.ts`
  - `lib/ecomviper/walmart/walmart-serpapi-connection.ts`
- Supplier normalized store:
  - `lib/ecomviper/dropshipping/rocktomic-normalized-store.ts`
- Studio/Image Studio-adjacent persistence currently on same path:
  - `lib/studio/domara/ai-channel-engine/database-repository.ts`
  - `lib/studio/domara/campaign-repository.ts`
- Admin reads that surface ecommerce supplier intelligence:
  - `lib/admin/ecomviper/supplier-intelligence.ts`

Brain route observations:

- `/optiwal` currently consumes Walmart logic that persists through the same shared DB path.
- `/optibay` is currently mock-first and has no direct DB repository binding in route surface.
- `/optizon` currently has no direct ecommerce DB repository binding in route surface.

## Ecommerce-Related Tables Found In Repo

From migrations/runtime repository code:

- `directoryiq_signal_source_credentials` (shared credential table currently used by ecommerce integrations)
- `marketplace_connections`
- `shopify_products`
- `shopify_product_import_state`
- `shopify_pdp_intelligence`
- `shopify_publish_attempts`
- `walmart_products`
- `walmart_product_import_state`
- `walmart_drafts`
- `ecomviper_walmart_generated_media`
- `supplier_products_normalized`
- `supplier_inventory_normalized`
- `supplier_pricing_normalized`
- `supplier_assets_normalized`
- `supplier_source_sync_status`
- `supplier_source_sync_runs`
- `supplier_source_sync_locks`
- `casahud_projects`
- `casahud_generation_runs`
- `casahud_run_stage_outputs`
- `casahud_run_outputs`
- `casahud_youtube_research_results`
- `casahud_title_candidates`
- `casahud_content_strategies`
- `casahud_listing_discovery_results`
- `casahud_imported_listings`
- `casahud_listing_media_assets`
- `casahud_listing_validation_results`
- `casahud_location_enrichments`
- `casahud_script_outputs`
- `casahud_storyboards`
- `casahud_render_plans`
- `casahud_render_jobs`
- `casahud_rendered_video_outputs`
- `casahud_youtube_packages`
- `casahud_review_states`
- `casahud_publish_jobs`
- `casahud_integration_status_snapshots`

## Boundary Classification (Current Targeting)

Likely core iBrains platform concerns (stay on `DATABASE_URL`):

- user/session/auth records
- global shell/permissions/billing
- non-ecommerce cross-brain platform tables

Likely ecommerce-platform concerns (eventual move toward `ECOMMERCE_DATABASE_URL`):

- supplier normalized data and supplier sync state
- Shopify/Walmart product, listing, draft, and publish state
- marketplace account connections and ecommerce connector credentials
- generated ecommerce media/assets and image jobs
- channel optimization outputs and generated commerce content
- future OptiBay/OptiWal/Optizon shared ecommerce records

## Forward Path (Not Part Of Phase 1.5)

- Phase 2+ should introduce explicit repository-level rebinding/migration phases from current shared pool path to `ECOMMERCE_DATABASE_URL`.
- Each phase must be scoped by table family and runtime path with rollback safety.
- Legacy `ecomviper-prod-postgres` remains out of scope unless a future explicit recovery sprint identifies specific must-preserve records.

## Phase 2 Clarification

- Phase 2 Rocktomic validation policy is package/offline quality gating only.
- Phase 2 does not import validated supplier data into `ibrains-ecommerce-prod-postgres`.
- Phase 2 does not change runtime database binding behavior.

## Phase 4 Preview

- Phase 4 is the intended phase for controlled import/read binding of validated supplier data into the shared ecommerce database.
