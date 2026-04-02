# Clerk Auth Foundation

iBrains now uses Clerk as the browser user authentication layer.

- Browser users sign in with Clerk (`@clerk/nextjs`) and carry a real user/session.
- Protected app surfaces (`/brains`, `/runs`, `/mission-control`, `/studio`) require sign-in.
- Core brain operation routes now require a signed-in Clerk user for write/operation actions.
- Internal service credentials (`BRAINS_WORKER_API_KEY`, `BRAINS_MASTER_KEY`/`BRAINS_X_API_KEY`) remain server-side only and are not browser auth.

This is the foundation for future per-brain authorization and entitlement checks.

## Environment contract for dedicated auth pages

Set these public Clerk URL vars so path-based auth pages render and redirect consistently:

- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/`
