import { describe, expect, it } from "vitest";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-supplement-disclaimer";

describe("Walmart validation reliability", () => {
  it("fails a screenshot-style bad draft with disclaimer/copy/FAQ/search-browse blockers", () => {
    const badPayload = {
      title: "Supplement",
      category: "Supplements",
      shortDescription: "Treats insomnia and anxiety quickly.",
      longDescription:
        "This formula treats insomnia fast and supports wellness, supports wellness for everyone. " +
        `${SUPPLEMENT_FDA_DISCLAIMER} ${SUPPLEMENT_FDA_DISCLAIMER}`,
      bulletPoints: [
        "supports wellness, supports wellness",
        "best seller",
        "free shipping",
      ],
      structuredProductFactsSummary:
        "Form: Gummies | Active ingredients: Magnesium (as Magnesium Glycinate) 30mg | Serving size: 1 gummy | Servings per container: 60 | Suggested use: Adults take one gummy daily. | Warnings: Consult your healthcare professional before use.",
      aiVisibilitySummary: "AI-ready summary for answer-engine retrieval.",
      searchBrowseAttributes: {},
      faqSnippets: [],
    };

    const result = evaluateWalmartListingCompliance(badPayload);

    expect(result.valid).toBe(false);
    expect(result.violations.some((entry) => entry.includes("duplicate FDA supplement disclaimer"))).toBe(
      true
    );
    expect(
      result.violations.some((entry) =>
        entry.includes("Disease/treat/cure/prevent language detected outside canonical FDA disclaimer")
      )
    ).toBe(true);
    expect(result.violations.some((entry) => entry.includes("FAQ snippets are missing"))).toBe(true);
    expect(
      result.violations.some((entry) =>
        entry.includes("inferable from extracted facts but missing in Search & Browse")
      )
    ).toBe(true);
    expect(result.warnings.some((entry) => entry.includes("Repeated generated-copy artifacts"))).toBe(
      true
    );
  });

  it("passes a fixed draft with canonical disclaimer, complete search/browse, and FAQ coverage", () => {
    const fixedPayload = {
      title: "OPA Nutrition Magnesium Glycinate Gummies 60 Count",
      category: "Supplements",
      shortDescription:
        "Magnesium glycinate gummies supporting relaxation and sleep quality with label-backed serving guidance.",
      longDescription:
        "OPA Nutrition Magnesium Glycinate Gummies provide label-backed wellness support with clear ingredient, serving, and safety guidance. Suggested use: Adults take one gummy daily. Safety guidance: Consult your healthcare professional before use if pregnant, nursing, or taking medication. " +
        SUPPLEMENT_FDA_DISCLAIMER,
      bulletPoints: [
        "Magnesium glycinate gummy format",
        "Serving size: 1 gummy",
        "Servings per container: 60",
      ],
      structuredProductFactsSummary:
        "Form: Gummies | Active ingredients: Magnesium (as Magnesium Glycinate) 30mg | Serving size: 1 gummy | Servings per container: 60 | Suggested use: Adults take one gummy daily. | Warnings: Consult your healthcare professional before use.",
      aiVisibilitySummary: "Entity-rich summary for answer-engine retrieval.",
      searchBrowseAttributes: {
        brand: "OPA Nutrition",
        manufacturer: "OPA Nutrition",
        product_name: "Magnesium Glycinate Gummies",
        supplement_type: "Sleep Support Supplement",
        product_type: "Sleep Support Supplement",
        category: "Supplements",
        product_form: "Gummy",
        form: "Gummy",
        main_ingredients: "Magnesium (as Magnesium Glycinate) 30mg",
        ingredients_list: "Magnesium (as Magnesium Glycinate) 30mg",
        serving_size: "1 gummy",
        servings_per_container: "60",
        suggested_use: "Adults take one gummy daily.",
        safety_warnings:
          "Consult your healthcare professional before use if pregnant, nursing, or taking medication.",
        support_areas: "sleep quality support, relaxation support",
        search_keywords: "magnesium glycinate gummies, sleep quality support",
        search_terms: "magnesium glycinate gummies",
        target_audience: "Adults",
        dosage_strength: "Magnesium (as Magnesium Glycinate) 30mg",
      },
      faqSnippets: [
        "Q: What is this product? A: Magnesium glycinate gummies.",
        "Q: Who is it for? A: Adults.",
        "Q: How do I take it? A: One gummy daily.",
        "Q: What are the main ingredients? A: Magnesium glycinate.",
        "Q: Any warnings? A: Consult your healthcare professional before use.",
      ],
    };

    const result = evaluateWalmartListingCompliance(fixedPayload);

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("detects missing inferable Search & Browse fields when extraction data exists", () => {
    const payload = {
      title: "OPA Nutrition Magnesium Glycinate Gummies 60 Count",
      category: "Supplements",
      shortDescription: "Supports sleep quality and relaxation.",
      longDescription:
        "Suggested use: Adults take one gummy daily. Warnings: Consult your healthcare professional before use. " +
        SUPPLEMENT_FDA_DISCLAIMER,
      bulletPoints: ["Serving size: 1 gummy", "Servings per container: 60"],
      structuredProductFactsSummary:
        "Form: Gummies | Active ingredients: Magnesium (as Magnesium Glycinate) 30mg | Serving size: 1 gummy | Servings per container: 60",
      aiVisibilitySummary: "AI summary",
      searchBrowseAttributes: {
        brand: "OPA Nutrition",
      },
      faqSnippets: [
        "Q: What is this product? A: Magnesium gummies.",
        "Q: Who is it for? A: Adults.",
        "Q: How do I take it? A: One gummy daily.",
        "Q: Main ingredient? A: Magnesium glycinate.",
        "Q: Warnings? A: See safety guidance.",
      ],
    };

    const result = evaluateWalmartListingCompliance(payload);

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((entry) => entry.includes("Main ingredient is inferable"))
    ).toBe(true);
    expect(result.violations.some((entry) => entry.includes("Serving size is inferable"))).toBe(
      true
    );
    expect(
      result.violations.some((entry) => entry.includes("Suggested use is inferable"))
    ).toBe(true);
  });
});
