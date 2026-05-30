"use client";

import Link from "next/link";

export default function BrainsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-6 text-[#0F172A] shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <p className="text-xs uppercase tracking-[0.16em] text-rose-600">iBrains Dashboard Error</p>
      <h2 className="mt-2 text-xl font-semibold">The launcher failed to render</h2>
      <p className="mt-2 text-sm text-[#334155]">
        Retry the dashboard render or return home. This page does not run supplier ingestion or product sync during render.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
        <Link href="/" className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A]">
          Home
        </Link>
      </div>
    </div>
  );
}
