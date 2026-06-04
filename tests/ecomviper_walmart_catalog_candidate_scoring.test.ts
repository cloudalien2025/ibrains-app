import { describe, expect, it } from "vitest";
import {
  scoreWalmartCatalogCandidate,
  type WalmartCatalogCandidateForScoring,
  type WalmartCatalogExpectedMatch,
} from "@/lib/ecomviper/walmart/walmart-catalog-candidate-scoring";

function baseExpected(overrides?: Partial<WalmartCatalogExpectedMatch>): WalmartCatalogExpectedMatch {
  return {
    itemId: "2791205430",
    sku: "ROC303",
    upc: "123456789012",
    gtin: "0123456789012",
    title: "OPA Enzymes Prebiotic Probiotics For Men And Women 60 Ct",
    brand: "OPA Nutrition",
    manufacturer: "OPA Nutrition",
    category: "Supplements",
    packCount: "60 ct",
    sizeHint: "60 ct",
    ...overrides,
  };
}

function baseCandidate(overrides?: Partial<WalmartCatalogCandidateForScoring>): WalmartCatalogCandidateForScoring {
  return {
    source: "walmart_item_api",
    itemId: "2791205430",
    sku: "ROC303",
    upc: "123456789012",
    gtin: "0123456789012",
    title: "OPA Enzymes Prebiotic Probiotics For Men And Women - 60 Ct",
    brand: "OPA Nutrition",
    manufacturer: "OPA Nutrition",
    category: "Supplements",
    shortDescription: "Digestive support short description.",
    longDescription: "Digestive support long description.",
    keyFeatures: ["Digestive Enzymes", "Probiotic Support"],
    price: 24.99,
    primaryImageUrl: "https://images.example.com/roc303-primary.jpg",
    galleryImageUrls: ["https://images.example.com/roc303-primary.jpg"],
    raw: {},
    ...overrides,
  };
}

describe("Walmart catalog candidate scoring", () => {
  it("scores exact ITEM_ID/GTIN/UPC matches as exact confidence", () => {
    const result = scoreWalmartCatalogCandidate({
      candidate: baseCandidate(),
      expected: baseExpected(),
      requiresDirectItemId: true,
    });

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.confidence).toBe("exact");
    expect(result.exactIdentifierMatch).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("supports exact GTIN match when ITEM_ID is absent", () => {
    const result = scoreWalmartCatalogCandidate({
      candidate: baseCandidate({
        itemId: "",
        upc: "",
      }),
      expected: baseExpected({
        itemId: "",
        upc: "",
      }),
      requiresDirectItemId: false,
    });

    expect(result.matchedFields).toContain("gtin");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("supports exact UPC match when GTIN/ITEM_ID are absent", () => {
    const result = scoreWalmartCatalogCandidate({
      candidate: baseCandidate({
        itemId: "",
        gtin: "",
      }),
      expected: baseExpected({
        itemId: "",
        gtin: "",
      }),
      requiresDirectItemId: false,
    });

    expect(result.matchedFields).toContain("upc");
    expect(result.score).toBeGreaterThanOrEqual(65);
  });

  it("produces strong/moderate confidence for strong title+brand matches", () => {
    const result = scoreWalmartCatalogCandidate({
      candidate: baseCandidate({
        itemId: "",
        upc: "",
        gtin: "",
        title: "OPA Enzymes Prebiotic Probiotics For Men And Women Digestive Balance 60 Ct",
      }),
      expected: baseExpected({
        itemId: "",
        upc: "",
        gtin: "",
      }),
      requiresDirectItemId: false,
    });

    expect(["exact", "strong", "moderate"]).toContain(result.confidence);
    expect(result.blockers).toEqual([]);
  });

  it("blocks candidate on clear brand conflict", () => {
    const result = scoreWalmartCatalogCandidate({
      candidate: baseCandidate({
        brand: "Different Brand",
      }),
      expected: baseExpected(),
      requiresDirectItemId: false,
    });

    expect(result.blockers).toContain("clearly different brand");
    expect(result.confidence).toBe("none");
  });

  it("blocks candidate when count/size conflicts with known size", () => {
    const result = scoreWalmartCatalogCandidate({
      candidate: baseCandidate({
        title: "OPA Enzymes Prebiotic Probiotics 120 Ct",
      }),
      expected: baseExpected({
        packCount: "60 ct",
        sizeHint: "60 ct",
      }),
      requiresDirectItemId: false,
    });

    expect(result.blockers).toContain("different count/size vs known product");
    expect(result.confidence).toBe("none");
  });
});
