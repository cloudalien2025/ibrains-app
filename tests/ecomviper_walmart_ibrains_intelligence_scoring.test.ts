import { describe, expect, it } from "vitest";
import {
  runWalmartIBrainsIntelligence,
  summarizeWalmartIBrainsOpportunities,
} from "@/lib/ecomviper/walmart/walmart-ibrains-intelligence";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

function createProduct(overrides?: Partial<WalmartEffectiveProductRecord>): WalmartEffectiveProductRecord {
  return {
    id: "walmart_ibrains_scoring_001",
    marketplace: "walmart",
    sku: "IBR-SCORE-001",
    externalItemId: "wm_ibrains_scoring_001",
    title: "Digestive Wellness Daily Support",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 15,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/ibrains-score-001.jpg",
    altText: "Digestive wellness daily support supplement bottle",
    issues: ["Expand FAQ coverage"],
    attributes: {
      target_audience: "Adults",
      product_form: "Capsule",
      primary_benefit: "Digestive support",
    },
    searchBrowseAttributes: {
      wellness_goal: "Digestive support",
      use_case: "Daily routine",
    },
    shortDescription: "Supports digestive wellness and daily balance.",
    longDescription: "Designed to support digestive balance as part of a daily wellness routine.",
    bulletPoints: [
      "Supports digestive wellness",
      "Designed for daily routine support",
      "Helps maintain wellness consistency",
    ],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-11T00:00:00.000Z",
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart iBrains Intelligence scoring", () => {
  it("identifies high-impact opportunities and keeps score in a sensible range", () => {
    const run = runWalmartIBrainsIntelligence(createProduct());

    expect(run.summary.agenticVisibilityScore).toBeGreaterThanOrEqual(0);
    expect(run.summary.agenticVisibilityScore).toBeLessThanOrEqual(100);
    expect(run.summary.highImpactActions).toBeGreaterThan(0);
    expect(run.opportunities.some((opportunity) => opportunity.agenticVisibilityScore >= 75)).toBe(true);
  });

  it("flags risky opportunities when product content includes high-risk language", () => {
    const run = runWalmartIBrainsIntelligence(
      createProduct({
        longDescription:
          "Clinically proven to treat anxiety and insomnia with guaranteed results and works like a drug.",
      })
    );

    expect(run.summary.complianceWarnings).toBeGreaterThan(0);
    expect(run.opportunities.some((opportunity) => opportunity.complianceRisk === "high")).toBe(true);
    expect(run.opportunities.some((opportunity) => opportunity.status === "needs_approval")).toBe(true);
  });

  it("keeps summary counts aligned with the generated opportunity set", () => {
    const run = runWalmartIBrainsIntelligence(createProduct());
    const summary = summarizeWalmartIBrainsOpportunities(run.opportunities);

    const expectedWarnings = run.opportunities.filter((opportunity) => opportunity.complianceRisk !== "low").length;

    expect(summary.opportunitiesFound).toBe(run.opportunities.length);
    expect(summary.complianceWarnings).toBe(expectedWarnings);
    expect(summary.draftsReady).toBe(
      run.opportunities.filter(
        (opportunity) =>
          Boolean(opportunity.draftBody?.trim()) &&
          (opportunity.status === "draft_ready" ||
            opportunity.status === "needs_approval" ||
            opportunity.status === "approved")
      ).length
    );
  });
});
