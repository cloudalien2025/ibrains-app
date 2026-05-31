import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAuditRows,
  buildValidationReport,
  loadSourceRegistry,
  normalizeRocktomicSku,
  parseInventoryCsv,
  parsePricingCsv,
  toAuditCsv,
  toGoogleSheetCsvUrl,
  type AssetsRecord,
  type InventoryRecord,
  type PricingRecord,
  type SourceFactRecord,
} from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";

describe("rocktomic offline audit helpers", () => {
  it("normalizes SKU rows deterministically", () => {
    expect(normalizeRocktomicSku(" roc-949 ")).toBe("ROC949");
    expect(normalizeRocktomicSku("roc 817")).toBe("ROC817");
  });

  it("loads source registry from canonical file", async () => {
    const registryPath = path.join(process.cwd(), "data/ecomviper/suppliers/rocktomic/sources.json");
    const registry = await loadSourceRegistry(registryPath);
    expect(registry.supplier).toBe("rocktomic");
    expect(registry.sources.length).toBeGreaterThanOrEqual(6);
    expect(registry.sources.some((source) => source.id === "catalog_pdf")).toBe(true);
  });

  it("parses pricing/inventory CSV rows and keeps explicit missing fields", () => {
    const pricingCsv = [
      "SKU,Product Name,Non Member Pricing,MSRP,Estimated Profit",
      "ROC949,Premium Magnesium Gummies,12.47,39.99,27.52",
      "ROC920,Sleep Well Gummies,,,",
    ].join("\n");
    const inventoryCsv = [
      "SKU,Inventory Status,Qty",
      "ROC949,In Stock,42",
      "ROC920,,",
    ].join("\n");

    const pricing = parsePricingCsv(pricingCsv);
    const inventory = parseInventoryCsv(inventoryCsv);

    expect(pricing).toHaveLength(2);
    expect(pricing[0]?.sku).toBe("ROC920");
    expect(pricing[1]?.sku).toBe("ROC949");
    expect(pricing.find((row) => row.sku === "ROC920")?.missingFields).toContain("wholesaleCost");
    expect(inventory.find((row) => row.sku === "ROC920")?.missingFields).toContain("rawInventoryValue");
  });

  it("builds audit rows with missing field details and stable csv shape", () => {
    const sourceFacts: SourceFactRecord[] = [
      {
        sku: "ROC949",
        productName: "Premium Magnesium Gummies",
        category: null,
        supplementFactsText: null,
        supplementFacts: null,
        sourceReferences: ["catalog_pdf"],
        missingFields: ["category", "supplementFactsText"],
      },
    ];
    const pricing: PricingRecord[] = [
      {
        sku: "ROC949",
        productName: "Premium Magnesium Gummies",
        wholesaleCost: 12.47,
        msrp: 39.99,
        estimatedProfit: 27.52,
        membershipTierCosts: { "Non Member Pricing": 12.47 },
        sourceReferences: ["plds_catalog"],
        missingFields: [],
      },
    ];
    const inventory: InventoryRecord[] = [
      {
        sku: "ROC949",
        rawInventoryValue: "In Stock",
        inventoryStatus: "in_stock",
        sourceReferences: ["inventory_report"],
        missingFields: [],
      },
    ];
    const assets: AssetsRecord[] = [
      {
        sku: "ROC949",
        coaUrl: null,
        catalogTemplateUrl: null,
        labelTemplateAiUrl: null,
        mockupTemplateTifUrl: null,
        labelTemplateUrl: null,
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
        sourceReferences: [],
        missingFields: ["coaUrl", "labelTemplateUrl", "mockupUrl"],
      },
    ];

    const auditRows = buildAuditRows({
      sourceFactsBySku: { ROC949: sourceFacts[0] },
      pricingBySku: { ROC949: pricing[0] },
      inventoryBySku: { ROC949: inventory[0] },
      assetsBySku: { ROC949: assets[0] },
      sourceErrors: [{ sourceId: "catalog_pdf", error: "mock parse error" }],
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.missingFields).toContain("coaUrl");
    expect(auditRows[0]?.sourceNotes[0]).toContain("catalog_pdf");
    expect(auditRows[0]?.validationStatus).toBeTruthy();

    const csv = toAuditCsv(auditRows);
    expect(csv).toContain("missingFields");
    expect(csv).toContain("validationStatus");
    expect(csv).toContain("hasLabelTemplateAi");
    expect(csv).toContain("usableForOptiPixel");
    expect(csv).toContain("blockingDefects");
    expect(csv).toContain("ROC949");

    const report = buildValidationReport({
      generatedAt: "2026-05-31T00:00:00.000Z",
      packageVersion: 1,
      sourceFacts,
      pricing,
      inventory,
      assets,
      sourceErrors: [{ sourceId: "catalog_pdf", error: "mock parse error" }],
    });
    expect(report.totalSkusDiscovered).toBe(1);
    expect(report.validationPolicyVersion).toBeTruthy();
    expect(report.supplierId).toBe("rocktomic");
    expect(report.skuValidationResults).toHaveLength(1);
    expect(report.fieldCoverageSummary).toHaveProperty("assets.labelTemplateAiUrl");
    expect(report.fieldCoverageSummary).toHaveProperty("assets.mockupTemplateTifUrl");
    expect(report.fieldCoverageSummary).toHaveProperty("supplementFacts.aiOrOcrEvidence");
    expect(report.sourceErrors).toHaveLength(1);
  });

  it("converts google sheet links to CSV export URLs", () => {
    const csvUrl = toGoogleSheetCsvUrl(
      "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing"
    );
    expect(csvUrl).toContain("/export?format=csv");
    expect(csvUrl).toContain("15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU");
  });
});
