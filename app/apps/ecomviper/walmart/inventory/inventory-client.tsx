"use client";

import { useEffect, useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

interface InventoryClientProps {
  products: WalmartEffectiveProductRecord[];
  lowStock: WalmartEffectiveProductRecord[];
  outOfStock: WalmartEffectiveProductRecord[];
  recentChanges: Array<{ createdAt: string; sku: string | null; message: string }>;
}

function formatInventory(product: WalmartEffectiveProductRecord | null): string {
  if (!product) return "Not found";
  if (product.inventoryStatus === "unknown") return "Not synced";
  if (product.inventoryStatus === "out_of_stock") return "Out of stock";
  return String(product.inventoryQuantity);
}

function formatInventoryStatus(product: WalmartEffectiveProductRecord | null): string {
  if (!product) return "Unknown";
  if (product.inventoryStatus === "unknown") return "Unknown (Not synced)";
  if (product.inventoryStatus === "out_of_stock") return "Out of stock";
  return "In stock";
}

export default function WalmartInventoryClient({ products, lowStock, outOfStock, recentChanges }: InventoryClientProps) {
  const [sku, setSku] = useState(products[0]?.sku ?? "");
  const [quantity, setQuantity] = useState(products[0] ? String(products[0].inventoryQuantity) : "0");
  const [message, setMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku.toLowerCase() === sku.trim().toLowerCase()) ?? null,
    [products, sku]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    setQuantity(String(selectedProduct.inventoryQuantity));
  }, [selectedProduct?.sku]);

  async function submit(saveAsDraft: boolean) {
    if (!selectedProduct) {
      setMessage("Select a valid product SKU before updating inventory.");
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setMessage("Quantity must be a non-negative number.");
      return;
    }

    const response = await fetch("/api/ecomviper/walmart/inventory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: selectedProduct.sku,
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
              Select product / SKU
              <input
                data-testid="ecomviper-walmart-inventory-sku-selector"
                list="ecomviper-walmart-inventory-product-options"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Search by SKU or title"
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              />
              <datalist id="ecomviper-walmart-inventory-product-options">
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
              Current quantity
              <input
                data-testid="ecomviper-walmart-inventory-current-quantity"
                value={formatInventory(selectedProduct)}
                readOnly
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Inventory status
              <input
                value={formatInventoryStatus(selectedProduct)}
                readOnly
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2"
              />
            </label>
            <label className="text-sm text-[#334155]">
              New quantity
              <input
                data-testid="ecomviper-walmart-inventory-new-quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                data-testid="ecomviper-walmart-inventory-save-draft"
                type="button"
                onClick={() => submit(true)}
                className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
              >
                Save Draft
              </button>
              <button
                data-testid="ecomviper-walmart-inventory-update-sku"
                type="button"
                onClick={() => submit(false)}
                className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
              >
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
                <span className="font-medium">{formatInventory(product)}</span>
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
                <span className="font-medium">{formatInventory(product)}</span>
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
