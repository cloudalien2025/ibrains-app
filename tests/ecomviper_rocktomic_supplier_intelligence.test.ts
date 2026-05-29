import { describe, expect, it } from "vitest";
import { getRocktomicCatalogSkus, matchRocktomicBySkus } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import { toEcomViperProductInventoryRows } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

describe("rocktomic supplier intelligence", () => {
  it("exposes baseline Rocktomic SKU catalog", () => {
    expect(getRocktomicCatalogSkus()).toEqual(expect.arrayContaining(["ROC817", "ROC949", "ROC937"]));
  });

  it("matches supplier intelligence by SKU", () => {
    const result = matchRocktomicBySkus(["abc", "roc817"]);
    expect(result.status).toBe("rocktomic");
    expect(result.matchedSku).toBe("ROC817");
    expect(result.intelligence?.productName).toContain("Rocktomic");
  });

  it("maps Shopify products to inventory rows with PDP route + match status", () => {
    const product: ShopifyProductRecord = {
      id: "gid://shopify/Product/123",
      storeDomain: "example.myshopify.com",
      title: "Magnesium Gummies",
      handle: "magnesium-gummies",
      vendor: "OPA Nutrition",
      productType: "Supplements",
      status: "ACTIVE",
      tags: [],
      description: "Long description ".repeat(20),
      descriptionHtml: "<p>Long description</p>",
      seoTitle: "Best Magnesium Gummies",
      seoDescription: "Supports sleep and recovery with clean ingredients.",
      metafields: [],
      onlineStoreUrl: "https://example.myshopify.com/products/magnesium-gummies",
      primaryImageUrl: "https://cdn.example.com/a.webp",
      galleryImageUrls: ["https://cdn.example.com/a.webp"],
      galleryImages: [],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z",
      variants: [
        {
          id: "gid://shopify/ProductVariant/1",
          productId: "gid://shopify/Product/123",
          title: "Default",
          sku: "ROC817",
          barcode: "",
          price: 19.99,
          compareAtPrice: null,
          inventoryQuantity: 20,
          selectedOptions: [],
          imageUrl: "",
          imageAltText: null,
          imageUrls: [],
        },
      ],
    };

    const rows = toEcomViperProductInventoryRows([product]);
    expect(rows[0].productEditorHref).toBe("/ecomviper/products/magnesium-gummies");
    expect(rows[0].supplierMatch).toBe("rocktomic");
    expect(rows[0].supplierMatchedSku).toBe("ROC817");
    expect(rows[0].shopifyStatus).toBe("active");
  });
});
