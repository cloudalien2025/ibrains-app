// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import EcomViperProductEditorClient from "@/app/ecomviper/products/[productId-or-handle]/product-editor-client";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

describe("ecomviper product editor source sync required", () => {
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

  it("shows explicit sync required message when supplier record is missing", async () => {
    const state: ShopifyProductEditorInitialState = {
      productReference: "roc949",
      productFound: true,
      notFoundMessage: null,
      source: "fallback_snapshot",
      sourceLabel: "Fallback Snapshot",
      hydrationMode: "fallback",
      currentShopifyListing: {
        productId: "gid://shopify/Product/949",
        title: "Premium Magnesium Glycinate Gummies",
        handle: "premium-magnesium-glycinate-gummies",
        status: "active",
        vendor: "OPA Nutrition",
        productType: "Supplements",
        tags: [],
        collections: [],
        descriptionText: "",
        descriptionHtml: "",
        seoTitle: "",
        seoDescription: "",
        productUrl: "",
        canonicalUrl: "",
        primaryImageUrl: "",
        images: [],
        variants: [{ id: "v", title: "Default", sku: "ROC949", barcode: "", price: 39.99, compareAtPrice: null, inventoryQuantity: 1 }],
        metafields: [],
        source: "fallback_snapshot",
        sourceLabel: "Fallback Snapshot",
        hydrationMode: "fallback",
        lastSyncedAt: null,
        fetchedAt: new Date().toISOString(),
      },
      optimizedShopifyProposal: null,
      editableShopifyDraft: null,
      openAiConnected: false,
      openAiStatusLabel: "Not connected",
      lastSyncedAt: null,
      warnings: [],
      pdpIntelligence: null,
      supplierContext: {
        matched: false,
        matchedSku: null,
        matchConfidence: 0,
        matchReason: "no_supplier_sku_match",
        platform: "rocktomic",
        syncStatus: "never_synced",
        syncRequired: true,
        syncMessage: "Supplier data has not been synced for this SKU. Run source sync.",
        inventoryAvailable: false,
        lastSupplierCheckAt: null,
        product: null,
      },
    };

    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={state} />);
    });

    expect(container.textContent).toContain("Supplier data has not been synced for this SKU. Run source sync.");
  });
});
