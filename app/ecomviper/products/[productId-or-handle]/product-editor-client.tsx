"use client";

import Link from "next/link";
import { matchRocktomicBySkus } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

function asIso(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString();
}

export default function EcomViperProductEditorClient({ initialState }: { initialState: ShopifyProductEditorInitialState }) {
  const product = initialState.currentShopifyListing;

  if (!product) {
    return (
      <main className="ibrains-shell min-h-screen p-6" data-testid="ecomviper-product-editor-page">
        <article className="mx-auto max-w-4xl rounded-2xl border border-[#D9E4F0] bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Product unavailable</h1>
          <p className="mt-2 text-sm text-[#475569]">{initialState.notFoundMessage || "Product not found for this workspace."}</p>
          <div className="mt-4">
            <Link href="/ecomviper" className="text-sm text-[#1D4ED8] hover:underline">Back to Products</Link>
          </div>
        </article>
      </main>
    );
  }

  const skus = product.variants.map((variant) => variant.sku.trim()).filter(Boolean);
  const supplierMatch = matchRocktomicBySkus(skus);

  return (
    <main className="ibrains-shell min-h-screen p-6" data-testid="ecomviper-product-editor-page">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">Product Editor / PDP Optimizer</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">{product.title}</h1>
          <p className="mt-2 text-sm text-[#475569]">Shopify-first PDP editor foundation with Rocktomic SKU intelligence placeholders and future publication controls.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#334155]">
            <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1">Source: {initialState.sourceLabel}</span>
            <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1">Last synced: {asIso(initialState.lastSyncedAt)}</span>
            <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1">OpenAI: {initialState.openAiStatusLabel}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/ecomviper" className="text-[#1D4ED8] hover:underline">Back to Products</Link>
            <Link href={`/ecomviper/shopify/products/${encodeURIComponent(initialState.productReference)}`} className="text-[#1D4ED8] hover:underline">
              Open Shopify 3-step editor
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2" data-testid="ecomviper-product-editor-sections">
          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Shopify Product Data</h2>
            <p className="mt-2 text-sm text-[#475569]">Vendor: {product.vendor || "-"}</p>
            <p className="text-sm text-[#475569]">Product type: {product.productType || "-"}</p>
            <p className="text-sm text-[#475569]">Status: {product.status || "-"}</p>
            <p className="text-sm text-[#475569]">Variants: {product.variants.length}</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Supplier Intelligence</h2>
            {supplierMatch.status === "rocktomic" ? (
              <>
                <p className="mt-2 text-sm text-[#475569]">Supplier: {supplierMatch.product?.supplier || "Rocktomic"}</p>
                <p className="text-sm text-[#475569]">SKU: {supplierMatch.matchedSku}</p>
                <p className="text-sm text-[#475569]">Match confidence: {Math.round(supplierMatch.matchConfidence * 100)}%</p>
                <p className="text-sm text-[#475569]">Match reason: {supplierMatch.matchReason}</p>
                <p className="text-sm text-[#475569]">Product Name: {supplierMatch.product?.productName || "-"}</p>
                <p className="text-sm text-[#475569]">Category: {supplierMatch.product?.category || "-"}</p>
                <p className="text-sm text-[#475569]">Certifications: {(supplierMatch.product?.certifications || []).join(", ") || "-"}</p>
                <p className="text-sm text-[#475569]">Dietary attributes: {(supplierMatch.product?.dietaryAttributes || []).join(", ") || "-"}</p>
                <p className="text-sm text-[#475569]">Manufacturing claims: {(supplierMatch.product?.manufacturingClaims || []).join(", ") || "-"}</p>
                <p className="text-sm text-[#475569]">COA status: {supplierMatch.product?.coa.status || "-"}</p>
                <p className="text-sm text-[#475569]">Label template status: {supplierMatch.product?.labelTemplate.status || "-"}</p>
                <p className="text-sm text-[#475569]">Mockup status: {supplierMatch.product?.mockup.status || "-"}</p>
                <p className="text-sm text-[#475569]">Inventory status: {supplierMatch.product?.inventoryStatus || "-"}</p>
                <p className="text-sm text-[#475569]">Pricing status: {supplierMatch.product?.pricingStatus || "-"}</p>
                <p className="text-sm text-[#475569]">Policy status: {supplierMatch.product?.policyStatus || "-"}</p>
                <p className="text-sm text-[#475569]">Last sync/source status: {supplierMatch.product?.lastSyncedAt ? asIso(supplierMatch.product.lastSyncedAt) : "-"}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#475569]">No Rocktomic SKU match found. Additional supplier intelligence sources are pending.</p>
            )}
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">AI PDP Optimizer</h2>
            <p className="mt-2 text-sm text-[#475569]">This foundation keeps optimization controls deterministic and review-first. Live optimization execution remains in Shopify editor workflows.</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Image Studio</h2>
            <p className="mt-2 text-sm text-[#475569]">Future output contracts:</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-[#475569]">
              <li>Product images: 2048 x 2048, WebP, square 1:1, up to 12 images</li>
              <li>Rocktomic labels: JPG, 300 DPI, max 10MB, filename `SKU.jpg`</li>
              <li>Brand reference uploads preserved for style consistency</li>
              <li>Generated files downloadable by merchant</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Buy Now Links</h2>
            <p className="mt-2 text-sm text-[#475569]">Marketplace fields modeled for Shopify, Amazon, Walmart, eBay, Etsy, TikTok Shop, and custom URLs:</p>
            <p className="mt-2 text-xs text-[#64748B]">`marketplace`, `buy_now_url`, `button_label`, `price`, `availability`, `priority_order`, `tracking_utm`, `enabled`</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Publish Controls</h2>
            <p className="mt-2 text-sm text-[#475569]">EcomViper.com remains the future public optimized PDP surface. Public publishing, schema endpoints, and agent routes are architecture-documented and not fully executed in this sprint.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
