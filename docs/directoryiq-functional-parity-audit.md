# DirectoryIQ Functional Parity Audit

Source of truth audited: `/tmp/DirectoryIQ` at commit `3c905188104ad924f7b8000f1a4e82eb4e9ba285`.

## Broken surfaces audited
- `/directoryiq` dashboard client
- `/directoryiq/listings` listings client

## 1) Standalone page/component entrypoints
- Dashboard: `app/(brains)/directoryiq/page.tsx` -> `app/(brains)/directoryiq/directoryiq-dashboard-client.tsx`
- Listings: `app/(brains)/directoryiq/listings/page.tsx` -> `app/(brains)/directoryiq/listings/directoryiq-listings-client.tsx`

## 2) Standalone API endpoints used by those pages
- Dashboard page:
  - `GET /api/directoryiq/dashboard`
  - `POST /api/directoryiq/dashboard` (refresh)
  - `POST /api/directoryiq/settings` (vertical override)
- Listings page:
  - `GET /api/directoryiq/sites`
  - `GET /api/directoryiq/listings?site_id=...` (or `?site=all`)

## 3) Request parameters
- Dashboard:
  - `GET /api/directoryiq/dashboard`: none
  - `POST /api/directoryiq/dashboard`: no payload required
- Listings:
  - `GET /api/directoryiq/sites`: none
  - `GET /api/directoryiq/listings`: optional `site_id` or `site=all`

## 4) Expected response shapes
- `GET /api/directoryiq/dashboard`:
  - `{ connected, readiness, pillars, listings[], vertical_detected, vertical_override, last_analyzed_at, progress_messages[] }`
- `GET /api/directoryiq/sites`:
  - `{ sites: BdSite[], is_admin: boolean, limit: number }`
- `GET /api/directoryiq/listings`:
  - `{ ok: true, listings: ListingRow[] }` on success

## 5) Dependent services/helpers
- Dashboard/listings handlers use:
  - `app/api/directoryiq/_utils/selectionData.ts`
  - `app/api/directoryiq/_utils/bdSites.ts`
  - `app/api/directoryiq/_utils/connectedState.ts`
  - `app/api/directoryiq/_utils/dashboardListingsContract.ts`
- Runtime routing switch existed between local handlers and external proxy:
  - `app/api/directoryiq/_utils/runtimeParity.ts`
  - `app/api/directoryiq/_utils/externalReadProxy.ts`

## 6) Required providers/env/runtime contracts
- Auth/user: `resolveUserId(...)` header/query derived fallback user model.
- DB: DirectoryIQ handlers query through `app/api/ecomviper/_utils/db.ts` -> `getDirectoryIqPool()` (`DIRECTORYIQ_DATABASE_URL` preferred).
- Proxy mode: external proxy required resolvable `DIRECTORYIQ_API_BASE` and reachable upstream if enabled.

## 7) Functional parity finding relevant to current break
- Standalone and monorepo code both contained host-gated proxy fallback.
- In current monorepo runtime, core app traffic was being proxied externally instead of being served by local handlers, causing fetch failures when upstream resolution failed.
- Correct functional parity for the monorepo app path requires reliable local serving by default, with proxy only as explicit opt-in.
