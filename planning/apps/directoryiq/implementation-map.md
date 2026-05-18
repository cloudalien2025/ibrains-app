# DirectoryIQ Implementation Map

Last updated: 2026-05-18 (UTC)

## Purpose

Map DirectoryIQ planning concepts to concrete code locations.

## App Routes

- Root and shell: `app/apps/directoryiq/layout.tsx`, `app/apps/directoryiq/page.tsx`
- Dashboard client: `app/apps/directoryiq/directoryiq-dashboard-client.tsx`
- Listings: `app/apps/directoryiq/listings/*`
- Listing optimization: `app/apps/directoryiq/listings/[listingId]/listing-optimization-client.tsx`
- Authority: `app/apps/directoryiq/authority/*`
- Graph integrity: `app/apps/directoryiq/graph-integrity/*`
- Signal sources: `app/apps/directoryiq/signal-sources/*`
- Settings/versions: `app/apps/directoryiq/settings/*`, `app/apps/directoryiq/versions/*`

## Shared UI Components Used by DirectoryIQ

- `components/directoryiq/DirectoryIqMobileNav.tsx`
- `components/directoryiq/DirectoryIqTopNav.tsx`
- `components/ecomviper/HudCard.tsx`

## Navigation Contracts

- DirectoryIQ nav model: `lib/directoryiq/navItems.ts`
- App launcher surface: `app/apps/page.tsx`

## API Route Families

DirectoryIQ API namespace:

- Dashboard/listings: `app/api/directoryiq/dashboard`, `app/api/directoryiq/listings`
- Authority/step workflows: `app/api/directoryiq/authority/*`
- Graph/integrity: `app/api/directoryiq/graph/*`, `app/api/directoryiq/graph-integrity/*`
- Signal sources/sites/integrations: `app/api/directoryiq/signal-sources`, `app/api/directoryiq/sites`, `app/api/directoryiq/integrations`
- Jobs/settings/versions: `app/api/directoryiq/jobs`, `app/api/directoryiq/settings`, `app/api/directoryiq/versions`
- Ingestion entry points: `app/api/ingest/directoryiq/run`, `app/api/directoryiq/ingest/*`

## Library and Domain Layers

- DirectoryIQ library layer: `lib/directoryiq/*`
- Domain services/repositories: `src/directoryiq/services/*`, `src/directoryiq/repositories/*`
- Graph and leak services: `src/directoryiq/graph/*`, `src/directoryiq/leaks/*`

## Schema and Data Artifacts

- DirectoryIQ schema and ownership SQL: `db/directoryiq/*`
- Shared migration stream including DirectoryIQ artifacts: `db/migrations/*`

## Tests

- DirectoryIQ-focused tests: `tests/directoryiq_*`
- Shared route/auth/layout contracts relevant when shell/framework files change:
  - `tests/apps_layout_auth_contract.test.tsx`
  - `tests/frontdoor_*`
  - relevant EcomViper/Walmart route contracts when shared components are touched
