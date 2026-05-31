# Rocktomic Admin Audit Visibility (Phase 3)

Last updated: 2026-05-31 (UTC)

## Purpose

Phase 3 adds read-only admin visibility for the offline Rocktomic package and Phase 2 validation outputs.

Primary operator route:

- `/admin/ecomviper/suppliers/rocktomic/audit`

## Scope Boundary (Phase 3)

- Read-only admin visibility only.
- Reads offline package artifacts from `data/ecomviper/suppliers/rocktomic/`.
- No source fetching, OCR, OpenAI calls, extraction, or validation side effects.
- No database import into `ibrains-ecommerce-prod-postgres`.
- No database schema migration.
- No Product Editor, Generate Intelligence, Image Studio, OptiBay, OptiWal, or Optizon runtime behavior changes.

## Admin Data Source

Server-only package reader:

- `lib/ecomviper/suppliers/rocktomic-admin-audit.ts`

Reader behavior:

- Reads `sources.json` and `latest/*` artifacts.
- Reports artifact presence/missing states safely.
- Produces compact admin view model:
  - package status/metadata
  - SKU counts/status rollups
  - coverage summaries
  - package/source defects
  - top SKU defects + SKU preview table
  - source registry summary
  - artifact status table
- Handles missing artifacts gracefully without route crashes.

## Admin Route Contract

`/admin/ecomviper/suppliers/rocktomic/audit` displays:

1. Header/status summary (`pass|pass_with_warnings|fail|unavailable`)
2. KPI cards (discovered/validated/usable/warnings/blocked/extraction errors)
3. Source registry summary
4. Field coverage, blocking coverage, warning coverage
5. Defect summary (package + source + top SKU defects)
6. SKU validation preview table with readiness flags
7. Artifact status and offline package file presence

This surface is operator-focused and read-only.

## Security and Runtime Safety

- Admin route remains protected by existing admin auth (`requireAdmin` + allowlist).
- Signed-out users continue redirect-to-sign-in behavior via existing admin layout guard.
- No new public endpoints are required in this phase.
- No runtime dependency on `ECOMMERCE_DATABASE_URL` for this page.

## Relationship to Database Roadmap

- `DATABASE_URL`: core iBrains platform data boundary (unchanged)
- `ECOMMERCE_DATABASE_URL`: future ecommerce platform DB boundary (unchanged)
- `ecomviper-prod-postgres`: legacy/deprecated/ignored (unchanged)

Phase 3 does not import package data into database; it only exposes package health in admin.

## Forward Phases

- Phase 4: controlled validated supplier data import/read path for shared ecommerce DB.
- Phase 5: Product Editor read-only supplier facts binding.
- Phase 6: Generate Intelligence binding.
- Phase 7: generalized shared ecommerce usage across apps.
