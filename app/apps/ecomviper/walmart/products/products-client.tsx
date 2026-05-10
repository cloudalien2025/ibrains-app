"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { filterWalmartProductsWithType } from "@/lib/ecomviper/walmart/walmart-product-filters";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

interface ProductsClientProps {
  products: WalmartEffectiveProductRecord[];
}

const filters = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "out_of_stock", label: "Out of stock" },
  { id: "low_stock", label: "Low stock" },
  { id: "missing_image", label: "Image missing" },
  { id: "missing_attributes", label: "Missing attributes" },
  { id: "price_missing", label: "Price missing" },
  { id: "sync_failed", label: "Sync failed" },
  { id: "draft_pending", label: "Draft pending" },
] as const;

function formatInventory(product: WalmartEffectiveProductRecord): string {
  if (product.inventoryStatus === "unknown") return "—";
  if (product.inventoryStatus === "out_of_stock") return "Out of stock";
  return String(product.inventoryQuantity);
}

function normalizeSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

type SkuSortDirection = "none" | "asc" | "desc";

function compareSkuNatural(
  left: WalmartEffectiveProductRecord,
  right: WalmartEffectiveProductRecord,
  direction: Exclude<SkuSortDirection, "none">
): number {
  const compared = left.sku.localeCompare(right.sku, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return direction === "asc" ? compared : compared * -1;
}

function formatImageStatus(product: WalmartEffectiveProductRecord): string {
  if (product.imageStatusMessage?.trim()) return product.imageStatusMessage;
  if (product.imageSyncStatus === "not_found") {
    if (product.imageSource === "walmart_item_report") return "No matching row found in Walmart Item Report.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "No public Walmart listing images found via SerpApi.";
    if (product.imageSource === "manual") return "Manual image URL not provided.";
    return "Item Search returned no usable image.";
  }
  if (product.imageSyncStatus === "ambiguous") {
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing image match is ambiguous.";
    return "Multiple Walmart Item Search candidates matched this product.";
  }
  if (product.imageSyncStatus === "failed") {
    if (product.imageSource === "walmart_item_report") return "Walmart Item Report request failed.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing image lookup failed.";
    return "Item Search request failed after retry.";
  }
  if (product.imageSyncStatus === "not_synced") {
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing images not synced.";
    if (product.imageSource === "manual") return "Manual image URL not provided.";
    return "Image enrichment not synced.";
  }
  if (product.imageUrl) return "Image available";
  return "Image enrichment not synced.";
}

function formatImageSource(product: WalmartEffectiveProductRecord): string {
  if (product.imageSource === "walmart_item_report") return "Walmart Item Report";
  if (product.imageSource === "walmart_catalog") return "Walmart Seller Catalog Search";
  if (product.imageSource === "walmart_item_search") return "Walmart Item Search";
  if (product.imageSource === "public_walmart_listing_serpapi")
    return "Public Walmart listing via SerpApi";
  if (product.imageSource === "manual") return "Manual image URL";
  return "Not synced";
}

function hasPendingDraftImage(product: WalmartEffectiveProductRecord): boolean {
  if (!product.hasDraftChanges) return false;
  const current = product.imageUrl?.trim() ?? "";
  const live = product.liveImageUrl?.trim() ?? "";
  return current !== live;
}

export default function WalmartProductsClient({ products }: ProductsClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [skuSortDirection, setSkuSortDirection] = useState<SkuSortDirection>("none");
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [locallyRemovedSkuKeys, setLocallyRemovedSkuKeys] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<{
    sku: string;
    title: string;
    hasDraftChanges: boolean;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const allProducts = useMemo(
    () =>
      products.filter((product) => !locallyRemovedSkuKeys.includes(normalizeSkuKey(product.sku))),
    [products, locallyRemovedSkuKeys]
  );

  const visibleProducts = useMemo(() => {
    const filteredProducts = filterWalmartProductsWithType(allProducts, { query, filter });
    if (skuSortDirection === "none") return filteredProducts;
    return [...filteredProducts].sort((left, right) => compareSkuNatural(left, right, skuSortDirection));
  }, [allProducts, query, filter, skuSortDirection]);

  const hasImportedProducts = allProducts.length > 0;
  const isImportEmpty = !hasImportedProducts;
  const isFilteredEmpty = hasImportedProducts && visibleProducts.length === 0;

  const emptyStateMessage = useMemo(() => {
    if (isImportEmpty) {
      return "No Walmart products imported yet. Connect Walmart, then import your products.";
    }
    if (!isFilteredEmpty) return null;
    if (filter === "draft_pending") {
      return "No products with pending drafts match this filter.";
    }
    return "No products match the selected filter.";
  }, [filter, isFilteredEmpty, isImportEmpty]);

  const skuSortLabel = useMemo(() => {
    if (skuSortDirection === "asc") return "SKU ↑";
    if (skuSortDirection === "desc") return "SKU ↓";
    return "SKU ↕";
  }, [skuSortDirection]);

  const skuAriaSort = useMemo(() => {
    if (skuSortDirection === "asc") return "ascending";
    if (skuSortDirection === "desc") return "descending";
    return "none";
  }, [skuSortDirection]);

  const draftLinkHrefBySku = useMemo(
    () =>
      new Map<string, string>(
        allProducts.map((product) => [
          product.sku,
          product.hasDraftChanges ? `/apps/ecomviper/walmart/products/${encodeURIComponent(product.sku)}` : "/apps/ecomviper/walmart/drafts",
        ])
      ),
    [allProducts]
  );

  async function handleImport() {
    setIsImporting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ecomviper/walmart/products/import", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        importedCount?: number;
        fetchedCount?: number;
        importDiagnostics?: {
          payloadShape?: string;
          fetchedCount?: number;
          inventoryUnknownCount?: number;
          imageFoundCount?: number;
          imageNotFoundCount?: number;
          imageAmbiguousCount?: number;
          imageFailedCount?: number;
        };
        error?: { message?: string };
      };

      if (!response.ok) {
        setMessage(payload.error?.message ?? "Import failed.");
        return;
      }

      const importedCount = typeof payload.importedCount === "number" ? payload.importedCount : null;
      if (importedCount === 0) {
        const fetchedCount = payload.importDiagnostics?.fetchedCount ?? payload.fetchedCount ?? 0;
        const payloadShape = payload.importDiagnostics?.payloadShape ?? "unknown";
        const inventoryUnknownCount = payload.importDiagnostics?.inventoryUnknownCount ?? 0;
        const imageFoundCount = payload.importDiagnostics?.imageFoundCount ?? 0;
        const imageNotFoundCount = payload.importDiagnostics?.imageNotFoundCount ?? 0;
        const imageAmbiguousCount = payload.importDiagnostics?.imageAmbiguousCount ?? 0;
        const imageFailedCount = payload.importDiagnostics?.imageFailedCount ?? 0;
        setMessage(
          payload.message ??
            `Import completed with zero products. fetchedCount=${fetchedCount}, payloadShape=${payloadShape}, inventoryPending=${inventoryUnknownCount}, imageFound=${imageFoundCount}, imageNotFound=${imageNotFoundCount}, imageAmbiguous=${imageAmbiguousCount}, imageFailed=${imageFailedCount}.`
        );
      } else {
        setMessage(payload.message ?? "Import completed.");
      }
      router.refresh();
    } catch {
      setMessage("Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleSyncClick(sku: string) {
    setMessage(`Sync request queued for ${sku}. Run Import Products to refresh catalog data.`);
  }

  function toggleSkuSort() {
    setSkuSortDirection((current) => {
      if (current === "none") return "asc";
      if (current === "asc") return "desc";
      return "asc";
    });
  }

  async function confirmRemoveFromCatalog() {
    if (!removeTarget) return;

    setIsRemoving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ecomviper/walmart/products/${encodeURIComponent(removeTarget.sku)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        sku?: string;
        affectedDraftCount?: number;
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.sku) {
        setMessage(payload.error?.message ?? "Could not remove product from local EcomViper catalog.");
        return;
      }

      const skuKey = normalizeSkuKey(payload.sku);
      setLocallyRemovedSkuKeys((current) => (current.includes(skuKey) ? current : [...current, skuKey]));
      const affectedDraftCount = payload.affectedDraftCount ?? 0;
      setMessage(
        affectedDraftCount > 0
          ? `Removed ${payload.sku} from EcomViper catalog. ${affectedDraftCount} local draft(s) were removed.`
          : `Removed ${payload.sku} from EcomViper catalog.`
      );
      setRemoveTarget(null);
      router.refresh();
    } catch {
      setMessage("Could not remove product from local EcomViper catalog.");
    } finally {
      setIsRemoving(false);
    }
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
            disabled={isImporting}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
          >
            {isImporting ? "Importing..." : "Import Products"}
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
          <table className="min-w-[1080px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2">Image</th>
                <th className="py-2" aria-sort={skuAriaSort}>
                  <button
                    type="button"
                    onClick={toggleSkuSort}
                    className="inline-flex items-center rounded-md px-1 py-0.5 text-left text-xs uppercase tracking-[0.1em] text-[#64748B] hover:text-[#0F172A]"
                    aria-label="Sort by SKU"
                  >
                    {skuSortLabel}
                  </button>
                </th>
                <th className="py-2">Title</th>
                <th className="py-2">Brand</th>
                <th className="py-2">Price</th>
                <th className="py-2 text-center" data-testid="ecomviper-walmart-products-inventory-header">Inventory</th>
                <th className="py-2">Status</th>
                <th className="py-2">Last Synced</th>
                <th className="py-2">Issues</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.sku} className="border-t border-[#E2E8F0] align-top">
                  <td className="py-2 pr-2">
                    {product.imageUrl ? (
                      <div className="space-y-1">
                        <img
                          src={product.imageUrl}
                          alt={`${product.sku} image`}
                          className="h-10 w-10 rounded border border-[#D9E4F0] bg-[#F8FBFF] object-cover"
                          loading="lazy"
                        />
                        <p className="max-w-[180px] text-[11px] text-[#475569]">{formatImageStatus(product)}</p>
                        <p className="max-w-[180px] text-[11px] text-[#64748B]">Source: {formatImageSource(product)}</p>
                        {hasPendingDraftImage(product) ? (
                          <p className="max-w-[180px] text-[11px] text-amber-700">Pending draft image</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">N/A</span>
                        <p className="max-w-[180px] text-[11px] text-[#475569]">{formatImageStatus(product)}</p>
                        <p className="max-w-[180px] text-[11px] text-[#64748B]">Source: {formatImageSource(product)}</p>
                        {hasPendingDraftImage(product) ? (
                          <p className="max-w-[180px] text-[11px] text-amber-700">Pending draft image</p>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium text-[#0F172A]">
                    <Link
                      href={`/apps/ecomviper/walmart/products/${encodeURIComponent(product.sku)}`}
                      className="hover:text-[#1D4ED8]"
                    >
                      {product.sku}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-[#334155]">
                    <Link
                      href={`/apps/ecomviper/walmart/products/${encodeURIComponent(product.sku)}`}
                      className="hover:text-[#1D4ED8]"
                    >
                      {product.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-[#334155]">
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{product.brand}</span>
                      {product.hasDraftChanges &&
                      product.brand.trim() !== (product.liveBrand ?? product.brand).trim() ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-700">
                          Pending draft
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-[#334155]">${product.price.toFixed(2)}</td>
                  <td className="py-2 px-2 text-center text-[#334155]" data-testid="ecomviper-walmart-products-inventory-cell">
                    {formatInventory(product)}
                  </td>
                  <td className="py-2 pr-2"><StatusBadge status={product.status} /></td>
                  <td className="py-2 pr-2 text-[#334155]">{product.lastSyncedAt}</td>
                  <td className="py-2 pr-2 text-[#334155]">{product.issues.join(", ") || "None"}</td>
                  <td className="py-2 pr-3 text-right">
                    <details className="relative inline-block text-left">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-[#D9E4F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:border-[#BFDBFE] hover:bg-[#F8FAFF] [&::-webkit-details-marker]:hidden">
                        Actions
                        <span aria-hidden="true">▾</span>
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-[#D9E4F0] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                        <Link
                          href={`/apps/ecomviper/walmart/products/${encodeURIComponent(product.sku)}`}
                          className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          Edit Product
                        </Link>
                        <Link
                          href={draftLinkHrefBySku.get(product.sku) ?? "/apps/ecomviper/walmart/drafts"}
                          className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          {product.hasDraftChanges ? "View Draft" : "View Drafts"}
                        </Link>
                        <Link
                          href={`/apps/ecomviper/walmart/products/${encodeURIComponent(product.sku)}`}
                          className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          Optimize with AI
                        </Link>
                        {!product.imageUrl && (product.publicWalmartUrl || product.publicWalmartProductId) ? (
                          <Link
                            href={`/apps/ecomviper/walmart/products/${encodeURIComponent(product.sku)}`}
                            className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                          >
                            Resolve images
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleSyncClick(product.sku)}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          Sync
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRemoveTarget({
                              sku: product.sku,
                              title: product.title,
                              hasDraftChanges: Boolean(product.hasDraftChanges),
                            })
                          }
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-rose-700 hover:bg-rose-50"
                          data-testid={`ecomviper-walmart-remove-${encodeURIComponent(product.sku)}`}
                        >
                          Remove from EcomViper catalog
                        </button>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {emptyStateMessage ? (
                <tr className="border-t border-[#E2E8F0]">
                  <td colSpan={10} className="py-6 text-center text-sm text-[#64748B]">
                    {emptyStateMessage}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {removeTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F172A]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-2xl border border-[#D9E4F0] bg-white p-5 shadow-[0_22px_48px_rgba(15,23,42,0.28)]">
            <h2 className="text-lg font-semibold text-[#0F172A]">Remove product from EcomViper catalog?</h2>
            <p className="mt-2 text-sm text-[#334155]">
              This removes the product from your EcomViper workspace only. It will not delete, retire, unpublish, or change the product on Walmart.
            </p>
            {removeTarget.hasDraftChanges ? (
              <p className="mt-2 text-sm text-[#9A3412]">
                Any local EcomViper drafts for this product will also be removed.
              </p>
            ) : null}
            <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#334155]">
              <p><span className="font-medium text-[#0F172A]">SKU:</span> {removeTarget.sku}</p>
              <p><span className="font-medium text-[#0F172A]">Title:</span> {removeTarget.title}</p>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                disabled={isRemoving}
                className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#334155]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveFromCatalog}
                disabled={isRemoving}
                className="rounded-lg border border-rose-700 bg-rose-700 px-3 py-2 text-sm text-white"
              >
                {isRemoving ? "Removing..." : "Remove from EcomViper"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
