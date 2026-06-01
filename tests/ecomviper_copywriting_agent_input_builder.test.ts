import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildProductCopywritingInput,
  buildProductCopywritingInputFromShopifyEditorState,
} from "@/lib/ecomviper/copywriting-agent/copywriting-agent-input-builder";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

function shopifyStateFixture(): ShopifyProductEditorInitialState {
  return {
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
    supplierFactsPanel: null,
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
}

describe("ecomviper copywriting agent input builder", () => {
  it("supports supplier-backed supplement input", () => {
    const input = buildProductCopywritingInputFromShopifyEditorState(shopifyStateFixture());
    expect(input).not.toBeNull();
    expect(input?.supplierContext.matchStatus).toBe("matched");
    expect(input?.supplementFacts.activeIngredients).toContain("Magnesium");
    expect(input?.missingData.coaMissing).toBe(false);
    expect(input?.missingData.pricingMissing).toBe(false);
  });

  it("uses supplier facts read-model fields when sourceFacts values are stale/missing", () => {
    const state = shopifyStateFixture();
    state.sourceFacts = {
      ...state.sourceFacts!,
      activeIngredients: { status: "source_missing", values: [], displayText: "" },
      amountPerServing: { status: "source_missing", value: "", displayText: "" },
      servingSize: { status: "source_missing", value: "", displayText: "" },
      servingsPerContainer: { status: "source_missing", value: "", displayText: "" },
      assets: {
        ...state.sourceFacts!.assets,
        coaUrl: null,
        labelTemplateUrl: null,
        mockupUrl: null,
      },
    };
    state.supplierFactsPanel = {
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
      ingredientAmounts: ["Magnesium 30mg"],
      otherIngredients: ["Cellulose"],
      servingSize: "1 capsule",
      servingsPerContainer: "30",
      directions: "Use daily",
      warnings: "Keep away from children",
      pricingSummary: {
        available: true,
        wholesaleCost: 9,
        msrp: 19.99,
        currency: "USD",
        statusLabel: "ready",
      },
      inventorySummary: {
        available: true,
        status: "in_stock",
        raw: "8",
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
        sourceMethod: "ai_pdf_text",
        aiLabelTextEvidenceStatus: "reused_cached",
        needsReview: false,
        missingCoaWarning: false,
        topDefects: [],
      },
    };

    const input = buildProductCopywritingInputFromShopifyEditorState(state);
    expect(input).not.toBeNull();
    expect(input?.supplementFacts.activeIngredients).toContain("Magnesium");
    expect(input?.supplementFacts.ingredientAmounts).toContain("Magnesium 30mg");
    expect(input?.supplementFacts.servingSize).toBe("1 capsule");
    expect(input?.sourceEvidence.coaPresent).toBe(true);
    expect(input?.missingData.supplementFactsMissing).toBe(false);
    expect(input?.missingData.ingredientAmountsMissing).toBe(false);
  });

  it("supports Shopify-only no-supplier products", () => {
    const input = buildProductCopywritingInput({
      channel: "shopify",
      productIdentity: {
        productId: "gid://shopify/Product/1234",
        handle: "shopify-only",
        title: "Shopify Only Product",
        productType: "Supplements",
      },
      variants: [{ sku: "S1", barcode: null, upc: null, gtin: null, price: 24.99, compareAtPrice: null, inventory: 4 }],
      supplierContext: { matchStatus: "no_match", matchReasons: ["none"] },
      sourceEvidence: { coaPresent: false, sourceFactsUsed: [] },
    });

    expect(input.supplierContext.matchStatus).toBe("no_match");
    expect(input.missingData.supplierMatchMissing).toBe(true);
  });

  it("keeps missing COA and missing pricing as notices instead of blocking input creation", () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p1", title: "Missing Data Product", productType: "Supplements" },
      variants: [{ sku: "S2", barcode: null, upc: null, gtin: null, price: null, compareAtPrice: null, inventory: 3 }],
      supplementFacts: { activeIngredients: ["Ingredient A"] },
      sourceEvidence: { coaPresent: false },
    });

    expect(input.missingData.coaMissing).toBe(true);
    expect(input.missingData.pricingMissing).toBe(true);
    expect(input.supplementFacts.activeIngredients).toContain("Ingredient A");
  });

  it("flags missing Supplement Facts explicitly", () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p2", title: "Facts Missing", productType: "Supplements" },
      variants: [{ sku: "S3", barcode: null, upc: null, gtin: null, price: 10, compareAtPrice: null, inventory: 1 }],
      sourceEvidence: { coaPresent: true, coaUrl: "https://example.com/coa.pdf" },
    });

    expect(input.missingData.supplementFactsMissing).toBe(true);
    expect(input.missingData.ingredientFactsMissing).toBe(true);
    expect(input.missingData.servingSizeMissing).toBe(true);
    expect(input.missingData.servingsPerContainerMissing).toBe(true);
    expect(input.missingData.ingredientAmountsMissing).toBe(true);
  });

  it("does not mark supplement facts missing when ingredient facts exist but serving fields are missing", () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p3", title: "Partial Facts", productType: "Supplements" },
      variants: [{ sku: "S4", barcode: null, upc: null, gtin: null, price: 15, compareAtPrice: null, inventory: 2 }],
      supplementFacts: {
        activeIngredients: ["L-Arginine"],
        ingredientAmounts: ["L-Arginine 500mg"],
      },
      sourceEvidence: {
        labelEvidencePresent: true,
        supplementFactsImagePresent: true,
        aiLabelTextEvidencePresent: true,
      },
    });

    expect(input.missingData.supplementFactsMissing).toBe(false);
    expect(input.missingData.ingredientFactsMissing).toBe(false);
    expect(input.missingData.ingredientAmountsMissing).toBe(false);
    expect(input.missingData.servingSizeMissing).toBe(true);
    expect(input.missingData.servingsPerContainerMissing).toBe(true);
  });

  it("treats image-only supplement evidence as not-structured instead of fully missing", () => {
    const input = buildProductCopywritingInput({
      productIdentity: { productId: "p4", title: "Image Only", productType: "Supplements" },
      variants: [{ sku: "S5", barcode: null, upc: null, gtin: null, price: 12, compareAtPrice: null, inventory: 1 }],
      sourceEvidence: {
        labelEvidencePresent: true,
        supplementFactsImagePresent: true,
        aiLabelTextEvidencePresent: false,
      },
    });

    expect(input.missingData.supplementFactsMissing).toBe(false);
    expect(input.missingData.supplementFactsImageOnly).toBe(true);
    expect(input.missingData.structuredSupplementFactsMissing).toBe(true);
  });

  it("does not hardcode ROC123/ROC948/product handles in builder logic", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts"),
      "utf8"
    );
    expect(source).not.toContain("ROC123");
    expect(source).not.toContain("ROC948");
    expect(source).not.toContain("opa-oxy-burn-thermogenic-support");
  });
});
