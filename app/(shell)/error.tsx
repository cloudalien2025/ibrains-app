"use client";

import Link from "next/link";

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-rose-200 bg-white p-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <p className="text-xs uppercase tracking-[0.16em] text-rose-600">Workspace Error</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#0F172A]">Unable to load this workspace</h2>
      <p className="mt-2 text-sm text-[#334155]">
        The workspace hit an unexpected error. Retry the render or return to the brains index.
      </p>
      {error.digest ? (
        <p className="mt-3 text-xs text-[#64748B]">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
        >
          Retry
        </button>
        <Link
          href="/brains"
          className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
        >
          Back to Brains
        </Link>
      </div>
    </div>
  );
}
