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
- Root (`/`), `/sign-in`, and `/sign-up` now run through Clerk middleware context so server-side auth state helpers can resolve consistently.
- Development/test may use a local placeholder publishable key to keep local rendering stable when Clerk env is intentionally absent.
- Production must provide a real publishable key and `CLERK_SECRET_KEY`.
- If production env is misconfigured, the app now fails explicitly with a diagnosable Clerk contract error (instead of silently behaving like a normal logout).
