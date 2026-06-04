import { describe, it, expect } from "vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  supplementFactsStatusToMerchantText,
  mapPackageProductToHydratedFacts,
} from "@/lib/ecomviper/suppliers/rocktomic/rocktomic-package-source-facts";
import type { RocktomicProductRecord } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

function makeProduct(overrides: Partial<RocktomicProductRecord> = {}): RocktomicProductRecord {
  return {
    sku: "ROC200",
    productName: "Collagen Peptides",
    category: "Supplement",
    membershipAccess: "all",
    labelSize: "3x5",
    containerSize: "300g",
    productWeight: "320g",
    pricing: { msrp: 44.99, wholesaleCost: 22.0, estimatedProfit: null, estimatedMarginPct: null, currency: "USD", tiers: { t1: 22.0 } },
    inventory: { status: "in_stock", rawInventoryValue: "100", replenishmentEta: null, replenishmentComments: null },
    coaUrl: null,
    labelTemplateUrl: "https://rocktomicplatform.blob.core.windows.net/roc200/ROC200.ai",
    mockupUrl: null,
    catalogPage: 7,
    policyDocxParsed: false,
    policyDocxUrl: null,
    policyNormalizedSummary: null,
    supplementFacts: {
      status: "structured",
      servingSize: "1 scoop (10g)",
      servingsPerContainer: 30,
      nutrientFacts: [{ name: "Protein", amount: 9, unit: "g", dailyValue: "18%", rawText: "Protein 9g" }],
      activeIngredients: [{ name: "Collagen Peptides", amount: 10000, unit: "mg", rawText: "Collagen Peptides 10000mg" }],
      otherIngredients: ["Citric Acid"],
    },
    productFeatures: [],
    certifications: [],
    missingData: { productName: false, category: false, pricing: false, msrp: false, inventory: false, coaUrl: true, labelTemplateUrl: false, mockupUrl: true, supplementFacts: false, provenance: false },
    warnings: [],
    provenance: { productName: { source: "plds_catalog_csv", row: 8 } },
    ...overrides,
  };
}

describe("Package → Product Editor binding: supplement facts status", () => {
  it("structured package facts produce extracted status with serving size", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplementFactsStatus).toBe("structured");
    expect(facts.servingSize).toBe("1 scoop (10g)");
    expect(facts.activeIngredients.length).toBeGreaterThan(0);
  });

  it("partial package facts produce partial status without OCR language", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "partial",
        servingSize: "1 capsule",
        servingsPerContainer: 60,
        nutrientFacts: [],
        activeIngredients: [{ name: "Ashwagandha", amount: null, unit: null, rawText: "Ashwagandha" }],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplementFactsStatus).toBe("partial");
    expect(facts.supplementFactsMerchantText).not.toContain("OCR");
    expect(facts.supplementFactsMerchantText).toContain("review before publishing");
  });

  it("visual_only package facts produce panel-available merchant text without OCR language", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "visual_only",
        servingSize: null,
        servingsPerContainer: null,
        nutrientFacts: [],
        activeIngredients: [],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplementFactsStatus).toBe("visual_only");
    const text = supplementFactsStatusToMerchantText("visual_only");
    expect(text).toContain("Supplement Facts panel is available");
    expect(text).not.toContain("OCR");
    expect(text).not.toContain("ocr_required");
  });

  it("missing package facts produce not-available merchant text without OCR/debug language", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "missing",
        servingSize: null,
        servingsPerContainer: null,
        nutrientFacts: [],
        activeIngredients: [],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplementFactsStatus).toBe("missing");
    const text = supplementFactsStatusToMerchantText("missing");
    expect(text).not.toContain("OCR");
    expect(text).not.toContain("ocr_required");
    expect(text).not.toContain("extraction_failed");
    expect(text).not.toContain("Amount Per Serving require");
  });

  it("not_applicable package facts produce not-applicable text", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "not_applicable",
        servingSize: null,
        servingsPerContainer: null,
        nutrientFacts: [],
        activeIngredients: [],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplementFactsStatus).toBe("not_applicable");
    expect(supplementFactsStatusToMerchantText("not_applicable")).toContain("not applicable");
  });
});

describe("Package → Product Editor binding: ingredient field mapping", () => {
  it("active ingredients from package beat empty panel/supplier values", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.activeIngredients).toContain("Collagen Peptides");
    expect(facts.activeIngredients).toContain("Protein");
  });

  it("ingredient amounts are mapped with units", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    const hasCollagenAmount = facts.ingredientAmounts.some(
      (entry) => entry.includes("Collagen") && entry.includes("10000")
    );
    expect(hasCollagenAmount).toBe(true);
  });

  it("other ingredients are passed through", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.otherIngredients).toContain("Citric Acid");
  });

  it("returns empty arrays for visual_only product (no inventing facts)", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "visual_only",
        servingSize: null,
        servingsPerContainer: null,
        nutrientFacts: [],
        activeIngredients: [],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.activeIngredients).toHaveLength(0);
    expect(facts.ingredientAmounts).toHaveLength(0);
  });

  it("returns empty arrays for missing product (no inventing facts)", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "missing",
        servingSize: null,
        servingsPerContainer: null,
        nutrientFacts: [],
        activeIngredients: [],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.activeIngredients).toHaveLength(0);
    expect(facts.otherIngredients).toHaveLength(0);
  });
});

describe("Package → Product Editor binding: assets", () => {
  it("maps COA URL from package product", () => {
    const product = makeProduct({ coaUrl: "https://example.com/coa.pdf" });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.coaUrl).toBe("https://example.com/coa.pdf");
  });

  it("returns null COA when missing from package", () => {
    const product = makeProduct({ coaUrl: null });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.coaUrl).toBeNull();
  });

  it("detects label template presence from package", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.labelTemplateAiPresent).toBe(true);
  });

  it("detects absent mockup as false", () => {
    const product = makeProduct({ mockupUrl: null });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.mockupTemplateTifPresent).toBe(false);
  });
});

describe("No auto-save / no auto-publish boundary", () => {
  it("mapPackageProductToHydratedFacts does not trigger any save or publish side effects", () => {
    const product = makeProduct();
    expect(() => mapPackageProductToHydratedFacts(product)).not.toThrow();
  });

  it("supplementFactsStatusToMerchantText is pure and synchronous with no side effects", () => {
    expect(() => {
      supplementFactsStatusToMerchantText("structured");
      supplementFactsStatusToMerchantText("partial");
      supplementFactsStatusToMerchantText("visual_only");
      supplementFactsStatusToMerchantText("missing");
      supplementFactsStatusToMerchantText("not_applicable");
    }).not.toThrow();
  });
});
