import { describe, expect, it } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildLabelFactsFixtureForRoc949,
  extractCanonicalProductFacts,
} from "@/lib/ecomviper/walmart/product-facts-agent";

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
    inventoryQuantity: 10,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    issues: [],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-12T00:00:00.000Z",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("Product Facts Agent", () => {
  it("extracts ROC949 label facts and replaces stale contradictory draft values", () => {
    const labelFacts = buildLabelFactsFixtureForRoc949();

    const result = extractCanonicalProductFacts({
      product: createProduct({
        title: "OPA Joint Platinum Turmeric Glucosamine Chondroitin 60 Capsules",
        normalizedPayload: { labelFacts },
      }),
      draftPayload: {
        flavor: "Mixed berry",
        product_form: "Capsules",
        main_ingredients: "Turmeric, Glucosamine, Chondroitin",
      },
    });

    expect(result.usedSources).toContain("label_image");
    expect(result.facts.brand).toBe("OPA Nutrition");
    expect(result.facts.productName).toBe("Magnesium Glycinate Gummies");
    expect(result.facts.form).toBe("Gummies");
    expect(result.facts.flavor).toBe("Grape");
    expect(result.facts.servingSize).toBe("1 gummy");
    expect(result.facts.servingsPerContainer).toBe("60");
    expect(result.facts.activeIngredients.join(" ").toLowerCase()).toContain("magnesium");
    expect(result.facts.activeIngredients.join(" ").toLowerCase()).not.toContain("turmeric");
    expect(result.staleFieldReplacements.some((entry) => entry.field === "flavor")).toBe(true);
    expect(result.staleFieldReplacements.some((entry) => entry.field === "form")).toBe(true);
  });

  it("keeps flavor blank when label has no flavor evidence", () => {
    const labelFacts = {
      ...buildLabelFactsFixtureForRoc949(),
      flavor: "",
      naturalFlavor: "",
      otherIngredients: ["Glucose syrup", "Sugar", "Pectin"],
    };

    const result = extractCanonicalProductFacts({
      product: createProduct({
        title: "OPA Nutrition Ashwagandha Gummies 60 count",
        normalizedPayload: { labelFacts },
      }),
      draftPayload: {
        flavor: "Mixed berry",
      },
    });

    expect(result.facts.flavor).toBe("");
    expect(result.facts.sourceConfidence.flavor).toBe("unknown");
  });

  it("infers powder form and servings from title while clearing capsule-style stale defaults", () => {
    const result = extractCanonicalProductFacts({
      product: createProduct({
        title:
          "OPA Immunity Greens & Reds Daily Wellness Blend with Prebiotics, Enzymes & Mushrooms, 35 servings",
        attributes: {
          product_form: "Capsule",
          serving_size: "2 capsules",
          servings_per_container: "30",
          dosage_strength: "Magnesium 30mg",
          main_ingredients: "Turmeric, glucosamine, chondroitin",
          flavor: "Mixed berry",
        },
      }),
    });

    expect(result.facts.form).toBe("Powder");
    expect(result.facts.servingsPerContainer).toBe("35");
    expect(result.facts.servingSize).toBe("");
    expect(result.facts.dosageStrength).toBe("");
    expect(result.facts.activeIngredients).toEqual([]);
    expect(result.facts.flavor).toBe("");
    expect(result.staleFieldReplacements.some((entry) => entry.field === "servingSize")).toBe(
      true
    );
  });
});
