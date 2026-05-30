import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  buildShopifyProductEditorStateForUser: vi.fn(),
  getShopifyOpenAiApiKeyForUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/shopify/shopify-product-editor-state", () => ({
  buildShopifyProductEditorStateForUser: mocks.buildShopifyProductEditorStateForUser,
}));

vi.mock("@/lib/ecomviper/shopify/openai-connection", () => ({
  getShopifyOpenAiApiKeyForUser: mocks.getShopifyOpenAiApiKeyForUser,
}));

function listingFixture() {
  return {
    productId: "gid://shopify/Product/123",
    title: "Sleep Formula Gummies",
    handle: "sleep-formula-gummies",
    status: "active",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    tags: ["sleep"],
    collections: [],
    descriptionText: "Daily wellness support.",
    descriptionHtml: "<p>Daily wellness support.</p>",
    seoTitle: "Sleep Formula Gummies",
    seoDescription: "Daily wellness support",
    productUrl: "https://example.myshopify.com/products/sleep-formula-gummies",
    canonicalUrl: "https://example.myshopify.com/products/sleep-formula-gummies",
    images: [],
    variants: [{ id: "v1", title: "Default", sku: "ROC817", barcode: "", price: 20, compareAtPrice: null, inventoryQuantity: 3 }],
    metafields: [],
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    lastSyncedAt: "2026-05-29T00:00:00.000Z",
    fetchedAt: "2026-05-29T00:00:00.000Z",
  };
}

function supplierProductFixture() {
  return {
    supplier: "Rocktomic",
    sku: "ROC817",
    productName: "Sleep Formula",
    category: "Sleep",
    supplementFacts: { status: "ocr_required", value: null },
    inventoryStatus: "in_stock",
    pricing: {
      wholesaleCost: 5.25,
      msrp: 39.99,
      currency: "USD",
      membershipTier: "Scale Plan $497/mo",
      membershipTiersDetected: ["Scale Plan $497/mo"],
      membershipTierCosts: { "Scale Plan $497/mo": 5.25 },
    },
    coa: { status: "available", url: "https://example.com/ROC817-COA.pdf" },
    labelTemplate: { status: "available", url: "https://example.com/templates.html" },
    mockup: { status: "available", url: "https://example.com/mockup.html" },
    certifications: [],
    dietaryAttributes: [],
    manufacturingClaims: [],
    activeIngredients: [],
    ingredientHighlights: [],
    productFeatures: [],
    sourceDiagnostics: ["normalized_product_record_status: found"],
    lastSyncedAt: "2026-05-30T00:00:00.000Z",
    sourceVersion: "global-test-source",
    sourceUpdatedAt: "2026-05-30T00:00:00.000Z",
  };
}

describe("ecomviper PDP intelligence route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.buildShopifyProductEditorStateForUser.mockReset();
    mocks.getShopifyOpenAiApiKeyForUser.mockReset();
    (globalThis as Record<string, unknown>).__ecomviper_shopify_pdp_intelligence_fallback__ = undefined;
    mocks.buildShopifyProductEditorStateForUser.mockResolvedValue({
      currentShopifyListing: listingFixture(),
    });
    mocks.getShopifyOpenAiApiKeyForUser.mockResolvedValue(null);
  });

  it("returns 401 for unauthorized requests", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await GET(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence?productReference=sleep-formula-gummies")
    );
    expect(response.status).toBe(401);
  });

  it("supports save and reopen persistence for the same user", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_a",
      unauthorizedResponse: null,
    });
    const { POST, GET } = await import("@/app/api/ecomviper/pdp-intelligence/route");

    const saveResponse = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          productReference: "sleep-formula-gummies",
          record: {
            ai_product_summary: "Saved summary",
            best_for: ["Night routine"],
            faqs: [
              {
                question: "When should I use it?",
                answer: "As directed on product label.",
                category: "usage",
                schema_eligible: true,
                compliance_status: "approved",
              },
            ],
          },
        }),
      })
    );
    const savePayload = await saveResponse.json();
    expect(saveResponse.status).toBe(200);
    expect(savePayload.intelligence?.ai_product_summary).toBe("Saved summary");

    const getResponse = await GET(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence?productReference=sleep-formula-gummies")
    );
    const getPayload = await getResponse.json();
    expect(getResponse.status).toBe(200);
    expect(getPayload.intelligence?.ai_product_summary).toBe("Saved summary");
    expect(getPayload.intelligence?.faqs?.[0]?.question).toBe("When should I use it?");
  });

  it("keeps tenant/workspace isolation across users", async () => {
    const { POST, GET } = await import("@/app/api/ecomviper/pdp-intelligence/route");

    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_a",
      unauthorizedResponse: null,
    });
    await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          productReference: "sleep-formula-gummies",
          record: { ai_product_summary: "User A summary" },
        }),
      })
    );

    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_b",
      unauthorizedResponse: null,
    });
    const getResponse = await GET(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence?productReference=sleep-formula-gummies")
    );
    const getPayload = await getResponse.json();
    expect(getResponse.status).toBe(200);
    expect(getPayload.intelligence).toBeNull();
  });

  it("returns generation unavailable state when OpenAI key is missing", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_a",
      unauthorizedResponse: null,
    });
    mocks.getShopifyOpenAiApiKeyForUser.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          productReference: "sleep-formula-gummies",
        }),
      })
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.generationUnavailable).toBe(true);
    expect(payload.intelligence?.generation_status).toBe("generation_unavailable");
    expect(mocks.buildShopifyProductEditorStateForUser).toHaveBeenCalledWith({
      userId: "user_a",
      productReference: "sleep-formula-gummies",
      demoMode: false,
    });
  });

  it("returns generation diagnostics from product editor sourceFacts", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_a",
      unauthorizedResponse: null,
    });
    mocks.getShopifyOpenAiApiKeyForUser.mockResolvedValue(null);
    mocks.buildShopifyProductEditorStateForUser.mockResolvedValue({
      currentShopifyListing: listingFixture(),
      sourceFacts: {
        normalizedSku: "ROC817",
        supplierProductRecordFound: true,
        pricingRecordFound: true,
        inventoryRecordFound: true,
        assetsRecordFound: true,
        selectedMembershipTier: "Scale Plan $497/mo",
        supplementFacts: {
          status: "ocr_required",
          value: "",
          displayText: "Supplement Facts require OCR extraction from catalog label image.",
        },
        staleIntelligence: true,
        inventory: { status: "in_stock", displayText: "Available" },
        commerce: { wholesaleCost: 5.25, msrp: 39.99, estimatedProfit: 14.75, marginPercent: 73.75 },
        assets: { coaStatus: "available", coaUrl: "https://example.com/ROC817-COA.pdf" },
      },
      supplierContext: {
        matchedSku: "ROC817",
        syncStatus: "synced",
        product: supplierProductFixture(),
      },
    });

    const { POST } = await import("@/app/api/ecomviper/pdp-intelligence/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/pdp-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          productReference: "sleep-formula-gummies",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.diagnostics).toMatchObject({
      normalized_sku: "ROC817",
      supplier_product_record_status: "synced",
      pricing_record_status: "synced",
      inventory_record_status: "synced",
      asset_record_status: "synced",
      selected_membership_tier: "Scale Plan $497/mo",
      source_facts_used: true,
      supplement_facts_status: "ocr_required",
      generated_from_source_version: "global-test-source",
      stale_intelligence_before_generation: true,
    });
  });
});
