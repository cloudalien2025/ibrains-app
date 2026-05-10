"use client";

import { useEffect, useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

interface PricingClientProps {
  products: WalmartEffectiveProductRecord[];
  warnings: Array<{ sku: string; message: string }>;
  recentChanges: Array<{ createdAt: string; sku: string | null; message: string }>;
}

export default function WalmartPricingClient({ products, warnings, recentChanges }: PricingClientProps) {
  const [sku, setSku] = useState(products[0]?.sku ?? "");
  const [price, setPrice] = useState(products[0] ? products[0].price.toFixed(2) : "0");
  const [message, setMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku.toLowerCase() === sku.trim().toLowerCase()) ?? null,
    [products, sku]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    setPrice(selectedProduct.price.toFixed(2));
  }, [selectedProduct?.sku]);

  async function submit(saveAsDraft: boolean) {
    if (!selectedProduct) {
      setMessage("Select a valid product SKU before updating pricing.");
      return;
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setMessage("Price must be greater than zero.");
      return;
    }

    const response = await fetch("/api/ecomviper/walmart/pricing/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: selectedProduct.sku,
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
      />

      {!products.length ? (
        <section className="rounded-2xl border border-dashed border-[#D9E4F0] bg-white/95 p-5 text-sm text-[#64748B]">
          No Walmart products imported yet. Connect Walmart, then import your products before price updates.
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Pricing Update Workspace</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-[#334155]">
              Select product / SKU
              <input
                data-testid="ecomviper-walmart-pricing-sku-selector"
                list="ecomviper-walmart-pricing-product-options"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Search by SKU or title"
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              />
              <datalist id="ecomviper-walmart-pricing-product-options">
                {products.map((product) => (
                  <option
                    key={product.sku}
                    value={product.sku}
                    label={`${product.sku} - ${product.title}`}
                  />
                ))}
              </datalist>
            </label>
            <label className="text-sm text-[#334155]">
              Product title
              <input
                value={selectedProduct?.title ?? "Not found"}
                readOnly
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Current price
              <input
                data-testid="ecomviper-walmart-pricing-current-price"
                value={selectedProduct ? `$${selectedProduct.price.toFixed(2)}` : "Not found"}
                readOnly
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2"
              />
            </label>
            <label className="text-sm text-[#334155]">
              New price
              <input
                data-testid="ecomviper-walmart-pricing-new-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                data-testid="ecomviper-walmart-pricing-save-draft"
                type="button"
                onClick={() => submit(true)}
                className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
              >
                Save Draft
              </button>
              <button
                data-testid="ecomviper-walmart-pricing-submit-update"
                type="button"
                onClick={() => submit(false)}
                className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
              >
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
