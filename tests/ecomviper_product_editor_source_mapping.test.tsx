// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import EcomViperProductEditorClient from "@/app/ecomviper/products/[productId-or-handle]/product-editor-client";
import { createEmptyShopifyPdpIntelligenceRecord } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import { buildCurrentShopifyListingDocket } from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

function createProductRecord(): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/949",
    storeDomain: "opanutrition.myshopify.com",
    title: "Premium Magnesium Glycinate Gummies",
    handle: "premium-magnesium-glycinate-gummies",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    status: "ACTIVE",
    tags: [],
    description: "Magnesium gummies",
    descriptionHtml: "<p>Magnesium gummies</p>",
    seoTitle: "Premium Magnesium Glycinate Gummies",
    seoDescription: "Magnesium gummies",
    metafields: [],
    onlineStoreUrl: "https://opanutrition.myshopify.com/products/premium-magnesium-glycinate-gummies",
    primaryImageUrl: "",
    galleryImageUrls: [],
    galleryImages: [],
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/949",
        productId: "gid://shopify/Product/949",
        title: "Default",
        sku: "ROC949",
        barcode: "",
        price: 39.99,
        compareAtPrice: null,
        inventoryQuantity: 4,
        selectedOptions: [],
        imageUrl: "",
        imageAltText: null,
        imageUrls: [],
      },
    ],
  };
}

function createInitialState(): ShopifyProductEditorInitialState {
  const current = buildCurrentShopifyListingDocket(createProductRecord(), {
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    lastSyncedAt: "2026-05-30T00:00:00.000Z",
    collections: [],
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
    editableShopifyDraft: null,
    openAiConnected: true,
    openAiStatusLabel: "Connected",
    lastSyncedAt: "2026-05-30T00:00:00.000Z",
    warnings: [],
    pdpIntelligence: null,
    sourceFacts: {
      shopifyProductId: current.productId,
      shopifyProductHandle: current.handle,
      shopifySku: "ROC949",
      normalizedSku: "ROC949",
      supplierProductRecordFound: true,
      pricingRecordFound: true,
      inventoryRecordFound: true,
      assetsRecordFound: true,
      selectedMembershipTier: "Non Member Pricing",
      effectiveMembershipTier: "Non Member Pricing",
      usingDefaultMembershipTier: false,
      detectedMembershipTiers: ["Non Member Pricing"],
      lastGlobalSupplierSyncAt: "2026-05-30T00:00:00.000Z",
      lastGeneratedIntelligenceAt: null,
      staleIntelligence: false,
      supplementFacts: {
        status: "extracted",
        value: "Serving Size: 1 gummy | Servings Per Container: 60 | Magnesium (as Magnesium Glycinate): 30mg",
        displayText: "Serving Size: 1 gummy | Servings Per Container: 60 | Magnesium (as Magnesium Glycinate): 30mg",
      },
      activeIngredients: {
        status: "extracted",
        values: ["Magnesium (as Magnesium Glycinate)"],
        displayText: "Magnesium (as Magnesium Glycinate)",
      },
      amountPerServing: {
        status: "extracted",
        value: "Magnesium (as Magnesium Glycinate) 30mg",
        displayText: "Magnesium (as Magnesium Glycinate) 30mg",
      },
      otherIngredients: {
        status: "extracted",
        value: "Glucose syrup, sugar",
        displayText: "Glucose syrup, sugar",
      },
      servingSize: { status: "extracted", value: "1 gummy", displayText: "1 gummy" },
      servingsPerContainer: { status: "extracted", value: "60", displayText: "60" },
      dietaryAllergenAttributes: { status: "extracted", values: ["Vegan"], displayText: "Vegan" },
      keyProductFeatures: {
        status: "extracted",
        values: ["Premium magnesium glycinate gummies"],
        displayText: "Premium magnesium glycinate gummies",
      },
      certifications: {
        status: "extracted",
        values: ["GMP Facility"],
        displayText: "GMP Facility",
      },
      manufacturingClaims: {
        status: "extracted",
        values: ["Made in USA"],
        displayText: "Made in USA",
      },
      testingClaims: {
        status: "source_missing",
        values: [],
        displayText: "Testing Claims not found in normalized source record.",
      },
      commerce: {
        shopifyPrice: 39.99,
        compareAtPrice: null,
        wholesaleCost: 12.47,
        msrp: 39.99,
        estimatedProfit: 27.52,
        marginPercent: 68.82,
        currency: "USD",
        pricingStatusLabel: "tier_pricing_mapped",
        message: "Selected membership tier pricing mapped.",
      },
      inventory: { status: "in_stock", displayText: "Available" },
      assets: {
        coaUrl: "https://example.com/ROC949-COA.pdf",
        labelTemplateUrl: "https://example.com/templates.html",
        mockupUrl: "https://example.com/templates.html",
        coaStatus: "available",
        coaLinkStatus: "extracted",
        message: "available/extracted",
      },
      missingFields: [],
      diagnostics: [
        "normalized_sku: ROC949",
        "global_supplier_product_record_found: true",
        "global_pricing_record_found: true",
        "global_inventory_record_found: true",
        "global_assets_record_found: true",
        "supplement_facts_status: extracted",
      ],
    },
    supplierContext: {
      matched: true,
      matchedSku: "ROC949",
      matchConfidence: 1,
      matchReason: "exact_supplier_sku_match",
      platform: "rocktomic",
      inventoryAvailable: true,
      lastSupplierCheckAt: "2026-05-30T00:00:00.000Z",
      product: {
        supplier: "Rocktomic",
        sku: "ROC949",
        productName: "Premium Magnesium Glycinate Gummies",
        category: "Premium Gummies",
        labelSize: "2.25",
        containerSize: "60 gummies",
        productWeight: "8 oz",
        servingSize: "1 gummy",
        servingsPerContainer: "60",
        activeIngredients: ["Magnesium (as Magnesium Glycinate)"],
        amountPerServing: "Magnesium (as Magnesium Glycinate) 30mg",
        ingredientHighlights: ["Magnesium glycinate"],
        productFeatures: ["Premium magnesium glycinate gummies"],
        otherIngredients: "Glucose syrup, sugar",
        allergenDietaryAttributes: ["Gluten-Free"],
        sourceDiagnostics: ["coa_link_status: extracted"],
        coaLinkStatus: "extracted",
        coaLinkError: null,
        coa: {
          status: "available",
          url: "https://example.com/ROC949-COA.pdf",
          expiresAt: null,
          testingCategories: [],
          verificationStatus: "pending",
        },
        labelTemplate: { status: "available", url: "https://example.com/templates.html" },
        mockup: { status: "available", url: "https://example.com/templates.html" },
        certifications: ["GMP Facility"],
        dietaryAttributes: ["Vegan"],
        manufacturingClaims: ["Made in USA"],
        supplementFacts: {
          status: "available",
          value:
            "Serving Size: 1 gummy | Servings Per Container: 60 | Magnesium (as Magnesium Glycinate): 30mg",
        },
        suggestedUse: { status: "pending_source", value: null },
        warnings: { status: "pending_source", value: null },
        inventoryStatus: "in_stock",
        discontinuedStatus: "active",
        pricingStatus: "current",
        policyStatus: "available",
        pricing: {
          wholesaleCost: 12.47,
          msrp: 39.99,
          estimatedProfit: 27.52,
          marginPercent: 68.82,
          currency: "USD",
          sourceStatus: "available",
        },
        shipping: {
          shipsFrom: "US",
          processingTime: "1-3 business days",
          shippingTime: "3-7 business days",
          returnPolicy: "Configured",
          fulfillmentStatus: "platform_managed",
        },
        lastSyncedAt: "2026-05-30T00:00:00.000Z",
        sourceVersion: "test",
        sourceUpdatedAt: "2026-05-30T00:00:00.000Z",
      },
    },
  };
}

describe("ecomviper product editor supplier field mapping", () => {
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

  it("pre-populates ingredient model and COA link from supplier mapping", async () => {
    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={createInitialState()} />);
    });

    const ingredientsTab = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Ingredients")
    ) as HTMLButtonElement;
    await act(async () => {
      ingredientsTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Magnesium (as Magnesium Glycinate)");
    expect(container.textContent).toContain("Serving Size");
    expect(container.querySelector('input[value="1 gummy"]')).not.toBeNull();
    expect(container.querySelector('input[value="60"]')).not.toBeNull();
    expect(container.textContent).toContain("Glucose syrup, sugar");
    expect(container.textContent).toContain("global_assets_record_found: true");
    expect(container.textContent).toContain("COA Link: View COA");
  });

  it("renders explicit OCR-required source state instead of stale generated Unknown values", async () => {
    const state = createInitialState();
    const fallback = createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: state.currentShopifyListing?.productId || "gid://shopify/Product/949",
      productHandle: state.currentShopifyListing?.handle || null,
      supplier: "Rocktomic",
      supplierSku: "ROC949",
    });
    state.pdpIntelligence = {
      ...fallback,
      supplement_facts: "Unknown",
      ingredients: ["Unknown"],
      serving_size: "Unknown",
      inventory_status: "source_unavailable",
      availability_status: "Inventory Status Unavailable",
      last_generated_at: "2026-05-29T00:00:00.000Z",
    };
    if (state.sourceFacts) {
      state.sourceFacts.staleIntelligence = true;
      state.sourceFacts.supplementFacts = {
        status: "ocr_required",
        value: "",
        displayText: "Supplement Facts require OCR extraction from catalog label image.",
      };
      state.sourceFacts.activeIngredients = {
        status: "ocr_required",
        values: [],
        displayText: "Active Ingredients require OCR extraction from catalog label image.",
      };
    }

    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={state} />);
    });

    const ingredientsTab = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Ingredients")
    ) as HTMLButtonElement;
    await act(async () => {
      ingredientsTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Supplement Facts require OCR extraction from catalog label image.");
    expect(container.textContent).toContain("Source data has changed since this intelligence was generated.");
    expect(container.textContent).toContain("Inventory: Available");
  });

  it("labels default pricing tier and low-stock action-required inventory deterministically", async () => {
    const state = createInitialState();
    if (state.sourceFacts) {
      state.sourceFacts.selectedMembershipTier = null;
      state.sourceFacts.effectiveMembershipTier = "Non Member Pricing";
      state.sourceFacts.usingDefaultMembershipTier = true;
      state.sourceFacts.inventory = { status: "low_stock", displayText: "Action Required: Mark Out of Stock" };
      state.sourceFacts.commerce.wholesaleCost = 18.87;
      state.sourceFacts.commerce.message = "Pricing Tier: Non Member Pricing (default)";
    }

    await act(async () => {
      root.render(<EcomViperProductEditorClient initialState={state} />);
    });

    expect(container.textContent).toContain("Selected Membership Tier: Non Member Pricing (default)");
    expect(container.textContent).toContain("Action Required: Mark Out of Stock");
    expect(container.textContent).toContain("COA Document Parsing: pending");
  });
});
