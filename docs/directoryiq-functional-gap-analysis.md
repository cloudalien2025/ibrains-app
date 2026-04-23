# DirectoryIQ Functional Gap Analysis (Monorepo vs Working Behavior)

## Reproduced failures before fix
Local repro against monorepo (`next dev`, 2026-04-23 UTC):

1. Page: `/apps/directoryiq`
- Failing API: `GET /api/directoryiq/dashboard`
- Status/payload: `502` with `{"ok":false,"error":"fetch failed"}`
- Client-visible error text: `fetch failed`
- Contract mismatch: dashboard client expects dashboard JSON contract, got transport failure payload.

2. Page: `/apps/directoryiq/listings`
- Failing API: `GET /api/directoryiq/listings`
- Status/payload: `502` with `{"ok":false,"error":"fetch failed"}`
- Client-visible error text: `fetch failed`
- Contract mismatch: listings client expects `{ ok, listings[] }`, got transport failure payload.

Root infrastructure symptom captured:
- Upstream endpoint host failed DNS resolution from runtime (`Could not resolve host: directoryiq-api.ibrains.ai`).

## Explicit gaps identified
### Gap A: Runtime routing mode
- Problem: DirectoryIQ APIs chose local-vs-proxy based on host equality with `DIRECTORYIQ_API_BASE` host.
- Effect in monorepo app runtime: requests proxied externally instead of using local handlers.
- Result: `502 fetch failed` on primary surfaces when upstream not resolvable/reachable.

### Gap B: Legacy fallback dependency on `integrations_credentials`
- Problem: BD site bootstrap and integration reads assumed `integrations_credentials` relation exists in current DirectoryIQ DB path.
- Effect after local-serving fix: requests failed with `relation "integrations_credentials" does not exist` in environments where that relation is absent from the DirectoryIQ DB path.
- Result: dashboard/listings/signal-sources degraded from transport errors to local 500s.

## Root-cause families
1. `client fetch -> wrong backend mode`: external proxy mode active by default for monorepo app traffic.
2. `route exists but backend dependency missing`: local handlers touched optional legacy table without defensive fallback.

## Why standalone could appear to work while monorepo app failed
- Standalone and monorepo shared similar handler code, but monorepo app runtime characteristics (host/base routing and upstream reachability) made the proxy branch unreliable for `/apps/directoryiq`.
- Monorepo parity target requires local-first handler execution for app routes, not dependency on external host availability.
