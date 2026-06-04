"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = error.digest || "unknown";

  return (
    <html lang="en">
      <body className="ibrains-shell min-h-screen text-[#0F172A]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-14">
          <section className="w-full rounded-2xl border border-[#D9E4F0] bg-white/95 p-7 text-center shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">iBrains</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">Application error</h1>
            <p className="mt-2 text-sm text-[#475569]">
              The app hit an unexpected client/runtime issue. Reload this page to recover.
            </p>
            <p className="mt-3 text-xs text-[#64748B]">Reference: {reference}</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white"
              >
                Try again
              </button>
              <a
                href="/"
                className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
              >
                Go home
              </a>
            </div>
          </section>
        </div>
      </body>
    </html>
  );
}
