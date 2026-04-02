# Clerk Auth Foundation

iBrains now uses Clerk as the browser user authentication layer.

- Browser users sign in with Clerk (`@clerk/nextjs`) and carry a real user/session.
- Protected app surfaces (`/brains`, `/runs`, `/mission-control`, `/studio`) require sign-in.
- Core brain operation routes now require a signed-in Clerk user for write/operation actions.
- Internal service credentials (`BRAINS_WORKER_API_KEY`, `BRAINS_MASTER_KEY`/`BRAINS_X_API_KEY`) remain server-side only and are not browser auth.

This is the foundation for future per-brain authorization and entitlement checks.
