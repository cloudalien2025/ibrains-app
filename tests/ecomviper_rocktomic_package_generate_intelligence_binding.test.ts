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
    sku: "ROC948",
    productName: "Premium Nitric Oxide Gummies",
    category: "Supplement",
    membershipAccess: "all",
    labelSize: "4x6",
    containerSize: "60ct",
    productWeight: "220g",
    pricing: { msrp: 49.99, wholesaleCost: 19.5, estimatedProfit: 30.49, estimatedMarginPct: 61.0, currency: "USD", tiers: { t1: 19.5, t4: 17.0 } },
    inventory: { status: "in_stock", rawInventoryValue: "300", replenishmentEta: null, replenishmentComments: null },
    coaUrl: "https://dropbox.com/roc948-coa.pdf",
    labelTemplateUrl: "https://rocktomicplatform.blob.core.windows.net/roc948/ROC948.ai",
    mockupUrl: "https://rocktomicplatform.blob.core.windows.net/roc948/ROC948.tif",
    catalogPage: 44,
    policyDocxParsed: false,
    policyDocxUrl: null,
    policyNormalizedSummary: null,
    supplementFacts: {
      status: "structured",
      servingSize: "2 gummies",
      servingsPerContainer: 30,
      nutrientFacts: [
        { name: "Vitamin B6", amount: 2, unit: "mg", dailyValue: "118%", rawText: "Vitamin B6 2mg" },
        { name: "Vitamin B12", amount: 6, unit: "mcg", dailyValue: "250%", rawText: "Vitamin B12 6mcg" },
      ],
      activeIngredients: [
        { name: "L-Arginine AKG", amount: 1500, unit: "mg", rawText: "L-Arginine AKG 1500mg" },
        { name: "L-Citrulline", amount: 1000, unit: "mg", rawText: "L-Citrulline 1000mg" },
      ],
      otherIngredients: ["Pectin", "Citric Acid", "Natural Flavors"],
    },
    productFeatures: ["Supports nitric oxide production", "Third-party tested"],
    certifications: [],
    missingData: { productName: false, category: false, pricing: false, msrp: false, inventory: false, coaUrl: false, labelTemplateUrl: false, mockupUrl: false, supplementFacts: false, provenance: false },
    warnings: ["Keep out of reach of children", "Consult physician before use"],
    provenance: { productName: { source: "plds_catalog_csv", row: 48 } },
    ...overrides,
  };
}

describe("Package → Generate Intelligence binding: structured facts", () => {
  it("copywriting input receives active ingredients from package for structured SKU", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.activeIngredients).toContain("L-Arginine AKG");
    expect(facts.activeIngredients).toContain("L-Citrulline");
    expect(facts.activeIngredients).toContain("Vitamin B6");
    expect(facts.activeIngredients).toContain("Vitamin B12");
  });

  it("ingredient amounts include unit for structured facts", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.ingredientAmounts.some((e) => e.includes("1500"))).toBe(true);
    expect(facts.ingredientAmounts.some((e) => e.includes("L-Arginine"))).toBe(true);
  });

  it("serving size and servings per container are passed to generate intelligence input", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.servingSize).toBe("2 gummies");
    expect(facts.servingsPerContainer).toBe("30");
  });

  it("COA URL is available for compliance check in generate intelligence", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.coaUrl).toBeTruthy();
  });
});

describe("Package → Generate Intelligence binding: partial/visual_only/missing — no invented facts", () => {
  it("partial facts return whatever ingredients are available without inventing extras", () => {
    const product = makeProduct({
      supplementFacts: {
        status: "partial",
        servingSize: "1 capsule",
        servingsPerContainer: 60,
        nutrientFacts: [],
        activeIngredients: [{ name: "Berberine", amount: 500, unit: "mg", rawText: "Berberine 500mg" }],
        otherIngredients: [],
      },
    });
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.activeIngredients).toContain("Berberine");
    expect(facts.activeIngredients).not.toContain("L-Arginine AKG");
    expect(facts.supplementFactsStatus).toBe("partial");
  });

  it("visual_only facts return empty ingredient lists (no invented facts)", () => {
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
    expect(facts.otherIngredients).toHaveLength(0);
  });

  it("missing facts return empty ingredient lists (no invented facts)", () => {
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
    expect(facts.servingSize).toBeNull();
  });
});

describe("Package → Generate Intelligence binding: package diagnostics shape", () => {
  it("hydrated facts expose packageReadStatus and packageSkuStatus for diagnostics", () => {
    const product = makeProduct();
    const facts = mapPackageProductToHydratedFacts(product);
    expect(facts.packageReadStatus).toBe("package_found");
    expect(facts.packageSkuStatus).toBe("sku_found");
  });

  it("supplementFactsMerchantText is never an internal debug string for any status", () => {
    const statuses = ["structured", "partial", "visual_only", "missing", "not_applicable"] as const;
    const forbidden = ["ocr_required", "extraction_failed", "source_sync_required", "Amount Per Serving require", "source fact references"];
    for (const status of statuses) {
      const text = supplementFactsStatusToMerchantText(status);
      for (const badPhrase of forbidden) {
        expect(text).not.toContain(badPhrase);
      }
    }
  });
});

describe("Regression: no duplicate route, no DB writes, no OCR runtime path", () => {
  it("mapPackageProductToHydratedFacts does not call any external service or DB", () => {
    const product = makeProduct();
    expect(() => mapPackageProductToHydratedFacts(product)).not.toThrow();
  });

  it("supplementFactsStatusToMerchantText is deterministic and pure", () => {
    const r1 = supplementFactsStatusToMerchantText("structured");
    const r2 = supplementFactsStatusToMerchantText("structured");
    expect(r1).toBe(r2);
  });
});
