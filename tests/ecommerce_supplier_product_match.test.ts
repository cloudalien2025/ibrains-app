import { describe, expect, it } from "vitest";
import { findSupplierProductMatch, normalizeSupplierSku } from "@/lib/ecommerce/supplier-product-match";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

function createProduct(overrides: Partial<ShopifyProductRecord> = {}): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/500",
    storeDomain: "opanutrition.myshopify.com",
    title: "OPA Enzyme Balance",
    handle: "opa-enzyme-balance",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    status: "ACTIVE",
    tags: [],
    description: "Digestive blend with bromelain and papain",
    descriptionHtml: "<p>Digestive blend with bromelain and papain</p>",
    seoTitle: "OPA Enzyme Balance",
    seoDescription: "Digestive blend",
    metafields: [
      {
        id: "mf-1",
        namespace: "facts",
        key: "ingredients",
        type: "single_line_text_field",
        value: "Bromelain 200mg, Papain 120mg",
        description: null,
      },
    ],
    onlineStoreUrl: "https://opanutrition.myshopify.com/products/opa-enzyme-balance",
    primaryImageUrl: "",
    galleryImageUrls: [],
    galleryImages: [],
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/501",
        productId: "gid://shopify/Product/500",
        title: "Default",
        sku: "roc-011",
        barcode: "",
        price: 29.99,
        compareAtPrice: null,
        inventoryQuantity: 4,
        selectedOptions: [],
        imageUrl: "",
        imageAltText: null,
        imageUrls: [],
      },
    ],
    ...overrides,
  };
}

describe("supplier-product-match", () => {
  it("normalizes supplier sku values", () => {
    expect(normalizeSupplierSku(" roc-011 ")).toBe("ROC011");
    expect(normalizeSupplierSku("RoC 011")).toBe("ROC011");
  });

  it("returns exact_sku when SKU matches exactly", () => {
    const result = findSupplierProductMatch({
      product: createProduct({ variants: [{ ...createProduct().variants[0], sku: "ROC011" }] }),
      candidates: [
        {
          supplierSlug: "rocktomic",
          supplierName: "Rocktomic",
          sku: "ROC011",
          productName: "OPA Enzyme Balance",
          activeIngredients: ["Bromelain"],
          supplementFactsText: null,
        },
      ],
    });

    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("exact_sku");
  });

  it("returns normalized_sku when formatting differs", () => {
    const result = findSupplierProductMatch({
      product: createProduct({ variants: [{ ...createProduct().variants[0], sku: "roc-011" }] }),
      candidates: [
        {
          supplierSlug: "rocktomic",
          supplierName: "Rocktomic",
          sku: "ROC011",
          productName: "OPA Enzyme Balance",
          activeIngredients: ["Bromelain"],
          supplementFactsText: null,
        },
      ],
    });

    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("normalized_sku");
  });

  it("returns weak_candidate when only low-confidence title overlap exists", () => {
    const result = findSupplierProductMatch({
      product: createProduct({ title: "Super Greens", handle: "super-greens" }),
      candidates: [
        {
          supplierSlug: "rocktomic",
          supplierName: "Rocktomic",
          sku: "ROC200",
          productName: "Greens Powder",
          activeIngredients: [],
          supplementFactsText: null,
        },
      ],
    });

    expect(result.matched).toBe(false);
    expect(["weak_candidate", "no_match"]).toContain(result.confidence);
  });
});
