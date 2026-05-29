import { describe, expect, it } from "vitest";
import { toEcomViperProductInventoryRows } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";
import type { RocktomicSupplierProduct } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";

function buildProduct(sku: string, inventoryQuantity: number | null): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/1",
    storeDomain: "example.myshopify.com",
    title: "Product",
    handle: "product",
    vendor: "Vendor",
    productType: "Supplements",
    status: "ACTIVE",
    tags: [],
    description: "A".repeat(140),
    descriptionHtml: "<p>Product</p>",
    seoTitle: "SEO title example",
    seoDescription: "SEO description example with enough length.",
    metafields: [],
    onlineStoreUrl: "https://example.myshopify.com/products/product",
    primaryImageUrl: "",
    galleryImageUrls: [],
    galleryImages: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/1",
        productId: "gid://shopify/Product/1",
        title: "Default",
        sku,
        barcode: "",
        price: 10,
        compareAtPrice: null,
        inventoryQuantity,
        selectedOptions: [],
        imageUrl: "",
        imageAltText: null,
        imageUrls: [],
      },
    ],
  };
}

function buildSupplierProduct(sku: string, inventoryStatus: RocktomicSupplierProduct["inventoryStatus"]): RocktomicSupplierProduct {
  return {
    supplier: "Rocktomic",
    sku,
    productName: "Supplier Product",
    category: "Supplements",
    labelSize: null,
    containerSize: null,
    productWeight: null,
    coa: { status: "pending_source", url: null },
    labelTemplate: { status: "configured", url: null },
    mockup: { status: "pending_source", url: null },
    certifications: [],
    dietaryAttributes: [],
    manufacturingClaims: [],
    supplementFacts: { status: "pending_source", value: null },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus,
    discontinuedStatus: "unknown",
    pricingStatus: "pending_source",
    policyStatus: "available",
    lastSyncedAt: "2026-05-29T00:00:00.000Z",
    sourceVersion: "test",
    sourceUpdatedAt: "2026-05-29T00:00:00.000Z",
  };
}

describe("ecomviper inventory fallback behavior", () => {
  it("uses Rocktomic inventory status when available", () => {
    const rows = toEcomViperProductInventoryRows([buildProduct("ROC948", 0)], {
      supplierProducts: [buildSupplierProduct("ROC948", "in_stock")],
      rocktomicInventoryAvailable: true,
    });

    expect(rows[0].inventoryStatus).toBe("in_stock");
    expect(rows[0].inventorySource).toBe("rocktomic");
  });

  it("falls back to Shopify inventory when Rocktomic inventory is unknown but source is available", () => {
    const rows = toEcomViperProductInventoryRows([buildProduct("ROC948", 5)], {
      supplierProducts: [buildSupplierProduct("ROC948", "unknown")],
      rocktomicInventoryAvailable: true,
    });

    expect(rows[0].inventoryStatus).toBe("in_stock");
    expect(rows[0].inventorySource).toBe("shopify");
  });

  it("returns unknown when inventory cannot be derived but source is available", () => {
    const rows = toEcomViperProductInventoryRows([buildProduct("ROC948", null)], {
      supplierProducts: [buildSupplierProduct("ROC948", "unknown")],
      rocktomicInventoryAvailable: true,
    });

    expect(rows[0].inventoryStatus).toBe("unknown");
    expect(rows[0].inventorySource).toBe("unknown");
  });

  it("returns inventory_source_unavailable when inventory source is unavailable", () => {
    const rows = toEcomViperProductInventoryRows([buildProduct("ROC948", null)], {
      supplierProducts: [buildSupplierProduct("ROC948", "unknown")],
      rocktomicInventoryAvailable: false,
    });

    expect(rows[0].inventoryStatus).toBe("inventory_source_unavailable");
    expect(rows[0].inventorySource).toBe("inventory_source_unavailable");
  });
});
