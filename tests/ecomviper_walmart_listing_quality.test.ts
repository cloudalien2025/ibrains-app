import { describe, expect, it } from "vitest";
import { assessWalmartListingQuality } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_30066-841",
    marketplace: "walmart",
    sku: "30066-841",
    externalItemId: "wm_30066-841",
    title: "Sample Walmart Product Daily Wellness Formula with Balanced Ingredients",
    brand: "Walmart Brand",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 12,
    inventoryStatus: "known",
    status: "active",
    imageUrl: "https://images.example.com/30066-841.jpg",
    imageStatus: "image_available",
    imageStatusMessage: "Image available",
    imageSource: "walmart_catalog",
    issues: [],
    attributes: { serving_size: "2 capsules" },
    shortDescription: "Supports daily wellness routines.",
    longDescription: "Compliant and factual listing description.",
    bulletPoints: ["Feature one", "Feature two", "Feature three"],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-09T00:00:00.000Z",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart listing quality scoring", () => {
  it("reduces score when image is missing", () => {
    const withImage = assessWalmartListingQuality(createProduct());
    const withoutImage = assessWalmartListingQuality(
      createProduct({
        imageUrl: "",
        imageStatus: "enrichment_unconfigured",
        imageStatusMessage: "Image enrichment source not configured",
        imageSource: "none",
        issues: ["Image not provided by Walmart catalog", "Image enrichment source not configured"],
      })
    );

    expect(withoutImage.score).toBeLessThan(withImage.score);
    expect(withoutImage.factors).toContain("Image enrichment source not configured");
  });

  it("scores known inventory better than unknown or out-of-stock", () => {
    const known = assessWalmartListingQuality(createProduct({ inventoryStatus: "known", inventoryQuantity: 7 }));
    const unknown = assessWalmartListingQuality(createProduct({ inventoryStatus: "unknown", inventoryQuantity: 0 }));
    const outOfStock = assessWalmartListingQuality(createProduct({ inventoryStatus: "out_of_stock", inventoryQuantity: 0 }));

    expect(known.score).toBeGreaterThan(unknown.score);
    expect(known.score).toBeGreaterThan(outOfStock.score);
  });

  it("detects missing brand and weak title quality issues", () => {
    const assessment = assessWalmartListingQuality(
      createProduct({
        title: "Bad",
        brand: "",
      })
    );

    expect(assessment.recommendations.some((entry) => entry.id === "brand_missing")).toBe(true);
    expect(assessment.recommendations.some((entry) => entry.id === "title_quality")).toBe(true);
  });
});
