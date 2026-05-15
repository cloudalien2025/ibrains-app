import { describe, expect, it } from "vitest";
import type { CanonicalProductFacts } from "@/lib/ecomviper/walmart/product-facts-agent";
import type { AgenticReferralCopyOutput } from "@/lib/ecomviper/walmart/agentic-referral-copy-agent";
import {
  mapCanonicalFactsToSearchBrowse,
} from "@/lib/ecomviper/walmart/walmart-search-browse-mapper";

function createFacts(overrides?: Partial<CanonicalProductFacts>): CanonicalProductFacts {
  return {
    brand: "OPA Nutrition",
    manufacturer: "OPA Nutrition",
    productName: "Magnesium Glycinate Gummies",
    series: "OPA Sleep Series",
    sku: "ROC949",
    form: "Gummies",
    count: "60 gummies",
    supply: "60 day supply",
    flavor: "Grape",
    servingSize: "1 gummy",
    servingsPerContainer: "60",
    activeIngredients: ["Magnesium (as Magnesium Glycinate) 30mg"],
    supplementFacts: {
      "Magnesium (as Magnesium Glycinate)": "30mg",
    },
    otherIngredients: ["Glucose syrup", "Pectin", "Natural Flavor (Grape)"],
    allergenOrDoesNotContainStatements: ["Gluten", "Soy", "Gelatin"],
    suggestedUse: "Adults take one gummy daily, or as directed by your healthcare professional.",
    warnings:
      "Consult your healthcare professional before use if pregnant, nursing, or taking medication.",
    storage: "Store in a cool, dry place.",
    claimsFromLabel: ["Sleep quality support", "Relaxation support"],
    madeInUsa: "",
    origin: "",
    category: "Magnesium Supplement",
    productType: "Sleep Support Supplement",
    targetAudience: "Adults seeking relaxation and sleep quality support",
    sourceConfidence: {},
    sourceEvidence: {},
    ...overrides,
  };
}

function createCopy(overrides?: Partial<AgenticReferralCopyOutput>): AgenticReferralCopyOutput {
  return {
    title:
      "OPA Nutrition Magnesium Glycinate Gummies, Sleep Quality & Relaxation Support, Grape, 60 Ct",
    shortDescription:
      "Fact-grounded magnesium glycinate gummies for relaxation and sleep quality support.",
    longDescription:
      "Premium magnesium glycinate gummy formula for daily routines. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
    bullets: [
      "Magnesium glycinate gummy format",
      "Sleep quality and relaxation support",
      "Serving size: 1 gummy daily",
      "Grape flavor, 60-count bottle",
    ],
    searchKeywords: [
      "magnesium glycinate gummies",
      "sleep quality support gummies",
      "grape magnesium gummies",
    ],
    aiVisibilitySummary:
      "Magnesium glycinate gummy supplement with clear facts and daily-use guidance.",
    structuredProductFactsSummary:
      "Brand: OPA Nutrition | Form: Gummies | Serving size: 1 gummy",
    customerFitDescriptors: ["Adults seeking relaxation support"],
    compliantBenefitClusters: ["sleep quality support", "relaxation support"],
    faqSnippets: ["How do I use it? Adults take one gummy daily."],
    disclaimer:
      "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
    ...overrides,
  };
}

describe("Search & Browse mapper", () => {
  it("maps canonical facts and copy into search/browse fields while replacing stale values", () => {
    const result = mapCanonicalFactsToSearchBrowse({
      facts: createFacts(),
      copy: createCopy(),
      existingSearchBrowse: {
        brand: "OPA",
        manufacturer: "Unknown",
        product_form: "Capsule",
        flavor: "Mixed berry",
        main_ingredients: "Turmeric, Glucosamine, Chondroitin",
        search_keywords: "joint support",
      },
      staleFieldReplacements: [
        {
          field: "flavor",
          previousValue: "mixed berry",
          nextValue: "grape",
          reason: "label outranks draft",
        },
        {
          field: "form",
          previousValue: "capsules",
          nextValue: "gummies",
          reason: "label outranks draft",
        },
      ],
      usedSources: ["label_image", "shopify", "walmart_draft"],
    });

    expect(result.mappedAttributes.brand).toBe("OPA Nutrition");
    expect(result.mappedAttributes.manufacturer).toBe("OPA Nutrition");
    expect(result.mappedAttributes.product_form).toBe("Gummy");
    expect(result.mappedAttributes.flavor).toBe("Grape");
    expect(result.mappedAttributes.main_ingredients.toLowerCase()).toContain("magnesium");
    expect(result.mappedAttributes.main_ingredients.toLowerCase()).not.toContain("turmeric");
    expect(result.mappedAttributes.search_keywords.toLowerCase()).toContain("magnesium glycinate");
    expect(result.replacedFields).toContain("product_form");
    expect(result.replacedFields).toContain("flavor");
  });

  it("does not allow protected fields from AI candidates", () => {
    const result = mapCanonicalFactsToSearchBrowse({
      facts: createFacts(),
      copy: createCopy(),
      aiCandidates: {
        sku: "DO-NOT-OVERWRITE",
        upc: "123456789012",
        price: "19.99",
        support_areas: "unknown",
        search_terms: "magnesium glycinate gummies",
      },
    });

    expect(result.mappedAttributes).not.toHaveProperty("sku");
    expect(result.mappedAttributes).not.toHaveProperty("upc");
    expect(result.mappedAttributes).not.toHaveProperty("price");
    expect(result.mappedAttributes.search_terms).toContain("magnesium glycinate");
    expect(result.skippedProtectedFields).toEqual(expect.arrayContaining(["sku", "upc", "price"]));
    expect(result.skippedLowConfidenceFields).toContain("support_areas");
  });

  it("clears stale flavor when label source is present but flavor is unknown", () => {
    const result = mapCanonicalFactsToSearchBrowse({
      facts: createFacts({ flavor: "" }),
      copy: createCopy(),
      existingSearchBrowse: {
        flavor: "Mixed berry",
      },
      usedSources: ["label_image"],
    });

    expect(result.mappedAttributes.flavor).toBeUndefined();
    expect(result.clearedFields).toContain("flavor");
  });
});
