import { describe, expect, it } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { buildDeterministicAiSuggestion } from "@/lib/ecomviper/walmart/walmart-ai-optimizer";
import { buildLabelFactsFixtureForRoc949 } from "@/lib/ecomviper/walmart/product-facts-agent";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc949",
    marketplace: "walmart",
    sku: "ROC949",
    externalItemId: "wm_roc949",
    title: "OPA Joint Platinum Turmeric Glucosamine Chondroitin 60 Capsules",
    brand: "OPA",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    issues: ["Image not provided by Walmart catalog"],
    attributes: {
      product_form: "Capsule",
      flavor: "Mixed berry",
      main_ingredients: "Turmeric, Glucosamine, Chondroitin",
      target_audience: "Adults",
    },
    searchBrowseAttributes: {
      product_form: "Capsule",
      flavor: "Mixed berry",
      main_ingredients: "Turmeric, Glucosamine, Chondroitin",
    },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {
      labelFacts: buildLabelFactsFixtureForRoc949(),
    },
    lastSyncedAt: "2026-05-12T00:00:00.000Z",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart AI optimizer layered enrichment", () => {
  it("builds deterministic suggestion from label facts and maps Search & Browse safely", () => {
    const suggestion = buildDeterministicAiSuggestion(createProduct());

    expect(suggestion.searchBrowseAttributes?.brand).toBe("OPA Nutrition");
    expect(suggestion.searchBrowseAttributes?.manufacturer).toBe("OPA Nutrition");
    expect(suggestion.searchBrowseAttributes?.product_form).toBe("Gummy");
    expect(suggestion.searchBrowseAttributes?.flavor).toBe("Grape");
    expect(suggestion.searchBrowseAttributes?.main_ingredients?.toLowerCase()).toContain("magnesium");
    expect(suggestion.searchBrowseAttributes?.main_ingredients?.toLowerCase()).not.toContain("turmeric");

    expect(suggestion.applyDiagnostics?.factsSources).toContain("label_image");
    expect(suggestion.applyDiagnostics?.staleFieldsReplaced).toContain("flavor");
    expect(suggestion.applyDiagnostics?.staleFieldsReplaced).toContain("form");

    expect(suggestion.suggestedDescription).toContain(SUPPLEMENT_FDA_DISCLAIMER);
    expect(suggestion.suggestedDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(1);
    expect(suggestion.suggestedDescription.toLowerCase()).not.toContain(
      "supports wellness, supports wellness"
    );
  });
});
