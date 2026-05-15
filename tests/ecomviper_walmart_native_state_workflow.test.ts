import { describe, expect, it } from "vitest";
import {
  generateEditableDraftState,
  generateOptimizedProposalState,
  hydrateCurrentWalmartState,
  toNativeStateDraftPayload,
} from "@/lib/ecomviper/walmart/walmart-native-state";
import { resolveWalmartStructuredAttributeRegistry } from "@/lib/ecomviper/walmart/walmart-structured-attributes";
import type { WalmartAiSuggestion, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_native_1",
    marketplace: "walmart",
    sku: "NATIVE-1",
    externalItemId: "wm_native_1",
    title: "Current Product Name",
    brand: "Current Brand",
    category: "Supplements",
    price: 21.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/native-primary.jpg",
    imageStatus: "image_available",
    imageStatusMessage: "Image available",
    imageSyncStatus: "found",
    imageSource: "walmart_item_search",
    issues: ["Missing nutrients"],
    attributes: {
      product_type: "Digestive Support",
      supplement_type: "Daily Supplement",
      product_form: "Capsule",
      serving_size: "2 capsules",
      servings_per_container: "30",
      main_ingredients: "Probiotic Blend",
      warning_text: "Keep out of reach of children",
      stop_use_indications: "Stop use if irritation occurs",
      country_of_origin: "USA",
    },
    searchBrowseAttributes: {
      product_type: "Digestive Support",
      supplement_type: "Daily Supplement",
      product_form: "Capsule",
      serving_size: "2 capsules",
      servings_per_container: "30",
      count_per_pack: "1",
      age_group: "Adult",
      flavor: "Unflavored",
    },
    shortDescription: "Current site description",
    longDescription: "Current long description",
    bulletPoints: ["Current bullet one", "Current bullet two"],
    rawPayload: {
      salePrice: 18.99,
      fulfillmentType: "WFS",
      lagTime: "1 day",
      shippingTemplate: "Standard",
      weight: "1 lb",
      taxonomyPlacement: "Health/Nutrition/Supplements",
      wfsStatus: "enabled",
    },
    normalizedPayload: {
      galleryImageUrls: [
        "https://images.example.com/native-primary.jpg",
        "https://images.example.com/native-gallery-1.jpg",
      ],
      richMediaStatus: "active",
    },
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function createSuggestion(): WalmartAiSuggestion {
  return {
    sku: "NATIVE-1",
    qualityScore: 88,
    suggestedTitle: "Optimized Product Name",
    suggestedShortDescription: "Optimized site description",
    suggestedDescription: "Optimized long description",
    suggestedBullets: ["Optimized bullet one", "Optimized bullet two"],
    suggestedBrand: "Optimized Brand",
    suggestedAttributes: {
      product_type: "Advanced Digestive Support",
      product_form: "Capsule",
      nutrients: "Vitamin D, Zinc",
    },
    searchBrowseAttributes: {
      serving_size: "1 capsule",
      servings_per_container: "60",
      count_per_pack: "2",
    },
    missingAttributes: [],
    complianceWarnings: [],
    disclaimer: "Disclaimer",
  };
}

describe("Walmart native state workflow architecture", () => {
  it("hydrates current Walmart-native state without FAQ/internal optimization fields", () => {
    const current = hydrateCurrentWalmartState({
      product: createProduct(),
    });

    const serialized = JSON.stringify(current).toLowerCase();
    expect(current.stateType).toBe("current");
    expect(current.content.productName).toBe("Current Product Name");
    expect(current.searchBrowse.productType).toBe("Digestive Support");
    expect(serialized).not.toContain("faq");
    expect(serialized).not.toContain("aivisibility");
    expect(serialized).not.toContain("semantic gap");
  });

  it("builds optimized proposal from current state without mutating current layer", () => {
    const current = hydrateCurrentWalmartState({
      product: createProduct(),
    });
    const before = JSON.stringify(current);

    const proposalLayer = generateOptimizedProposalState({
      currentWalmartState: current,
      suggestion: createSuggestion(),
      currentScore: 70,
      projectedScore: 88,
    });

    expect(proposalLayer.optimizationAnalysis.generated).toBe(true);
    expect(proposalLayer.optimizedProposalState.stateType).toBe("proposal");
    expect(proposalLayer.optimizedProposalState.content.productName).toBe("Optimized Product Name");
    expect(proposalLayer.optimizedProposalState.searchBrowse.attributes.serving_size).toBe("1 capsule");
    expect(proposalLayer.optimizationAnalysis.changedFields.length).toBeGreaterThan(0);

    expect(JSON.stringify(current)).toBe(before);
    expect(JSON.stringify(proposalLayer.currentWalmartState)).toBe(before);
  });

  it("builds editable draft state from proposal without mutating proposal layer", () => {
    const current = hydrateCurrentWalmartState({
      product: createProduct(),
    });
    const proposalLayer = generateOptimizedProposalState({
      currentWalmartState: current,
      suggestion: createSuggestion(),
      currentScore: 70,
      projectedScore: 88,
    });

    const proposalBefore = JSON.stringify(proposalLayer.optimizedProposalState);

    const draftLayer = generateEditableDraftState({
      currentWalmartState: proposalLayer.currentWalmartState,
      optimizedProposalState: proposalLayer.optimizedProposalState,
      draftPayload: {
        title: "Manually Edited Draft Title",
        price: 24.99,
        searchBrowseAttributes: {
          product_form: "Gummy",
          nutrients: "Vitamin C",
        },
      },
    });

    expect(draftLayer.editableDraftState.stateType).toBe("draft");
    expect(draftLayer.editableDraftState.content.productName).toBe("Manually Edited Draft Title");
    expect(draftLayer.editableDraftState.pricingInventory.currentPrice).toBe(24.99);
    expect(draftLayer.editableDraftState.searchBrowse.attributes.product_form).toBe("Gummy");

    expect(JSON.stringify(proposalLayer.optimizedProposalState)).toBe(proposalBefore);
    expect(JSON.stringify(draftLayer.optimizedProposalState)).toBe(proposalBefore);
  });

  it("keeps structured attribute mapping category-aware and supplement-specific", () => {
    const supplementRegistry = resolveWalmartStructuredAttributeRegistry({
      product: createProduct(),
    });

    expect(supplementRegistry.supplementRelevant).toBe(true);
    expect(
      supplementRegistry.definitions.some((definition) => definition.key === "supplement_type")
    ).toBe(true);
    expect(
      supplementRegistry.definitions.some(
        (definition) => definition.key === "serving_size" && definition.required
      )
    ).toBe(true);

    const nonSupplementRegistry = resolveWalmartStructuredAttributeRegistry({
      product: createProduct({
        category: "Electronics",
        title: "Noise Cancelling Headphones",
        attributes: { color: "Black" },
        searchBrowseAttributes: { color: "Black" },
      }),
    });

    expect(nonSupplementRegistry.supplementRelevant).toBe(false);
    expect(
      nonSupplementRegistry.definitions.some((definition) => definition.key === "supplement_type")
    ).toBe(false);
  });

  it("converts editable native state to MP_MAINTENANCE-compatible draft payload", () => {
    const current = hydrateCurrentWalmartState({
      product: createProduct(),
    });
    const payload = toNativeStateDraftPayload(current);

    expect(payload).toMatchObject({
      title: "Current Product Name",
      shortDescription: "Current site description",
      longDescription: "Current long description",
      price: 21.99,
      inventoryQuantity: 8,
      searchBrowseAttributes: {
        product_type: "Digestive Support",
        supplement_type: "Daily Supplement",
      },
    });
    expect(payload).not.toHaveProperty("faqSnippets");
  });
});
