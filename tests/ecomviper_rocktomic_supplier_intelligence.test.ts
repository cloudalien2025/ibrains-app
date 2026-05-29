import { describe, expect, it } from "vitest";
import {
  getRocktomicCatalogSkus,
  listRocktomicSupplierProducts,
  lookupRocktomicSupplierProductBySku,
  matchRocktomicBySkus,
  normalizeRocktomicSku,
} from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import { toEcomViperProductInventoryRows } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

describe("rocktomic supplier intelligence", () => {
  it("normalizes SKU values", () => {
    expect(normalizeRocktomicSku(" roc-817 ")).toBe("ROC817");
    expect(normalizeRocktomicSku("roc 949")).toBe("ROC949");
    expect(normalizeRocktomicSku("")).toBe("");
  });

  it("exposes fallback Rocktomic SKU catalog including ROC948", () => {
    expect(getRocktomicCatalogSkus()).toEqual(expect.arrayContaining(["ROC817", "ROC949", "ROC920", "ROC948"]));
  });

  it("returns exact SKU lookup match with confidence", () => {
    const result = lookupRocktomicSupplierProductBySku(" roc-948 ");
    expect(result.status).toBe("rocktomic");
    expect(result.normalizedSku).toBe("ROC948");
    expect(result.matchConfidence).toBe(1);
    expect(result.matchReason).toBe("exact_supplier_sku_match");
    expect(result.product?.productName).toBe("Premium Nitric Oxide Gummies");
  });

  it("returns unmatched lookup state for unknown SKU", () => {
    const result = lookupRocktomicSupplierProductBySku("roc000");
    expect(result.status).toBe("unmatched");
    expect(result.product).toBeNull();
    expect(result.matchConfidence).toBe(0);
    expect(result.matchReason).toBe("no_supplier_sku_match");
  });

  it("matches supplier intelligence by SKU", () => {
    const result = matchRocktomicBySkus(["abc", "roc948"]);
    expect(result.status).toBe("rocktomic");
    expect(result.matchedSku).toBe("ROC948");
    expect(result.product?.productName).toBe("Premium Nitric Oxide Gummies");
    expect(result.matchConfidence).toBe(1);
    expect(result.matchReason).toBe("exact_supplier_sku_match");
  });

  it("exposes required supplier product shape", () => {
    const product = listRocktomicSupplierProducts()[0];
    expect(product.supplier).toBe("Rocktomic");
    expect(product.sku).toBeTruthy();
    expect(product.productName).toBeTruthy();
    expect(product.category).toBeTruthy();
    expect(product.coa).toHaveProperty("status");
    expect(product.coa).toHaveProperty("url");
    expect(product.labelTemplate).toHaveProperty("status");
    expect(product.labelTemplate).toHaveProperty("url");
    expect(product.mockup).toHaveProperty("status");
    expect(product.mockup).toHaveProperty("url");
    expect(Array.isArray(product.certifications)).toBe(true);
    expect(Array.isArray(product.dietaryAttributes)).toBe(true);
    expect(Array.isArray(product.manufacturingClaims)).toBe(true);
    expect(product.supplementFacts).toHaveProperty("status");
    expect(product.supplementFacts).toHaveProperty("value");
    expect(product.suggestedUse).toHaveProperty("status");
    expect(product.suggestedUse).toHaveProperty("value");
    expect(product.warnings).toHaveProperty("status");
    expect(product.warnings).toHaveProperty("value");
    expect(product.inventoryStatus).toBeTruthy();
    expect(product.discontinuedStatus).toBeTruthy();
    expect(product.pricingStatus).toBeTruthy();
    expect(product.policyStatus).toBeTruthy();
    expect(product.lastSyncedAt).toBeTruthy();
    expect(product.sourceVersion).toBeTruthy();
    expect(product.sourceUpdatedAt).toBeTruthy();
  });

  it("maps Shopify products to inventory rows using source-backed supplier products", () => {
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
          sku: "ROC948",
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

    const rows = toEcomViperProductInventoryRows([product], {
      supplierProducts: listRocktomicSupplierProducts(),
      rocktomicInventoryAvailable: true,
    });
    expect(rows[0].productEditorHref).toBe("/ecomviper/products/magnesium-gummies");
    expect(rows[0].supplierMatch).toBe("rocktomic");
    expect(rows[0].supplierMatchedSku).toBe("ROC948");
    expect(rows[0].supplierMatchConfidence).toBe(1);
    expect(rows[0].supplierMatchReason).toBe("exact_supplier_sku_match");
    expect(rows[0].supplierProductName).toBe("Premium Nitric Oxide Gummies");
    expect(rows[0].shopifyStatus).toBe("active");
  });
});
