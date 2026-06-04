# Admin Access Control

Last updated: 2026-05-31 (UTC)

## Authentication + Authorization Model

Admin routes require two checks:

1. Clerk authentication.
2. Platform-admin authorization via env email allowlist.

Env contract:

- `ADMIN_EMAIL_ALLOWLIST=email1@example.com,email2@example.com`

The allowlist is parsed server-side only via `lib/admin/require-admin.ts`.

## Enforcement Points

1. Middleware protection (`proxy.ts`): `/admin(.*)` is treated as a protected route and signed-out users redirect to `/sign-in`.
2. Server-side guard (`requireAdmin`):
   - reads Clerk auth/session claims,
   - resolves signed-in email,
   - compares against `ADMIN_EMAIL_ALLOWLIST`,
   - returns `notFound()` when signed in but not allowlisted.

## Security Rules

- Allowlist is never shipped to browser/client code.
- Merchant workspace role settings are not used for platform-admin elevation.
- Internal supplier sync tokens are not exposed in admin UI.
- Admin routes remain isolated from merchant route auth semantics.

## Failure Behavior

- Signed out: redirect to Clerk sign-in with `redirect_url`.
- Signed in + not allowlisted: not found/denied server-side.
- Allowlisted: render admin route tree.
