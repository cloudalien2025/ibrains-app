// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ShopifyProductEditorClient from "@/app/ecomviper/shopify/products/[productId-or-handle]/shopify-product-editor-client";
import { buildCurrentShopifyListingDocket, buildEditableShopifyDraft } from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

function createProductRecord(): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/101",
    storeDomain: "opanutrition.myshopify.com",
    title: "OPA Enzyme Balance",
    handle: "opa-enzyme-balance",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    status: "ACTIVE",
    tags: ["digestive"],
    description: "Digestive enzyme blend",
    descriptionHtml: "<p>Digestive enzyme blend</p>",
    seoTitle: "OPA Enzyme Balance",
    seoDescription: "Digestive enzyme blend",
    metafields: [],
    onlineStoreUrl: "https://opanutrition.myshopify.com/products/opa-enzyme-balance",
    primaryImageUrl: "https://cdn.shopify.com/opa-main.jpg",
    galleryImageUrls: ["https://cdn.shopify.com/opa-main.jpg"],
    galleryImages: [],
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/201",
        productId: "gid://shopify/Product/101",
        title: "Default",
        sku: "ROC011",
        barcode: "0123456789012",
        price: 24.99,
        compareAtPrice: 29.99,
        inventoryQuantity: 12,
        selectedOptions: [{ name: "Size", value: "60 ct" }],
        imageUrl: "https://cdn.shopify.com/opa-main.jpg",
        imageAltText: "OPA bottle front",
        imageUrls: ["https://cdn.shopify.com/opa-main.jpg"],
      },
    ],
  };
}

function createInitialState(overrides: Partial<ShopifyProductEditorInitialState> = {}): ShopifyProductEditorInitialState {
  const current = buildCurrentShopifyListingDocket(createProductRecord(), {
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    collections: ["Digestive Support"],
  });

  return {
    productReference: current.handle,
    productFound: true,
    notFoundMessage: null,
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    currentShopifyListing: current,
    optimizedShopifyProposal: null,
    editableShopifyDraft: buildEditableShopifyDraft(current, null),
    openAiConnected: true,
    openAiStatusLabel: "Connected",
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    warnings: [],
    pdpIntelligence: null,
    supplierFactsPanel: {
      status: "matched",
      supplierSlug: "rocktomic",
      message: "Validated supplier match found from shared ecommerce database.",
      checkedIdentifiers: {
        skus: ["ROC011"],
        normalizedSkus: ["ROC011"],
        barcodes: ["0123456789012"],
        handle: "opa-enzyme-balance",
        title: "OPA Enzyme Balance",
      },
      matchStatus: "matched",
      matchConfidence: "exact_sku",
      matchReasons: ["exact SKU match (ROC011)"],
      supplierName: "Rocktomic",
      supplierSku: "ROC011",
      supplierProductName: "OPA Enzyme Balance",
      validationStatus: "blocked",
      readiness: {
        ingredientMatching: "ready_with_warnings",
        productEditorFacts: "ready_with_warnings",
        pricing: "ready_with_warnings",
        inventory: "ready",
        complianceEvidence: "blocked",
        optiPixelAssets: "ready",
        channelImageGeneration: "ready",
      },
      sourceFactsSummary: [],
      supplementFactsSummary: ["Serving Size: 2 capsules"],
      activeIngredients: ["Bromelain 200mg"],
      otherIngredients: ["Vegetable capsule"],
      servingSize: "2 capsules",
      servingsPerContainer: "30",
      directions: "Take daily",
      warnings: "Consult physician",
      pricingSummary: {
        available: false,
        wholesaleCost: null,
        msrp: null,
        currency: "USD",
        statusLabel: "Pricing unavailable",
      },
      inventorySummary: {
        available: true,
        status: "in_stock",
        raw: "120",
        comments: null,
      },
      assetSummary: {
        coaPresent: false,
        coaUrl: null,
        labelTemplateAiPresent: true,
        mockupTemplateTifPresent: true,
        readyForOptiPixel: true,
      },
      evidence: {
        sourceMethod: "ai_pdf_text",
        aiLabelTextEvidenceStatus: "success",
        needsReview: true,
        missingCoaWarning: true,
        topDefects: ["missing_coa"],
      },
    },
    supplierContext: {
      matched: false,
      matchedSku: null,
      matchConfidence: 0,
      matchReason: "no_supplier_sku_match",
      platform: null,
      syncStatus: null,
      syncRequired: false,
      syncMessage: null,
      inventoryAvailable: false,
      lastSupplierCheckAt: null,
      product: null,
    },
    ...overrides,
  };
}

describe("shopify product editor supplier facts panel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("renders read-only supplier facts with compliance warning semantics", async () => {
    await act(async () => {
      root.render(<ShopifyProductEditorClient initialState={createInitialState()} />);
    });

    const panel = container.querySelector('[data-testid="ecomviper-shopify-supplier-facts-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain("Supplier Source Facts");
    expect(panel.textContent).toContain("Ingredient Matching: ready with warnings");
    expect(panel.textContent).toContain("Compliance Evidence: blocked");
    expect(panel.textContent).toContain("COA missing is a compliance warning only");
    expect(panel.textContent).toContain("Pricing unavailable");
    expect(panel.querySelector("button")).toBeNull();
  });

  it("renders unavailable state without crashing editor", async () => {
    await act(async () => {
      root.render(
        <ShopifyProductEditorClient
          initialState={createInitialState({
            supplierFactsPanel: {
              ...createInitialState().supplierFactsPanel!,
              status: "unavailable",
              matchStatus: "unavailable",
              message: "Supplier facts unavailable",
            },
          })}
        />
      );
    });

    const panel = container.querySelector('[data-testid="ecomviper-shopify-supplier-facts-panel"]') as HTMLElement;
    expect(panel.textContent).toContain("Supplier facts unavailable");
    expect(container.querySelector('[data-testid="ecomviper-shopify-editor-tabs"]')).not.toBeNull();
  });
});
