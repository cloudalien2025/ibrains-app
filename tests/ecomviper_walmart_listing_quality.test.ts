import { describe, expect, it } from "vitest";
import {
  assessWalmartListingQuality,
  mergeWalmartAiSuggestionIntoProduct,
  mergeWalmartDraftPayloadIntoProduct,
} from "@/lib/ecomviper/walmart/walmart-listing-quality";
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

  it("scores projected draft from merged AI fields instead of trusting raw AI quality number", () => {
    const current = createProduct({
      sku: "ROC808",
      title: "OPA Joint Flex Capsules with Glucosamine, Chondroitin & MSM - 60ct",
      shortDescription: "",
      longDescription: "",
      bulletPoints: [],
      attributes: {},
      imageUrl: "",
      imageStatus: "catalog_missing",
      imageStatusMessage: "Image not provided by Walmart catalog",
      imageSyncStatus: "not_found",
      imageSource: "walmart_item_search",
      issues: ["Image not provided by Walmart catalog"],
    });

    const currentAssessment = assessWalmartListingQuality(current);
    expect(currentAssessment.score).toBe(62);

    const suggestionQualityClaim = 8;
    const projected = mergeWalmartAiSuggestionIntoProduct(current, {
      sku: "ROC808",
      qualityScore: suggestionQualityClaim,
      suggestedTitle: "OPA Joint Flex Capsules with Glucosamine, Chondroitin & MSM - 60ct",
      suggestedShortDescription: "Daily joint and mobility support.",
      suggestedDescription:
        "Designed for compliant listing quality with clear product benefits and factual shopper guidance.",
      suggestedBullets: [
        "Joint and mobility support formula",
        "Glucosamine, chondroitin, and MSM blend",
        "Clear daily routine guidance",
        "Factual listing language",
        "Structured key feature coverage",
      ],
      suggestedAttributes: { form: "Capsule", serving_size: "2 capsules" },
      missingAttributes: ["ingredients_highlights"],
      complianceWarnings: [],
      disclaimer: "compliance disclaimer",
    });

    const projectedAssessment = assessWalmartListingQuality(projected);
    expect(projectedAssessment.score).toBeGreaterThan(currentAssessment.score);
    expect(projectedAssessment.score).not.toBe(suggestionQualityClaim);
    expect(projectedAssessment.factors).toContain("Image not provided by Walmart catalog");
  });

  it("does not let empty attribute keys mask missing attributes in scoring", () => {
    const fromDraft = mergeWalmartDraftPayloadIntoProduct(
      createProduct({
        attributes: {},
      }),
      {
        attributes: {
          color: "",
          material: " ",
        },
      }
    );
    const assessment = assessWalmartListingQuality(fromDraft);
    expect(assessment.factors).toContain("Key attributes are missing");
  });

  it("keeps score healthy when image is the only major issue", () => {
    const assessment = assessWalmartListingQuality(
      createProduct({
        imageUrl: "",
        imageStatus: "catalog_missing",
        imageStatusMessage: "Image not provided by Walmart catalog",
        imageSyncStatus: "not_found",
        imageSource: "walmart_item_search",
        issues: ["Image not provided by Walmart catalog"],
      })
    );

    expect(assessment.score).toBeGreaterThanOrEqual(80);
    expect(assessment.factors).toContain("Image not provided by Walmart catalog");
  });
});
