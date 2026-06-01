import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  buildShopifyProductEditorStateForUser: vi.fn(),
  getShopifyOpenAiApiKeyForUser: vi.fn(),
  getPersistedShopifyPdpIntelligenceForProduct: vi.fn(),
  savePersistedShopifyPdpIntelligence: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/shopify/shopify-product-editor-state", async () => {
  const actual = await vi.importActual("@/lib/ecomviper/shopify/shopify-product-editor-state");
  return {
    ...(actual as object),
    buildShopifyProductEditorStateForUser: mocks.buildShopifyProductEditorStateForUser,
  };
});

vi.mock("@/lib/ecomviper/shopify/openai-connection", () => ({
  getShopifyOpenAiApiKeyForUser: mocks.getShopifyOpenAiApiKeyForUser,
}));

vi.mock("@/lib/ecomviper/shopify/shopify-pdp-intelligence-repository", () => ({
  getPersistedShopifyPdpIntelligenceForProduct: mocks.getPersistedShopifyPdpIntelligenceForProduct,
  savePersistedShopifyPdpIntelligence: mocks.savePersistedShopifyPdpIntelligence,
}));

function stateFixture(overrides?: Partial<ShopifyProductEditorInitialState>): ShopifyProductEditorInitialState {
  const base: ShopifyProductEditorInitialState = {
    productReference: "test-product",
    productFound: true,
    notFoundMessage: null,
    source: "live_shopify",
    sourceLabel: "Live Shopify",
    hydrationMode: "live",
    currentShopifyListing: {
      productId: "gid://shopify/Product/999",
      title: "Test Supplement",
      handle: "test-supplement",
      status: "active",
      vendor: "OPA Nutrition",
      productType: "Supplements",
      tags: ["supplement"],
      collections: [],
      descriptionText: "Sample text",
      descriptionHtml: "<p>Sample text</p>",
      seoTitle: "Test Supplement",
      seoDescription: "Sample meta",
      productUrl: "",
      canonicalUrl: "",
      primaryImageUrl: "https://example.com/front.jpg",
      images: [{ id: "img-1", url: "https://example.com/front.jpg", altText: "front", source: "product" }],
      variants: [{ id: "v1", title: "Default", sku: "SKU-1", barcode: "", price: 19.99, compareAtPrice: null, inventoryQuantity: 8 }],
      metafields: [],
      source: "live_shopify",
      sourceLabel: "Live Shopify",
      hydrationMode: "live",
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
    supplierFactsPanel: {
      status: "matched",
      supplierSlug: "rocktomic",
      message: "matched",
      checkedIdentifiers: {
        skus: ["SKU-1"],
        normalizedSkus: ["SKU1"],
        barcodes: [],
        handle: "test-supplement",
        title: "Test Supplement",
      },
      matchStatus: "matched",
      matchConfidence: "exact_sku",
      matchReasons: ["exact SKU match"],
      supplierName: "Rocktomic",
      supplierSku: "SKU-1",
      supplierProductName: "Test Supplement",
      validationStatus: "usable_with_warnings",
      readiness: {
        ingredientMatching: "ready",
        productEditorFacts: "ready",
        pricing: "ready",
        inventory: "ready",
        complianceEvidence: "ready_with_warnings",
        optiPixelAssets: "unknown",
        channelImageGeneration: "unknown",
      },
      sourceFactsSummary: [],
      supplementFactsSummary: [],
      activeIngredients: ["Magnesium"],
      otherIngredients: ["Cellulose"],
      servingSize: "1 capsule",
      servingsPerContainer: "30",
      directions: "Use daily",
      warnings: "Keep out of reach of children",
      pricingSummary: {
        available: true,
        wholesaleCost: 10,
        msrp: 20,
        currency: "USD",
        statusLabel: "ready",
      },
      inventorySummary: {
        available: true,
        status: "in_stock",
        raw: null,
        comments: null,
      },
      assetSummary: {
        coaPresent: true,
        coaUrl: "https://example.com/coa.pdf",
        labelTemplateAiPresent: true,
        mockupTemplateTifPresent: true,
        readyForOptiPixel: false,
      },
      evidence: {
        sourceMethod: "deterministic",
        aiLabelTextEvidenceStatus: "available",
        needsReview: false,
        missingCoaWarning: false,
        topDefects: [],
      },
    },
    supplierContext: {
      matched: true,
      matchedSku: "SKU-1",
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
        sku: "SKU-1",
        productName: "Test Supplement",
        category: "Supplements",
        labelSize: null,
        containerSize: "30",
        productWeight: null,
        servingSize: "1 capsule",
        servingsPerContainer: "30",
        activeIngredients: ["Magnesium"],
        amountPerServing: "Magnesium 30mg",
        ingredientHighlights: ["Magnesium"],
        productFeatures: ["Daily support"],
        otherIngredients: "Cellulose",
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
        supplementFacts: { status: "available", value: "Sample facts" },
        suggestedUse: { status: "available", value: "Use daily" },
        warnings: { status: "available", value: "Keep away from children" },
        inventoryStatus: "in_stock",
        discontinuedStatus: "active",
        pricingStatus: "current",
        policyStatus: "available",
        lastSyncedAt: new Date().toISOString(),
        sourceVersion: "v1",
        sourceUpdatedAt: new Date().toISOString(),
      },
    },
    sourceFacts: {
      shopifyProductId: "gid://shopify/Product/999",
      shopifyProductHandle: "test-supplement",
      shopifySku: "SKU-1",
      normalizedSku: "SKU1",
      supplierProductRecordFound: true,
      pricingRecordFound: true,
      inventoryRecordFound: true,
      assetsRecordFound: true,
      selectedMembershipTier: "Tier A",
      effectiveMembershipTier: "Tier A",
      usingDefaultMembershipTier: false,
      detectedMembershipTiers: ["Tier A"],
      lastGlobalSupplierSyncAt: null,
      lastGeneratedIntelligenceAt: null,
      staleIntelligence: false,
      supplementFacts: { status: "extracted", value: "facts", displayText: "facts" },
      activeIngredients: { status: "extracted", values: ["Magnesium"], displayText: "Magnesium" },
      amountPerServing: { status: "extracted", value: "Magnesium 30mg", displayText: "Magnesium 30mg" },
      otherIngredients: { status: "extracted", value: "Cellulose", displayText: "Cellulose" },
      servingSize: { status: "extracted", value: "1 capsule", displayText: "1 capsule" },
      servingsPerContainer: { status: "extracted", value: "30", displayText: "30" },
      dietaryAllergenAttributes: { status: "source_missing", values: [], displayText: "" },
      keyProductFeatures: { status: "source_missing", values: [], displayText: "" },
      certifications: { status: "source_missing", values: [], displayText: "" },
      manufacturingClaims: { status: "source_missing", values: [], displayText: "" },
      testingClaims: { status: "source_missing", values: [], displayText: "" },
      commerce: {
        shopifyPrice: 19.99,
        compareAtPrice: null,
        wholesaleCost: 9,
        msrp: 19.99,
        estimatedProfit: 10.99,
        marginPercent: 55,
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
  };

  return {
    ...base,
    ...overrides,
    currentShopifyListing: overrides?.currentShopifyListing ?? base.currentShopifyListing,
    supplierContext: overrides?.supplierContext ?? base.supplierContext,
    sourceFacts: overrides?.sourceFacts ?? base.sourceFacts,
    supplierFactsPanel: overrides?.supplierFactsPanel ?? base.supplierFactsPanel,
  };
}

function validOutput() {
  return {
    optimizedTitle: "Test Product Optimized",
    listingSubtitle: "Source-backed support",
    shortDescription: "Short source-backed description.",
    fullDescription: "Full source-backed description with clear usage guidance.",
    benefitBullets: ["Source-backed facts", "Clear usage", "Review-first workflow"],
    ingredientHighlights: ["Magnesium"],
    usageSummary: "Use as directed.",
    faqSuggestions: [{ question: "How to use?", answer: "Use as directed." }],
    imageAltTextSuggestions: [{ imageId: "img-1", altText: "Front bottle image" }],
    metaTitle: "Test Product Optimized",
    metaDescription: "Source-backed listing copy.",
    agenticVisibilitySignals: {
      primaryIntents: ["what is this"],
      comparisonHooks: ["serving size"],
      trustSignals: ["source facts"],
      faqCoverage: ["usage"],
    },
    complianceWarnings: [],
    missingDataNotices: [],
    sourceFactsUsed: ["supplement_facts:extracted"],
    claimsRejected: ["No disease-treatment claims"],
    qualityScores: {
      schemaValidity: 100,
      factualGrounding: 90,
      supplementCompliance: 95,
      agenticVisibility: 80,
      conversionQuality: 80,
      missingDataBehavior: 100,
      brandVoice: 90,
      sourceUseTransparency: 95,
    },
    channelVariants: {
      shopify: "Shopify variant",
      optibay: null,
      optiwal: null,
      optizon: null,
      genericMarketplace: null,
    },
    generationMetadata: {
      contractVersion: "phase_6_1",
      generatedAt: "2026-06-01T00:00:00.000Z",
      sourceMode: "manual",
      model: null,
    },
  };
}

describe("ecomviper generate intelligence copywriting action", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.buildShopifyProductEditorStateForUser.mockResolvedValue(stateFixture());
    mocks.getShopifyOpenAiApiKeyForUser.mockResolvedValue("sk-test");
    mocks.getPersistedShopifyPdpIntelligenceForProduct.mockResolvedValue(null);
    mocks.savePersistedShopifyPdpIntelligence.mockResolvedValue(null);
  });

  it("builds all-product input for supplier-backed supplement and returns review-only proposal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "gpt-4.1-mini",
          choices: [{ message: { content: JSON.stringify(validOutput()) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", productReference: "test-supplement" }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.reviewOnly).toBe(true);
    expect(payload.copywriting?.status).toBe("success");
    expect(payload.copywriting?.output?.optimizedTitle).toContain("Optimized");
    expect(payload.copywriting?.missingDataNotices || []).not.toContain("Supplier match not found.");
    expect(mocks.savePersistedShopifyPdpIntelligence).not.toHaveBeenCalled();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));
    expect(JSON.stringify(requestBody)).toContain("Supplier match: matched");
  });

  it("falls back to Shopify-only mode with plain supplier-match notice", async () => {
    mocks.buildShopifyProductEditorStateForUser.mockResolvedValue(
      stateFixture({
        supplierContext: {
          ...stateFixture().supplierContext,
          matched: false,
          matchedSku: null,
          product: null,
        },
        supplierFactsPanel: {
          ...stateFixture().supplierFactsPanel!,
          matchStatus: "no_match",
          supplierSku: null,
          supplierProductName: null,
          matchReasons: ["no supplier candidate met confidence threshold"],
        },
      })
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "gpt-4.1-mini",
          choices: [{ message: { content: JSON.stringify(validOutput()) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", productReference: "test-supplement" }),
      })
    );

    const payload = await response.json();
    expect(payload.copywriting?.missingDataNotices).toContain("Supplier match not found.");
  });

  it("returns unavailable when key is missing with plain message", async () => {
    mocks.getShopifyOpenAiApiKeyForUser.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", productReference: "test-supplement" }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.generationUnavailable).toBe(true);
    expect(payload.copywriting?.safeMessage).toBe("AI generation is unavailable right now.");
    expect(payload.intelligence?.generation_status).toBe("generation_unavailable");
  });

  it("returns plain timeout message when model request times out", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("request timed out"));

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", productReference: "test-supplement" }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.copywriting?.status).toBe("model_error");
    expect(payload.copywriting?.safeMessage).toBe("AI generation timed out. Try again.");
    expect(JSON.stringify(payload)).not.toContain("PDP intelligence generate failed.");
  });

  it("returns validation-safe message for invalid structured output", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "gpt-4.1-mini",
          choices: [{ message: { content: JSON.stringify({ optimizedTitle: 123 }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", productReference: "test-supplement" }),
      })
    );

    const payload = await response.json();
    expect(payload.copywriting?.status).toBe("validation_error");
    expect(payload.copywriting?.safeMessage).toBe("Generated response could not be validated.");
    expect(JSON.stringify(payload)).not.toContain("stack");
  });

  it("adds plain COA/Pricing notices without blocking generation and keeps ingredient copy when facts exist", async () => {
    const missingDataState = stateFixture({
      sourceFacts: {
        ...stateFixture().sourceFacts!,
        assets: {
          ...stateFixture().sourceFacts!.assets,
          coaUrl: null,
          coaStatus: "missing",
        },
        commerce: {
          ...stateFixture().sourceFacts!.commerce,
          shopifyPrice: null,
          compareAtPrice: null,
          wholesaleCost: null,
          msrp: null,
          estimatedProfit: null,
          marginPercent: null,
        },
      },
      currentShopifyListing: {
        ...stateFixture().currentShopifyListing!,
        variants: [{ id: "v1", title: "Default", sku: "SKU-1", barcode: "", price: null as unknown as number, compareAtPrice: null, inventoryQuantity: 4 }],
      },
      supplierContext: {
        ...stateFixture().supplierContext,
        product: {
          ...stateFixture().supplierContext.product!,
          coa: { status: "missing", url: null },
        },
      },
    });
    mocks.buildShopifyProductEditorStateForUser.mockResolvedValue(missingDataState);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "gpt-4.1-mini",
          choices: [{ message: { content: JSON.stringify(validOutput()) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", productReference: "test-supplement" }),
      })
    );

    const payload = await response.json();
    expect(payload.copywriting?.status).toBe("success");
    expect(payload.copywriting?.missingDataNotices).toContain("COA missing.");
    expect(payload.copywriting?.missingDataNotices).toContain("Pricing missing.");
    expect((payload.copywriting?.output?.ingredientHighlights || []).length).toBeGreaterThan(0);
  });

  it("prevents ingredient-backed claims when Supplement Facts are missing", async () => {
    const missingFactsState = stateFixture({
      sourceFacts: {
        ...stateFixture().sourceFacts!,
        supplementFacts: { status: "source_missing", value: "", displayText: "" },
        activeIngredients: { status: "source_missing", values: [], displayText: "" },
        amountPerServing: { status: "source_missing", value: "", displayText: "" },
        servingSize: { status: "source_missing", value: "", displayText: "" },
        servingsPerContainer: { status: "source_missing", value: "", displayText: "" },
      },
      supplierContext: {
        ...stateFixture().supplierContext,
        product: {
          ...stateFixture().supplierContext.product!,
          activeIngredients: [],
          amountPerServing: null,
          servingSize: null,
          servingsPerContainer: null,
          supplementFacts: { status: "pending_source", value: null },
        },
      },
    });
    mocks.buildShopifyProductEditorStateForUser.mockResolvedValue(missingFactsState);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "gpt-4.1-mini",
          choices: [{ message: { content: JSON.stringify({ ...validOutput(), ingredientHighlights: ["Magnesium"] }) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", productReference: "test-supplement" }),
      })
    );

    const payload = await response.json();
    expect(payload.copywriting?.status).toBe("success");
    expect(payload.copywriting?.missingDataNotices).toContain("Supplement Facts missing.");
    expect(payload.copywriting?.output?.ingredientHighlights).toEqual([]);
  });
});
