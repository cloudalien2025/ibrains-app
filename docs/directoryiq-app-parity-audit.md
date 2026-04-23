# DirectoryIQ App Parity Audit (Standalone Source of Truth)

Source audited: `/tmp/DirectoryIQ` at commit `3c905188104ad924f7b8000f1a4e82eb4e9ba285` on `main`.

## 1. Standalone route tree
Standalone app routes are mounted under `app/(brains)/directoryiq/**` with URL paths rooted at `/directoryiq`:

- `/directoryiq` (dashboard landing)
- `/directoryiq/listings`
- `/directoryiq/listings/[listingId]`
- `/directoryiq/authority`
- `/directoryiq/authority/blogs`
- `/directoryiq/authority/listings`
- `/directoryiq/authority/integrity`
- `/directoryiq/authority/authority-support`
- `/directoryiq/authority-support`
- `/directoryiq/graph-integrity`
- `/directoryiq/signal-sources`
- `/directoryiq/settings`
- `/directoryiq/settings/integrations`
- `/directoryiq/integrations` (redirect style route)
- `/directoryiq/versions`
- `/directoryiq/blog-drafts/[draft_id]/preview`

## 2. Standalone main landing experience
- Landing file: `app/(brains)/directoryiq/page.tsx`
- Entry client: `directoryiq-dashboard-client.tsx`
- Primary hero label: **AI Visibility Dashboard**
- Landing depends on `GET/POST /api/directoryiq/dashboard` and `POST /api/directoryiq/settings`.

## 3. Standalone nav model
- Layout: `app/(brains)/directoryiq/layout.tsx`
- Mobile nav component: `components/directoryiq/DirectoryIqMobileNav.tsx`
- Nav model source: `lib/directoryiq/navItems.ts`
- Sections: Dashboard, Listings, Authority, Graph Integrity, Connections, History.

## 4. Required providers/layout wrappers
- Global layout: `app/layout.tsx`
- Brain-group layout: `app/(brains)/layout.tsx`
- DirectoryIQ-local layout: `app/(brains)/directoryiq/layout.tsx`
- No separate React context provider is required for rendering core DirectoryIQ routes.

## 5. Required API/data dependencies
Core API surface used by the standalone app includes:

- `/api/directoryiq/dashboard`
- `/api/directoryiq/listings` and `/api/directoryiq/listings/[listingId]/*`
- `/api/directoryiq/sites`, `/api/directoryiq/signal-sources`, `/api/ingest/directoryiq/run`
- `/api/directoryiq/authority/*`, `/api/directoryiq/graph/*`, `/api/directoryiq/graph-integrity/*`
- `/api/directoryiq/settings`, `/api/directoryiq/versions/*`
- `/api/directoryiq/blog-drafts/*`, `/api/directoryiq/jobs/*`, `/api/directoryiq/snapshot/*`

Data/service dependencies include:
- `app/api/ecomviper/_utils/{db,user,crypto}.ts`
- `app/api/_utils/snapshots.ts`
- `lib/directoryiq/**`, `lib/openai/serverClient.ts`, `src/directoryiq/**`, `src/lib/directoryiq/**`.

## 6. Visual/theming model in standalone
- The standalone DirectoryIQ UI is dark/cyan themed (`bg-slate-950`, cyan accents).
- Primary shared UI primitives are in `components/ecomviper/*` and `components/directoryiq/*`.
- Styling identity is distinct from iBrains light-blue shell defaults.

## 7. What was wrong/missing in ibrains-app before this lane
- Prior user-observed behavior was a dashboard/error-like surface that did not match expected full app experience.
- The lane target is to keep standalone information architecture parity while integrating visual language into iBrains styling and avoiding a disconnected standalone look.
