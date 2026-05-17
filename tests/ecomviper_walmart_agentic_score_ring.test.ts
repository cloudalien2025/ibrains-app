import { describe, expect, it } from "vitest";
import { getAgenticScorePresentation } from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";

describe("Walmart Agentic Visibility score ring thresholds", () => {
  it("marks 100 as perfectly optimized with full-green tone", () => {
    const presentation = getAgenticScorePresentation(100);
    expect(presentation.label).toBe("Perfectly optimized");
    expect(presentation.ringColor).toBe("#16A34A");
  });

  it("marks representative mid scores as needs work", () => {
    const presentation = getAgenticScorePresentation(63);
    expect(presentation.label).toBe("Needs work");
    expect(presentation.ringColor).toBe("#EAB308");
  });

  it("avoids guaranteed outcome language in score labels", () => {
    const labels = [
      getAgenticScorePresentation(100).label,
      getAgenticScorePresentation(95).label,
      getAgenticScorePresentation(80).label,
      getAgenticScorePresentation(63).label,
      getAgenticScorePresentation(20).label,
    ].join(" ");

    expect(labels.toLowerCase()).not.toContain("guaranteed");
    expect(labels.toLowerCase()).not.toContain("sales");
    expect(labels.toLowerCase()).not.toContain("referral");
  });
});
