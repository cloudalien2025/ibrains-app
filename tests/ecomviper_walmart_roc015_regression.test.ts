import { describe, expect, it } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { buildDeterministicAiSuggestion } from "@/lib/ecomviper/walmart/walmart-ai-optimizer";
import { extractCanonicalProductFacts } from "@/lib/ecomviper/walmart/product-facts-agent";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc015",
    marketplace: "walmart",
    sku: "ROC015",
    externalItemId: "wm_roc015",
    title:
      "OPA Immunity Greens & Reds Daily Wellness Blend with Prebiotics, Enzymes & Mushrooms, 35 servings",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 39.99,
    inventoryQuantity: 7,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://cdn.example.com/roc015-front.jpg",
    galleryImageUrls: ["https://cdn.example.com/roc015-supplement-facts.jpg"],
    attributes: {
      product_form: "Capsule",
      form: "Capsule",
      flavor: "Mixed berry",
      main_ingredients: "Turmeric, glucosamine, chondroitin",
      ingredients_list: "Complete ingredients from label",
      serving_size: "2 capsules",
      servings_per_container: "30",
      servings: "30",
      dosage_strength: "Magnesium 30mg",
    },
    searchBrowseAttributes: {
      product_form: "Capsule",
      form: "Capsule",
      flavor: "Mixed berry",
      main_ingredients: "Turmeric, glucosamine, chondroitin",
      ingredients_list: "Complete ingredients from label",
      serving_size: "2 capsules",
      servings_per_container: "30",
      servings: "30",
      dosage_strength: "Magnesium 30mg",
    },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    issues: ["Image not provided by Walmart catalog"],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("ROC015 Walmart optimizer truth gates", () => {
  it("removes stale defaults and keeps alias fields synchronized", () => {
    const suggestion = buildDeterministicAiSuggestion(createProduct());

    expect(suggestion.searchBrowseAttributes?.product_form).toBe("Powder");
    expect(suggestion.searchBrowseAttributes?.form).toBe("Powder");
    expect(suggestion.searchBrowseAttributes?.servings_per_container).toBe("35");
    expect(suggestion.searchBrowseAttributes?.servings).toBe("35");
    expect(suggestion.searchBrowseAttributes?.flavor).toBe("Unflavored");
    expect(suggestion.searchBrowseAttributes?.main_ingredients).toBeUndefined();
    expect(suggestion.searchBrowseAttributes?.ingredients_list).toBeUndefined();
    expect(suggestion.searchBrowseAttributes?.serving_size).toBeUndefined();
    expect(suggestion.searchBrowseAttributes?.dosage_strength).toBeUndefined();
    expect(suggestion.applyDiagnostics?.staleFieldsCleared).toEqual(
      expect.arrayContaining([
        "main_ingredients",
        "ingredients_list",
        "serving_size",
        "dosage_strength",
      ])
    );
  });

  it("does not leak Unknown/internal language into deterministic customer-facing copy", () => {
    const suggestion = buildDeterministicAiSuggestion(
      createProduct({
        brand: "",
      })
    );

    expect((suggestion.suggestedTitle || "").toLowerCase()).not.toContain("unknown");
    expect((suggestion.suggestedDescription || "").toLowerCase()).not.toContain(
      "machine-readable confidence"
    );
    expect((suggestion.suggestedDescription || "").toLowerCase()).not.toContain(
      "ai recommendation readiness"
    );
    expect((suggestion.suggestedTitle || "")).not.toContain("|");
  });

  it("keeps manufacturer blank and flags review when manufacturer evidence is missing", () => {
    const suggestion = buildDeterministicAiSuggestion(
      createProduct({
        brand: "OPA Nutrition",
      })
    );

    expect(suggestion.searchBrowseAttributes?.manufacturer).toBeUndefined();
    expect(suggestion.applyDiagnostics?.manufacturerNeedsReview).toBe(true);
  });

  it("keeps FAQ pending when image facts need vision extraction and thresholds are unmet", () => {
    const suggestion = buildDeterministicAiSuggestion(
      createProduct({
        title: "OPA Immunity Greens & Reds Powder 35 servings",
        attributes: {},
        searchBrowseAttributes: {},
      })
    );

    expect(suggestion.applyDiagnostics?.imageFactsStatus).toBe("needs_vision_extraction");
    expect(suggestion.applyDiagnostics?.faqGenerationState).toBe("pending");
    expect(suggestion.faqSnippets ?? []).toEqual([]);
    expect(suggestion.complianceWarnings.join(" ").toLowerCase()).toContain("faq generation pending");
  });

  it("blocks internal/customer-placeholder leakage at validation", () => {
    const result = evaluateWalmartListingCompliance({
      title: "Unknown OPA product",
      shortDescription: "See product label for ingredient details.",
      longDescription:
        "This listing uses compliant structure/function language for AI Recommendation Readiness and machine-readable confidence.",
      bulletPoints: ["Unknown"],
      searchBrowseAttributes: {
        brand: "OPA Nutrition",
      },
      faqSnippets: ["Q: Ingredients? A: See product label for ingredient details."],
    });

    expect(result.valid).toBe(false);
    expect(result.violations.join(" ").toLowerCase()).toContain("placeholder");
    expect(result.violations.join(" ").toLowerCase()).toContain("internal agentic");
  });

  it("blocks manufacturer copied from brand when no source evidence is supplied", () => {
    const result = evaluateWalmartListingCompliance({
      title: "OPA Immunity Greens & Reds Powder 35 Servings",
      shortDescription: "Greens and reds powder for daily wellness routines.",
      longDescription:
        "OPA Immunity Greens & Reds powder for daily use. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
      searchBrowseAttributes: {
        brand: "OPA Nutrition",
        manufacturer: "OPA Nutrition",
        product_form: "Powder",
      },
      faqSnippets: [],
      imageFactsStatus: "needs_vision_extraction",
    });

    expect(result.valid).toBe(false);
    expect(result.violations.join(" ").toLowerCase()).toContain(
      "manufacturer appears copied from brand"
    );
  });

  it("captures image-fact gate in canonical facts when no extraction has run", () => {
    const facts = extractCanonicalProductFacts(
      {
        product: createProduct({
          attributes: {
            dosage_strength: "Magnesium 30mg",
            main_ingredients: "Turmeric, glucosamine, chondroitin",
          },
          searchBrowseAttributes: {
            dosage_strength: "Magnesium 30mg",
            main_ingredients: "Turmeric, glucosamine, chondroitin",
          },
        }),
      }
    );

    expect(facts.imageFactsStatus).toBe("needs_vision_extraction");
    expect(facts.facts.dosageStrength).toBe("");
    expect(facts.facts.activeIngredients).toEqual([]);
  });
});
