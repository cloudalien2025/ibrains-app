import { describe, expect, it } from "vitest";
import { buildWalmartProductAiVisibilityDiagnostics } from "@/lib/ecomviper/walmart/walmart-product-ai-visibility-score";
import type { WalmartListingQualityAssessment } from "@/lib/ecomviper/walmart/walmart-types";

function buildListingQuality(overrides?: Partial<WalmartListingQualityAssessment>): WalmartListingQualityAssessment {
  return {
    score: 68,
    imageStatus: "Image available",
    factors: ["Bullets/key features are sparse"],
    recommendations: [
      {
        id: "bullets_missing",
        title: "Expand key feature bullets",
        reason: "Add at least 3 concise key features.",
        severity: "medium",
      },
      {
        id: "price_missing",
        title: "Set valid product price",
        reason: "Price is required for listing quality and conversion.",
        severity: "high",
      },
    ],
    ...overrides,
  };
}

describe("Walmart product ai visibility score adapter", () => {
  it("maps listing quality score into canonical ai_visibility_score overall/status", () => {
    const diagnostics = buildWalmartProductAiVisibilityDiagnostics({
      listingQuality: buildListingQuality({ score: 71 }),
      provenanceSource: "derived",
      generatedAt: "2026-05-18T00:00:00.000Z",
    });

    expect(diagnostics.ai_visibility_score.overall).toBe(71);
    expect(diagnostics.ai_visibility_score.status).toBe("good");
    expect(diagnostics.ai_visibility_score.dimensions.catalog_readiness_coverage).toBe(71);
    expect(diagnostics.listing_quality_score).toBe(71);
    expect(diagnostics.projected_listing_quality_score).toBeNull();
    expect(diagnostics.ai_visibility_score.provenance).toEqual({
      source: "derived",
      generated_at: "2026-05-18T00:00:00.000Z",
      input_refs: [
        "lib/ecomviper/walmart/walmart-listing-quality.ts",
        "lib/ecomviper/walmart/walmart-product-ai-visibility-score.ts",
        "app/apps/ecomviper/walmart/products/[sku]/product-editor-client.tsx",
      ],
    });
  });

  it("uses projected score as the optimized overall when it is higher", () => {
    const diagnostics = buildWalmartProductAiVisibilityDiagnostics({
      listingQuality: buildListingQuality({ score: 62 }),
      projectedScore: 88,
      provenanceSource: "fixture",
    });

    expect(diagnostics.listing_quality_score).toBe(62);
    expect(diagnostics.projected_listing_quality_score).toBe(88);
    expect(diagnostics.ai_visibility_score.overall).toBe(88);
    expect(diagnostics.ai_visibility_score.status).toBe("excellent");
  });

  it("keeps current listing quality as overall when projected score is lower", () => {
    const diagnostics = buildWalmartProductAiVisibilityDiagnostics({
      listingQuality: buildListingQuality({ score: 79 }),
      projectedScore: 55,
      provenanceSource: "derived",
    });

    expect(diagnostics.listing_quality_score).toBe(79);
    expect(diagnostics.projected_listing_quality_score).toBe(55);
    expect(diagnostics.ai_visibility_score.overall).toBe(79);
    expect(diagnostics.ai_visibility_score.status).toBe("good");
  });

  it("normalizes product recommendations into canonical recommendation priorities", () => {
    const diagnostics = buildWalmartProductAiVisibilityDiagnostics({
      listingQuality: buildListingQuality({
        recommendations: [
          {
            id: "inventory_oos",
            title: "Restock inventory",
            reason: "Out-of-stock products suppress conversion and listing momentum.",
            severity: "high",
          },
          {
            id: "description_missing",
            title: "Add compliant description",
            reason: "Description coverage is required for listing quality and shopper clarity.",
            severity: "low",
          },
        ],
      }),
    });

    expect(diagnostics.ai_visibility_score.recommendations).toEqual([
      {
        id: "inventory_oos",
        label: "Restock inventory",
        priority: "high",
        surface: "product_editor",
      },
      {
        id: "description_missing",
        label: "Add compliant description",
        priority: "low",
        surface: "product_editor",
      },
    ]);
  });
});
