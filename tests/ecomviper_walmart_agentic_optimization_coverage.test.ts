import { describe, expect, it } from "vitest";
import {
  buildWalmartAgenticReadinessScorecard,
  buildWalmartOptimizationCoverageAudit,
  getWalmartOptimizationCoverageMatrix,
} from "@/lib/ecomviper/walmart/walmart-agentic-optimization-coverage";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_cov_001",
    marketplace: "walmart",
    sku: "COV-001",
    externalItemId: "wm_cov_001",
    title: "Sample Wellness Formula",
    brand: "",
    category: "Supplements",
    price: 0,
    inventoryQuantity: 0,
    inventoryStatus: "unknown",
    status: "attention",
    imageUrl: "",
    issues: ["Image not provided by Walmart catalog"],
    attributes: {},
    searchBrowseAttributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart agentic optimization coverage", () => {
  it("builds a non-empty coverage matrix with unique ids and all major groups", () => {
    const matrix = getWalmartOptimizationCoverageMatrix();
    expect(matrix.length).toBeGreaterThan(120);

    const ids = matrix.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);

    const groups = new Set(matrix.map((row) => row.group));
    expect(groups).toEqual(
      new Set([
        "pdp_content",
        "structured_attributes",
        "images_media",
        "rich_media",
        "faq_optimization",
        "search_ai_agentic",
        "compliance_optimization",
        "listing_quality_performance",
        "reviews_customer_language",
        "pricing_fulfillment_offer",
        "brand_store_graph",
        "cross_marketplace_consistency",
        "api_feed_optimization",
        "analytics_proof",
      ])
    );
  });

  it("contains critical optimization surface anchors", () => {
    const matrix = getWalmartOptimizationCoverageMatrix();
    const ids = new Set(matrix.map((row) => row.id));

    const mustHave = [
      "pdp_title",
      "pdp_long_description",
      "attr_ingredients",
      "img_primary_hero",
      "faq_ai_answer",
      "search_agentic_commerce",
      "comp_supplement_claims",
      "quality_listing_score",
      "offer_inventory_availability",
      "feed_mp_maintenance",
      "analytics_before_after",
    ];

    for (const id of mustHave) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });

  it("returns required grouped readiness subscores and overall score", () => {
    const scorecard = buildWalmartAgenticReadinessScorecard();

    expect(scorecard.overallAiRecommendationReadinessScore).toBeGreaterThan(0);
    expect(scorecard.aiConfidenceScore).toBeGreaterThan(0);

    expect(Object.keys(scorecard.subscores).sort()).toEqual(
      [
        "Analytics/Proof",
        "Brand Graph",
        "Compliance Safety",
        "FAQ Coverage",
        "Images & Media",
        "Offer/Fulfillment Signals",
        "PDP Content",
        "Search/AI Semantics",
        "Structured Attributes",
      ].sort()
    );
  });

  it("produces missing-field recommendations for low-coverage products", () => {
    const report = buildWalmartAgenticReadinessScorecard({
      product: createProduct(),
    });

    expect(report.missingFieldRecommendations.length).toBeGreaterThan(0);
    expect(report.missingFieldRecommendations.some((row) => row.group === "PDP Content")).toBe(true);
    expect(report.missingFieldRecommendations.some((row) => row.group === "Structured Attributes")).toBe(true);
  });

  it("exposes missing/partial coverage and prioritized next actions in audit output", () => {
    const audit = buildWalmartOptimizationCoverageAudit({
      product: createProduct(),
    });

    expect(audit.missingFromCode.length).toBeGreaterThan(0);
    expect(audit.nextBestActions.length).toBeGreaterThan(0);
    expect(audit.statusCounts.supported).toBeGreaterThan(0);
    expect(audit.statusCounts.missing).toBeGreaterThan(0);
    expect(audit.statusCounts.partial).toBeGreaterThan(0);
  });
});
