"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface InventoryClientProps {
  products: WalmartProductRecord[];
  lowStock: WalmartProductRecord[];
  outOfStock: WalmartProductRecord[];
  recentChanges: Array<{ createdAt: string; sku: string | null; message: string }>;
}

export default function WalmartInventoryClient({ products, lowStock, outOfStock, recentChanges }: InventoryClientProps) {
  const [sku, setSku] = useState(products[0]?.sku ?? "");
  const [quantity, setQuantity] = useState("0");
  const [message, setMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku.toLowerCase() === sku.trim().toLowerCase()) ?? null,
    [products, sku]
  );

  async function submit(saveAsDraft: boolean) {
    const parsedQuantity = Number(quantity);
    const response = await fetch("/api/ecomviper/walmart/inventory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        quantity: parsedQuantity,
        saveAsDraft,
      }),
    });

    if (!response.ok) {
      setMessage("Inventory update failed.");
      return;
    }

    const payload = (await response.json()) as { message: string };
    setMessage(payload.message);
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-inventory-page">
      <WalmartPageHeader
        title="Inventory"
        subtitle="Update inventory safely with draft or direct update paths."
      />

      {!products.length ? (
        <section className="rounded-2xl border border-dashed border-[#D9E4F0] bg-white/95 p-5 text-sm text-[#64748B]">
          No Walmart products imported yet. Connect Walmart, then import your products before inventory updates.
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Inventory Update Workspace</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-[#334155]">
              Search SKU
              <input value={sku} onChange={(event) => setSku(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
            </label>
            <label className="text-sm text-[#334155]">
              Current quantity
              <input value={selectedProduct?.inventoryQuantity ?? "Not found"} readOnly className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2" />
            </label>
            <label className="text-sm text-[#334155]">
              New quantity
              <input value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => submit(true)} className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]">
                Save Draft
              </button>
              <button type="button" onClick={() => submit(false)} className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white">
                Update SKU
              </button>
            </div>
            {message ? <p className="text-sm text-[#334155]">{message}</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Recent Inventory Changes</h2>
          <ul className="mt-3 space-y-2">
            {recentChanges.length ? (
              recentChanges.map((entry) => (
                <li key={`${entry.createdAt}-${entry.message}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm">
                  <p className="font-medium text-[#0F172A]">{entry.sku ?? "SKU n/a"}</p>
                  <p className="mt-1 text-[#334155]">{entry.message}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{entry.createdAt}</p>
                </li>
              ))
            ) : (
              <li className="rounded-lg border border-dashed border-[#D9E4F0] p-3 text-sm text-[#64748B]">No recent inventory changes.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Low-stock table</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lowStock.map((product) => (
              <li key={product.sku} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">
                <span>{product.sku}</span>
                <span className="font-medium">{product.inventoryQuantity}</span>
              </li>
            ))}
            {!lowStock.length ? (
              <li className="rounded-lg border border-dashed border-[#D9E4F0] px-3 py-2 text-[#64748B]">No low-stock products.</li>
            ) : null}
          </ul>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Out-of-stock table</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {outOfStock.map((product) => (
              <li key={product.sku} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">
                <span>{product.sku}</span>
                <span className="font-medium">{product.inventoryQuantity}</span>
              </li>
            ))}
            {!outOfStock.length ? (
              <li className="rounded-lg border border-dashed border-[#D9E4F0] px-3 py-2 text-[#64748B]">No out-of-stock products.</li>
            ) : null}
          </ul>
        </article>
      </section>
    </div>
  );
}
