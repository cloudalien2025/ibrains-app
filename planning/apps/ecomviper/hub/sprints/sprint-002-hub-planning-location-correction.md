# Sprint 002: Hub Planning Location Correction

## Purpose

Correct the Hub documentation location so architecture/planning source-of-truth lives under `planning/apps/ecomviper/hub/` rather than under the app route directory.

## Scope

- Move Hub markdown architecture docs from `app/ecomviper/hub/` to `planning/apps/ecomviper/hub/`
- Remove mistaken app-route markdown docs
- Update moved content so it references planning-tree ownership and keeps `/ecomviper/hub` as a future route target

## Files Moved

- `app/ecomviper/hub/README.md` -> `planning/apps/ecomviper/hub/README.md`
- `app/ecomviper/hub/overview.md` -> `planning/apps/ecomviper/hub/overview.md`
- `app/ecomviper/hub/product-intent.md` -> `planning/apps/ecomviper/hub/product-intent.md`
- `app/ecomviper/hub/roadmap.md` -> `planning/apps/ecomviper/hub/roadmap.md`
- `app/ecomviper/hub/architecture.md` -> `planning/apps/ecomviper/hub/architecture.md`
- `app/ecomviper/hub/workflows.md` -> `planning/apps/ecomviper/hub/workflows.md`
- `app/ecomviper/hub/integrations.md` -> `planning/apps/ecomviper/hub/integrations.md`
- `app/ecomviper/hub/data-models.md` -> `planning/apps/ecomviper/hub/data-models.md`
- `app/ecomviper/hub/operations.md` -> `planning/apps/ecomviper/hub/operations.md`
- `app/ecomviper/hub/ui-zones.md` -> `planning/apps/ecomviper/hub/ui-zones.md`
- `app/ecomviper/hub/sprints/sprint-001-hub-architecture-foundation.md` -> `planning/apps/ecomviper/hub/sprints/sprint-001-hub-architecture-foundation.md`

## App-Route Cleanup

- Removed markdown architecture docs from `app/ecomviper/hub/`
- Removed empty `app/ecomviper/hub/sprints` directory
- Removed empty `app/ecomviper/hub` directory

## Non-Goals

- No `page.tsx` or Hub UI implementation
- No nav wiring
- No APIs/integrations implementation
- No database or dependency changes

## Checks

- `find app/ecomviper/hub -type f -maxdepth 3 2>/dev/null || true`
- `find planning/apps/ecomviper/hub -type f | sort`
- `rg -n "app/ecomviper/hub|planning/apps/ecomviper/hub|/ecomviper/hub" planning/apps/ecomviper/hub app/ecomviper 2>/dev/null || true`
- `git status`
- `git diff --stat`
- `bash scripts/check_route_signatures.sh`

## Acceptance Criteria

- Hub architecture docs exist only under `planning/apps/ecomviper/hub/`
- No duplicate markdown architecture files remain under `app/ecomviper/hub/`
- Docs preserve future app route intent (`/ecomviper/hub`) while stating implementation is deferred
- Sprint is documentation-location correction only
