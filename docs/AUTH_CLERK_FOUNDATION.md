# Clerk Auth Foundation

iBrains now uses Clerk as the browser user authentication layer.

- Browser users sign in with Clerk (`@clerk/nextjs`) and carry a real user/session.
- Protected app surfaces (`/brains`, `/dashboard`, `/tasks`, `/reports`, `/settings`, `/billing`) require sign-in.
- Core brain operation routes now require a signed-in Clerk user for write/operation actions.
- Internal service credentials (`BRAINS_WORKER_API_KEY`, `BRAINS_MASTER_KEY`/`BRAINS_X_API_KEY`) remain server-side only and are not browser auth.
- Protected API auth contract: signed-out protected requests should return clean auth responses (for example `401`) and must not fail with `500` due middleware/proxy loops.

Legacy route note:

- `/apps/*`, `/studio`, `/siteforge`, and `/uapforge` are removed and must remain `404` (no redirects).

This is the foundation for future per-brain authorization and entitlement checks.

## Environment contract for dedicated auth pages

Set these public Clerk URL vars so path-based auth pages render and redirect consistently:

- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/brains`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/brains`

Fallback redirect safety rule:

- Legacy fallback targets under deprecated routes are automatically sanitized to `/brains`:
  - `/apps`
  - `/apps/*`
  - `/studio`
  - `/siteforge`
  - `/uapforge`

Set a Clerk publishable key for browser auth. Either variable works in this repo:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk_...>`
- or `CLERK_PUBLISHABLE_KEY=<pk_...>`

Set a Clerk secret key for server-side auth and middleware protection:

- `CLERK_SECRET_KEY=<sk_...>`

## Runtime contract behavior

- `app/layout.tsx` and `proxy.ts` both resolve Clerk env from one shared contract helper (`lib/auth/clerkEnvContract.ts`).
- Public frontdoor/auth routes (`/`, `/sign-in`, `/sign-up`) bypass Clerk frontend proxy middleware to avoid signed-out localhost rewrite failures.
- `app.ibrains.ai` uses the Clerk production instance as an allowed subdomain of the primary `ibrains.ai` domain. The app must use direct Clerk frontend/auth requests for that allowed-subdomain model.
- Do not enable Clerk frontend API proxying (`frontendApiProxy`) or pass `ClerkProvider proxyUrl` for `app.ibrains.ai` unless a future architecture decision explicitly changes the auth topology. Half-proxying Clerk requests can cause host attribution failures such as `host_invalid` and can destabilize signed-in `/brains` refreshes.
- Middleware matcher contract: `/__clerk/**` must be excluded from proxy middleware matching (including the broad non-static matcher), so stale browser proxy-mode requests return clean `404` from Next.js.
- Development/test may use a local placeholder publishable key to keep local rendering stable when Clerk env is intentionally absent.
- Production must provide a real publishable key and `CLERK_SECRET_KEY`.
- If production env is misconfigured, the app now fails explicitly with a diagnosable Clerk contract error (instead of silently behaving like a normal logout).

## Protected workspace rendering rule

- `/brains` is the canonical iBrains Dashboard launcher and must render from local canonical brain inventory.
- `/brains` server render must not call protected `/api/brains/*` endpoints.
- `/brains` must not perform client-side stats hydration, supplier refresh, Shopify fetches, OpenAI calls, PDF parsing, Google Sheets parsing, or product-editor imports during initial render.
- `/brains` must not hard-redirect to `/ecomviper`; app workspaces link back to `/brains`.
- Signed-out protected shell routes redirect to `/sign-in` with a relative `redirect_url` such as `/brains` or `/ecomviper`; `/brains` and `/ecomviper` must never redirect to each other.
- Signed-out protected API routes such as `/api/brains` and `/api/brains/:id/stats` must return clean non-500 auth responses.

## Production smoke checklist

- `/__clerk/v1/client` returns `404` (not `500`).
- `/sign-in` returns `200` and renders Clerk UI.
- `/sign-up` returns `200` and renders Clerk UI.
- signed-out `/brains` redirects (`307`) to `/sign-in` with `redirect_url` preserved.
- signed-out `/api/brains` and `/api/brains/ecomviper/stats` return `401` (not `500`).
- deprecated routes remain `404`: `/apps`, `/apps/studio`, `/studio`, `/siteforge`, `/uapforge`.

## Authenticated verification checklist (manual)

Use this after deploys when automated signed-in smoke is unavailable.

1. Open `https://app.ibrains.ai/sign-in` and authenticate in a clean browser profile.
2. Open `/brains` and confirm launcher cards render with no redirect loop.
3. Open `/ecomviper` and confirm products table/status cards load.
4. Open `/ecomviper/settings` and confirm page renders without hang/crash.
5. Open one `/ecomviper/products/[productId-or-handle]` route and confirm editor renders.
6. Open browser console and confirm no uncaught client exception.
7. Record verification timestamp plus blocker reason if signed-in verification could not run.

If users previously hit stale proxy-mode/session errors, clear cookies/session once for:
- `app.ibrains.ai`
- `ibrains.ai`
- `clerk.ibrains.ai`
