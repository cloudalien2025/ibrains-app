# DirectoryIQ Overview

Last updated: 2026-05-18 (UTC)

DirectoryIQ is an operator workspace for improving directory-backed listing authority/readiness using guarded workflows and integration-aware ingestion.

## Current Status

- Product intent baseline is implementation-derived in `planning/apps/directoryiq/product-intent.md`.
- DirectoryIQ planning now includes architecture/builder foundation docs grounded in observed UI/API/model/test behavior.
- Sprint `sprint-001-directoryiq-foundation` establishes planning foundations and a workspace-shell alignment baseline.

## Current Planning Docs

- `planning/apps/directoryiq/product-intent.md`
- `planning/apps/directoryiq/architecture.md`
- `planning/apps/directoryiq/builder.md`
- `planning/apps/directoryiq/implementation-map.md`
- `planning/apps/directoryiq/testing.md`
- `planning/apps/directoryiq/roadmap.md`

## What This File Covers

This overview is a high-level orientation document.

- Use this file for current state, workflow area map, and sprint direction.
- Use `planning/apps/directoryiq/product-intent.md` for detailed implementation-derived contracts, gaps, and evidence.
- Use `planning/apps/directoryiq/architecture.md` and `planning/apps/directoryiq/implementation-map.md` for codebase mapping and architecture boundaries.

## Major Workflow Areas (from product intent)

- Dashboard/readiness monitoring and listing-level optimization entry.
- Signal-source and BD site configuration plus verification.
- Ingestion lifecycle into DirectoryIQ-owned data stores.
- Step 1-3 listing workflow (support discovery, support creation/publish guards, listing upgrade push guards).
- Authority and graph-integrity scan/remediation loops.

## Next Sprint Direction

Current active sprint: `sprint-001-directoryiq-foundation`.

Scope remains foundation-only: planning architecture/builder alignment plus app-shell layout alignment without API or data-semantic changes.

## Source-of-Truth References

Planning:
- `planning/state.md`
- `planning/apps/directoryiq/product-intent.md`

Implementation evidence families:
- `app/apps/directoryiq/*`
- `app/api/directoryiq/*`
- `lib/directoryiq/*`
- `tests/directoryiq_*`
