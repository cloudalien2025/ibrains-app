import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveShopifyConnectionForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import {
  importShopifyProductsForUser,
  listShopifyProductsForUser,
  getShopifyImportStateForUser,
} from "@/lib/ecomviper/shopify/shopify-import";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString("base64");

describe("Shopify product import normalization", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_shopify_connection_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_access_token_cache__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_product_tables_checked__ = undefined;
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
  });

  it("imports product/variant media, SKU+barcode metadata, and deduplicates images", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      clientId: "shopify_client_123456",
      clientSecret: "shopify_secret_123456",
      apiVersion: "2025-10",
    });

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shopify_exchange_token_1",
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
              products: {
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    id: "gid://shopify/Product/101",
                    title: "OPA Magnesium Glycinate",
                    handle: "opa-magnesium-glycinate",
                    vendor: "OPA Nutrition",
                    productType: "Supplements",
                    status: "ACTIVE",
                    tags: ["magnesium", "sleep"],
                    description: "Calm support",
                    descriptionHtml: "<p>Calm support</p>",
                    onlineStoreUrl: null,
                    createdAt: "2026-05-10T00:00:00.000Z",
                    updatedAt: "2026-05-11T00:00:00.000Z",
                    featuredImage: {
                      id: "gid://shopify/MediaImage/featured_1",
                      url: "https://cdn.shopify.com/featured.jpg?v=1",
                      altText: "Featured image",
                      width: 2048,
                      height: 2048,
                    },
                    media: {
                      nodes: [
                        {
                          id: "gid://shopify/MediaImage/media_1",
                          image: {
                            id: "gid://shopify/Image/1",
                            url: "https://cdn.shopify.com/featured.jpg?v=1",
                            altText: "Duplicate featured",
                            width: 1024,
                            height: 1024,
                          },
                        },
                        {
                          id: "gid://shopify/MediaImage/media_2",
                          image: {
                            id: "gid://shopify/Image/2",
                            url: "https://cdn.shopify.com/gallery-2.jpg?v=2",
                            altText: "Gallery image",
                            width: 1800,
                            height: 1800,
                          },
                        },
                      ],
                    },
                    variants: {
                      nodes: [
                        {
                          id: "gid://shopify/ProductVariant/5001",
                          title: "Default Title",
                          sku: "SKU-5001",
                          barcode: "0123456789012",
                          price: "24.99",
                          compareAtPrice: "29.99",
                          inventoryQuantity: 17,
                          selectedOptions: [{ name: "Size", value: "120 Capsules" }],
                          image: {
                            id: "gid://shopify/Image/variant_1",
                            url: "https://cdn.shopify.com/variant.jpg?v=5",
                            altText: "Variant image",
                            width: 1900,
                            height: 1900,
                          },
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

    const result = await importShopifyProductsForUser("user_ibrains", { boundedRuntime: true });

    expect(result.importedCount).toBe(1);
    expect(result.imageCount).toBe(3);
    expect(result.diagnostics.diagnosticsEventProductsImported).toBe("shopify_products_imported");
    expect(result.diagnostics.diagnosticsEventImagesImported).toBe("shopify_images_imported");

    const graphqlCallHeaders = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const graphqlHeaders = graphqlCallHeaders?.headers as Record<string, string> | undefined;
    expect(graphqlHeaders?.["X-Shopify-Access-Token"]).toBe("shopify_exchange_token_1");

    const products = await listShopifyProductsForUser("user_ibrains");
    expect(products).toHaveLength(1);

    const product = products[0];
    expect(product.title).toBe("OPA Magnesium Glycinate");
    expect(product.onlineStoreUrl).toBe("https://opanutrition.myshopify.com/products/opa-magnesium-glycinate");
    expect(product.primaryImageUrl).toBe("https://cdn.shopify.com/featured.jpg?v=1");
    expect(product.galleryImageUrls).toEqual([
      "https://cdn.shopify.com/featured.jpg?v=1",
      "https://cdn.shopify.com/gallery-2.jpg?v=2",
      "https://cdn.shopify.com/variant.jpg?v=5",
    ]);

    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].sku).toBe("SKU-5001");
    expect(product.variants[0].barcode).toBe("0123456789012");
    expect(product.variants[0].imageUrl).toBe("https://cdn.shopify.com/variant.jpg?v=5");
  });

  it("imports full product gallery from Shopify images connection when media nodes are empty", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      clientId: "shopify_client_images_123",
      clientSecret: "shopify_secret_images_123",
      apiVersion: "2025-10",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shopify_exchange_token_images",
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
              products: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    id: "gid://shopify/Product/202",
                    title: "OPA Recovery Complex",
                    handle: "opa-recovery-complex",
                    vendor: "OPA Nutrition",
                    productType: "Supplements",
                    status: "ACTIVE",
                    tags: ["recovery"],
                    description: "Recovery support",
                    descriptionHtml: "<p>Recovery support</p>",
                    onlineStoreUrl: null,
                    createdAt: "2026-05-10T00:00:00.000Z",
                    updatedAt: "2026-05-11T00:00:00.000Z",
                    featuredImage: {
                      id: "gid://shopify/MediaImage/featured_202",
                      url: "https://cdn.shopify.com/recovery-main.jpg?v=1",
                      altText: "Main image",
                      width: 2000,
                      height: 2000,
                    },
                    images: {
                      nodes: [
                        {
                          id: "gid://shopify/Image/202-1",
                          url: "https://cdn.shopify.com/recovery-main.jpg?v=1",
                          altText: "Main duplicate",
                          width: 2000,
                          height: 2000,
                        },
                        {
                          id: "gid://shopify/Image/202-2",
                          url: "https://cdn.shopify.com/recovery-side.jpg?v=2",
                          altText: "Side angle",
                          width: 2000,
                          height: 2000,
                        },
                        {
                          id: "gid://shopify/Image/202-3",
                          url: "https://cdn.shopify.com/recovery-back.jpg?v=3",
                          altText: "Back label",
                          width: 2000,
                          height: 2000,
                        },
                      ],
                    },
                    media: {
                      nodes: [],
                    },
                    variants: {
                      nodes: [],
                    },
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const result = await importShopifyProductsForUser("user_ibrains", { boundedRuntime: true });
    expect(result.importedCount).toBe(1);
    expect(result.imageCount).toBe(3);

    const products = await listShopifyProductsForUser("user_ibrains");
    expect(products).toHaveLength(1);
    expect(products[0].galleryImageUrls).toEqual([
      "https://cdn.shopify.com/recovery-main.jpg?v=1",
      "https://cdn.shopify.com/recovery-side.jpg?v=2",
      "https://cdn.shopify.com/recovery-back.jpg?v=3",
    ]);
  });

  it("records import state counters for products and images", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      clientId: "shopify_client_123456",
      clientSecret: "shopify_secret_123456",
      apiVersion: "2025-10",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shopify_exchange_token_2",
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
              products: {
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    await importShopifyProductsForUser("user_ibrains", { boundedRuntime: true });
    const state = await getShopifyImportStateForUser("user_ibrains");

    expect(state.lastImportStatus).toBe("success");
    expect(state.productCount).toBe(0);
    expect(state.imageCount).toBe(0);
  });
});
