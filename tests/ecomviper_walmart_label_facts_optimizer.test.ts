import { describe, expect, it } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildWalmartOptimizationFactPack,
  normalizeVerifiedAllergenFreeStatements,
} from "@/lib/ecomviper/walmart/walmart-label-facts";
import { applyWalmartDocketOptimizationRules } from "@/lib/ecomviper/walmart/walmart-optimization-rules";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";

function createRoc817Product(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc817",
    marketplace: "walmart",
    sku: "ROC817",
    externalItemId: "wm_roc817",
    title: "OPA Nutrition Sleep Aid Formula, Sleep Support Supplement, 60 Capsules",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 18,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/roc817-front.jpg",
    galleryImageUrls: ["https://images.example.com/roc817-facts.jpg"],
    issues: [],
    attributes: {},
    searchBrowseAttributes: {
      serving_size: "e.g., 1 scoop (8 g)",
      servings_per_container: "",
    },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {
      labelFacts: {
        servingSize: "2 Capsules",
        servingsPerContainer: "30",
        count: "60 Capsules",
        supplementFacts: {
          Calcium: "17 mg",
          "Vitamin B6": "1.8 mg",
          Magnesium: "13 mg",
          Melatonin: "10 mg",
          "Sleep Formula Proprietary Blend": "905 mg",
        },
        activeIngredients: [
          "Calcium 17 mg",
          "Vitamin B6 1.8 mg",
          "Magnesium 13 mg",
          "Melatonin 10 mg",
          "L-Tryptophan",
          "Goji",
          "Chamomile",
          "Lemon Balm",
          "Passion Flower",
          "L-Taurine",
          "Hops",
          "GABA",
          "Skullcap",
          "L-Theanine",
          "Ashwagandha",
          "Inositol",
        ],
        otherIngredients: [
          "Cellulose (Vegetable Capsule)",
          "Magnesium Stearate (Vegetable)",
          "Silicon Dioxide",
        ],
        suggestedUse:
          "As a dietary supplement take two (2) capsules once a day. For best results take 20-30 min before bedtime with an 8 oz glass of water, or as directed by your healthcare professional.",
        warnings:
          "Do not exceed recommended dose. Pregnant or nursing mothers, children under the age of 18, and individuals with a known medical condition should consult a physician before using this or any dietary supplement.",
      },
    },
    lastSyncedAt: "2026-05-17T00:00:00.000Z",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart label facts optimizer", () => {
  it("extracts ROC817 serving/dosage/suggested-use facts from label-backed payload", () => {
    const factPack = buildWalmartOptimizationFactPack({
      product: createRoc817Product(),
    });

    expect(factPack.labelFacts.servingSize).toBe("2 capsules");
    expect(factPack.labelFacts.servingsPerContainer).toBe("30");
    expect(factPack.labelFacts.capsuleTabletGummyCount).toBe("60 capsules");
    expect(factPack.labelFacts.dosageStrength).toContain("Melatonin 10 mg");
    expect(factPack.labelFacts.dosageStrength).toContain("Sleep Formula Proprietary Blend 905 mg");
    expect(factPack.labelFacts.proprietaryBlendName).toBe("Sleep Formula Proprietary Blend");
    expect(factPack.labelFacts.proprietaryBlendAmount).toBe("905 mg");
    expect(factPack.labelFacts.suggestedUse).toContain("20-30 min before bedtime");
    expect(factPack.labelFacts.cautionsWarnings).toContain("Do not exceed recommended dose");
  });

  it("does not infer allergen-free claims when label evidence is absent", () => {
    const factPack = buildWalmartOptimizationFactPack({
      product: createRoc817Product(),
    });
    expect(factPack.labelFacts.allergenFreeStatements).toEqual([]);

    const result = applyWalmartDocketOptimizationRules({
      product: createRoc817Product(),
    });
    expect(result.output.searchBrowse.allergenFreeStatements ?? "").toBe("");
    expect(result.output.validation.warnings.join(" ").toLowerCase()).toContain(
      "no allergen-free statement verified from label"
    );
  });

  it("keeps explicit allergen-free statements when they are present in label facts", () => {
    const factPack = buildWalmartOptimizationFactPack({
      product: createRoc817Product({
        normalizedPayload: {
          labelFacts: {
            doesNotContain: ["Gluten-free", "Dairy-free", "Soy-free"],
          },
        },
      }),
    });
    expect(factPack.labelFacts.allergenFreeStatements).toEqual([
      "Gluten-free",
      "Dairy-free",
      "Soy-free",
    ]);

    expect(
      normalizeVerifiedAllergenFreeStatements("Gluten-free, dairy-free, no artificial colors")
    ).toEqual(["Gluten-free", "dairy-free"]);
  });

  it("fills serving/search-browse fields and generates label-fact-rich long copy and bullets", () => {
    const result = applyWalmartDocketOptimizationRules({
      product: createRoc817Product(),
    });

    expect(result.output.searchBrowse.servingSize).toBe("2 capsules");
    expect(result.output.searchBrowse.servingsPerContainer).toBe("30");
    expect(result.output.searchBrowse.count).toBe("60 capsules");
    expect(result.output.searchBrowse.flavor).toBe("Unflavored");
    expect(result.output.searchBrowse.flavorSource).toBe("default_unflavored");
    expect(result.output.searchBrowse.flavorConfidence).toBe("default_unflavored");
    expect(result.output.searchBrowse.dosageStrength ?? "").toContain("Melatonin 10 mg");
    expect(result.output.searchBrowse.dosageStrength ?? "").toContain("905 mg");
    expect(result.output.content.longDescription.startsWith(result.output.content.productTitle)).toBe(
      true
    );
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("berry flavor");
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("unflavored");
    expect(result.output.content.shortDescription.toLowerCase()).not.toContain("berry flavor");
    expect(result.output.content.longDescription).toContain("2 capsules");
    expect(result.output.content.longDescription).toContain("Melatonin 10 mg");
    expect(result.output.content.longDescription).toContain("905 mg");
    expect(result.output.content.longDescription).toContain("20-30 min before bedtime");
    expect(result.output.content.longDescription).not.toContain("Differentiation note");
    expect(result.output.content.longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1).toBe(
      1
    );
    expect(result.output.content.bullets.length).toBeGreaterThanOrEqual(5);
    expect(result.output.content.bullets.length).toBeLessThanOrEqual(7);
    expect(result.output.content.bullets.join(" ")).toContain("2 capsules");
    expect(result.output.content.bullets.join(" ")).toContain("Melatonin 10 mg");
    expect(result.output.content.bullets.join(" ")).toContain("905 mg");
    expect(result.output.content.bullets.join(" ")).toContain("60 capsules");
    expect(result.output.content.shortDescription.toLowerCase()).not.toContain("supports supports");
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("supports relaxation support");
    expect(result.output.content.bullets.join(" ").toLowerCase()).not.toContain("designed to supports");
    expect(result.output.content.longDescription.toLowerCase()).not.toContain("water,or");
    expect(result.output.content.longDescription.toLowerCase()).not.toContain("8oz.");
  });

  it("removes unsupported flavor claims from title copy and emits warning", () => {
    const result = applyWalmartDocketOptimizationRules({
      product: createRoc817Product({
        title: "OPA Nutrition Sleep Aid Formula Capsules, Berry flavor, Unflavored flavor, 60 capsules",
        searchBrowseAttributes: {},
      }),
    });

    expect(result.output.searchBrowse.flavor).toBe("Unflavored");
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("berry flavor");
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("unflavored flavor");
    expect(result.output.validation.warnings.join(" ")).toContain(
      "Removed unsupported flavor claim because no explicit flavor was found. Defaulted Flavor attribute to Unflavored."
    );
    expect(result.output.validation.removedClaims).toContain("Berry flavor");
    expect(result.output.validation.removedClaims).toContain("Unflavored flavor");
  });

  it("keeps explicit Berry flavor when trusted flavor evidence exists", () => {
    const result = applyWalmartDocketOptimizationRules({
      product: createRoc817Product({
        searchBrowseAttributes: {
          flavor: "Berry",
          product_form: "Capsule",
        },
      }),
    });

    expect(result.output.searchBrowse.flavor).toBe("Berry");
    expect(result.output.searchBrowse.flavorConfidence).toBe("explicit");
  });
});
