import { describe, expect, it } from "vitest";
import { reconcileWalmartProductsWithShopify } from "@/lib/ecomviper/shopify/walmart-shopify-reconciliation";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createWalmartProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_sku_1",
    marketplace: "walmart",
    sku: "SKU-1",
    externalItemId: "wm_sku_1",
    upc: "123456789012",
    gtin: "",
    title: "OPA Magnesium Glycinate 120 Capsules",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 10,
    inventoryStatus: "known",
    status: "active",
    imageUrl: "",
    galleryImageUrls: [],
    variantImageUrls: [],
    imageStatus: "catalog_missing",
    imageStatusMessage: "Image not provided by Walmart catalog",
    imageSource: "walmart_catalog",
    imageSyncStatus: "not_found",
    issues: ["Image not provided by Walmart catalog"],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function createShopifyProduct(overrides?: Partial<ShopifyProductRecord>): ShopifyProductRecord {
  const productId = overrides?.id ?? "gid://shopify/Product/1";
  return {
    id: productId,
    storeDomain: "opanutrition.myshopify.com",
    title: "OPA Magnesium Glycinate 120 Capsules",
    handle: "opa-magnesium-glycinate",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    status: "ACTIVE",
    tags: ["magnesium"],
    description: "",
    descriptionHtml: "",
    onlineStoreUrl: "https://opanutrition.myshopify.com/products/opa-magnesium-glycinate",
    primaryImageUrl: "https://cdn.shopify.com/product-main.jpg",
    galleryImageUrls: ["https://cdn.shopify.com/product-main.jpg", "https://cdn.shopify.com/product-gallery.jpg"],
    galleryImages: [
      {
        id: "media_1",
        url: "https://cdn.shopify.com/product-main.jpg",
        altText: "Main",
        width: 2000,
        height: 2000,
        source: "product",
        variantId: null,
      },
    ],
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/1",
        productId,
        title: "Default Title",
        sku: "SKU-1",
        barcode: "123456789012",
        price: 19.99,
        compareAtPrice: null,
        inventoryQuantity: 12,
        selectedOptions: [],
        imageUrl: "https://cdn.shopify.com/variant-main.jpg",
        imageAltText: "Variant",
        imageUrls: ["https://cdn.shopify.com/variant-main.jpg"],
      },
    ],
    ...overrides,
  };
}

describe("Walmart-to-Shopify matching", () => {
  it("applies Shopify variant image on exact SKU match", () => {
    const walmart = createWalmartProduct({ sku: "sku-1", upc: "" });
    const shopify = createShopifyProduct({
      variants: [
        {
          id: "gid://shopify/ProductVariant/sku_match",
          productId: "gid://shopify/Product/1",
          title: "Default Title",
          sku: "SKU-1",
          barcode: "",
          price: 19.99,
          compareAtPrice: null,
          inventoryQuantity: 10,
          selectedOptions: [],
          imageUrl: "https://cdn.shopify.com/variant-sku.jpg",
          imageAltText: null,
          imageUrls: ["https://cdn.shopify.com/variant-sku.jpg"],
        },
      ],
    });

    const result = reconcileWalmartProductsWithShopify({
      walmartProducts: [walmart],
      shopifyProducts: [shopify],
      applyMode: "prefer_shopify",
    });

    expect(result.result.walmartProductsMatchedToShopify).toBe(1);
    expect(result.result.imagesAppliedFromShopify).toBe(1);
    expect(result.products[0].imageSource).toBe("shopify_variant");
    expect(result.products[0].imageMatchMethod).toBe("shopify_sku_exact");
    expect(result.products[0].imageUrl).toBe("https://cdn.shopify.com/variant-sku.jpg");
  });

  it("applies image for barcode exact and barcode normalized matches", () => {
    const exactBarcode = createWalmartProduct({
      sku: "WAL-EXACT",
      upc: "123456789012",
      gtin: "",
    });
    const normalizedBarcode = createWalmartProduct({
      sku: "WAL-NORM",
      upc: "00123456789012",
      gtin: "",
    });

    const shopify = createShopifyProduct({
      variants: [
        {
          id: "gid://shopify/ProductVariant/barcode_1",
          productId: "gid://shopify/Product/1",
          title: "Default",
          sku: "OTHER-SKU",
          barcode: "123456789012",
          price: 22,
          compareAtPrice: null,
          inventoryQuantity: 10,
          selectedOptions: [],
          imageUrl: "https://cdn.shopify.com/barcode.jpg",
          imageAltText: null,
          imageUrls: ["https://cdn.shopify.com/barcode.jpg"],
        },
      ],
    });

    const result = reconcileWalmartProductsWithShopify({
      walmartProducts: [exactBarcode, normalizedBarcode],
      shopifyProducts: [shopify],
      applyMode: "prefer_shopify",
    });

    expect(result.products[0].imageMatchMethod).toBe("shopify_barcode_exact");
    expect(result.products[0].imageUrl).toBe("https://cdn.shopify.com/barcode.jpg");

    expect(result.products[1].imageMatchMethod).toBe("shopify_barcode_normalized");
    expect(result.products[1].imageUrl).toBe("https://cdn.shopify.com/barcode.jpg");
  });

  it("uses title/vendor high-confidence match only when unambiguous", () => {
    const walmart = createWalmartProduct({
      sku: "NO-SKU-NO-BARCODE",
      upc: "",
      gtin: "",
      title: "OPA Daily Greens Powder",
      brand: "OPA Nutrition",
    });

    const best = createShopifyProduct({
      id: "gid://shopify/Product/best",
      title: "OPA Daily Greens Powder",
      vendor: "OPA Nutrition",
      variants: [],
      primaryImageUrl: "https://cdn.shopify.com/greens-main.jpg",
      galleryImageUrls: ["https://cdn.shopify.com/greens-main.jpg"],
    });

    const weak = createShopifyProduct({
      id: "gid://shopify/Product/weak",
      title: "OPA Daily Fiber",
      vendor: "OPA Nutrition",
      variants: [],
      primaryImageUrl: "https://cdn.shopify.com/fiber-main.jpg",
      galleryImageUrls: ["https://cdn.shopify.com/fiber-main.jpg"],
    });

    const confident = reconcileWalmartProductsWithShopify({
      walmartProducts: [walmart],
      shopifyProducts: [best, weak],
      applyMode: "prefer_shopify",
    });

    expect(confident.products[0].imageMatchMethod).toBe("shopify_title_vendor_high");
    expect(confident.products[0].imageSource).toBe("shopify_product");

    const ambiguous = reconcileWalmartProductsWithShopify({
      walmartProducts: [walmart],
      shopifyProducts: [
        { ...best, id: "gid://shopify/Product/best2", title: "OPA Daily Greens Powder 300g" },
        { ...best, id: "gid://shopify/Product/best3", title: "OPA Daily Greens Powder 280g" },
      ],
      applyMode: "prefer_shopify",
    });

    expect(ambiguous.products[0].imageUrl).toBe("");
    expect(ambiguous.result.ambiguousShopifyMatches).toBe(1);
  });

  it("preserves manual image priority and does not overwrite verified Walmart listing URL", () => {
    const walmart = createWalmartProduct({
      sku: "MANUAL-1",
      imageUrl: "https://manual.example/image.jpg",
      imageSource: "manual",
      imageSyncStatus: "found",
      publicWalmartUrl: "https://www.walmart.com/ip/12345678",
      upc: "",
      gtin: "",
    });

    const shopify = createShopifyProduct({
      variants: [
        {
          id: "gid://shopify/ProductVariant/sku_manual",
          productId: "gid://shopify/Product/1",
          title: "Default",
          sku: "MANUAL-1",
          barcode: "",
          price: 22,
          compareAtPrice: null,
          inventoryQuantity: 10,
          selectedOptions: [],
          imageUrl: "https://cdn.shopify.com/shopify-should-not-override.jpg",
          imageAltText: null,
          imageUrls: ["https://cdn.shopify.com/shopify-should-not-override.jpg"],
        },
      ],
    });

    const result = reconcileWalmartProductsWithShopify({
      walmartProducts: [walmart],
      shopifyProducts: [shopify],
      applyMode: "prefer_shopify",
    });

    expect(result.products[0].imageUrl).toBe("https://manual.example/image.jpg");
    expect(result.products[0].publicWalmartUrl).toBe("https://www.walmart.com/ip/12345678");
    expect(result.result.imagesAppliedFromShopify).toBe(0);
  });

  it("leaves products unchanged when no Shopify match is found", () => {
    const walmart = createWalmartProduct({
      sku: "NO-MATCH",
      upc: "",
      gtin: "",
      title: "Unmatched Product Name",
      brand: "No Brand",
    });

    const shopify = createShopifyProduct({
      variants: [
        {
          id: "gid://shopify/ProductVariant/other",
          productId: "gid://shopify/Product/1",
          title: "Default",
          sku: "DIFFERENT",
          barcode: "999999999999",
          price: 22,
          compareAtPrice: null,
          inventoryQuantity: 10,
          selectedOptions: [],
          imageUrl: "https://cdn.shopify.com/different.jpg",
          imageAltText: null,
          imageUrls: ["https://cdn.shopify.com/different.jpg"],
        },
      ],
    });

    const result = reconcileWalmartProductsWithShopify({
      walmartProducts: [walmart],
      shopifyProducts: [shopify],
      applyMode: "prefer_shopify",
    });

    expect(result.products[0].imageUrl).toBe("");
    expect(result.products[0].imageMatchMethod).toBeUndefined();
    expect(result.result.shopifyNoMatch).toBe(1);
  });
});
