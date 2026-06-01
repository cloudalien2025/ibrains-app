import { describe, expect, it } from "vitest";
import {
  extractSupplementFactsDeterministic,
  isStructuredSupplementFactsValid,
} from "@/lib/ecomviper/suppliers/rocktomic/supplement-facts-panel";

const provenance = [{
  sourceType: "catalog_pdf" as const,
  sourceUrl: "https://example.com/catalog.pdf",
  pageNumber: 76,
  extractedAt: "2026-06-01T00:00:00.000Z",
  extractor: "test",
  rawSnippet: "fixture",
  confidence: 0.95,
}];

describe("rocktomic supplement facts deterministic parser", () => {
  it("extracts ROC948-like panel text into structured facts", () => {
    const text = [
      "Supplement Facts",
      "Serving Size: 2 Gummies",
      "Servings Per Container: 30",
      "Calories 25",
      "Total Carbohydrates 6g",
      "Total Sugars 5g",
      "Includes 5g Added Sugars",
      "Vitamin C 30mg",
      "Niacin 10mg",
      "Vitamin B12 100mcg",
      "Sodium 7mg",
      "Beet Root Powder Extract 100mg",
      "Grape Seed Extract 50mg",
      "L-Arginine 25mg",
      "L-Citrulline 25mg",
    ].join("\n");

    const parsed = extractSupplementFactsDeterministic({
      text,
      provenance,
      extractionMethod: "deterministic_pdf_text",
    });

    expect(parsed.needsReview).toBe(false);
    expect(parsed.servingSize).toBe("2 Gummies");
    expect(parsed.servingsPerContainer).toBe(30);
    expect(parsed.nutrientFacts.some((entry) => entry.name.toLowerCase().includes("vitamin c") && entry.amount === 30)).toBe(true);
    expect(parsed.activeIngredients.some((entry) => entry.name.includes("Beet Root Powder Extract") && entry.amount === 100)).toBe(true);

    const validity = isStructuredSupplementFactsValid({
      sku: "ROC948",
      productName: "Premium Nitric Oxide Gummies",
      servingSize: parsed.servingSize,
      servingsPerContainer: parsed.servingsPerContainer,
      nutrientFacts: parsed.nutrientFacts,
      activeIngredients: parsed.activeIngredients,
    });
    expect(validity.valid).toBe(true);
  });

  it("keeps messy/incomplete panel text in needs_review", () => {
    const parsed = extractSupplementFactsDeterministic({
      text: "Supplement Facts Serving Size 2 Capsules Serving Per Container 10 Amount Per Serving NPV",
      provenance,
      extractionMethod: "deterministic_markdown_text",
    });

    expect(parsed.needsReview).toBe(true);
    expect(parsed.missingFields).toContain("nutrientFacts");
    expect(parsed.missingFields).toContain("activeIngredients");
  });
});

