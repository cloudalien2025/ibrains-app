# Sprint 005: Hub Feed Control Center Foundation

## Purpose

Seed the first private Hub Feed Control Center surface at `/ecomviper/hub` using static/demo content aligned to Hub planning architecture.

## Scope

- add a Feed Control Center foundation to private Hub app shell
- model optimized feed intake from Walmart, eBay, Amazon, and Shopify into private Hub
- show canonicalization queue preview and publication readiness preview
- add focused Hub tests for Feed Control Center rendering and static-foundation messaging
- apply small Hub planning doc updates that reflect seeded private UI-zone/workflow status

## Non-Goals

- no real feed sync implementation
- no marketplace API calls
- no database persistence or migrations
- no canonical graph persistence implementation
- no public `ecomviper.com` route implementation
- no DNS, SSL, hosting, droplet, or infrastructure changes
- no WordPress changes

## App Files Changed

- `app/ecomviper/hub/hub-workspace-client.tsx`
- `app/ecomviper/hub/_components/hub-sidebar.tsx`
- `app/ecomviper/hub/_components/hub-feed-control-center.tsx`
- `app/ecomviper/hub/hub-feed-control-content.ts`

## Planning Files Changed

- `planning/apps/ecomviper/hub/workflows.md`
- `planning/apps/ecomviper/hub/ui-zones.md`
- `planning/apps/ecomviper/hub/sprints/sprint-005-hub-feed-control-center-foundation.md`

## Tests Changed

- `tests/ecomviper_hub_feed_control_center.test.tsx` (new)
- `tests/ecomviper_hub_app_shell.test.tsx` (existing coverage retained)

## Static / Demo Feed Sources

- `EcomViper/Walmart` (`/optiwal`)
- `EcomViper/eBay` (`/optibay`)
- `EcomViper/Amazon` (`/optizon`)
- `EcomViper/Shopify` (`/ecomviper/shopify`)

Mode:

- static/demo status cards and table rows only
- no live intake execution in this sprint

## Acceptance Criteria

- private Hub route `/ecomviper/hub` visibly includes Feed Control Center foundation content
- feed intake sources include Walmart, eBay, Amazon, and Shopify
- workspace communicates private workflow: optimized feeds -> Hub intake -> canonicalization -> publication/routing approval
- workspace includes explicit static/demo-only language and does not imply live sync is implemented
- tests verify Feed Control Center source coverage and static foundation messaging
- no API, persistence, public route, or infrastructure changes are introduced

## Checks

- `git status`
- `git diff --check`
- `bash scripts/check_route_signatures.sh`
- `npm test -- --run tests/ecomviper_hub_app_shell.test.tsx tests/ecomviper_hub_feed_control_center.test.tsx`
- docs lint discovery command (run if available)

## Follow-Up Sprint Candidates

1. add first private publication queue interaction model (still static first)
2. define first typed private feed-intake API boundary for one marketplace source
3. add canonicalization review state model and queue ownership tags
4. add publication approval state transitions and audit timeline scaffolding
5. define attribution-loop contract from public discovery events back into private Hub
