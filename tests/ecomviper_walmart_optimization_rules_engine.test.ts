import { describe, expect, it } from "vitest";
import {
  applyWalmartDocketOptimizationRules,
  buildWalmartDocketOptimizationPromptContract,
} from "@/lib/ecomviper/walmart/walmart-optimization-rules";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_rules_1",
    marketplace: "walmart",
    sku: "RULES-1",
    externalItemId: "wm_rules_1",
    title: "OPA Sleep Herbal Melatonin Relaxation Complex 60 Capsules",
    brand: "OPA",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 22,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    issues: [],
    attributes: {
      product_form: "Capsule",
      count: "60 capsules",
      main_ingredients: "Melatonin, Chamomile",
      support_areas: "sleep quality, relaxation",
      target_audience: "Adults",
    },
    searchBrowseAttributes: {
      product_type: "Sleep Supplement",
      supplement_type: "Melatonin Supplement",
      product_form: "Capsule",
      count: "60 capsules",
      main_ingredients: "Melatonin, Chamomile",
      support_areas: "sleep quality, relaxation",
      target_audience: "Adults",
    },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart docket optimization rules engine", () => {
  it("generates compliant title/short/long/bullets with deterministic constraints", () => {
    const result = applyWalmartDocketOptimizationRules({
      product: createProduct(),
    });

    expect(result.output.content.productTitle.length).toBeGreaterThan(20);
    expect(result.output.content.productTitle.length).toBeLessThanOrEqual(150);
    expect(result.output.content.productTitle).toContain("OPA");
    expect(result.output.content.productTitle.toLowerCase()).toContain("capsule");
    expect(result.output.content.productTitle).toMatch(/60/i);
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("free shipping");

    const shortSentences = result.output.content.shortDescription
      .split(/[.!?]/)
      .filter((entry) => entry.trim().length > 0);
    expect(shortSentences).toHaveLength(1);

    const disclaimerCount =
      result.output.content.longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1;
    expect(disclaimerCount).toBe(1);

    expect(result.output.content.bullets.length).toBeGreaterThanOrEqual(5);
    expect(result.output.content.bullets.length).toBeLessThanOrEqual(7);
    expect(result.output.validation.blockers.join(" ").toLowerCase()).not.toContain("cure");
    expect(result.output.searchBrowse.flavor).toBe("Unflavored");
    expect(result.output.content.shortDescription.toLowerCase()).not.toContain("supports supports");
    expect(result.output.content.bullets.join(" ").toLowerCase()).not.toContain("designed to supports");
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("supports relaxation support");
    expect(result.output.content.productTitle.toLowerCase()).not.toContain("unflavored flavor");
  });

  it("keeps price/inventory unchanged and keeps GTIN/UPC lookup-only guidance", () => {
    const result = applyWalmartDocketOptimizationRules({
      product: createProduct({
        price: 19.49,
        inventoryQuantity: 11,
      }),
    });

    expect(result.output.pricingInventory.unchangedFields).toEqual(["price", "inventory"]);
    expect(result.output.pricingInventory.priceNotes.join(" ")).toContain("Price unchanged");
    expect(result.output.pricingInventory.inventoryNotes.join(" ")).toContain(
      "Inventory unchanged"
    );
    expect(result.output.searchBrowse.warnings.join(" ")).toContain("GTIN/UPC remain lookup identifiers only.");
  });

  it("builds prompt contract with full-docket schema and safe constraints", () => {
    const contract = buildWalmartDocketOptimizationPromptContract({
      product: createProduct(),
    });

    expect(contract.task).toContain("full Walmart listing docket");
    const constraints = contract.constraints as Record<string, unknown>;
    expect(constraints.titleMaxChars).toBe(150);
    expect(constraints.noDiseaseClaims).toBe(true);
    expect(constraints.missingFlavorDefaultsToUnflavored).toBe(true);
    expect(constraints.noFlavorInferenceFromColorIngredientsOrCompetitors).toBe(true);

    const requiredOutputShape = contract.requiredOutputShape as Record<string, unknown>;
    expect(requiredOutputShape).toHaveProperty("content");
    expect(requiredOutputShape).toHaveProperty("media");
    expect(requiredOutputShape).toHaveProperty("pricingInventory");
    expect(requiredOutputShape).toHaveProperty("searchBrowse");
    expect(requiredOutputShape).toHaveProperty("factPack");
  });

  it("keeps product identity first for ROC817-like supplement facts with minor minerals", () => {
    const result = applyWalmartDocketOptimizationRules({
      product: createProduct({
        title: "OPA Nutrition Sleep Aid Formula 60 Capsules",
        normalizedPayload: {
          labelFacts: {
            servingSize: "2 capsules",
            servingsPerContainer: "30",
            count: "60 capsules",
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
            ],
          },
        },
      }),
    });

    expect(result.output.content.productTitle.startsWith("OPA")).toBe(true);
    expect(result.output.content.productTitle.toLowerCase().startsWith("calcium")).toBe(false);
    expect(result.output.content.longDescription.startsWith(result.output.content.productTitle)).toBe(
      true
    );
  });
});
