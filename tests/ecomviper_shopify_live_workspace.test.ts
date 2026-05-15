import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveShopifyConnectionForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { hydrateShopifyLiveWorkspaceForUser } from "@/lib/ecomviper/shopify/shopify-live-hydrator";
import { buildShopifyAgenticWorkspaceStateForUser } from "@/lib/ecomviper/shopify/shopify-workspace-state";
import {
  getShopifyOpenAiConnectionStatusForUser,
  recordShopifyOpenAiTestResultForUser,
  saveShopifyOpenAiConnectionForUser,
  testShopifyOpenAiApiKey,
} from "@/lib/ecomviper/shopify/openai-connection";
import {
  getShopifySerpApiConnectionStatusForUser,
  recordShopifySerpApiScanResultForUser,
  saveShopifySerpApiConnectionForUser,
  runShopifyVisibilityScanWithSerpApi,
  testShopifySerpApiKey,
} from "@/lib/ecomviper/shopify/serpapi-connection";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 23).toString("base64");

function resetFallbackStores() {
  (globalThis as Record<string, unknown>).__ecomviper_shopify_connection_fallback__ = undefined;
  (globalThis as Record<string, unknown>).__ecomviper_shopify_access_token_cache__ = undefined;
  (globalThis as Record<string, unknown>).__ecomviper_shopify_product_fallback__ = undefined;
  (globalThis as Record<string, unknown>).__ecomviper_shopify_product_tables_checked__ = undefined;
  (globalThis as Record<string, unknown>).__ecomviper_shopify_openai_connection_fallback__ = undefined;
  (globalThis as Record<string, unknown>).__ecomviper_shopify_serpapi_connection_fallback__ = undefined;
}

function mockShopifyLiveFetchSequence() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "shopify_exchange_token_live",
          scope: "read_products",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            shop: {
              id: "gid://shopify/Shop/1",
              name: "OPA Nutrition",
              myshopifyDomain: "opanutrition.myshopify.com",
              email: "support@opanutrition.com",
              description: "Live supplement storefront",
              primaryDomain: {
                url: "https://opanutrition.com",
                host: "opanutrition.com",
              },
              shippingPolicy: {
                id: "gid://shopify/Policy/shipping",
                title: "Shipping Policy",
                body: "We support domestic and international shipping.",
                url: "https://opanutrition.com/policies/shipping",
              },
              refundPolicy: {
                id: "gid://shopify/Policy/refund",
                title: "Refund Policy",
                body: "Returns accepted within 30 days.",
                url: "https://opanutrition.com/policies/refund",
              },
              privacyPolicy: null,
              termsOfService: null,
            },
            products: {
              nodes: [
                {
                  id: "gid://shopify/Product/101",
                  title: "OPA Enzyme Balance",
                  handle: "opa-enzyme-balance",
                  vendor: "OPA Nutrition",
                  productType: "Supplements",
                  status: "ACTIVE",
                  tags: ["digestive", "enzyme"],
                  description: "Digestive enzyme blend for daily gut balance support.",
                  descriptionHtml: "<p>Digestive enzyme blend for daily gut balance support.</p>",
                  seo: { title: "OPA Enzyme Balance", description: "Digestive enzyme support" },
                  onlineStoreUrl: "https://opanutrition.myshopify.com/products/opa-enzyme-balance",
                  createdAt: "2026-05-14T00:00:00.000Z",
                  updatedAt: "2026-05-15T00:00:00.000Z",
                  featuredImage: {
                    id: "gid://shopify/Image/featured_1",
                    url: "https://cdn.shopify.com/product-main.jpg",
                    altText: "Primary bottle image",
                    width: 1500,
                    height: 1500,
                  },
                  images: {
                    nodes: [
                      {
                        id: "gid://shopify/Image/1",
                        url: "https://cdn.shopify.com/product-main.jpg",
                        altText: "Primary bottle image",
                        width: 1500,
                        height: 1500,
                      },
                    ],
                  },
                  media: { nodes: [] },
                  variants: {
                    nodes: [
                      {
                        id: "gid://shopify/ProductVariant/201",
                        title: "Default",
                        sku: "OPA-ENZ-60",
                        barcode: "0123456789012",
                        price: "24.99",
                        compareAtPrice: "29.99",
                        inventoryQuantity: 12,
                        selectedOptions: [{ name: "Size", value: "60 ct" }],
                        image: {
                          id: "gid://shopify/Image/variant_1",
                          url: "https://cdn.shopify.com/product-variant.jpg",
                          altText: "Variant bottle image",
                          width: 1500,
                          height: 1500,
                        },
                      },
                    ],
                  },
                  metafields: {
                    nodes: [
                      {
                        id: "gid://shopify/Metafield/1",
                        namespace: "facts",
                        key: "serving_size",
                        type: "single_line_text_field",
                        value: "2 capsules",
                        description: "Suggested serving",
                      },
                    ],
                  },
                },
              ],
            },
            collections: {
              nodes: [
                {
                  id: "gid://shopify/Collection/1",
                  title: "Digestive Support",
                  handle: "digestive-support",
                  description: "Digestive support products",
                  seo: { title: "Digestive Support", description: "Digestive support supplements" },
                  onlineStoreUrl: "https://opanutrition.myshopify.com/collections/digestive-support",
                  updatedAt: "2026-05-15T00:00:00.000Z",
                },
              ],
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            pages: {
              nodes: [
                {
                  id: "gid://shopify/Page/1",
                  title: "Shipping & Returns",
                  handle: "shipping-returns",
                  body: "We provide international shipping and easy returns.",
                  updatedAt: "2026-05-15T00:00:00.000Z",
                },
              ],
            },
            blogs: {
              nodes: [
                {
                  id: "gid://shopify/Blog/1",
                  title: "Wellness Journal",
                  handle: "wellness-journal",
                  articles: {
                    nodes: [
                      {
                        id: "gid://shopify/Article/1",
                        title: "Supplement Safety Basics",
                        handle: "supplement-safety-basics",
                        excerpt: "Use structure/function language.",
                        contentHtml: "<p>Use structure/function language only.</p>",
                        publishedAt: "2026-05-15T00:00:00.000Z",
                        updatedAt: "2026-05-15T00:00:00.000Z",
                        onlineStoreUrl: "https://opanutrition.myshopify.com/blogs/wellness/safety",
                      },
                    ],
                  },
                },
              ],
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
}

describe("Shopify live hydration + mock replacement", () => {
  beforeEach(() => {
    resetFallbackStores();
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
  });

  it("hydrates live Shopify shop/products/media/metafields/pages/blogs/policies", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      clientId: "shopify_client_live",
      clientSecret: "shopify_secret_live",
      apiVersion: "2025-10",
    });

    mockShopifyLiveFetchSequence();

    const hydrated = await hydrateShopifyLiveWorkspaceForUser({ userId: "user_ibrains" });

    expect(hydrated.source).toBe("live_shopify");
    expect(hydrated.shop.name).toBe("OPA Nutrition");
    expect(hydrated.products).toHaveLength(1);
    expect(hydrated.products[0].variants).toHaveLength(1);
    expect(hydrated.products[0].galleryImageUrls.length).toBeGreaterThan(0);
    expect(hydrated.products[0].metafields.length).toBeGreaterThan(0);
    expect(hydrated.collections).toHaveLength(1);
    expect(hydrated.pages).toHaveLength(1);
    expect(hydrated.blogArticles).toHaveLength(1);
    expect(hydrated.policies.length).toBeGreaterThan(0);
    expect(hydrated.entitySourceProvenance.some((entry) => entry.entityType === "product")).toBe(true);
  });

  it("uses live data when connected, unavailable when disconnected, and demo only when explicitly enabled", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      clientId: "shopify_client_live",
      clientSecret: "shopify_secret_live",
      apiVersion: "2025-10",
    });

    mockShopifyLiveFetchSequence();

    const liveState = await buildShopifyAgenticWorkspaceStateForUser({
      userId: "user_ibrains",
      demoMode: false,
    });

    expect(liveState.workspaceSource).toBe("live_shopify");
    expect(liveState.hydrationMode).toBe("live");
    expect(liveState.products.length).toBeGreaterThan(0);
    expect(liveState.modeLabel.toLowerCase()).not.toContain("mock-first");

    const disconnectedState = await buildShopifyAgenticWorkspaceStateForUser({
      userId: null,
      demoMode: false,
    });

    expect(disconnectedState.workspaceSource).toBe("unavailable");
    expect(disconnectedState.products).toHaveLength(0);

    const demoState = await buildShopifyAgenticWorkspaceStateForUser({
      userId: null,
      demoMode: true,
    });

    expect(demoState.workspaceSource).toBe("demo");
    expect(demoState.products.length).toBeGreaterThan(0);
    expect(demoState.mockModeEnabled).toBe(true);
  });
});

describe("Shopify OpenAI and SerpAPI connection modules", () => {
  beforeEach(() => {
    resetFallbackStores();
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
  });

  it("stores OpenAI key with masking and records failed key tests safely", async () => {
    await saveShopifyOpenAiConnectionForUser({
      userId: "user_ibrains",
      apiKey: "sk-live-shopify-123456",
    });

    const status = await getShopifyOpenAiConnectionStatusForUser("user_ibrains");
    expect(status.connected).toBe(true);
    expect(status.maskedApiKey).not.toContain("sk-live-shopify-123456");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("unauthorized", { status: 401 })
    );

    await expect(testShopifyOpenAiApiKey("sk-invalid")).rejects.toThrow(/401/);
    await recordShopifyOpenAiTestResultForUser({
      userId: "user_ibrains",
      ok: false,
      errorMessage: "OpenAI API test failed: HTTP 401 unauthorized.",
    });

    const failedStatus = await getShopifyOpenAiConnectionStatusForUser("user_ibrains");
    expect(failedStatus.lastError).toContain("401");
    expect(failedStatus.lastTestedAt).not.toBeNull();
  });

  it("stores SerpAPI key, supports test and visibility scan with mocked provider responses", async () => {
    await saveShopifySerpApiConnectionForUser({
      userId: "user_ibrains",
      apiKey: "serpapi_live_123456",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ search_information: { total_results: 100 }, organic_results: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            search_information: { total_results: 20 },
            organic_results: [{ link: "https://opanutrition.com/products/opa-enzyme-balance" }],
            shopping_results: [{ link: "https://www.walmart.com/ip/2791205430" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const testResult = await testShopifySerpApiKey("serpapi_live_123456");
    expect(testResult.providerStatus).toBe("connected");

    const scanResult = await runShopifyVisibilityScanWithSerpApi({
      apiKey: "serpapi_live_123456",
      storeDomain: "opanutrition.myshopify.com",
    });
    expect(scanResult.providerStatus).toBe("connected");
    expect(scanResult.resultUrls.length).toBeGreaterThan(0);

    await recordShopifySerpApiScanResultForUser({
      userId: "user_ibrains",
      ok: true,
    });

    const status = await getShopifySerpApiConnectionStatusForUser("user_ibrains");
    expect(status.connected).toBe(true);
    expect(status.maskedApiKey).not.toContain("serpapi_live_123456");
    expect(status.lastScanAt).not.toBeNull();
  });
});
