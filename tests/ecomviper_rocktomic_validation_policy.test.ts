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

describe("rocktomic phase4.3 validation policy calibration", () => {
  it("marks supplement SKU blocked when blocking defects exist", () => {
    const sku = "ROC900";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Electrolyte Formula 300g",
        category: "supplements",
        supplementFactsText: "Active Ingredients: Sodium 200mg",
        supplementFacts: null,
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
        catalogTemplateUrl: null,
        labelTemplateAiUrl: null,
        mockupTemplateTifUrl: null,
        labelTemplateUrl: "https://example.com/label.pdf",
        mockupUrl: "https://example.com/mockup.png",
        assets: [],
        assetReadiness: {
          hasCoa: false,
          hasLabelTemplateAi: false,
          hasMockupTemplateTif: false,
          readyForProductEditor: false,
          readyForOptiPixelAssets: false,
          readyForChannelImageGeneration: false,
        },
        sourceReferences: ["catalog_pdf", "label_mockup_templates"],
        missingFields: ["coaUrl"],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("blocked");
    expect(skuResult.blockingDefects.some((defect) => defect.field === "assets.coaUrl")).toBe(false);
    expect(skuResult.warningDefects.some((defect) => defect.field === "assets.coaUrl")).toBe(true);
    expect(skuResult.readiness.ingredientMatchingReadiness).toBe("ready_with_warnings");
    expect(skuResult.readiness.complianceEvidenceReadiness).toBe("blocked");
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
        supplementFacts: null,
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
        catalogTemplateUrl: null,
        labelTemplateAiUrl: null,
        mockupTemplateTifUrl: null,
        labelTemplateUrl: "https://example.com/hoodie-label.pdf",
        mockupUrl: null,
        assets: [],
        assetReadiness: {
          hasCoa: false,
          hasLabelTemplateAi: false,
          hasMockupTemplateTif: false,
          readyForProductEditor: false,
          readyForOptiPixelAssets: false,
          readyForChannelImageGeneration: false,
        },
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
    expect(skuResult.readiness.ingredientMatchingReadiness).toBe("ready_with_warnings");
    expect(skuResult.readiness.productEditorFactsReadiness).toBe("ready_with_warnings");
    expect(skuResult.readiness.complianceEvidenceReadiness).toBe("blocked");
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
        supplementFacts: {
          servingSize: "1 Scoop",
          servingsPerContainer: "30",
          activeIngredients: ["Sodium 200mg"],
          amountPerServing: ["Sodium 200mg"],
          dailyValuePercentages: [],
          otherIngredients: ["Citric Acid"],
          suggestedUse: null,
          warnings: null,
          storage: null,
        },
        sourceEvidence: {
          supplementFacts: {
            sourceMethod: "ocr",
            sourcePage: 12,
            sourceAsset: "fixture",
            sourceUrl: null,
            sourceFileName: null,
            templatePageLastUpdated: null,
            httpEtag: null,
            httpLastModified: null,
            httpContentLength: null,
            httpContentType: null,
            confidence: "high",
            needsReview: false,
            parseWarnings: [],
          },
        },
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
        catalogTemplateUrl: null,
        labelTemplateAiUrl: "https://example.com/label.ai",
        mockupTemplateTifUrl: "https://example.com/mockup.tif",
        labelTemplateUrl: "https://example.com/label.pdf",
        mockupUrl: "https://example.com/mockup.png",
        assets: [],
        assetReadiness: {
          hasCoa: true,
          hasLabelTemplateAi: true,
          hasMockupTemplateTif: true,
          readyForProductEditor: true,
          readyForOptiPixelAssets: true,
          readyForChannelImageGeneration: true,
        },
        sourceReferences: ["catalog_pdf", "label_mockup_templates"],
        missingFields: [],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("usable");
    expect(skuResult.blockingDefects).toHaveLength(0);
    expect(skuResult.warningDefects).toHaveLength(0);
    expect(result.packageStatus).toBe("pass");
    expect(result.ocrFactsCoverage.presentSkuCount).toBe(1);
    expect(result.aiTextFactsCoverage.presentSkuCount).toBe(0);
    expect(skuResult.readiness.ingredientMatchingReadiness).toBe("ready");
    expect(skuResult.readiness.productEditorFactsReadiness).toBe("ready");
    expect(result.ingredientMatchingReadyCount).toBe(1);
    expect(result.productEditorFactsReadyCount).toBe(1);
  });

  it("prefers ai_pdf_text evidence and marks review-needed AI facts as warnings, not blocking", () => {
    const sku = "ROC902";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Focus Blend 200g",
        category: "supplements",
        supplementFactsText: "Supplement Facts Serving Size 1 Scoop Servings Per Container 20",
        supplementFacts: {
          servingSize: "1 Scoop",
          servingsPerContainer: "20",
          activeIngredients: ["L Theanine 100 mg"],
          amountPerServing: ["L Theanine 100 mg"],
          dailyValuePercentages: [],
          otherIngredients: [],
          suggestedUse: null,
          warnings: null,
          storage: null,
        },
        sourceEvidence: {
          supplementFacts: {
            sourceMethod: "ai_pdf_text",
            sourcePage: null,
            sourceAsset: "ROC902.ai",
            sourceUrl: "https://example.com/ROC902.ai",
            sourceFileName: "ROC902.ai",
            templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
            httpEtag: '"etag"',
            httpLastModified: "Mon, 12 Aug 2024 18:00:53 GMT",
            httpContentLength: 1024,
            httpContentType: "application/pdf",
            confidence: "medium",
            needsReview: true,
            parseWarnings: ["missing_other_ingredients"],
          },
        },
        sourceReferences: ["label_mockup_templates"],
        missingFields: [],
      },
      pricing: {
        sku,
        productName: "Focus Blend 200g",
        wholesaleCost: 10,
        msrp: 25,
        estimatedProfit: 15,
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
        catalogTemplateUrl: null,
        labelTemplateAiUrl: "https://example.com/ROC902.ai",
        mockupTemplateTifUrl: "https://example.com/ROC902.tif",
        labelTemplateUrl: "https://example.com/label.pdf",
        mockupUrl: "https://example.com/mockup.png",
        extractionStatus: "success",
        assets: [],
        assetReadiness: {
          hasCoa: true,
          hasLabelTemplateAi: true,
          hasMockupTemplateTif: true,
          readyForProductEditor: true,
          readyForOptiPixelAssets: true,
          readyForChannelImageGeneration: true,
        },
        sourceReferences: ["catalog_pdf", "label_mockup_templates"],
        missingFields: [],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("usable_with_warnings");
    expect(skuResult.blockingDefects).toHaveLength(0);
    expect(skuResult.warningDefects.some((defect) => defect.field === "supplementFacts.aiNeedsReview")).toBe(true);
    expect(result.aiTextFactsCoverage.presentSkuCount).toBe(1);
    expect(result.supplementFactsCoverageTotal.presentSkuCount).toBe(1);
    expect(skuResult.readiness.ingredientMatchingReadiness).toBe("needs_review");
    expect(skuResult.readiness.productEditorFactsReadiness).toBe("needs_review");
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
        supplementFacts: null,
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
        catalogTemplateUrl: null,
        labelTemplateAiUrl: null,
        mockupTemplateTifUrl: null,
        labelTemplateUrl: "https://example.com/tee-label.pdf",
        mockupUrl: "https://example.com/tee-mockup.png",
        assets: [],
        assetReadiness: {
          hasCoa: false,
          hasLabelTemplateAi: false,
          hasMockupTemplateTif: false,
          readyForProductEditor: false,
          readyForOptiPixelAssets: false,
          readyForChannelImageGeneration: false,
        },
        sourceReferences: ["label_mockup_templates"],
        missingFields: [],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.blockingDefects.some((defect) => defect.field.startsWith("supplementFacts."))).toBe(false);
    expect(skuResult.notApplicableFields).toContain("supplementFacts.servingSize");
    expect(skuResult.readiness.ingredientMatchingReadiness).toBe("ready_with_warnings");
  });

  it("keeps ingredient matching ready when COA is missing but supplement facts are usable", () => {
    const sku = "ROCCOA1";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Nitric Pump 300g",
        category: "supplements",
        supplementFactsText: "Supplement Facts Serving Size 1 Scoop Servings Per Container 30 Citrulline Malate 5000 mg",
        supplementFacts: {
          servingSize: "1 Scoop",
          servingsPerContainer: "30",
          activeIngredients: ["Citrulline Malate 5000 mg"],
          amountPerServing: ["Citrulline Malate 5000 mg"],
          dailyValuePercentages: [],
          otherIngredients: ["Natural Flavors"],
          suggestedUse: "Mix one scoop daily.",
          warnings: "Keep away from children.",
          storage: null,
        },
        sourceEvidence: {
          supplementFacts: {
            sourceMethod: "ai_pdf_text",
            sourcePage: null,
            sourceAsset: "ROCCOA1.ai",
            sourceUrl: "https://example.com/ROCCOA1.ai",
            sourceFileName: "ROCCOA1.ai",
            templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
            httpEtag: "\"etag\"",
            httpLastModified: "Mon, 12 Aug 2024 18:00:53 GMT",
            httpContentLength: 1024,
            httpContentType: "application/pdf",
            confidence: "high",
            needsReview: false,
            parseWarnings: [],
          },
        },
        sourceReferences: ["label_mockup_templates"],
        missingFields: [],
      },
      pricing: {
        sku,
        productName: "Nitric Pump 300g",
        wholesaleCost: 11,
        msrp: 32,
        estimatedProfit: 21,
        membershipTierCosts: { retail: 11 },
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
        catalogTemplateUrl: "https://example.com/catalog-template",
        labelTemplateAiUrl: null,
        mockupTemplateTifUrl: null,
        labelTemplateUrl: "https://example.com/label.pdf",
        mockupUrl: "https://example.com/mockup.png",
        assets: [],
        assetReadiness: {
          hasCoa: false,
          hasLabelTemplateAi: false,
          hasMockupTemplateTif: false,
          readyForProductEditor: true,
          readyForOptiPixelAssets: false,
          readyForChannelImageGeneration: false,
        },
        sourceReferences: ["catalog_pdf"],
        missingFields: ["coaUrl"],
      },
    });

    const skuResult = result.skuValidationResults[0];
    expect(skuResult.status).toBe("usable_with_warnings");
    expect(skuResult.readiness.ingredientMatchingReadiness).toBe("ready_with_warnings");
    expect(skuResult.readiness.productEditorFactsReadiness).toBe("ready_with_warnings");
    expect(skuResult.readiness.complianceEvidenceReadiness).toBe("ready_with_warnings");
    expect(skuResult.warningDefects.some((defect) => defect.field === "assets.coaUrl")).toBe(true);
    expect(skuResult.ingredientMatchingDefects).toHaveLength(0);
    expect(result.missingCoaWarningCount).toBe(1);
    expect(result.missingCoaNoLongerGlobalBlockCount).toBe(1);
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

  it("reports readiness breakdown and calibration summary metadata", () => {
    const sku = "ROCREAD1";
    const result = packageForSku({
      sku,
      sourceFacts: {
        sku,
        productName: "Greens Complex",
        category: "supplements",
        supplementFactsText: "Supplement Facts Serving Size 1 Scoop Servings Per Container 30",
        supplementFacts: {
          servingSize: "1 Scoop",
          servingsPerContainer: "30",
          activeIngredients: ["Spirulina 500 mg"],
          amountPerServing: ["Spirulina 500 mg"],
          dailyValuePercentages: [],
          otherIngredients: [],
          suggestedUse: null,
          warnings: null,
          storage: null,
        },
        sourceEvidence: {
          supplementFacts: {
            sourceMethod: "ai_pdf_text",
            sourcePage: null,
            sourceAsset: "ROCREAD1.ai",
            sourceUrl: "https://example.com/ROCREAD1.ai",
            sourceFileName: "ROCREAD1.ai",
            templatePageLastUpdated: "Mon, 12 Aug 2024 18:00:53 GMT",
            httpEtag: "\"etag\"",
            httpLastModified: "Mon, 12 Aug 2024 18:00:53 GMT",
            httpContentLength: 1024,
            httpContentType: "application/pdf",
            confidence: "medium",
            needsReview: false,
            parseWarnings: [],
          },
        },
        sourceReferences: ["label_mockup_templates"],
        missingFields: [],
      },
      pricing: {
        sku,
        productName: "Greens Complex",
        wholesaleCost: 11,
        msrp: 33,
        estimatedProfit: 22,
        membershipTierCosts: { retail: 11 },
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
        catalogTemplateUrl: "https://example.com/catalog-template",
        labelTemplateAiUrl: "https://example.com/ROCREAD1.ai",
        mockupTemplateTifUrl: "https://example.com/ROCREAD1.tif",
        labelTemplateUrl: "https://example.com/label.pdf",
        mockupUrl: "https://example.com/mockup.png",
        assets: [],
        assetReadiness: {
          hasCoa: false,
          hasLabelTemplateAi: true,
          hasMockupTemplateTif: true,
          readyForProductEditor: true,
          readyForOptiPixelAssets: true,
          readyForChannelImageGeneration: true,
        },
        sourceReferences: ["catalog_pdf"],
        missingFields: ["coaUrl"],
      },
    });

    expect(result.readinessBreakdown.ingredientMatching.ready + result.readinessBreakdown.ingredientMatching.readyWithWarnings + result.readinessBreakdown.ingredientMatching.needsReview).toBeGreaterThan(0);
    expect(result.validationPolicyCalibrationReport.globalBlockedBeforeCalibration).toBeGreaterThanOrEqual(result.validationPolicyCalibrationReport.globalBlockedAfterCalibration);
    expect(result.topBlockingDefectTypes.length).toBeGreaterThanOrEqual(0);
    expect(result.topWarningDefectTypes.length).toBeGreaterThanOrEqual(1);
  });
});
