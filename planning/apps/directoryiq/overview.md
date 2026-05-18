# DirectoryIQ Overview

Last updated: 2026-05-18 (UTC)

DirectoryIQ is an operator workspace for improving directory-backed listing authority/readiness using guarded workflows and integration-aware ingestion.

## Current Status

- Product intent baseline is implementation-derived in `planning/apps/directoryiq/product-intent.md`.
- DirectoryIQ planning now has a source-of-truth intent document grounded in observed UI/API/model/test behavior.
- The next implementation planning target is `sprint-001-directoryiq-foundation`.

## What This File Covers

This overview is a high-level orientation document.

- Use this file for current state, workflow area map, and sprint direction.
- Use `planning/apps/directoryiq/product-intent.md` for detailed implementation-derived contracts, gaps, and evidence.

## Major Workflow Areas (from product intent)

- Dashboard/readiness monitoring and listing-level optimization entry.
- Signal-source and BD site configuration plus verification.
- Ingestion lifecycle into DirectoryIQ-owned data stores.
- Step 1-3 listing workflow (support discovery, support creation/publish guards, listing upgrade push guards).
- Authority and graph-integrity scan/remediation loops.

## Next Sprint Direction

Expected next active sprint: `sprint-001-directoryiq-foundation`.

The sprint should strengthen the existing DirectoryIQ foundation from current implementation evidence (contracts, workflow consistency, and guardrail coverage), without inventing net-new requirements.

## Source-of-Truth References

Planning:
- `planning/state.md`
- `planning/apps/directoryiq/product-intent.md`

Implementation evidence families:
- `app/apps/directoryiq/*`
- `app/api/directoryiq/*`
- `lib/directoryiq/*`
- `tests/directoryiq_*`
