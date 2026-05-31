import { describe, expect, it } from "vitest";
import {
  buildRocktomicSupplementFactsOcrEvidence,
  parseRocktomicSupplementFactsFromOcrText,
} from "@/lib/ecomviper/suppliers/rocktomic-supplement-facts-ocr";

const ocrText = `
Supplement Facts
Serving Size: 1 Scoop (10g)
Servings Per Container: 30
Active Ingredients: L-Citrulline 6000mg; Beta Alanine 3200mg
Other Ingredients: Citric Acid, Natural Flavor
Suggested Use: Mix one scoop with water.
Warnings: Keep out of reach of children.
`;

describe("rocktomic supplement facts OCR parsing", () => {
  it("parses serving size, servings per container, active ingredients, and other ingredients", () => {
    const parsed = parseRocktomicSupplementFactsFromOcrText(ocrText);

    expect(parsed.parsed.servingSize).toContain("1 Scoop");
    expect(parsed.parsed.servingsPerContainer).toBe("30");
    expect(parsed.parsed.activeIngredients.length).toBeGreaterThan(0);
    expect(parsed.parsed.amountPerServing.some((entry) => entry.includes("L-Citrulline"))).toBe(true);
    expect(parsed.parsed.otherIngredients).toContain("Citric Acid");
    expect(parsed.confidence).toBe("high");
    expect(parsed.needsReview).toBe(false);
  });

  it("marks low-confidence OCR as review-needed without Unknown placeholders", () => {
    const parsed = parseRocktomicSupplementFactsFromOcrText("Random panel text without nutrition heading");

    expect(parsed.confidence).toBe("low");
    expect(parsed.needsReview).toBe(true);
    expect(parsed.parseWarnings.length).toBeGreaterThan(0);
    expect(parsed.parsed.servingSize).toBeNull();
  });

  it("builds deterministic OCR evidence rows for fixture usage", () => {
    const rows = buildRocktomicSupplementFactsOcrEvidence({
      entries: [
        {
          sku: "roc-011",
          rawText: ocrText,
          sourcePage: 42,
          sourceAsset: "catalog_pdf_page_42_crop_a",
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.sku).toBe("ROC011");
    expect(rows[0]?.sourceMethod).toBe("ocr");
    expect(rows[0]?.sourcePage).toBe(42);
    expect(rows[0]?.needsReview).toBe(false);
  });
});
