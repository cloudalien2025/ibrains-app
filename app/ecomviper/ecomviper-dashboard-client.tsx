"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackToBrainsLink from "@/components/brains/back-to-brains-link";
import type { EcomViperInventoryStatus, EcomViperProductInventoryRow } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";

interface EcomViperDashboardClientProps {
  shopifyConnected: boolean;
  storeDomain: string;
  shopifyStatusLabel: string;
  lastImportAt: string | null;
  productCount: number;
  sourceWarnings: string[];
  rows: EcomViperProductInventoryRow[];
}

type SupplierFilter = "all" | "rocktomic" | "unmatched";
type ShopifyStatusFilter = "all" | "active" | "draft" | "archived";
type PublishedFilter = "all" | "yes" | "no";
type ScoreFilter = "all" | "0-49" | "50-74" | "75-100";
type InventoryFilter = "all" | EcomViperInventoryStatus;

function asIso(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString();
}

function scoreMatches(value: number, filter: ScoreFilter): boolean {
  if (filter === "all") return true;
  if (filter === "0-49") return value <= 49;
  if (filter === "50-74") return value >= 50 && value <= 74;
  return value >= 75;
}

function inventoryLabel(status: EcomViperInventoryStatus): string {
  if (status === "in_stock") return "In stock";
  if (status === "out_of_stock") return "Out of stock";
  if (status === "mixed") return "Mixed";
  return "Unavailable";
}

export default function EcomViperDashboardClient({
  shopifyConnected,
  storeDomain,
  shopifyStatusLabel,
  lastImportAt,
  productCount,
  sourceWarnings,
  rows,
}: EcomViperDashboardClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>("all");
  const [shopifyStatusFilter, setShopifyStatusFilter] = useState<ShopifyStatusFilter>("all");
  const [publishedFilter, setPublishedFilter] = useState<PublishedFilter>("all");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const searchMatch =
        !normalizedSearch ||
        row.productName.toLowerCase().includes(normalizedSearch) ||
        (row.sku || "").toLowerCase().includes(normalizedSearch) ||
        row.vendor.toLowerCase().includes(normalizedSearch);

      const supplierMatch = supplierFilter === "all" || row.supplierMatch === supplierFilter;
      const shopifyMatch = shopifyStatusFilter === "all" || row.shopifyStatus === shopifyStatusFilter;
      const publishedMatch =
        publishedFilter === "all" ||
        (publishedFilter === "yes" ? row.publishedToEcomViper : !row.publishedToEcomViper);
      const scoreMatch = scoreMatches(row.aiPdpScore, scoreFilter);
      const inventoryMatch = inventoryFilter === "all" || row.inventoryStatus === inventoryFilter;

      return searchMatch && supplierMatch && shopifyMatch && publishedMatch && scoreMatch && inventoryMatch;
    });
  }, [inventoryFilter, publishedFilter, rows, scoreFilter, search, shopifyStatusFilter, supplierFilter]);

  const navBaseClass =
    "rounded-lg border border-transparent px-3 py-2 text-left text-sm text-[#334155] hover:border-[#D9E4F0] hover:bg-[#F8FBFF]";

  return (
    <main className="ibrains-shell min-h-screen text-[#0F172A]" data-testid="ecomviper-overview-page">
      <div className="mx-auto max-w-[1380px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <BackToBrainsLink className="text-sm font-medium text-[#1D4ED8] hover:text-[#1E40AF] hover:underline" />
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
            EcomViper Shopify Foundation
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]" data-testid="ecomviper-brain-sidebar">
            <div className="mb-3 border-b border-[#E2E8F0] pb-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">ECOMVIPER</p>
              <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Shopify Inventory Workspace</h2>
              <p className="mt-1 text-xs text-[#64748B]">Shopify-first listings foundation with SKU-based supplier intelligence.</p>
            </div>
            <nav className="grid gap-1" aria-label="EcomViper workspace navigation">
              <Link href="/ecomviper" className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-left text-sm text-[#0F172A]">Overview</Link>
              <a href="#ecomviper-products-panel" className={navBaseClass}>Products</a>
              <a href="#ecomviper-products-panel" className={navBaseClass}>Product Editor / PDP Optimizer</a>
              <span className={navBaseClass}>Image Studio</span>
              <Link href="/ecomviper/dropshipping/rocktomic" className={navBaseClass}>Dropshipping</Link>
              <Link href="/ecomviper/dropshipping/rocktomic" className="ml-4 rounded-lg border border-transparent px-3 py-2 text-left text-sm text-[#334155] hover:border-[#D9E4F0] hover:bg-[#F8FBFF]">
                Rocktomic
              </Link>
              <span className={navBaseClass}>Agentic Visibility</span>
              <Link href="/ecomviper/shopify" className={navBaseClass}>Settings</Link>
            </nav>
          </aside>

          <section className="space-y-6" data-testid="ecomviper-brain-workspace">
            <section className="rounded-[1.5rem] border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
              <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[#0F172A]">EcomViper Products</h1>
              <p className="mt-2 max-w-4xl text-sm text-[#475569]">
                Connect Shopify with your Shopify custom app credentials, import listings, and open PDP editor workflows from the product table.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm">Shopify: {shopifyStatusLabel}</p>
                <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm">Store: {storeDomain || "Not connected"}</p>
                <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm">Products: {productCount}</p>
                <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm">Last import: {asIso(lastImportAt)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link href="/ecomviper/shopify" className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 font-medium text-white">
                  Open Shopify Connection Settings
                </Link>
                <Link href="/ecomviper/shopify?demo=1" className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-[#334155]">
                  Open Demo Mode
                </Link>
              </div>
              {!shopifyConnected ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Shopify live sync is pending until credentials are saved and Sync Now is run in Shopify Settings.
                </p>
              ) : null}
              {sourceWarnings.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {sourceWarnings.join(" ")}
                </div>
              ) : null}
            </section>

            <section
              id="ecomviper-products-panel"
              className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
              data-testid="ecomviper-products-panel"
            >
              <h2 className="text-lg font-semibold text-[#0F172A]">Products / Listings</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products"
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                />
                <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value as SupplierFilter)} className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm">
                  <option value="all">Supplier match: all</option>
                  <option value="rocktomic">Rocktomic</option>
                  <option value="unmatched">Unmatched</option>
                </select>
                <select value={shopifyStatusFilter} onChange={(event) => setShopifyStatusFilter(event.target.value as ShopifyStatusFilter)} className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm">
                  <option value="all">Shopify status: all</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
                <select value={publishedFilter} onChange={(event) => setPublishedFilter(event.target.value as PublishedFilter)} className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm">
                  <option value="all">Published: all</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <select value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value as ScoreFilter)} className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm">
                  <option value="all">AI/PDP score: all</option>
                  <option value="0-49">0-49</option>
                  <option value="50-74">50-74</option>
                  <option value="75-100">75-100</option>
                </select>
                <select value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value as InventoryFilter)} className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm">
                  <option value="all">Inventory: all</option>
                  <option value="in_stock">In stock</option>
                  <option value="out_of_stock">Out of stock</option>
                  <option value="mixed">Mixed</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm" data-testid="ecomviper-products-table">
                  <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                    <tr>
                      <th className="py-2 pr-3">Product image</th>
                      <th className="py-2 pr-3">Product name</th>
                      <th className="py-2 pr-3">SKU</th>
                      <th className="py-2 pr-3">Vendor</th>
                      <th className="py-2 pr-3">Product type</th>
                      <th className="py-2 pr-3">Shopify status</th>
                      <th className="py-2 pr-3">Supplier match</th>
                      <th className="py-2 pr-3">AI/PDP score</th>
                      <th className="py-2 pr-3">Published status</th>
                      <th className="py-2 pr-3">Inventory status</th>
                      <th className="py-2 pr-3">Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t border-[#E2E8F0] text-[#334155]"
                        onClick={() => router.push(row.productEditorHref)}
                        data-testid="ecomviper-product-row"
                      >
                        <td className="py-3 pr-3">
                          {row.imageUrl ? (
                            <img src={row.imageUrl} alt={row.productName} className="h-10 w-10 rounded-md border border-[#D9E4F0] object-cover" />
                          ) : (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#D9E4F0] text-xs text-[#64748B]">N/A</span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <Link
                            href={row.productEditorHref}
                            className="font-medium text-[#1D4ED8] hover:text-[#1E40AF] hover:underline"
                            data-testid="ecomviper-product-editor-link"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.productName}
                          </Link>
                        </td>
                        <td className="py-3 pr-3">{row.sku || "-"}</td>
                        <td className="py-3 pr-3">{row.vendor}</td>
                        <td className="py-3 pr-3">{row.productType}</td>
                        <td className="py-3 pr-3">{row.shopifyStatus}</td>
                        <td className="py-3 pr-3">
                          {row.supplierMatch === "rocktomic"
                            ? `Rocktomic (${row.supplierMatchedSku}) · ${Math.round(row.supplierMatchConfidence * 100)}%`
                            : "Unmatched"}
                        </td>
                        <td className="py-3 pr-3">{row.aiPdpScore}</td>
                        <td className="py-3 pr-3">{row.publishedToEcomViper ? "Yes" : "No"}</td>
                        <td className="py-3 pr-3">{inventoryLabel(row.inventoryStatus)}</td>
                        <td className="py-3 pr-3">{asIso(row.lastUpdated)}</td>
                      </tr>
                    ))}
                    {!filteredRows.length ? (
                      <tr className="border-t border-[#E2E8F0]">
                        <td colSpan={11} className="py-6 text-center text-sm text-[#64748B]">
                          No products match current filters. Connect Shopify and run import/sync to populate listings.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
                <h3 className="text-base font-semibold text-[#0F172A]">Product Editor / PDP Optimizer</h3>
                <p className="mt-2 text-sm text-[#475569]">Product rows open PDP editor routes with Shopify context, supplier intelligence, optimization placeholders, and publish controls.</p>
              </article>
              <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
                <h3 className="text-base font-semibold text-[#0F172A]">Image Studio</h3>
                <p className="mt-2 text-sm text-[#475569]">Module shell is active. Future output rules are documented for 2048x2048 WebP product images and SKU-named 300 DPI label JPG exports.</p>
              </article>
              <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
                <h3 className="text-base font-semibold text-[#0F172A]">Dropshipping / Rocktomic</h3>
                <p className="mt-2 text-sm text-[#475569]">SKU matching is platform-managed. Merchants do not manually upload Rocktomic files in normal workflow.</p>
              </article>
              <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
                <h3 className="text-base font-semibold text-[#0F172A]">Agentic Visibility + Settings</h3>
                <p className="mt-2 text-sm text-[#475569]">Agentic discoverability and EcomViper.com publication remain approval-gated future modules; settings stay in Shopify connection surfaces.</p>
              </article>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
