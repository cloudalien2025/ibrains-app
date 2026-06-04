import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ecomviper/suppliers/rocktomic/master-package-reader", () => ({
  getRocktomicProduct: vi.fn(),
}));

import {
  supplementFactsStatusToMerchantText,
  mapPackageProductToHydratedFacts,
  clearPackageCache,
} from "@/lib/ecomviper/suppliers/rocktomic/rocktomic-package-source-facts";
import type { RocktomicProductRecord } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

function makeProduct(overrides: Partial<RocktomicProductRecord> = {}): RocktomicProductRecord {
  return {
    sku: "ROC100",
    productName: "Nitric Oxide Gummies",
    category: "Supplement",
    membershipAccess: "all",
    labelSize: "4x6",
    containerSize: "60ct",
    productWeight: "200g",
    pricing: {
      msrp: 39.99,
      wholesaleCost: 18.0,
      estimatedProfit: 21.99,
      estimatedMarginPct: 55.0,
      currency: "USD",
      tiers: { t1: 18.0, t4: 16.0 },
    },
    inventory: { status: "in_stock", rawInventoryValue: "200", replenishmentEta: null, replenishmentComments: null },
    coaUrl: "https://dropbox.com/roc100-coa.pdf",
    labelTemplateUrl: "https://rocktomicplatform.blob.core.windows.net/roc100/ROC100.ai",
    mockupUrl: "https://rocktomicplatform.blob.core.windows.net/roc100/ROC100.tif",
    catalogPage: 5,
    policyDocxParsed: false,
    policyDocxUrl: null,
    policyNormalizedSummary: null,
    supplementFacts: {
      status: "structured",
      servingSize: "2 gummies",
      servingsPerContainer: 30,
      nutrientFacts: [{ name: "Vitamin C", amount: 100, unit: "mg", dailyValue: "111%", rawText: "Vitamin C 100mg" }],
      activeIngredients: [{ name: "L-Arginine", amount: 500, unit: "mg", rawText: "L-Arginine 500mg" }],
      otherIngredients: ["Gelatin", "Pectin"],
    },
    productFeatures: ["Third-party tested", "Gluten-free"],
    certifications: ["NSF Certified"],
    missingData: {
      productName: false,
      category: false,
      pricing: false,
      msrp: false,
      inventory: false,
      coaUrl: false,
      labelTemplateUrl: false,
      mockupUrl: false,
      supplementFacts: false,
      provenance: false,
    },
    warnings: ["Keep out of reach of children"],
    provenance: { productName: { source: "plds_catalog_csv", row: 3 } },
    ...overrides,
  };
}

describe("supplementFactsStatusToMerchantText", () => {
  it("returns extraction message for structured", () => {
    expect(supplementFactsStatusToMerchantText("structured")).toContain("extracted");
  });

  it("returns review message for partial", () => {
    const text = supplementFactsStatusToMerchantText("partial");
    expect(text).toContain("review before publishing");
  });

  it("returns panel-available message for visual_only without OCR language", () => {
    const text = supplementFactsStatusToMerchantText("visual_only");
    expect(text).toContain("Supplement Facts panel is available");
    expect(text).not.toContain("OCR");
    expect(text).not.toContain("ocr");
  });

  it("returns not-available message for missing without OCR language", () => {
    const text = supplementFactsStatusToMerchantText("missing");
    expect(text).toContain("not available");
    expect(text).not.toContain("OCR");
    expect(text).not.toContain("ocr");
  });

  it("returns not-applicable message for not_applicable", () => {
    const text = supplementFactsStatusToMerchantText("not_applicable");
    expect(text).toContain("not applicable");
  });
});

describe("mapPackageProductToHydratedFacts", () => {
  beforeEach(() => clearPackageCache());
  afterEach(() => clearPackageCache());

  it("maps structured product to hydrated facts", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplierSku).toBe("ROC100");
    expect(facts.supplierProductName).toBe("Nitric Oxide Gummies");
    expect(facts.supplementFactsStatus).toBe("structured");
    expect(facts.servingSize).toBe("2 gummies");
    expect(facts.servingsPerContainer).toBe("30");
    expect(facts.coaUrl).toBe("https://dropbox.com/roc100-coa.pdf");
    expect(facts.labelTemplateAiPresent).toBe(true);
    expect(facts.mockupTemplateTifPresent).toBe(true);
    expect(facts.packageReadStatus).toBe("package_found");
    expect(facts.packageSkuStatus).toBe("sku_found");
  });

  it("includes active ingredient names from supplement facts", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.activeIngredients).toContain("L-Arginine");
    expect(facts.activeIngredients).toContain("Vitamin C");
  });

  it("includes ingredient amounts with unit", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.ingredientAmounts.some((entry) => entry.includes("L-Arginine"))).toBe(true);
    expect(facts.ingredientAmounts.some((entry) => entry.includes("500"))).toBe(true);
  });

  it("includes other ingredients", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.otherIngredients).toContain("Gelatin");
    expect(facts.otherIngredients).toContain("Pectin");
  });

  it("joins warnings into a single string", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.warnings).toContain("Keep out of reach of children");
  });

  it("returns null warnings when product has no warnings", () => {
    const product = makeProduct({ warnings: [] });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.warnings).toBeNull();
  });

  it("returns null coaUrl when product has no coaUrl", () => {
    const product = makeProduct({ coaUrl: null });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.coaUrl).toBeNull();
  });

  it("returns false for labelTemplateAiPresent when no label URL", () => {
    const product = makeProduct({ labelTemplateUrl: null });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.labelTemplateAiPresent).toBe(false);
  });

  it("returns false for mockupTemplateTifPresent when no mockup URL", () => {
    const product = makeProduct({ mockupUrl: null });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.mockupTemplateTifPresent).toBe(false);
  });

  it("maps partial status correctly", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "partial",
        servingSize: "1 scoop",
        servingsPerContainer: 20,
        nutrientFacts: [],
        activeIngredients: [{ name: "Creatine", amount: null, unit: null, rawText: "Creatine" }],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplementFactsStatus).toBe("partial");
    expect(facts.supplementFactsMerchantText).toContain("review before publishing");
  });

  it("maps visual_only status correctly without OCR language", () => {
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
    expect(facts.supplementFactsMerchantText).not.toContain("OCR");
    expect(facts.activeIngredients).toHaveLength(0);
  });

  it("maps missing status correctly without OCR language", () => {
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
    expect(facts.supplementFactsMerchantText).not.toContain("OCR");
  });

  it("preserves needsReview=false for structured facts", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.supplementFactsStatus).toBe("structured");
  });

  it("sets servingsPerContainer to string from number", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(typeof facts.servingsPerContainer).toBe("string");
    expect(facts.servingsPerContainer).toBe("30");
  });

  it("returns null servingsPerContainer when package value is null", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "partial",
        servingSize: "1 scoop",
        servingsPerContainer: null,
        nutrientFacts: [],
        activeIngredients: [],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.servingsPerContainer).toBeNull();
  });
});
