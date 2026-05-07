"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface PricingClientProps {
  products: WalmartProductRecord[];
  warnings: Array<{ sku: string; message: string }>;
  recentChanges: Array<{ createdAt: string; sku: string | null; message: string }>;
  mode: string;
}

export default function WalmartPricingClient({ products, warnings, recentChanges, mode }: PricingClientProps) {
  const [sku, setSku] = useState(products[0]?.sku ?? "");
  const [price, setPrice] = useState("0");
  const [message, setMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku.toLowerCase() === sku.trim().toLowerCase()) ?? null,
    [products, sku]
  );

  async function submit(saveAsDraft: boolean) {
    const parsedPrice = Number(price);
    const response = await fetch("/api/ecomviper/walmart/pricing/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        price: parsedPrice,
        saveAsDraft,
      }),
    });

    if (!response.ok) {
      setMessage("Price update failed.");
      return;
    }

    const payload = (await response.json()) as { message: string };
    setMessage(payload.message);
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-pricing-page">
      <WalmartPageHeader
        title="Pricing"
        subtitle="Prepare price updates with optional draft-first flow."
        mode={mode}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Pricing Update Workspace</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-[#334155]">
              Search SKU
              <input value={sku} onChange={(event) => setSku(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
            </label>
            <label className="text-sm text-[#334155]">
              Current price
              <input value={selectedProduct ? `$${selectedProduct.price.toFixed(2)}` : "Not found"} readOnly className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2" />
            </label>
            <label className="text-sm text-[#334155]">
              New price
              <input value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => submit(true)} className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]">
                Save Draft
              </button>
              <button type="button" onClick={() => submit(false)} className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white">
                Submit Price Update
              </button>
            </div>
            {message ? <p className="text-sm text-[#334155]">{message}</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Price Validation Warnings</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#334155]">
            {warnings.length ? (
              warnings.map((warning) => (
                <li key={`${warning.sku}-${warning.message}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  {warning.sku}: {warning.message}
                </li>
              ))
            ) : (
              <li className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">No active warnings.</li>
            )}
          </ul>

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Recent price changes</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {recentChanges.length ? (
              recentChanges.map((entry) => (
                <li key={`${entry.createdAt}-${entry.message}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">
                  <p className="font-medium text-[#0F172A]">{entry.sku ?? "SKU n/a"}</p>
                  <p className="mt-1 text-[#334155]">{entry.message}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{entry.createdAt}</p>
                </li>
              ))
            ) : (
              <li className="rounded-lg border border-dashed border-[#D9E4F0] px-3 py-2 text-[#64748B]">No recent price changes.</li>
            )}
          </ul>
        </article>
      </section>
    </div>
  );
}
