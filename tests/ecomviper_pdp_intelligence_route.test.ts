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
  });
});
