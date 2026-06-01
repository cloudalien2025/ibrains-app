import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

const mocks = vi.hoisted(() => ({
  queryEcommerce: vi.fn(),
}));

vi.mock("@/lib/ecommerce/database", () => ({
  queryEcommerce: mocks.queryEcommerce,
}));

function createState(overrides?: Partial<ShopifyProductEditorInitialState>): ShopifyProductEditorInitialState {
  const state: ShopifyProductEditorInitialState = {
    productReference: "opa-oxy-burn-thermogenic-support",
    productFound: true,
    notFoundMessage: null,
    source: "live_shopify",
    sourceLabel: "Live Shopify",
    hydrationMode: "live",
    currentShopifyListing: {
      productId: "gid://shopify/Product/123",
      title: "OPA Oxy-Burn Thermogenic Support",
      handle: "opa-oxy-burn-thermogenic-support",
      status: "active",
      vendor: "OPA",
      productType: "Supplements",
      tags: ["supplement"],
      collections: [],
      descriptionText: "desc",
      descriptionHtml: "<p>desc</p>",
      seoTitle: "OPA Oxy-Burn Thermogenic Support",
      seoDescription: "desc",
      productUrl: "",
      canonicalUrl: "",
      primaryImageUrl: "https://example.com/front.jpg",
      images: [{ id: "img-1", url: "https://example.com/front.jpg", altText: "front", source: "product" }],
      variants: [{ id: "v1", title: "Default", sku: "ROC123", barcode: "", price: 39.99, compareAtPrice: null, inventoryQuantity: 4 }],
      metafields: [],
      source: "live_shopify",
      sourceLabel: "Live Shopify",
      hydrationMode: "live",
      lastSyncedAt: null,
      fetchedAt: "2026-06-01T00:00:00.000Z",
    },
    optimizedShopifyProposal: null,
    editableShopifyDraft: null,
    openAiConnected: false,
    openAiStatusLabel: "Not connected",
    lastSyncedAt: null,
    warnings: [],
    pdpIntelligence: null,
    sourceFacts: {
      shopifyProductId: "gid://shopify/Product/123",
      shopifyProductHandle: "opa-oxy-burn-thermogenic-support",
      shopifySku: "ROC123",
      normalizedSku: "ROC123",
      supplierProductRecordFound: true,
      pricingRecordFound: true,
      inventoryRecordFound: true,
      assetsRecordFound: true,
      selectedMembershipTier: null,
      effectiveMembershipTier: null,
      usingDefaultMembershipTier: false,
      detectedMembershipTiers: [],
      lastGlobalSupplierSyncAt: null,
      lastGeneratedIntelligenceAt: null,
      staleIntelligence: false,
      supplementFacts: { status: "ocr_required", value: "", displayText: "" },
      activeIngredients: { status: "ocr_required", values: [], displayText: "" },
      amountPerServing: { status: "ocr_required", value: "", displayText: "" },
      otherIngredients: { status: "source_missing", value: "", displayText: "" },
      servingSize: { status: "source_missing", value: "", displayText: "" },
      servingsPerContainer: { status: "source_missing", value: "", displayText: "" },
      dietaryAllergenAttributes: { status: "source_missing", values: [], displayText: "" },
      keyProductFeatures: { status: "source_missing", values: [], displayText: "" },
      certifications: { status: "source_missing", values: [], displayText: "" },
      manufacturingClaims: { status: "source_missing", values: [], displayText: "" },
      testingClaims: { status: "source_missing", values: [], displayText: "" },
      commerce: {
        shopifyPrice: 39.99,
        compareAtPrice: null,
        wholesaleCost: 15.0,
        msrp: 49.99,
        estimatedProfit: 24.99,
        marginPercent: 62.5,
        currency: "USD",
        pricingStatusLabel: "ready",
        message: "ready",
      },
      inventory: { status: "in_stock", displayText: "in stock" },
      assets: {
        coaUrl: "https://example.com/coa.pdf",
        labelTemplateUrl: "https://example.com/label.ai",
        mockupUrl: "https://example.com/mockup.tif",
        coaStatus: "available",
        coaLinkStatus: "extracted",
        message: "available",
      },
      missingFields: [],
      diagnostics: [],
    },
    supplierFactsPanel: null,
    supplierContext: {
      matched: true,
      matchedSku: "ROC123",
      matchConfidence: 1,
      matchReason: "exact_supplier_sku_match",
      platform: "rocktomic",
      syncStatus: "synced",
      syncRequired: false,
      syncMessage: null,
      inventoryAvailable: true,
      lastSupplierCheckAt: null,
      product: {
        supplier: "Rocktomic",
        sku: "ROC123",
        productName: "Oxy Burn",
        category: "Supplements",
        labelSize: null,
        containerSize: null,
        productWeight: null,
        servingSize: null,
        servingsPerContainer: null,
        activeIngredients: [],
        amountPerServing: null,
        ingredientHighlights: [],
        productFeatures: [],
        otherIngredients: null,
        allergenDietaryAttributes: [],
        sourceDiagnostics: [],
        coaLinkStatus: "extracted",
        coaLinkError: null,
        coa: { status: "available", url: "https://example.com/coa.pdf" },
        labelTemplate: { status: "available", url: "https://example.com/label.ai" },
        mockup: { status: "available", url: "https://example.com/mockup.tif" },
        certifications: [],
        dietaryAttributes: [],
        manufacturingClaims: [],
        supplementFacts: { status: "ocr_required", value: null },
        suggestedUse: { status: "pending_source", value: null },
        warnings: { status: "pending_source", value: null },
        inventoryStatus: "in_stock",
        discontinuedStatus: "active",
        pricingStatus: "current",
        policyStatus: "available",
        pricing: {
          wholesaleCost: 15,
          msrp: 49.99,
          estimatedProfit: null,
          marginPercent: null,
          currency: "USD",
          sourceStatus: "available",
        },
        shipping: undefined,
        lastSyncedAt: "2026-06-01T00:00:00.000Z",
        sourceVersion: "v1",
        sourceUpdatedAt: "2026-06-01T00:00:00.000Z",
      },
    },
  };

  return {
    ...state,
    ...overrides,
    currentShopifyListing: overrides?.currentShopifyListing ?? state.currentShopifyListing,
    sourceFacts: overrides?.sourceFacts ?? state.sourceFacts,
    supplierContext: overrides?.supplierContext ?? state.supplierContext,
    supplierFactsPanel: overrides?.supplierFactsPanel ?? state.supplierFactsPanel,
  };
}

describe("live supplier facts hydration", () => {
  const originalEcommerceUrl = process.env.ECOMMERCE_DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    mocks.queryEcommerce.mockReset();
    process.env.ECOMMERCE_DATABASE_URL = "postgres://ecommerce";
  });

  afterEach(() => {
    if (originalEcommerceUrl == null) {
      delete process.env.ECOMMERCE_DATABASE_URL;
    } else {
      process.env.ECOMMERCE_DATABASE_URL = originalEcommerceUrl;
    }
  });

  it("hydrates structured facts from ecommerce DB when live state is image-only", async () => {
    mocks.queryEcommerce.mockResolvedValue([
      {
        sku: "ROC123",
        product_name: "Oxy Burn",
        source_facts: {},
        supplement_facts: {
          activeIngredients: ["Caffeine Anhydrous", "Green Tea Extract"],
          amountPerServing: ["Caffeine Anhydrous 200 mg", "Green Tea Extract 300 mg"],
        },
        source_evidence: { supplementFacts: { sourceMethod: "ai_pdf_text", needsReview: false } },
        coa_url: "https://example.com/coa.pdf",
        label_template_ai_url: "https://example.com/label.ai",
        mockup_template_tif_url: "https://example.com/mockup.tif",
        ai_label_text_evidence: { extractionStatus: "reused_cached" },
      },
    ]);

    const { hydrateLiveSupplierFactsForCopywriting } = await import("@/lib/ecomviper/copywriting-agent/live-supplier-facts-hydration");
    const result = await hydrateLiveSupplierFactsForCopywriting(createState());

    expect(result.supplierFactsReadSource).toBe("db");
    expect(result.supplierFactsReadFound).toBe(true);
    expect(result.state.supplierFactsPanel?.matchStatus).toBe("matched");
    expect(result.state.supplierFactsPanel?.activeIngredients.length).toBeGreaterThan(0);
    expect(result.state.supplierFactsPanel?.ingredientAmounts.length).toBeGreaterThan(0);
  });

  it("keeps none when no DB/artifact facts are found", async () => {
    mocks.queryEcommerce.mockResolvedValue([]);

    const state = createState({
      currentShopifyListing: {
        ...createState().currentShopifyListing!,
        variants: [{ id: "v1", title: "Default", sku: "UNKNOWN999", barcode: "", price: 10, compareAtPrice: null, inventoryQuantity: 1 }],
      },
      sourceFacts: {
        ...createState().sourceFacts!,
        shopifySku: "UNKNOWN999",
        normalizedSku: "UNKNOWN999",
      },
      supplierContext: {
        ...createState().supplierContext,
        matchedSku: "UNKNOWN999",
      },
    });

    const { hydrateLiveSupplierFactsForCopywriting } = await import("@/lib/ecomviper/copywriting-agent/live-supplier-facts-hydration");
    const result = await hydrateLiveSupplierFactsForCopywriting(state);

    expect(result.supplierFactsReadSource).toBe("none");
    expect(result.supplierFactsReadFound).toBe(false);
  });
});
