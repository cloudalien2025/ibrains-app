import { describe, expect, it } from "vitest";
import {
  reviewWalmartSupplementCopy,
  type WalmartComplianceContent,
} from "@/lib/ecomviper/walmart/walmart-compliance-agent";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";

function createContent(overrides?: Partial<WalmartComplianceContent>): WalmartComplianceContent {
  return {
    title: "OPA Nutrition Magnesium Glycinate Gummies, Sleep Quality Support, 60 Ct",
    shortDescription: "Magnesium glycinate gummies that support relaxation and sleep quality.",
    longDescription:
      "Supports relaxation support and supports wellness, supports wellness for daily use. " +
      SUPPLEMENT_FDA_DISCLAIMER +
      " " +
      SUPPLEMENT_FDA_DISCLAIMER,
    bullets: [
      "Supports relaxation support",
      "Supports wellness, supports wellness",
      "1 gummy daily",
      "Grape flavor",
    ],
    searchKeywords: [
      "magnesium glycinate gummies",
      "sleep quality support gummies",
      "treat insomnia fast",
    ],
    aiVisibilitySummary:
      "Magnesium glycinate gummies with clear serving guidance and label-backed product facts.",
    structuredProductFactsSummary:
      "Form: Gummies | Serving size: 1 gummy | Servings per container: 60",
    customerFitDescriptors: ["Adults seeking relaxation support"],
    compliantBenefitClusters: ["sleep quality support", "relaxation support"],
    faqSnippets: ["How do I use it? Adults take one gummy daily."],
    ...overrides,
  };
}

describe("Walmart Compliance Agent", () => {
  it("preserves FDA disclaimer once and removes risky/repetitive copy", () => {
    const result = reviewWalmartSupplementCopy(createContent());

    expect(result.finalDecision).toBe("accepted_with_changes");
    expect(result.disclaimerStatus).toBe("deduped");
    expect(result.compliantContent.longDescription).toContain(SUPPLEMENT_FDA_DISCLAIMER);
    expect(result.compliantContent.longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(1);

    expect(result.compliantContent.searchKeywords.join(" ").toLowerCase()).not.toContain("insomnia");
    expect(result.compliantContent.bullets.join(" ").toLowerCase()).not.toContain(
      "supports wellness, supports wellness"
    );
    expect(result.changedFields.length).toBeGreaterThan(0);
  });

  it("rejects output when unresolved forbidden claims remain", () => {
    const result = reviewWalmartSupplementCopy(
      createContent({
        title: "ED support gummies",
      })
    );

    expect(result.finalDecision).toBe("rejected");
    expect(result.rejectionReasons).toContain("risky_claims_detected_after_compliance");
  });
});
