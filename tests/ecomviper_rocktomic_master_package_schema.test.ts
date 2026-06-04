import { describe, it, expect } from "vitest";
import { validateProductRecord, validateMasterPackage, type RocktomicProductRecord, type RocktomicMasterPackage } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

function makeProduct(overrides: Partial<RocktomicProductRecord> = {}): RocktomicProductRecord {
  return {
    sku: "ROC010",
    productName: "Pump Pre-Workout",
    category: "Supplement",
    membershipAccess: "all",
    labelSize: "4x6",
    containerSize: "312g",
    productWeight: "350g",
    pricing: {
      msrp: 29.99,
      wholesaleCost: 23.97,
      estimatedProfit: 6.02,
      estimatedMarginPct: 20.08,
      currency: "USD",
      tiers: { t1: 23.97, t4: 21.97 },
    },
    inventory: {
      status: "in_stock",
      rawInventoryValue: "500",
      replenishmentEta: null,
      replenishmentComments: null,
    },
    coaUrl: "https://dropbox.com/roc010-coa.pdf",
    labelTemplateUrl: "https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.ai",
    mockupUrl: "https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.tif",
    catalogPage: 12,
    policyDocxParsed: false,
    policyDocxUrl: "https://rocktomicplatform.blob.core.windows.net/client-resources/Order-Refund-Policy-Template.docx",
    policyNormalizedSummary: null,
    supplementFacts: {
      status: "structured",
      servingSize: "1 scoop (10g)",
      servingsPerContainer: 30,
      nutrientFacts: [{ name: "Sodium", amount: 50, unit: "mg", dailyValue: "2%", rawText: "Sodium 50mg 2%" }],
      activeIngredients: [{ name: "L-Citrulline", amount: 4000, unit: "mg", rawText: "L-Citrulline 4000mg" }],
      otherIngredients: ["Citric Acid"],
    },
    productFeatures: [],
    certifications: [],
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
    warnings: [],
    provenance: {
      productName: { source: "plds_catalog_csv", row: 5 },
      "pricing.msrp": { source: "msrp_report_csv", row: 5 },
    },
    ...overrides,
  };
}

function makePackage(products: RocktomicProductRecord[]): RocktomicMasterPackage {
  return {
    packageVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    sourceBundleId: "test-bundle",
    sourceHashes: {},
    productCount: products.length,
    countsByCategory: {},
    countsByInventoryStatus: {},
    countsBySupplementFactsStatus: {},
    countsByMissingDataType: {},
    sourceIdentityReport: { overallValid: true, duplicateUrlCount: 0, duplicateSheetIdCount: 0, mislabelCount: 0 },
    products,
  };
}

describe("validateProductRecord", () => {
  it("passes for a fully valid product record", () => {
    const result = validateProductRecord(makeProduct());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns when productName is missing", () => {
    const result = validateProductRecord(makeProduct({ productName: null }));
    expect(result.warnings).toContain("missing_productName");
  });

  it("warns when category is missing", () => {
    const result = validateProductRecord(makeProduct({ category: null }));
    expect(result.warnings).toContain("missing_category");
  });

  it("warns when membershipAccess is unknown", () => {
    const result = validateProductRecord(makeProduct({ membershipAccess: "unknown" }));
    expect(result.warnings).toContain("unknown_membershipAccess");
  });

  it("warns when all pricing fields are null", () => {
    const result = validateProductRecord(makeProduct({
      pricing: { msrp: null, wholesaleCost: null, estimatedProfit: null, estimatedMarginPct: null, currency: "USD", tiers: {} },
    }));
    expect(result.warnings).toContain("missing_all_pricing");
  });

  it("warns when inventory status is unknown", () => {
    const result = validateProductRecord(makeProduct({
      inventory: { status: "unknown", rawInventoryValue: null, replenishmentEta: null, replenishmentComments: null },
    }));
    expect(result.warnings).toContain("inventory_status_unknown");
  });

  it("errors on invalid SKU format", () => {
    const result = validateProductRecord(makeProduct({ sku: "INVALID-SKU" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("invalid_sku"))).toBe(true);
  });

  it("errors on invalid coaUrl", () => {
    const result = validateProductRecord(makeProduct({ coaUrl: "not-a-url" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("invalid_coaUrl"))).toBe(true);
  });

  it("errors when structured supplement facts status lacks serving size", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "structured",
        servingSize: null,
        servingsPerContainer: 30,
        nutrientFacts: [{ name: "Sodium", amount: 50, unit: "mg", dailyValue: null, rawText: "Sodium 50mg" }],
        activeIngredients: [],
        otherIngredients: [],
      },
    });
    const result = validateProductRecord(product);
    expect(result.errors).toContain("structured_supplement_facts_missing_servingSize");
  });

  it("warns when provenance is empty", () => {
    const result = validateProductRecord(makeProduct({ provenance: {} }));
    expect(result.warnings).toContain("missing_provenance");
  });
});

describe("validateMasterPackage", () => {
  it("returns pass status when all products are valid", () => {
    const report = validateMasterPackage(makePackage([makeProduct()]));
    expect(report.packageStatus).toBe("pass");
    expect(report.validProductCount).toBe(1);
    expect(report.invalidProductCount).toBe(0);
  });

  it("returns pass_with_warnings when warnings exist", () => {
    const report = validateMasterPackage(makePackage([makeProduct({ productName: null, category: null })]));
    expect(report.packageStatus).toBe("pass_with_warnings");
    expect(report.warningProductCount).toBe(1);
  });

  it("returns fail when invalid products exist", () => {
    const report = validateMasterPackage(makePackage([makeProduct({ sku: "INVALID" })]));
    expect(report.packageStatus).toBe("fail");
    expect(report.invalidProductCount).toBe(1);
  });

  it("counts supplement facts statuses correctly", () => {
    const products = [
      makeProduct({ supplementFacts: { status: "structured", servingSize: "1 scoop", servingsPerContainer: 30, nutrientFacts: [{ name: "A", amount: 1, unit: "mg", dailyValue: null, rawText: "A 1mg" }], activeIngredients: [], otherIngredients: [] } }),
      makeProduct({ sku: "ROC020", supplementFacts: { status: "missing", servingSize: null, servingsPerContainer: null, nutrientFacts: [], activeIngredients: [], otherIngredients: [] } }),
      makeProduct({ sku: "ROC030", supplementFacts: { status: "not_applicable", servingSize: null, servingsPerContainer: null, nutrientFacts: [], activeIngredients: [], otherIngredients: [] } }),
    ];
    const report = validateMasterPackage(makePackage(products));
    expect(report.supplementFactsCounts.structured).toBe(1);
    expect(report.supplementFactsCounts.missing).toBe(1);
    expect(report.supplementFactsCounts.not_applicable).toBe(1);
  });

  it("counts missing data types across all products", () => {
    const products = [
      makeProduct({ coaUrl: null, missingData: { productName: false, category: false, pricing: false, msrp: false, inventory: false, coaUrl: true, labelTemplateUrl: false, mockupUrl: false, supplementFacts: false, provenance: false } }),
      makeProduct({ sku: "ROC020", coaUrl: null, missingData: { productName: false, category: false, pricing: false, msrp: false, inventory: false, coaUrl: true, labelTemplateUrl: false, mockupUrl: false, supplementFacts: false, provenance: false } }),
    ];
    const report = validateMasterPackage(makePackage(products));
    expect(report.missingDataCounts.coaUrl).toBe(2);
  });
});
