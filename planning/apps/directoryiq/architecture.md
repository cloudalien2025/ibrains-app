# DirectoryIQ Architecture

Last updated: 2026-05-18 (UTC)

## Purpose

This file documents the current implementation architecture for DirectoryIQ from in-repo source evidence. It is not a net-new feature spec.

## Runtime Route Surface

Primary app route: `/directoryiq`

Current route families under `app/directoryiq`:

- Dashboard: `page.tsx`, `directoryiq-dashboard-client.tsx`
- Listings: `listings/`, `listings/[listingId]/`
- Authority: `authority/` and `authority-support/`
- Graph integrity: `graph-integrity/`
- Signal sources and integrations: `signal-sources/`, `integrations/`
- Settings and versions: `settings/`, `versions/`

## Workspace Shell Foundation

DirectoryIQ now uses a workspace shell layout pattern aligned to EcomViper/Walmart structure:

- left sidebar navigation for current route areas
- right workspace content region for route content
- mobile nav retained for small screens

Shell scope is layout/presentation only. Existing DirectoryIQ behavior and API contracts are preserved.

## Architecture Layers (Current)

1. App shell and route clients
- React/Next route clients render operator workflow surfaces.
- Dashboard and listing clients consume local route handlers.

2. API route handlers
- DirectoryIQ handlers under `app/api/directoryiq/*` provide dashboard, listing, authority, graph, signal-source, and job endpoints.
- Some families run local-first while selected routes proxy to external runtime paths.

3. Libraries and domain services
- `lib/directoryiq/*` provides workflow contracts, ingestion utilities, settings/readiness helpers, and route utilities.
- `src/directoryiq/*` contains graph/integrity and domain service/repository layers used by API handlers.

4. Persistence and contracts
- SQL artifacts in `db/directoryiq/*` and `db/migrations/*` define current schema and migration baseline.
- Runtime fallback strategies still exist in some pathways where DB/runtime availability differs.

## Command-Center Boundaries

In scope for current shell/foundation:

- navigation clarity across existing DirectoryIQ surfaces
- stable workspace frame for operators
- planning evidence and builder guardrails

Out of scope in this sprint:

- new ingestion automation logic
- new publish/sync semantics
- API contract redesign
- schema migration programs

## Source-of-Truth Files

Planning:

- `planning/apps/directoryiq/overview.md`
- `planning/apps/directoryiq/product-intent.md`
- `planning/apps/directoryiq/sprints/sprint-001-directoryiq-foundation/*`

Implementation:

- `app/directoryiq/*`
- `app/api/directoryiq/*`
- `lib/directoryiq/*`
- `src/directoryiq/*`
- `tests/directoryiq_*`
