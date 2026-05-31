"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ProductImageGallery from "@/components/ecomviper/product-image-gallery";
import {
  createEmptyShopifyPdpIntelligenceRecord,
  sanitizeShopifyPdpIntelligenceRecord,
  type ShopifyPdpFaqEntry,
  type ShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import { orderProductImages } from "@/lib/ecomviper/shopify/product-image-ordering";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";
import { safeIsoDate, safeMoney } from "@/lib/ui/safe-formatters";

type AsyncStatus = "idle" | "loading" | "success" | "error";
type EditorTab =
  | "overview"
  | "ingredients"
  | "trust"
  | "commerce"
  | "agentic"
  | "assets"
  | "seo";

interface PdpIntelligenceApiResponse {
  ok?: boolean;
  intelligence?: ShopifyPdpIntelligenceRecord | null;
  generationUnavailable?: boolean;
  message?: string | null;
  error?: {
    message?: string;
  };
}

function asIso(value: string | null): string {
  return safeIsoDate(value, "Never");
}

function asMoney(value: number | null, currency = "USD"): string {
  return safeMoney(value, { currency, fallback: "Unknown" });
}

function listToTextarea(values: string[]): string {
  return values.join("\n");
}

function textareaToList(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function upsertFaq(
  faqs: ShopifyPdpFaqEntry[],
  index: number,
  patch: Partial<ShopifyPdpFaqEntry>
): ShopifyPdpFaqEntry[] {
  return faqs.map((faq, faqIndex) => (faqIndex === index ? { ...faq, ...patch } : faq));
}

function chipTone(ok: boolean): string {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

function availabilityFromInventoryStatus(status: string): string {
  if (status === "in_stock") return "Available";
  if (status === "low_stock") return "Action Required: Mark Out of Stock";
  if (status === "out_of_stock") return "Currently Unavailable";
  if (status === "source_unavailable") return "Inventory Status Unavailable";
  return "Availability Unknown";
}

function meaningfulList(values: string[]): string[] {
  return values
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.toLowerCase() !== "unknown");
}

function sourceFieldText(value: string | undefined, displayText: string | undefined): string {
  return value?.trim() || displayText?.trim() || "";
}

function displayValue(value: string | null | undefined, fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function looksLikeImageUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (/(\.png|\.jpe?g|\.webp|\.gif|\.avif|\.svg)(\?.*)?$/.test(normalized)) return true;
  if (/\/generated-media\//.test(normalized)) return true;
  return false;
}

function validImageUrls(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && looksLikeImageUrl(value));
}

export default function EcomViperProductEditorClient({ initialState }: { initialState: ShopifyProductEditorInitialState }) {
  const product = initialState.currentShopifyListing;

  if (!product) {
    return (
      <section data-testid="ecomviper-product-editor-page">
        <article className="mx-auto max-w-4xl rounded-2xl border border-[#D9E4F0] bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Product unavailable</h1>
          <p className="mt-2 text-sm text-[#475569]">{initialState.notFoundMessage || "Product not found for this workspace."}</p>
          <div className="mt-4">
            <Link href="/ecomviper" className="text-sm text-[#1D4ED8] hover:underline">Back to Products</Link>
          </div>
        </article>
      </section>
    );
  }

  const supplierProduct = initialState.supplierContext.product;
  const sourceFacts = initialState.sourceFacts ?? null;
  const baseRecord = useMemo(() => {
    const fallback = createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: product.productId,
      productHandle: product.handle || null,
      supplier: supplierProduct?.supplier || null,
      supplierSku: initialState.supplierContext.matchedSku,
    });
    const seeded = initialState.pdpIntelligence
      ? sanitizeShopifyPdpIntelligenceRecord(initialState.pdpIntelligence, fallback)
      : fallback;
    const sourceIngredients = sourceFacts?.activeIngredients.values.length
      ? sourceFacts.activeIngredients.values
      : supplierProduct?.activeIngredients || [];
    const sourceDietary = sourceFacts?.dietaryAllergenAttributes.values.length
      ? sourceFacts.dietaryAllergenAttributes.values
      : supplierProduct?.dietaryAttributes || [];
    const sourceSupplementFacts = sourceFacts
      ? sourceFieldText(sourceFacts.supplementFacts.value, sourceFacts.supplementFacts.displayText)
      : supplierProduct?.supplementFacts?.value || "";
    const sourceServingSize = sourceFacts
      ? sourceFieldText(sourceFacts.servingSize.value, sourceFacts.servingSize.displayText)
      : supplierProduct?.servingSize || "";
    const sourceServingsPerContainer = sourceFacts
      ? sourceFieldText(sourceFacts.servingsPerContainer.value, sourceFacts.servingsPerContainer.displayText)
      : supplierProduct?.servingsPerContainer || "";
    const sourceOtherIngredients = sourceFacts
      ? sourceFieldText(sourceFacts.otherIngredients.value, sourceFacts.otherIngredients.displayText)
      : supplierProduct?.otherIngredients || "";
    const sourceAmountPerServing = sourceFacts
      ? sourceFieldText(sourceFacts.amountPerServing.value, sourceFacts.amountPerServing.displayText)
      : supplierProduct?.amountPerServing || "";
    const sourceIngredientHighlights =
      meaningfulList(seeded.ingredient_highlights).length > 0
        ? meaningfulList(seeded.ingredient_highlights)
        : supplierProduct?.ingredientHighlights || [];
    const sourcePrice = sourceFacts?.commerce.shopifyPrice ?? seeded.price ?? null;
    const sourceCompareAt = sourceFacts?.commerce.compareAtPrice ?? seeded.compare_at_price ?? null;
    const sourceWholesale = sourceFacts?.commerce.wholesaleCost ?? null;
    const sourceMsrp = sourceFacts?.commerce.msrp ?? null;
    const sourceProfit = sourceFacts?.commerce.estimatedProfit ?? null;
    const sourceMargin = sourceFacts?.commerce.marginPercent ?? null;
    const sourceInventoryStatus = sourceFacts?.inventory.status || supplierProduct?.inventoryStatus || "unknown";
    const sourceAvailabilityStatus = sourceFacts?.inventory.displayText || availabilityFromInventoryStatus(sourceInventoryStatus);

    return {
      ...seeded,
      shopify_product_id: product.productId,
      product_handle: product.handle || null,
      supplier: supplierProduct?.supplier ?? seeded.supplier,
      supplier_sku: initialState.supplierContext.matchedSku ?? seeded.supplier_sku,
      certifications:
        sourceFacts?.certifications.values?.length
          ? sourceFacts.certifications.values
          : supplierProduct?.certifications?.length
            ? supplierProduct.certifications
            : meaningfulList(seeded.certifications),
      dietary_attributes:
        sourceFacts?.dietaryAllergenAttributes.values?.length
          ? sourceFacts.dietaryAllergenAttributes.values
          : sourceDietary,
      manufacturing_claims:
        sourceFacts?.manufacturingClaims.values?.length
          ? sourceFacts.manufacturingClaims.values
          : supplierProduct?.manufacturingClaims?.length
            ? supplierProduct.manufacturingClaims
            : meaningfulList(seeded.manufacturing_claims),
      inventory_status: sourceInventoryStatus,
      availability_status: sourceAvailabilityStatus,
      coa_status: sourceFacts?.assets.coaStatus || seeded.coa_status || supplierProduct?.coa?.status || "unknown",
      coa_link: sourceFacts?.assets.coaUrl || seeded.coa_link || supplierProduct?.coa?.url || "",
      coa_testing_categories:
        seeded.coa_testing_categories.length > 0
          ? seeded.coa_testing_categories
          : supplierProduct?.coa?.testingCategories || [],
      coa_verification_status: seeded.coa_verification_status || supplierProduct?.coa?.verificationStatus || "unknown",
      ships_from: seeded.ships_from || supplierProduct?.shipping?.shipsFrom || "Unknown",
      processing_time: seeded.processing_time || supplierProduct?.shipping?.processingTime || "Unknown",
      shipping_time: seeded.shipping_time || supplierProduct?.shipping?.shippingTime || "Unknown",
      return_policy: seeded.return_policy || supplierProduct?.shipping?.returnPolicy || "Unknown",
      fulfillment_status: seeded.fulfillment_status || supplierProduct?.shipping?.fulfillmentStatus || "unknown",
      price: sourcePrice,
      compare_at_price: sourceCompareAt,
      wholesale_cost: sourceWholesale,
      msrp: sourceMsrp,
      estimated_profit: sourceProfit,
      margin_percent: sourceMargin,
      currency: seeded.currency || supplierProduct?.pricing?.currency || "USD",
      supplement_facts: sourceSupplementFacts,
      ingredients: sourceIngredients,
      serving_size: sourceServingSize,
      servings_per_container: sourceServingsPerContainer,
      other_ingredients: sourceOtherIngredients,
      key_features:
        sourceFacts?.keyProductFeatures.values?.length
          ? sourceFacts.keyProductFeatures.values
          : supplierProduct?.productFeatures?.length
            ? supplierProduct.productFeatures
            : meaningfulList(seeded.key_features),
      ingredient_highlights: sourceIngredientHighlights,
      source_diagnostics:
        sourceFacts?.diagnostics.length
          ? sourceFacts.diagnostics
          : [
              initialState.supplierContext.matched ? `Matched SKU: ${initialState.supplierContext.matchedSku}` : "Matched SKU: Unknown",
              `Inventory source: ${initialState.supplierContext.inventoryAvailable ? "Available" : "Unavailable"}`,
              `coa_link_status: ${supplierProduct?.coaLinkStatus || "not_present"}`,
              `coa_link_error: ${supplierProduct?.coaLinkError || "none"}`,
              `membership_tier_selected: ${supplierProduct?.pricing?.membershipTier || "none"}`,
              `pricing_status: ${supplierProduct?.pricing?.pricingStatusLabel || "unknown"}`,
              `amount_per_serving: ${sourceAmountPerServing || "not_extracted"}`,
              ...(supplierProduct?.sourceDiagnostics || []),
            ],
    };
  }, [initialState.pdpIntelligence, initialState.supplierContext, product.handle, product.productId, sourceFacts, supplierProduct]);

  const [record, setRecord] = useState<ShopifyPdpIntelligenceRecord>(baseRecord);
  const [generationStatus, setGenerationStatus] = useState<AsyncStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<AsyncStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("overview");

  const productReference = initialState.productReference || product.handle || product.productId;
  const selectedMembershipTier = sourceFacts?.selectedMembershipTier ?? supplierProduct?.pricing?.membershipTier ?? null;
  const effectiveMembershipTier = sourceFacts?.effectiveMembershipTier ?? selectedMembershipTier;
  const usingDefaultMembershipTier = sourceFacts?.usingDefaultMembershipTier ?? false;
  const pricingStatusLabel = sourceFacts?.commerce.pricingStatusLabel || supplierProduct?.pricing?.pricingStatusLabel || "unknown";
  const pricingMessage = sourceFacts?.commerce.message || "Select membership tier in Settings to calculate cost and profit.";
  const hasSelectedTierWholesale =
    Boolean(effectiveMembershipTier) && typeof sourceFacts?.commerce.wholesaleCost === "number";
  const supplierSyncRequired = initialState.supplierContext.syncRequired;
  const supplierSyncMessage = initialState.supplierContext.syncMessage;
  const hasInventoryQuantities = product.variants.some(
    (variant) => typeof variant.inventoryQuantity === "number" && Number.isFinite(variant.inventoryQuantity)
  );
  const inventoryCount = product.variants.reduce((total, variant) => {
    if (typeof variant.inventoryQuantity !== "number" || !Number.isFinite(variant.inventoryQuantity)) return total;
    return total + variant.inventoryQuantity;
  }, 0);
  const displaySku =
    initialState.supplierContext.matchedSku || product.variants.find((variant) => variant.sku)?.sku || "Not provided by source";
  const assetGalleryImages = useMemo(
    () =>
      orderProductImages([
        ...product.images.map((image) => ({
          url: image.url,
          altText: image.altText,
          type: image.altText,
          source: `shopify:${image.source}`,
        })),
        ...validImageUrls(record.product_images).map((url) => ({
          url,
          altText: `${product.title} product asset`,
          type: "product",
          source: "pdp-record",
        })),
        ...validImageUrls(record.supplement_facts_assets).map((url) => ({
          url,
          altText: `${product.title} supplement facts`,
          type: "supplement facts",
          source: "supplement-facts",
        })),
        ...validImageUrls(record.label_assets).map((url) => ({
          url,
          altText: `${product.title} label`,
          type: "label",
          source: "label-assets",
        })),
        ...validImageUrls(record.mockup_assets).map((url) => ({
          url,
          altText: `${product.title} lifestyle`,
          type: "lifestyle",
          source: "mockup-assets",
        })),
      ]),
    [product.images, product.title, record.label_assets, record.mockup_assets, record.product_images, record.supplement_facts_assets]
  );

  async function postAction(action: "generate" | "save", nextRecord?: ShopifyPdpIntelligenceRecord) {
    const payload =
      action === "save"
        ? { action, productReference, record: nextRecord ?? record }
        : { action, productReference };
    const response = await fetch("/api/ecomviper/pdp-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as PdpIntelligenceApiResponse;
    if (!response.ok || !body.ok || !body.intelligence) {
      throw new Error(body.error?.message || body.message || `PDP intelligence ${action} failed.`);
    }
    return body;
  }

  async function handleGenerate() {
    setGenerationStatus("loading");
    setStatusMessage(null);
    try {
      const body = await postAction("generate");
      setRecord(sanitizeShopifyPdpIntelligenceRecord(body.intelligence as ShopifyPdpIntelligenceRecord, baseRecord));
      setGenerationStatus("success");
      setStatusMessage(
        body.generationUnavailable
          ? "generation unavailable: missing server configuration"
          : "Source-grounded intelligence generated. Review before saving."
      );
    } catch (error) {
      setGenerationStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "PDP intelligence generation failed.");
    }
  }

  async function handleSave() {
    setSaveStatus("loading");
    setStatusMessage(null);
    try {
      const body = await postAction("save", record);
      setRecord(sanitizeShopifyPdpIntelligenceRecord(body.intelligence as ShopifyPdpIntelligenceRecord, baseRecord));
      setSaveStatus("success");
      setStatusMessage("PDP intelligence saved.");
    } catch (error) {
      setSaveStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "PDP intelligence save failed.");
    }
  }

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "ingredients", label: "Ingredients" },
    { id: "trust", label: "Trust & Compliance" },
    { id: "commerce", label: "Commerce" },
    { id: "agentic", label: "Agentic Visibility" },
    { id: "assets", label: "Assets" },
    { id: "seo", label: "SEO & Schema" },
  ];

  return (
    <div className="space-y-4 text-[#0F172A]" data-testid="ecomviper-product-editor-page">
      <header className="rounded-2xl border border-[#D5E2F0] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.12em] text-[#475569]">Products &gt; {product.title}</p>
            <h1 className="text-xl font-semibold tracking-tight text-[#0B1A36]">{product.title}</h1>
            <Link href="/ecomviper" className="text-sm text-[#1D4ED8] hover:underline">Back to Products</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled className="rounded-lg border border-[#C7D5E8] bg-white px-3 py-2 text-sm font-medium text-[#334155]">
              Preview PDP
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg border border-[#0F766E] bg-[#0F766E] px-3 py-2 text-sm font-medium text-white disabled:opacity-70"
              disabled={saveStatus === "loading"}
            >
              {saveStatus === "loading" ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:opacity-70"
              disabled={generationStatus === "loading"}
            >
              {generationStatus === "loading" ? "Generating..." : "Generate Intelligence"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1 ${chipTone(initialState.source === "live_shopify")}`}>
            Shopify {initialState.source === "live_shopify" ? "Connected" : "Snapshot"}
          </span>
          <span className={`rounded-full border px-3 py-1 ${chipTone(initialState.supplierContext.matched)}`}>
            {initialState.supplierContext.matched ? "Supplier Matched" : "Supplier Unmatched"}
          </span>
          <span className="rounded-full border border-[#D5E2F0] bg-[#F6FAFF] px-3 py-1 text-[#334155]">
            Inventory: {record.availability_status || "Availability Unknown"}
          </span>
          <span className={`rounded-full border px-3 py-1 ${chipTone(Boolean(record.coa_link || record.coa_status !== "unknown"))}`}>
            COA: {record.coa_status || "unknown"}
          </span>
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Last generated: {asIso(record.last_generated_at)} · Last edited: {asIso(record.last_edited_at)} · Last supplier check:{" "}
          {asIso(initialState.supplierContext.lastSupplierCheckAt)}
        </p>
        {supplierSyncRequired ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {supplierSyncMessage || "Supplier data has not been synced for this SKU. Run source sync."}
          </p>
        ) : null}
        {sourceFacts?.staleIntelligence ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Source data has changed since this intelligence was generated. Regenerate to use latest source facts.
          </p>
        ) : null}
        {statusMessage ? <p className="mt-2 text-sm text-[#334155]">{statusMessage}</p> : null}
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" data-testid="ecomviper-product-hero">
        <ProductImageGallery images={assetGalleryImages} productTitle={product.title} />
        <article className="rounded-2xl border border-[#D5E2F0] bg-white p-4 shadow-sm" data-testid="ecomviper-product-summary-card">
          <h2 className="text-sm font-semibold text-[#0B1A36]">Product Summary</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="font-semibold text-[#0B1A36]">SKU:</span> {displaySku}</p>
            <p><span className="font-semibold text-[#0B1A36]">Vendor:</span> {displayValue(product.vendor, "Not provided by source")}</p>
            <p><span className="font-semibold text-[#0B1A36]">Product Type:</span> {displayValue(product.productType, "Not provided by source")}</p>
            <p><span className="font-semibold text-[#0B1A36]">Shopify Status:</span> {displayValue(product.status, "Not provided by source")}</p>
            <p><span className="font-semibold text-[#0B1A36]">Supplier Match:</span> {initialState.supplierContext.matched ? "Matched" : "Not matched"}</p>
            <p><span className="font-semibold text-[#0B1A36]">Inventory Units:</span> {hasInventoryQuantities ? inventoryCount : "Not provided by source"}</p>
            <p>
              <span className="font-semibold text-[#0B1A36]">COA:</span>{" "}
              {record.coa_link ? (
                <a className="text-[#1D4ED8] hover:underline" href={record.coa_link} target="_blank" rel="noreferrer">View COA</a>
              ) : (
                "Available after supplier intelligence update"
              )}
            </p>
            <p><span className="font-semibold text-[#0B1A36]">Price:</span> {asMoney(record.price, record.currency)}</p>
            <p><span className="font-semibold text-[#0B1A36]">Compare-at:</span> {asMoney(record.compare_at_price, record.currency)}</p>
            <p>
              <span className="font-semibold text-[#0B1A36]">Membership Tier:</span>{" "}
              {usingDefaultMembershipTier && effectiveMembershipTier
                ? `${effectiveMembershipTier} (default)`
                : selectedMembershipTier || "Select membership tier to calculate"}
            </p>
            <p>
              <span className="font-semibold text-[#0B1A36]">Wholesale Cost:</span>{" "}
              {hasSelectedTierWholesale ? asMoney(record.wholesale_cost, record.currency) : "Available after supplier intelligence update"}
            </p>
            <p>
              <span className="font-semibold text-[#0B1A36]">Margin:</span>{" "}
              {hasSelectedTierWholesale && record.margin_percent != null
                ? `${record.margin_percent.toFixed(2)}%`
                : "Select membership tier to calculate"}
            </p>
            <p>
              <span className="font-semibold text-[#0B1A36]">Estimated Profit:</span>{" "}
              {hasSelectedTierWholesale ? asMoney(record.estimated_profit, record.currency) : "Select membership tier to calculate"}
            </p>
            <p><span className="font-semibold text-[#0B1A36]">Pricing Status:</span> {pricingStatusLabel || "Not provided by source"}</p>
            <p><span className="font-semibold text-[#0B1A36]">Last Source Check:</span> {asIso(initialState.supplierContext.lastSupplierCheckAt)}</p>
            <p><span className="font-semibold text-[#0B1A36]">Last Generated:</span> {asIso(record.last_generated_at)}</p>
          </div>
          {!effectiveMembershipTier ? (
            <p className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2 text-xs text-[#1E3A8A]">{pricingMessage}</p>
          ) : null}
        </article>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section id="product-editor-main" className="rounded-2xl border border-[#D5E2F0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2" data-testid="ecomviper-product-editor-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg border px-3 py-2 text-sm ${activeTab === tab.id ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#0F172A]" : "border-[#D9E4F0] text-[#475569]"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

            {activeTab === "overview" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm md:col-span-2">AI Product Summary
                  <textarea value={record.ai_product_summary} onChange={(e) => setRecord((s) => ({ ...s, ai_product_summary: e.target.value }))} rows={3} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Best For
                  <textarea value={listToTextarea(record.best_for)} onChange={(e) => setRecord((s) => ({ ...s, best_for: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Not Best For
                  <textarea value={listToTextarea(record.not_best_for)} onChange={(e) => setRecord((s) => ({ ...s, not_best_for: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Use Cases
                  <textarea value={listToTextarea(record.use_cases)} onChange={(e) => setRecord((s) => ({ ...s, use_cases: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Key Features
                  <textarea value={listToTextarea(record.key_features)} onChange={(e) => setRecord((s) => ({ ...s, key_features: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">Quick Facts
                  <textarea value={listToTextarea(record.quick_facts)} onChange={(e) => setRecord((s) => ({ ...s, quick_facts: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
              </div>
            ) : null}

            {activeTab === "ingredients" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm md:col-span-2">Supplement Facts
                  <textarea value={record.supplement_facts} onChange={(e) => setRecord((s) => ({ ...s, supplement_facts: e.target.value }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Active Ingredients
                  <textarea value={listToTextarea(record.ingredients)} onChange={(e) => setRecord((s) => ({ ...s, ingredients: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Amount Per Serving
                  <input value={sourceFacts?.amountPerServing.displayText || ""} readOnly className="rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-[#475569]" />
                </label>
                <label className="grid gap-1 text-sm">Serving Size
                  <input value={record.serving_size} onChange={(e) => setRecord((s) => ({ ...s, serving_size: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Servings Per Container
                  <input value={record.servings_per_container} onChange={(e) => setRecord((s) => ({ ...s, servings_per_container: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">Other Ingredients
                  <textarea value={record.other_ingredients} onChange={(e) => setRecord((s) => ({ ...s, other_ingredients: e.target.value }))} rows={2} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">Dietary / Allergen Attributes
                  <textarea value={sourceFacts?.dietaryAllergenAttributes.displayText || ""} readOnly rows={2} className="rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-[#475569]" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">Ingredient Highlights
                  <textarea value={listToTextarea(record.ingredient_highlights)} onChange={(e) => setRecord((s) => ({ ...s, ingredient_highlights: textareaToList(e.target.value) }))} rows={3} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                {sourceFacts && sourceFacts.activeIngredients.status !== "extracted" ? (
                  <p className="text-sm text-amber-800 md:col-span-2">Ingredient highlights are limited until source ingredients are available.</p>
                ) : null}
              </div>
            ) : null}

            {activeTab === "trust" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">Certifications
                  <textarea value={listToTextarea(record.certifications)} onChange={(e) => setRecord((s) => ({ ...s, certifications: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Dietary Attributes
                  <textarea value={listToTextarea(record.dietary_attributes)} onChange={(e) => setRecord((s) => ({ ...s, dietary_attributes: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Manufacturing Claims
                  <textarea value={listToTextarea(record.manufacturing_claims)} onChange={(e) => setRecord((s) => ({ ...s, manufacturing_claims: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Warnings
                  <textarea value={listToTextarea(record.warnings_text)} onChange={(e) => setRecord((s) => ({ ...s, warnings_text: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">COA Status
                  <input value={record.coa_status} onChange={(e) => setRecord((s) => ({ ...s, coa_status: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">COA Verification
                  <input value={record.coa_verification_status} onChange={(e) => setRecord((s) => ({ ...s, coa_verification_status: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
              </div>
            ) : null}

            {activeTab === "commerce" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">Price
                  <input value={record.price ?? ""} onChange={(e) => setRecord((s) => ({ ...s, price: e.target.value ? Number(e.target.value) : null }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Compare At
                  <input value={record.compare_at_price ?? ""} onChange={(e) => setRecord((s) => ({ ...s, compare_at_price: e.target.value ? Number(e.target.value) : null }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Wholesale Cost
                  <input value={record.wholesale_cost ?? ""} onChange={(e) => setRecord((s) => ({ ...s, wholesale_cost: e.target.value ? Number(e.target.value) : null }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">MSRP
                  <input value={record.msrp ?? ""} onChange={(e) => setRecord((s) => ({ ...s, msrp: e.target.value ? Number(e.target.value) : null }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Margin %
                  <input value={record.margin_percent ?? ""} onChange={(e) => setRecord((s) => ({ ...s, margin_percent: e.target.value ? Number(e.target.value) : null }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Estimated Profit
                  <input value={record.estimated_profit ?? ""} onChange={(e) => setRecord((s) => ({ ...s, estimated_profit: e.target.value ? Number(e.target.value) : null }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Selected Membership Tier
                  <input
                    value={
                      usingDefaultMembershipTier && effectiveMembershipTier
                        ? `${effectiveMembershipTier} (default)`
                        : selectedMembershipTier || "None selected"
                    }
                    readOnly
                    className="rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-[#475569]"
                  />
                </label>
                <label className="grid gap-1 text-sm">Pricing Status
                  <input value={pricingStatusLabel} readOnly className="rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-[#475569]" />
                </label>
                <label className="grid gap-1 text-sm">Inventory Status
                  <input value={record.inventory_status} onChange={(e) => setRecord((s) => ({ ...s, inventory_status: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Availability Status
                  <input value={record.availability_status} onChange={(e) => setRecord((s) => ({ ...s, availability_status: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                {!effectiveMembershipTier ? (
                  <p className="text-sm text-[#475569] md:col-span-2">
                    {pricingMessage}
                  </p>
                ) : null}
                {effectiveMembershipTier && !hasSelectedTierWholesale ? (
                  <p className="text-sm text-amber-800 md:col-span-2">
                    {pricingMessage}
                  </p>
                ) : null}
                {supplierSyncRequired ? (
                  <p className="text-sm text-amber-800 md:col-span-2">
                    Supplier data has not been synced for this SKU. Run source sync.
                  </p>
                ) : null}
              </div>
            ) : null}

            {activeTab === "agentic" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">FAQ Topics
                  <textarea value={listToTextarea(record.faq)} onChange={(e) => setRecord((s) => ({ ...s, faq: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Buyer Intent Mapping
                  <textarea value={listToTextarea(record.buyer_intent_mapping)} onChange={(e) => setRecord((s) => ({ ...s, buyer_intent_mapping: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Entity Mapping
                  <textarea value={listToTextarea(record.entity_mapping)} onChange={(e) => setRecord((s) => ({ ...s, entity_mapping: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Semantic Coverage
                  <textarea value={listToTextarea(record.semantic_coverage)} onChange={(e) => setRecord((s) => ({ ...s, semantic_coverage: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">Agentic Selection Notes
                  <textarea value={record.agentic_selection_notes} onChange={(e) => setRecord((s) => ({ ...s, agentic_selection_notes: e.target.value }))} rows={3} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>

                <div className="md:col-span-2 rounded-lg border border-[#D9E4F0] p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#0F172A]">Expanded FAQ</h3>
                    <button
                      type="button"
                      className="rounded border border-[#D9E4F0] px-2 py-1 text-xs text-[#334155]"
                      onClick={() =>
                        setRecord((current) => ({
                          ...current,
                          faqs: [
                            ...current.faqs,
                            {
                              question: "",
                              answer: "",
                              category: "general",
                              schema_eligible: false,
                              compliance_status: "review_required",
                            },
                          ],
                        }))
                      }
                    >
                      Add FAQ
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {record.faqs.map((faq, index) => (
                      <div key={`${index}-${faq.question}`} className="rounded border border-[#E2E8F0] p-3">
                        <label className="grid gap-1 text-xs text-[#475569]">
                          Question
                          <input
                            value={faq.question}
                            onChange={(event) =>
                              setRecord((current) => ({ ...current, faqs: upsertFaq(current.faqs, index, { question: event.target.value }) }))
                            }
                            className="rounded border border-[#D9E4F0] px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="mt-2 grid gap-1 text-xs text-[#475569]">
                          Answer
                          <textarea
                            value={faq.answer}
                            onChange={(event) =>
                              setRecord((current) => ({ ...current, faqs: upsertFaq(current.faqs, index, { answer: event.target.value }) }))
                            }
                            rows={2}
                            className="rounded border border-[#D9E4F0] px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "assets" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2 rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-sm text-[#334155]">
                  <p>COA: {sourceFacts?.assets.coaUrl ? <a href={sourceFacts.assets.coaUrl} target="_blank" rel="noreferrer" className="text-[#1D4ED8] hover:underline">View COA</a> : sourceFacts?.assets.message || "COA Link: source sync required"}</p>
                  <p>COA Status: {record.coa_status || "unknown"}</p>
                  <p>Label Template: {sourceFacts?.assets.labelTemplateUrl ? <a href={sourceFacts.assets.labelTemplateUrl} target="_blank" rel="noreferrer" className="text-[#1D4ED8] hover:underline">Open label template</a> : "Not available"}</p>
                  <p>Mockup: {sourceFacts?.assets.mockupUrl ? <a href={sourceFacts.assets.mockupUrl} target="_blank" rel="noreferrer" className="text-[#1D4ED8] hover:underline">Open mockup</a> : "Not available"}</p>
                </div>
                <div className="md:col-span-2 rounded-lg border border-[#D9E4F0] bg-white p-3 text-sm text-[#334155]">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Gallery Asset Sources</h3>
                  <div className="mt-2 space-y-1 text-xs">
                    {assetGalleryImages.length ? (
                      assetGalleryImages.slice(0, 12).map((asset) => (
                        <p key={asset.id}>
                          <span className="font-medium capitalize">{asset.type}:</span>{" "}
                          <a href={asset.url} target="_blank" rel="noreferrer" className="text-[#1D4ED8] hover:underline">{asset.url}</a>
                        </p>
                      ))
                    ) : (
                      <p>No image assets available.</p>
                    )}
                  </div>
                </div>
                <label className="grid gap-1 text-sm">Product Images
                  <textarea value={listToTextarea(record.product_images)} onChange={(e) => setRecord((s) => ({ ...s, product_images: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Supplement Facts Assets
                  <textarea value={listToTextarea(record.supplement_facts_assets)} onChange={(e) => setRecord((s) => ({ ...s, supplement_facts_assets: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">COA Assets
                  <textarea value={listToTextarea(record.coa_assets)} onChange={(e) => setRecord((s) => ({ ...s, coa_assets: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Label Assets
                  <textarea value={listToTextarea(record.label_assets)} onChange={(e) => setRecord((s) => ({ ...s, label_assets: textareaToList(e.target.value) }))} rows={4} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">Mockup Assets / Future Image Studio
                  <textarea value={listToTextarea(record.mockup_assets)} onChange={(e) => setRecord((s) => ({ ...s, mockup_assets: textareaToList(e.target.value) }))} rows={3} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
              </div>
            ) : null}

            {activeTab === "seo" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">SEO Title
                  <input value={record.seo_title} onChange={(e) => setRecord((s) => ({ ...s, seo_title: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Meta Description
                  <input value={record.meta_description} onChange={(e) => setRecord((s) => ({ ...s, meta_description: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Product Schema
                  <textarea value={record.product_schema} onChange={(e) => setRecord((s) => ({ ...s, product_schema: e.target.value }))} rows={2} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Offer Schema
                  <textarea value={record.offer_schema} onChange={(e) => setRecord((s) => ({ ...s, offer_schema: e.target.value }))} rows={2} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">FAQ Schema
                  <textarea value={record.faq_schema} onChange={(e) => setRecord((s) => ({ ...s, faq_schema: e.target.value }))} rows={2} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">Review Schema
                  <textarea value={record.review_schema} onChange={(e) => setRecord((s) => ({ ...s, review_schema: e.target.value }))} rows={2} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">Agentic Schema Readiness
                  <input value={record.agentic_schema_readiness} onChange={(e) => setRecord((s) => ({ ...s, agentic_schema_readiness: e.target.value }))} className="rounded-lg border border-[#D9E4F0] px-3 py-2" />
                </label>
              </div>
            ) : null}
        </section>

        <aside className="space-y-3">
          <section className="rounded-2xl border border-[#D5E2F0] bg-white p-4 shadow-sm" data-testid="ecomviper-shipping-card">
            <h2 className="text-sm font-semibold">Shipping</h2>
            <div className="mt-2 space-y-1 text-xs text-[#475569]">
              <p>Ships From: {record.ships_from || "Unknown"}</p>
              <p>Processing Time: {record.processing_time || "Unknown"}</p>
              <p>Shipping Time: {record.shipping_time || "Unknown"}</p>
              <p>Return Policy: {record.return_policy || "Unknown"}</p>
              <p>Fulfillment Status: {record.fulfillment_status || "unknown"}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#D5E2F0] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Workspace Metadata</h2>
            <div className="mt-2 space-y-1 text-xs text-[#475569]">
              <p>Reference: {initialState.productReference || product.handle || product.productId}</p>
              <p>Handle: {product.handle || "Not provided by source"}</p>
              <p>Source: {initialState.sourceLabel}</p>
              <p>Hydration: {initialState.hydrationMode}</p>
              <p>Last Shopify Sync: {asIso(initialState.lastSyncedAt)}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
