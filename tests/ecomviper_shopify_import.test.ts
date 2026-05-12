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
      adminApiToken: "shpat_live_import",
      apiVersion: "2025-10",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
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

  it("records import state counters for products and images", async () => {
    await saveShopifyConnectionForUser({
      userId: "user_ibrains",
      storeDomain: "opanutrition.myshopify.com",
      adminApiToken: "shpat_live_import",
      apiVersion: "2025-10",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
