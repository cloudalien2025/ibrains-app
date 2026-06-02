import { describe, it, expect } from "vitest";
import { getRocktomicProduct, resolvePrice, getMissingDataSummary } from "@/lib/ecomviper/suppliers/rocktomic/master-package-reader";
import type { RocktomicMasterPackage, RocktomicProductRecord } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

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
    inventory: { status: "in_stock", rawInventoryValue: "500", replenishmentEta: null, replenishmentComments: null },
    coaUrl: "https://dropbox.com/roc010-coa.pdf",
    labelTemplateUrl: "https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.ai",
    mockupUrl: "https://rocktomicplatform.blob.core.windows.net/roc010/ROC010.tif",
    catalogPage: 12,
    policyDocxParsed: false,
    policyDocxUrl: null,
    policyNormalizedSummary: null,
    supplementFacts: { status: "structured", servingSize: "1 scoop", servingsPerContainer: 30, nutrientFacts: [], activeIngredients: [], otherIngredients: [] },
    productFeatures: [],
    certifications: [],
    missingData: { productName: false, category: false, pricing: false, msrp: false, inventory: false, coaUrl: false, labelTemplateUrl: false, mockupUrl: false, supplementFacts: false, provenance: false },
    warnings: [],
    provenance: { productName: { source: "plds_catalog_csv", row: 5 } },
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

describe("getRocktomicProduct", () => {
  it("returns the product for a matching SKU", () => {
    const pkg = makePackage([makeProduct()]);
    const product = getRocktomicProduct(pkg, "ROC010");
    expect(product).not.toBeNull();
    expect(product?.productName).toBe("Pump Pre-Workout");
  });

  it("returns null for a non-existent SKU", () => {
    const pkg = makePackage([makeProduct()]);
    expect(getRocktomicProduct(pkg, "ROC999")).toBeNull();
  });

  it("normalizes SKU lookup case-insensitively", () => {
    const pkg = makePackage([makeProduct()]);
    expect(getRocktomicProduct(pkg, "roc010")).not.toBeNull();
  });

  it("handles SKU with hyphens or spaces gracefully", () => {
    const pkg = makePackage([makeProduct()]);
    expect(getRocktomicProduct(pkg, "ROC-010")).not.toBeNull();
  });
});

describe("resolvePrice", () => {
  it("resolves price from specified tier", () => {
    const pkg = makePackage([makeProduct()]);
    const result = resolvePrice(pkg, "ROC010", "t4");
    expect(result.price).toBe(21.97);
    expect(result.resolvedFrom).toBe("tier");
    expect(result.tier).toBe("t4");
  });

  it("falls back to first available tier when specified tier is null", () => {
    const pkg = makePackage([makeProduct({
      pricing: { msrp: 29.99, wholesaleCost: 23.97, estimatedProfit: null, estimatedMarginPct: null, currency: "USD", tiers: { t1: 23.97 } },
    })]);
    const result = resolvePrice(pkg, "ROC010", "t5");
    expect(result.price).toBe(23.97);
    expect(result.resolvedFrom).toBe("tier");
  });

  it("falls back to wholesaleCost when no tiers are available", () => {
    const pkg = makePackage([makeProduct({
      pricing: { msrp: 29.99, wholesaleCost: 23.97, estimatedProfit: null, estimatedMarginPct: null, currency: "USD", tiers: {} },
    })]);
    const result = resolvePrice(pkg, "ROC010");
    expect(result.price).toBe(23.97);
    expect(result.resolvedFrom).toBe("wholesaleCost");
  });

  it("falls back to MSRP when no tiers or wholesale cost are available", () => {
    const pkg = makePackage([makeProduct({
      pricing: { msrp: 29.99, wholesaleCost: null, estimatedProfit: null, estimatedMarginPct: null, currency: "USD", tiers: {} },
    })]);
    const result = resolvePrice(pkg, "ROC010");
    expect(result.price).toBe(29.99);
    expect(result.resolvedFrom).toBe("msrp");
  });

  it("returns null price when no pricing is available at all", () => {
    const pkg = makePackage([makeProduct({
      pricing: { msrp: null, wholesaleCost: null, estimatedProfit: null, estimatedMarginPct: null, currency: "USD", tiers: {} },
    })]);
    const result = resolvePrice(pkg, "ROC010");
    expect(result.price).toBeNull();
    expect(result.resolvedFrom).toBe("none");
  });

  it("returns null price for non-existent SKU", () => {
    const pkg = makePackage([makeProduct()]);
    const result = resolvePrice(pkg, "ROC999");
    expect(result.price).toBeNull();
    expect(result.resolvedFrom).toBe("none");
  });

  it("includes currency in resolution result", () => {
    const pkg = makePackage([makeProduct()]);
    const result = resolvePrice(pkg, "ROC010", "t1");
    expect(result.currency).toBe("USD");
  });
});

describe("getMissingDataSummary", () => {
  it("counts missing fields across all products", () => {
    const products = [
      makeProduct({ coaUrl: null, missingData: { productName: false, category: false, pricing: false, msrp: false, inventory: false, coaUrl: true, labelTemplateUrl: false, mockupUrl: false, supplementFacts: false, provenance: false } }),
      makeProduct({ sku: "ROC020", productName: null, coaUrl: null, missingData: { productName: true, category: false, pricing: false, msrp: false, inventory: false, coaUrl: true, labelTemplateUrl: false, mockupUrl: false, supplementFacts: true, provenance: false } }),
    ];
    const pkg = makePackage(products);
    const summary = getMissingDataSummary(pkg);
    expect(summary.totalProducts).toBe(2);
    expect(summary.missingCoaUrl).toBe(2);
    expect(summary.missingProductName).toBe(1);
    expect(summary.missingSupplementFacts).toBe(1);
  });

  it("returns zero counts when nothing is missing", () => {
    const pkg = makePackage([makeProduct()]);
    const summary = getMissingDataSummary(pkg);
    expect(summary.missingProductName).toBe(0);
    expect(summary.missingPricing).toBe(0);
  });

  it("handles empty product list", () => {
    const pkg = makePackage([]);
    const summary = getMissingDataSummary(pkg);
    expect(summary.totalProducts).toBe(0);
    expect(summary.missingProductName).toBe(0);
  });
});
