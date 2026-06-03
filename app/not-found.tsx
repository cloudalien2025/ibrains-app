// Explicit root not-found boundary.
//
// Besides giving the app a branded 404, an explicit `not-found.tsx` makes the
// build emit and register the `/_not-found` route's client reference manifest
// reliably. Without it, Next.js 16 (Turbopack) can fail to register the
// synthetic `/_not-found` manifest on first boot after a fresh build, throwing
// `InvariantError: The client reference manifest for route "/_not-found" does
// not exist` and returning 500 for any not-found render during the cold-start
// window (observed in production smoke right after deploy).
//
// Kept as a pure server component (plain anchor, no client imports) so it has
// no client-component dependency of its own.

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-[#475569]">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <a
        href="/brains"
        className="mt-5 inline-flex items-center rounded-lg border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
      >
        Back to iBrains
      </a>
    </main>
  );
}
