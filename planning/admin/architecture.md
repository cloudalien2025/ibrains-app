# Admin Architecture

Last updated: 2026-05-31 (UTC)

## Purpose

`/admin` is the internal iBrains operator surface for platform-owned operations.

Primary boundary:

- `/brain` routes are merchant/customer workflows.
- `/admin/brain` routes are internal operations.

## Route Strategy

Admin route hierarchy starts with:

- `/admin`
- `/admin/ecomviper`
- `/admin/ecomviper/suppliers`
- `/admin/ecomviper/suppliers/rocktomic`
- `/admin/ecomviper/suppliers/rocktomic/audit`
- `/admin/ecomviper/suppliers/rocktomic/builds`

Future convention:

- `/admin/optizon`
- `/admin/optibay`
- `/admin/directoryiq`
- `/admin/casaflix`
- `/admin/siteforge`

## Data Boundary

Admin supplier intelligence pages read platform/global normalized rows only:

- `supplier_products_normalized`
- `supplier_inventory_normalized`
- `supplier_pricing_normalized`
- `supplier_assets_normalized`
- `supplier_source_sync_status`
- `supplier_source_sync_runs`
- `supplier_source_sync_locks`

Scope for EcomViper supplier intelligence is `user_id = __global__` + supplier key (currently `rocktomic`).

## Runtime Safety Rules

Admin render paths are read-only and must not trigger:

- source sync execution
- PDF download
- Google Sheets download
- DOCX download
- OCR
- OpenAI calls
- heavy parsing

Admin pages report missing/incomplete states when data is unavailable.

## UI Pattern

Admin uses a lightweight Next.js dashboard pattern with:

- sidebar navigation
- top header and account badge
- metric cards
- diagnostic tables
- audit filters/search
- status badges

No external template import is required; layout follows existing repository Tailwind patterns.

## Roadmap

V1 is read-only diagnostics.

Future controls (build/publish/rollback) must stay gated behind explicit safe execution boundaries and should call dedicated background pipelines instead of route-render execution.
