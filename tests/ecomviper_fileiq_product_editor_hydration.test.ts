import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFileIqHydrationForShopifyProduct } from "@/lib/ecomviper/fileiq/fileiq-product-editor-hydration";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

const mocks = vi.hoisted(() => ({
  getLatestFileIqResolvedProductBySupplierAndSku: vi.fn(),
}));

vi.mock("@/lib/fileiq/fileiq-reconciliation", () => ({
  getLatestFileIqResolvedProductBySupplierAndSku: mocks.getLatestFileIqResolvedProductBySupplierAndSku,
}));

function product(): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/948",
    storeDomain: "opanutrition.myshopify.com",
    title: "ROC948 Nitric Oxide Gummies",
    handle: "roc948-nitric-oxide-gummies",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    status: "ACTIVE",
    tags: [],
    description: "Nitric oxide gummies",
    descriptionHtml: "<p>Nitric oxide gummies</p>",
    seoTitle: "ROC948 Nitric Oxide Gummies",
    seoDescription: "Nitric oxide gummies",
    metafields: [],
    onlineStoreUrl: "https://example.com/products/roc948",
    primaryImageUrl: "",
    galleryImageUrls: [],
    galleryImages: [],
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/948",
        productId: "gid://shopify/Product/948",
        title: "Default",
        sku: "ROC948",
        barcode: "",
        price: 39.99,
        compareAtPrice: null,
        inventoryQuantity: 4,
        selectedOptions: [],
        imageUrl: "",
        imageAltText: null,
        imageUrls: [],
      },
    ],
  };
}

describe("ecomviper fileiq product editor hydration", () => {
  beforeEach(() => {
    mocks.getLatestFileIqResolvedProductBySupplierAndSku.mockReset();
  });

  it("hydrates product editor facts from reconciled FileIQ supplier truth by SKU", async () => {
    mocks.getLatestFileIqResolvedProductBySupplierAndSku.mockResolvedValue({
      catalog: {
        schemaType: "product_catalog",
        schemaVersion: "1.1",
        supplier: { supplierId: "rocktomic-labs-llc", supplierName: "Rocktomic Labs LLC" },
        products: [],
        totalProductsFound: 1,
        sourcesProcessed: 3,
        extractionNotes: "reconciled",
      },
      metadata: {
        generatedAt: "2026-06-04T16:00:00.000Z",
        completenessBySku: {
          ROC948: {
            score: 7,
            readyForEcomViper: true,
            warnings: [],
          },
        },
      },
      product: {
        sku: "ROC948",
        productName: "ROC948 Nitric Oxide Gummies",
        details: {
          shortDescription: "Nitric oxide support",
          suggestedUse: "Take 2 gummies daily.",
          warnings: "Keep out of reach of children.",
          certifications: ["nsf_certified"],
          coaUrl: "https://example.com/roc948-coa.pdf",
        },
        supplementFacts: {
          servingSize: "2 gummies",
          servingsPerContainer: "30",
          ingredients: [{ name: "L-Arginine", amount: "1000", unit: "mg" }],
          otherIngredients: "Pectin",
        },
        inventory: {
          status: "in_stock",
          accessLevel: "product_investment_club",
        },
        pricing: {
          msrp: 39.99,
          wholesaleCost: 14.25,
          currency: "USD",
        },
        assets: {
          labelUrls: ["https://example.com/roc948-label.pdf"],
        },
        shipping: {
          shipsFromCountry: "USA",
          standardRoute: { fulfillmentDays: 2, totalEstimatedDays: 5 },
        },
        policy: {
          policyNotes: "30-day returns",
        },
        extraction: {
          extractedAt: "2026-06-04T15:30:00.000Z",
        },
      },
    });

    const hydration = await getFileIqHydrationForShopifyProduct({
      product: product(),
      supplierId: "rocktomic-labs-llc",
    });

    expect(hydration.context.matched).toBe(true);
    expect(hydration.context.completenessLabel).toBe("Ready for EcomViper");
    expect(hydration.patch?.servingSize).toBe("2 gummies");
    expect(hydration.patch?.activeIngredients).toContain("L-Arginine");
    expect(hydration.patch?.inventoryAccessLevel).toBe("product_investment_club");
    expect(hydration.patch?.msrp).toBe(39.99);
    expect(hydration.patch?.coaUrl).toContain("roc948-coa.pdf");
    expect(hydration.patch?.shipsFrom).toBe("USA");
    expect(hydration.patch?.returnPolicy).toBe("30-day returns");
  });

  it("returns no-match context when FileIQ has no canonical SKU record yet", async () => {
    mocks.getLatestFileIqResolvedProductBySupplierAndSku.mockResolvedValue(null);

    const hydration = await getFileIqHydrationForShopifyProduct({
      product: product(),
      supplierId: "rocktomic-labs-llc",
    });

    expect(hydration.context.matched).toBe(false);
    expect(hydration.context.completenessLabel).toBe("No FileIQ match");
    expect(hydration.patch).toBeNull();
  });
});
