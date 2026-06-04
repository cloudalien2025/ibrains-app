import {
  clampWalmartAiVisibilityScoreValue,
  toWalmartAiVisibilityScoreStatus,
  type WalmartAiVisibilityScore,
  type WalmartAiVisibilityScoreProvenanceSource,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-score";
import type { WalmartListingQualityAssessment } from "@/lib/ecomviper/walmart/walmart-types";

const DEFAULT_PRODUCT_INPUT_REFS = [
  "lib/ecomviper/walmart/walmart-listing-quality.ts",
  "lib/ecomviper/walmart/walmart-product-ai-visibility-score.ts",
  "app/optiwal/products/[sku]/product-editor-client.tsx",
];

function toRecommendationPriority(
  severity: "high" | "medium" | "low"
): "high" | "medium" | "low" {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

export interface WalmartProductAiVisibilityDiagnostics {
  ai_visibility_score: WalmartAiVisibilityScore;
  listing_quality_score: number;
  projected_listing_quality_score: number | null;
}

export function buildWalmartProductAiVisibilityDiagnostics(input: {
  listingQuality: WalmartListingQualityAssessment;
  projectedScore?: number | null;
  provenanceSource?: WalmartAiVisibilityScoreProvenanceSource;
  generatedAt?: string;
  inputRefs?: string[];
}): WalmartProductAiVisibilityDiagnostics {
  const listingQualityScore = clampWalmartAiVisibilityScoreValue(input.listingQuality.score);
  const projectedListingQualityScore =
    typeof input.projectedScore === "number"
      ? clampWalmartAiVisibilityScoreValue(input.projectedScore)
      : null;
  const overall =
    projectedListingQualityScore === null
      ? listingQualityScore
      : Math.max(listingQualityScore, projectedListingQualityScore);

  return {
    ai_visibility_score: {
      overall,
      status: toWalmartAiVisibilityScoreStatus(overall),
      dimensions: {
        // Product-level listing quality is currently the closest implemented
        // signal for catalog-readiness coverage at SKU scope.
        catalog_readiness_coverage: listingQualityScore,
      },
      provenance: {
        source: input.provenanceSource ?? "derived",
        generated_at: input.generatedAt ?? new Date().toISOString(),
        input_refs: input.inputRefs ?? DEFAULT_PRODUCT_INPUT_REFS,
      },
      recommendations: input.listingQuality.recommendations.slice(0, 12).map((recommendation) => ({
        id: recommendation.id,
        label: recommendation.title,
        priority: toRecommendationPriority(recommendation.severity),
        surface: "product_editor",
      })),
    },
    listing_quality_score: listingQualityScore,
    projected_listing_quality_score: projectedListingQualityScore,
  };
}
