// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import EcomViperProductEditorClient from "@/app/ecomviper/products/[productId-or-handle]/product-editor-client";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

function buildState(): ShopifyProductEditorInitialState {
  return {
    productReference: "roc949",
    productFound: true,
    notFoundMessage: null,
    source: "live_shopify",
    sourceLabel: "Live Shopify",
    hydrationMode: "live",
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
      images: [
        {
          url: "https://example.com/front.png",
          altText: "front",
          source: "shopify_media",
        },
      ],
      variants: [{ id: "v", title: "Default", sku: "ROC949", barcode: "", price: 39.99, compareAtPrice: null, inventoryQuantity: 5 }],
      metafields: [],
      source: "live_shopify",
      sourceLabel: "Live Shopify",
      hydrationMode: "live",
      lastSyncedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    },
    optimizedShopifyProposal: null,
    editableShopifyDraft: null,
    openAiConnected: true,
    openAiStatusLabel: "Connected",
    lastSyncedAt: new Date().toISOString(),
    warnings: [],
    pdpIntelligence: null,
    supplierContext: {
      matched: true,
      matchedSku: "ROC949",
      matchConfidence: 0.95,
      matchReason: "sku_match",
      platform: "rocktomic",
      syncStatus: "synced",
      syncRequired: false,
      syncMessage: null,
      inventoryAvailable: true,
      lastSupplierCheckAt: new Date().toISOString(),
      product: null,
    },
    sourceFacts: {
      available: false,
      staleIntelligence: false,
      selectedMembershipTier: null,
      effectiveMembershipTier: null,
      usingDefaultMembershipTier: false,
      amountPerServing: { value: null, displayText: "" },
      activeIngredients: { values: [], status: "not_available" },
      dietaryAllergenAttributes: { values: [], status: "not_available", displayText: "" },
      keyProductFeatures: { values: [], status: "not_available" },
      certifications: { values: [], status: "not_available" },
      manufacturingClaims: { values: [], status: "not_available" },
      servingSize: { value: null, displayText: "" },
      servingsPerContainer: { value: null, displayText: "" },
      supplementFacts: { value: null, displayText: "" },
      otherIngredients: { value: null, displayText: "" },
      commerce: {
        shopifyPrice: null,
        compareAtPrice: null,
        wholesaleCost: null,
        msrp: null,
        marginPercent: null,
        estimatedProfit: null,
        pricingStatusLabel: "Not available yet",
        message: "Select membership tier to calculate",
      },
      assets: {
        coaStatus: "unknown",
        coaUrl: "",
        message: "Not available yet",
        labelTemplateUrl: "",
        mockupUrl: "",
      },
      inventory: {
        status: "unknown",
        displayText: "Not available yet",
      },
      diagnostics: [],
    },
  };
}

describe("ecomviper product editor final layout", () => {
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

  it("starts with hero row and keeps summary shipping fields in the summary card", async () => {
    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={buildState()} />);
    });

    const hero = container.querySelector('[data-testid="ecomviper-product-hero"]');
    const editArea = container.querySelector('[data-testid="ecomviper-product-edit-area"]');
    expect(hero).not.toBeNull();
    expect(editArea).not.toBeNull();
    expect(hero?.compareDocumentPosition(editArea as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const summaryCard = container.querySelector('[data-testid="ecomviper-product-summary-card"]');
    expect(summaryCard?.textContent).toContain("Premium Magnesium Glycinate Gummies");
    expect(summaryCard?.textContent).toContain("Shipping Time");
    expect(summaryCard?.textContent).toContain("Return Policy");
    expect(container.querySelector('[data-testid="ecomviper-shipping-card"]')).toBeNull();
  });

  it("places action row above tabs with generate, save, and publish only", async () => {
    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={buildState()} />);
    });

    const actionRow = container.querySelector('[data-testid="ecomviper-product-editor-actions"]');
    const tabs = container.querySelector('[data-testid="ecomviper-product-editor-tabs"]');
    expect(actionRow).not.toBeNull();
    expect(tabs).not.toBeNull();
    expect(actionRow?.compareDocumentPosition(tabs as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const actionButtons = actionRow?.querySelectorAll("button") ?? [];
    expect(Array.from(actionButtons).map((button) => button.textContent?.trim())).toEqual([
      "Generate Intelligence",
      "Save Changes",
      "Publish",
    ]);

    expect(container.textContent).not.toContain("Preview PDP");
    expect(container.textContent).not.toContain("Workspace Metadata");
    expect(container.querySelector('[data-testid="ecomviper-publish-helper"]')?.textContent).toContain("ecomviper.com");
  });
});
