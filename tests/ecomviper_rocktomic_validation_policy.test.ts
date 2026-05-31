import { describe, expect, it } from "vitest";
import type { AssetsRecord, InventoryRecord, PricingRecord, SourceFactRecord } from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";
import { evaluateRocktomicPackageValidation } from "@/lib/ecomviper/suppliers/rocktomic-validation-policy";

function packageForSku(input: {
  sku: string;
  sourceFacts?: SourceFactRecord;
  pricing?: PricingRecord;
  inventory?: InventoryRecord;
  assets?: AssetsRecord;
  sourceErrors?: Array<{ sourceId: string; error: string }>;
}) {
  return evaluateRocktomicPackageValidation({
    generatedAt: "2026-05-31T00:00:00.000Z",
    packageVersion: 2,
    sourceFactsBySku: input.sourceFacts ? { [input.sku]: input.sourceFacts } : {},
    pricingBySku: input.pricing ? { [input.sku]: input.pricing } : {},
    inventoryBySku: input.inventory ? { [input.sku]: input.inventory } : {},
    assetsBySku: input.assets ? { [input.sku]: input.assets } : {},
    sourceErrors: input.sourceErrors || [],
  });
}

describe("rocktomic phase2 validation policy", () => {
  it("marks supplement SKU blocked when blocking defects exist", () => {
    const sku = "ROC900";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Electrolyte Formula 300g",
        category: "supplements",
        supplementFactsText: "Active Ingredients: Sodium 200mg",
        sourceReferences: ["catalog_pdf"],
        missingFields: [],
      },
      pricing: {
        sku,
        productName: "Electrolyte Formula 300g",
        wholesaleCost: 12,
        msrp: 35,
        estimatedProfit: 23,
        membershipTierCosts: { retail: 12 },
        sourceReferences: ["plds_catalog"],
        missingFields: [],
      },
      inventory: {
        sku,
        rawInventoryValue: "In Stock",
        inventoryStatus: "in_stock",
        sourceReferences: ["inventory_report"],
        missingFields: [],
      },
      assets: {
        sku,
        coaUrl: null,
        labelTemplateUrl: "https://example.com/label.pdf",
        mockupUrl: "https://example.com/mockup.png",
        sourceReferences: ["catalog_pdf", "label_mockup_templates"],
        missingFields: ["coaUrl"],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("blocked");
    expect(skuResult.blockingDefects.some((defect) => defect.field === "assets.coaUrl")).toBe(true);
    expect(result.packageStatus).toBe("fail");
  });

  it("marks warning-only SKU as usable_with_warnings", () => {
    const sku = "ROCAPP1";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Performance Hoodie XL",
        category: "apparel",
        supplementFactsText: null,
        sourceReferences: ["catalog_pdf"],
        missingFields: [],
      },
      pricing: {
        sku,
        productName: "Performance Hoodie XL",
        wholesaleCost: 18,
        msrp: 49,
        estimatedProfit: 31,
        membershipTierCosts: { retail: 18 },
        sourceReferences: ["plds_catalog"],
        missingFields: [],
      },
      inventory: {
        sku,
        rawInventoryValue: "In Stock",
        inventoryStatus: "in_stock",
        sourceReferences: ["inventory_report"],
        missingFields: [],
      },
      assets: {
        sku,
        coaUrl: null,
        labelTemplateUrl: "https://example.com/hoodie-label.pdf",
        mockupUrl: null,
        sourceReferences: ["label_mockup_templates"],
        missingFields: ["mockupUrl"],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("usable_with_warnings");
    expect(skuResult.blockingDefects).toHaveLength(0);
    expect(skuResult.warningDefects.length).toBeGreaterThan(0);
    expect(skuResult.warningDefects.some((defect) => defect.field === "assets.mockupUrl")).toBe(true);
    expect(result.packageStatus).toBe("pass_with_warnings");
  });

  it("marks fully clean supplement SKU as usable", () => {
    const sku = "ROC901";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Hydration Complex 300g",
        category: "supplements",
        supplementFactsText:
          "Supplement Facts Serving Size 1 Scoop Servings Per Container 30 Active Ingredients Sodium 200mg Other Ingredients Citric Acid",
        sourceReferences: ["catalog_pdf"],
        missingFields: [],
      },
      pricing: {
        sku,
        productName: "Hydration Complex 300g",
        wholesaleCost: 10,
        msrp: 29,
        estimatedProfit: 19,
        membershipTierCosts: { retail: 10 },
        sourceReferences: ["plds_catalog"],
        missingFields: [],
      },
      inventory: {
        sku,
        rawInventoryValue: "In Stock",
        inventoryStatus: "in_stock",
        sourceReferences: ["inventory_report"],
        missingFields: [],
      },
      assets: {
        sku,
        coaUrl: "https://example.com/coa.pdf",
        labelTemplateUrl: "https://example.com/label.pdf",
        mockupUrl: "https://example.com/mockup.png",
        sourceReferences: ["catalog_pdf", "label_mockup_templates"],
        missingFields: [],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("usable");
    expect(skuResult.blockingDefects).toHaveLength(0);
    expect(skuResult.warningDefects).toHaveLength(0);
    expect(result.packageStatus).toBe("pass");
  });

  it("does not apply supplement-specific blocking fields to apparel SKUs", () => {
    const sku = "ROCAPP2";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Training Tee",
        category: "apparel",
        supplementFactsText: null,
        sourceReferences: ["catalog_pdf"],
        missingFields: [],
      },
      pricing: {
        sku,
        productName: "Training Tee",
        wholesaleCost: 8,
        msrp: 24,
        estimatedProfit: 16,
        membershipTierCosts: { retail: 8 },
        sourceReferences: ["plds_catalog"],
        missingFields: [],
      },
      inventory: {
        sku,
        rawInventoryValue: "In Stock",
        inventoryStatus: "in_stock",
        sourceReferences: ["inventory_report"],
        missingFields: [],
      },
      assets: {
        sku,
        coaUrl: null,
        labelTemplateUrl: "https://example.com/tee-label.pdf",
        mockupUrl: "https://example.com/tee-mockup.png",
        sourceReferences: ["label_mockup_templates"],
        missingFields: [],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.blockingDefects.some((defect) => defect.field.startsWith("supplementFacts."))).toBe(false);
    expect(skuResult.notApplicableFields).toContain("supplementFacts.servingSize");
  });

  it("sets extraction_error for extraction failures and package fail status", () => {
    const result = evaluateRocktomicPackageValidation({
      generatedAt: "2026-05-31T00:00:00.000Z",
      packageVersion: 2,
      sourceFactsBySku: { ROCERR: undefined as unknown as SourceFactRecord },
      pricingBySku: {},
      inventoryBySku: {},
      assetsBySku: {},
      sourceErrors: [{ sourceId: "catalog_pdf", error: "parse failure" }],
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("extraction_error");
    expect(result.packageStatus).toBe("fail");
    expect(result.extractionErrorSkuCount).toBe(1);
  });
});
