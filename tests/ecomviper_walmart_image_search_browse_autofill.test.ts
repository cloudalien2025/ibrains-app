import { afterEach, describe, expect, it, vi } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { extractCanonicalProductFacts } from "@/lib/ecomviper/walmart/product-facts-agent";
import { buildAgenticReferralCopy } from "@/lib/ecomviper/walmart/agentic-referral-copy-agent";
import { mapCanonicalFactsToSearchBrowse } from "@/lib/ecomviper/walmart/walmart-search-browse-mapper";
import * as imageIntelligence from "@/lib/ecomviper/walmart/walmart-image-intelligence";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_img_roc949",
    marketplace: "walmart",
    sku: "ROC949",
    externalItemId: "wm_roc949",
    title: "OPA Nutrition Magnesium Glycinate Gummies 60 Count",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    attributes: {},
    searchBrowseAttributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    issues: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-12T00:00:00.000Z",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart image-derived Search & Browse autofill", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps deterministic mocked image facts into canonical facts and Search & Browse fields", () => {
    vi.spyOn(imageIntelligence, "extractImageDerivedFactsFromProduct").mockReturnValue({
      facts: {
        form: "Gummies",
        count: "60 gummies",
        servingSize: "1 gummy",
        servingsPerContainer: "60",
        dosageStrength: "Magnesium (as Magnesium Glycinate) 30mg",
        suggestedUse: "Adults take one gummy daily.",
        warnings:
          "Consult your healthcare professional before use if pregnant, nursing, or taking medication.",
        supportAreas: ["sleep quality support", "relaxation support"],
        activeIngredients: [
          "Magnesium (as Magnesium Glycinate) 30mg",
          "L-Theanine 50mg",
        ],
      },
      factsList: [
        { field: "form", value: "Gummies", confidence: "high", source: "front_label_text" },
        { field: "count", value: "60 gummies", confidence: "high", source: "front_label_text" },
        { field: "servingSize", value: "1 gummy", confidence: "high", source: "supplement_facts_text" },
        {
          field: "servingsPerContainer",
          value: "60",
          confidence: "high",
          source: "supplement_facts_text",
        },
        {
          field: "dosageStrength",
          value: "Magnesium (as Magnesium Glycinate) 30mg",
          confidence: "high",
          source: "supplement_facts_text",
        },
        {
          field: "suggestedUse",
          value: "Adults take one gummy daily.",
          confidence: "high",
          source: "front_label_text",
        },
        {
          field: "warnings",
          value:
            "Consult your healthcare professional before use if pregnant, nursing, or taking medication.",
          confidence: "high",
          source: "front_label_text",
        },
        {
          field: "supportArea",
          value: "sleep quality support",
          confidence: "medium",
          source: "ocr_text",
        },
        {
          field: "supportArea",
          value: "relaxation support",
          confidence: "medium",
          source: "ocr_text",
        },
        {
          field: "activeIngredient",
          value: "Magnesium (as Magnesium Glycinate) 30mg",
          confidence: "high",
          source: "supplement_facts_text",
        },
        {
          field: "activeIngredient",
          value: "L-Theanine 50mg",
          confidence: "high",
          source: "supplement_facts_text",
        },
        {
          field: "activeIngredient",
          value: "Unknown filler ingredient",
          confidence: "low",
          source: "image_metadata",
        },
      ],
      usedSources: ["front_label_text", "supplement_facts_text", "ocr_text"],
    });

    const product = createProduct();
    const factsResult = extractCanonicalProductFacts({ product });

    expect(factsResult.usedSources).toContain("image_text");
    expect(factsResult.imageFactsStatus).toBe("extracted");
    expect(factsResult.imageFactsMessage).toContain("Image-derived label facts were extracted.");
    expect(factsResult.facts.form).toBe("Gummies");
    expect(factsResult.facts.dosageStrength).toContain("Magnesium");
    expect(factsResult.facts.suggestedUse.toLowerCase()).toContain("gummy daily");
    expect(factsResult.facts.warnings.toLowerCase()).toContain("consult your healthcare");
    expect(factsResult.facts.activeIngredients.join(" ")).toContain("L-Theanine");
    expect(factsResult.facts.activeIngredients.join(" ")).not.toContain("Unknown filler ingredient");

    const copy = buildAgenticReferralCopy({ facts: factsResult.facts, product });
    const mapped = mapCanonicalFactsToSearchBrowse({
      facts: factsResult.facts,
      copy,
      existingSearchBrowse: {
        manufacturer: "OPA Nutrition",
      },
      aiCandidates: {
        sku: "DO_NOT_OVERWRITE",
        price: "0.99",
        support_areas: "unknown",
        search_terms: "needs product label confirmation",
      },
      usedSources: factsResult.usedSources,
      staleFieldReplacements: factsResult.staleFieldReplacements,
    });

    expect(mapped.mappedAttributes.supplement_type).toBeTruthy();
    expect(mapped.mappedAttributes.product_type).toBeTruthy();
    expect(mapped.mappedAttributes.product_form).toBe("Gummy");
    expect(mapped.mappedAttributes.form).toBe("Gummy");
    expect(mapped.mappedAttributes.main_ingredients.toLowerCase()).toContain("magnesium");
    expect(mapped.mappedAttributes.serving_size).toBe("1 gummy");
    expect(mapped.mappedAttributes.servings_per_container).toBe("60");
    expect(mapped.mappedAttributes.dosage_strength.toLowerCase()).toContain("magnesium");
    expect(mapped.mappedAttributes.suggested_use.toLowerCase()).toContain("gummy daily");
    expect(mapped.mappedAttributes.safety_warnings.toLowerCase()).toContain("consult your healthcare");
    expect(mapped.mappedAttributes.search_keywords.toLowerCase()).toContain("magnesium");
    expect(mapped.mappedAttributes.support_areas.toLowerCase()).toContain("support");

    expect(mapped.skippedProtectedFields).toEqual(expect.arrayContaining(["sku", "price"]));
    expect(mapped.skippedLowConfidenceFields).toEqual(
      expect.arrayContaining(["support_areas", "search_terms"])
    );
    expect(mapped.mappedAttributes).not.toHaveProperty("sku");
    expect(mapped.mappedAttributes).not.toHaveProperty("price");
  });

  it("reports needs_vision_extraction when image URLs exist but no image text was extracted", () => {
    vi.spyOn(imageIntelligence, "extractImageDerivedFactsFromProduct").mockReturnValue({
      facts: {},
      factsList: [],
      usedSources: [],
    });

    const product = createProduct({
      imageUrl: "https://cdn.example.com/product-primary.jpg",
      galleryImageUrls: ["https://cdn.example.com/product-secondary.jpg"],
    });

    const factsResult = extractCanonicalProductFacts({ product });

    expect(factsResult.imageFactsStatus).toBe("needs_vision_extraction");
    expect(factsResult.imageFactsMessage).toBe(
      "Images are available, but label text extraction has not run yet."
    );
  });

  it("reports low_confidence when only low-confidence image facts are present", () => {
    vi.spyOn(imageIntelligence, "extractImageDerivedFactsFromProduct").mockReturnValue({
      facts: {
        activeIngredients: ["Unknown ingredient"],
      },
      factsList: [
        {
          field: "activeIngredient",
          value: "Unknown ingredient",
          confidence: "low",
          source: "image_metadata",
        },
      ],
      usedSources: ["image_metadata"],
    });

    const product = createProduct({
      imageUrl: "https://cdn.example.com/product-primary.jpg",
    });

    const factsResult = extractCanonicalProductFacts({ product });

    expect(factsResult.imageFactsStatus).toBe("low_confidence");
    expect(factsResult.imageFactsMessage).toContain("low confidence");
    expect(factsResult.facts.activeIngredients).toEqual([]);
  });
});
