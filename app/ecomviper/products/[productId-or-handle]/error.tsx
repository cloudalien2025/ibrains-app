"use client";

import Link from "next/link";

export default function EcomViperProductEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <p className="text-xs uppercase tracking-[0.16em] text-rose-600">Product Editor Error</p>
      <h2 className="mt-2 text-xl font-semibold text-[#0F172A]">Unable to load product editor</h2>
      <p className="mt-2 text-sm text-[#334155]">
        Product detail data is temporarily unavailable or invalid. Retry or return to the products table.
      </p>
      {error.digest ? <p className="mt-3 text-xs text-[#64748B]">Reference: {error.digest}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
        <Link
          href="/ecomviper"
          className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A]"
        >
          Back to Products
        </Link>
      </div>
    </div>
  );
}
