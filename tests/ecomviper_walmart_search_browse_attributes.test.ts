import { describe, expect, it } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  appendUnknownSearchBrowseFields,
  buildSearchBrowseAttributesFromSources,
  getSearchBrowseFieldDefinitions,
  isSupplementLikeProduct,
  isValidNumberUnitValue,
  mergeAttributesWithSearchBrowse,
  normalizeSearchBrowseAttributes,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";

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
    attributes: {
      form: "Capsule",
      serving_size: "2 capsules",
    },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    issues: [],
    rawPayload: {
      attributes: {
        AgeGroup: "Adult",
        targetAudience: "Adults",
      },
    },
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("walmart search & browse attributes foundation", () => {
  it("normalizes aliases and omits needs-confirmation placeholders", () => {
    const normalized = normalizeSearchBrowseAttributes({
      AgeGroup: "Adult",
      form: "Capsule",
      mainIngredients: ["Turmeric", "Glucosamine"],
      support_areas: "needs product label confirmation",
    });

    expect(normalized.age_group).toBe("Adult");
    expect(normalized.product_form).toBe("Capsule");
    expect(normalized.main_ingredients).toContain("Turmeric");
    expect(normalized.support_areas).toBeUndefined();
  });

  it("builds draft-hydration attributes from product + draft + raw aliases", () => {
    const product = createProduct();

    const merged = buildSearchBrowseAttributesFromSources({
      product,
      draftPayload: {
        searchBrowseAttributes: {
          supportAreas: "Joint comfort, mobility",
        },
      },
    });

    expect(merged.product_form).toBe("Capsule");
    expect(merged.serving_size).toBe("2 capsules");
    expect(merged.age_group).toBe("Adult");
    expect(merged.target_audience).toBe("Adults");
    expect(merged.support_areas).toContain("Joint comfort");
  });

  it("returns supplement field set for supplement-like products", () => {
    const fields = getSearchBrowseFieldDefinitions(createProduct());
    expect(fields.some((field) => field.key === "supplement_type")).toBe(true);
    expect(fields.some((field) => field.key === "main_ingredients")).toBe(true);
    expect(isSupplementLikeProduct(createProduct())).toBe(true);
  });

  it("returns unknown imported attributes as editable metadata fields", () => {
    const unknown = appendUnknownSearchBrowseFields({
      product: createProduct(),
      attributes: {
        custom_walmart_slot: "Value",
      },
    });

    expect(unknown.some((field) => field.key === "custom_walmart_slot")).toBe(true);
  });

  it("merges base and search-browse attributes for draft payload", () => {
    const merged = mergeAttributesWithSearchBrowse({
      baseAttributes: { form: "Capsule" },
      searchBrowseAttributes: { product_form: "Gummy", age_group: "Adult" },
    });

    expect(merged.product_form).toBe("Gummy");
    expect(merged.age_group).toBe("Adult");
  });

  it("validates number+unit values", () => {
    expect(isValidNumberUnitValue("4.5 in")).toBe(true);
    expect(isValidNumberUnitValue("10")).toBe(true);
    expect(isValidNumberUnitValue("wide")).toBe(false);
  });
});
