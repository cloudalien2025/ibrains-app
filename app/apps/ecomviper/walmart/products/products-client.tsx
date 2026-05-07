"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { filterWalmartProducts } from "@/lib/ecomviper/walmart/walmart-product-filters";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface ProductsClientProps {
  products: WalmartProductRecord[];
}

const filters = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "out_of_stock", label: "Out of stock" },
  { id: "low_stock", label: "Low stock" },
  { id: "missing_image", label: "Missing image" },
  { id: "missing_attributes", label: "Missing attributes" },
  { id: "price_missing", label: "Price missing" },
  { id: "sync_failed", label: "Sync failed" },
  { id: "draft_pending", label: "Draft pending" },
] as const;

export default function WalmartProductsClient({ products }: ProductsClientProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterWalmartProducts(products, { query, filter }),
    [products, query, filter]
  );

  async function handleImport() {
    const response = await fetch("/api/ecomviper/walmart/products/import", { method: "POST" });
    if (!response.ok) {
      setMessage("Import failed.");
      return;
    }
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? "Import completed.");
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-products-page">
      <WalmartPageHeader
        title="Products"
        subtitle="Search and manage Walmart catalog products with safe staging and sync workflows."
        actions={
          <button
            type="button"
            onClick={handleImport}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
          >
            Import Products
          </button>
        }
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU, title, brand, status"
            className="min-w-[220px] flex-1 rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          >
            {filters.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {message ? <p className="mt-3 text-sm text-[#334155]">{message}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2">Image</th>
                <th className="py-2">SKU</th>
                <th className="py-2">Title</th>
                <th className="py-2">Brand</th>
                <th className="py-2">Price</th>
                <th className="py-2">Inventory</th>
                <th className="py-2">Status</th>
                <th className="py-2">Last Synced</th>
                <th className="py-2">Issues</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.sku} className="border-t border-[#E2E8F0] align-top">
                  <td className="py-2 pr-2">
                    {product.imageUrl ? (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-[#D9E4F0] bg-[#F8FBFF] text-xs text-[#334155]">
                        IMG
                      </span>
                    ) : (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">N/A</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium text-[#0F172A]">{product.sku}</td>
                  <td className="py-2 pr-2 text-[#334155]">{product.title}</td>
                  <td className="py-2 pr-2 text-[#334155]">{product.brand}</td>
                  <td className="py-2 pr-2 text-[#334155]">${product.price.toFixed(2)}</td>
                  <td className="py-2 pr-2 text-[#334155]">{product.inventoryQuantity}</td>
                  <td className="py-2 pr-2"><StatusBadge status={product.status} /></td>
                  <td className="py-2 pr-2 text-[#334155]">{product.lastSyncedAt}</td>
                  <td className="py-2 pr-2 text-[#334155]">{product.issues.join(", ") || "None"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/apps/ecomviper/walmart/products/${encodeURIComponent(product.sku)}`} className="text-xs text-[#2563EB] hover:text-[#1D4ED8]">Edit</Link>
                      <Link href="/apps/ecomviper/walmart/drafts" className="text-xs text-[#2563EB] hover:text-[#1D4ED8]">View Drafts</Link>
                      <button type="button" className="text-xs text-[#2563EB]">Sync</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr className="border-t border-[#E2E8F0]">
                  <td colSpan={10} className="py-6 text-center text-sm text-[#64748B]">
                    No Walmart products imported yet. Connect Walmart, then import your products.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
