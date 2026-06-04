import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRocktomicAdminAuditViewModel } from "@/lib/ecomviper/suppliers/rocktomic-admin-audit";

interface FixtureOptions {
  includeValidationReport?: boolean;
  includeAuditCsv?: boolean;
  packageStatus?: "pass" | "pass_with_warnings" | "fail";
}

async function writeFixturePackage(options: FixtureOptions = {}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rocktomic-admin-audit-"));
  const packageDir = path.join(root, "data/ecomviper/suppliers/rocktomic");
  const latestDir = path.join(packageDir, "latest");
  await fs.mkdir(latestDir, { recursive: true });

  const sources = {
    supplier: "rocktomic",
    version: 1,
    sources: [
      {
        id: "catalog_pdf",
        name: "Catalog PDF",
        url: "https://example.com/catalog.pdf",
        type: "pdf",
        notes: "Primary catalog",
      },
      {
        id: "inventory_report",
        name: "Inventory Report",
        url: "https://example.com/inventory.csv",
        type: "google_sheet",
        notes: "Inventory source",
      },
    ],
  };

  await fs.writeFile(path.join(packageDir, "sources.json"), JSON.stringify(sources, null, 2));
  await fs.writeFile(path.join(latestDir, "sourceFacts.json"), JSON.stringify([
    {
      sku: "ROC001",
      sourceReferences: ["catalog_pdf"],
    },
  ]));
  await fs.writeFile(path.join(latestDir, "pricing.json"), JSON.stringify([
    {
      sku: "ROC001",
      sourceReferences: ["catalog_pdf"],
    },
  ]));
  await fs.writeFile(path.join(latestDir, "inventory.json"), JSON.stringify([
    {
      sku: "ROC001",
      sourceReferences: ["inventory_report"],
    },
  ]));
  await fs.writeFile(path.join(latestDir, "assets.json"), JSON.stringify([
    {
      sku: "ROC001",
      sourceReferences: [],
    },
  ]));
  await fs.writeFile(path.join(latestDir, "catalog-link-evidence.json"), JSON.stringify({ evidence: [] }));
  await fs.writeFile(path.join(latestDir, "template-asset-evidence.json"), JSON.stringify({ evidence: [] }));
  await fs.writeFile(path.join(latestDir, "ocr-evidence.json"), JSON.stringify([]));
  await fs.writeFile(path.join(latestDir, "ai-label-text-evidence.json"), JSON.stringify({ records: [] }));
  await fs.writeFile(path.join(latestDir, "validation-policy-calibration-report.json"), JSON.stringify({ generatedAt: "2026-05-31T00:00:00.000Z" }));

  if (options.includeAuditCsv !== false) {
    await fs.writeFile(path.join(latestDir, "audit.csv"), ["sku,validationStatus", "ROC001,usable", "ROC002,blocked"].join("\n"));
  }

  if (options.includeValidationReport !== false) {
    const report = {
      generatedAt: "2026-05-31T00:00:00.000Z",
      supplierId: "rocktomic",
      validationPolicyVersion: "rocktomic_phase2_v1",
      packageStatus: options.packageStatus || "fail",
      totalSkusDiscovered: 2,
      totalSkusValidated: 2,
      usableSkuCount: 1,
      usableWithWarningsSkuCount: 0,
      blockedSkuCount: 1,
      extractionErrorSkuCount: 0,
      ocrNeedsReviewSkuCount: 1,
      aiTextFactsCoverage: { requiredSkuCount: 2, presentSkuCount: 1, missingSkuCount: 1 },
      ocrFactsCoverage: { requiredSkuCount: 2, presentSkuCount: 0, missingSkuCount: 2 },
      supplementFactsCoverageTotal: { requiredSkuCount: 2, presentSkuCount: 1, missingSkuCount: 1 },
      aiLabelTextExtractionAttempted: 2,
      aiLabelTextExtractionSucceeded: 1,
      aiLabelTextNeedsReview: 1,
      aiLabelTextNonPdfCompatible: 0,
      aiLabelTextNoExtractableText: 0,
      aiLabelTextExtractionErrors: 1,
      usableForOptiPixelSkuCount: 0,
      readyForChannelImageGenerationSkuCount: 0,
      ingredientMatchingReadyCount: 1,
      ingredientMatchingReadyWithWarningsCount: 0,
      ingredientMatchingBlockedCount: 1,
      productEditorFactsReadyCount: 1,
      productEditorFactsReadyWithWarningsCount: 0,
      productEditorFactsBlockedCount: 1,
      complianceEvidenceReadyCount: 0,
      complianceEvidenceReadyWithWarningsCount: 1,
      complianceEvidenceBlockedCount: 1,
      optiPixelAssetReadyCount: 0,
      optiPixelAssetReadyWithWarningsCount: 1,
      optiPixelAssetBlockedCount: 1,
      missingCoaWarningCount: 1,
      missingCoaNoLongerGlobalBlockCount: 1,
      globalBlockedBeforeCalibration: 2,
      globalBlockedAfterCalibration: 1,
      topBlockingDefectTypes: [{ defectField: "supplementFacts.activeIngredients", count: 1 }],
      topWarningDefectTypes: [{ defectField: "assets.coaUrl", count: 1 }],
      fieldCoverageSummary: {
        sku: { requiredSkuCount: 2, presentSkuCount: 2, missingSkuCount: 0 },
      },
      blockingFieldCoverageSummary: {
        "assets.coaUrl": { requiredSkuCount: 2, presentSkuCount: 1, missingSkuCount: 1 },
      },
      warningFieldCoverageSummary: {
        "assets.mockupUrl": { requiredSkuCount: 2, presentSkuCount: 1, missingSkuCount: 1 },
      },
      sourceErrors: [{ sourceId: "inventory_report", error: "sheet timeout" }],
      packageDefects: [{ field: "package", code: "blocked_sku_count", message: "Blocked SKUs detected" }],
      skuValidationResults: [
        {
          sku: "ROC001",
          productName: "Daily Greens",
          skuType: "supplement",
          status: "usable",
          blockingDefects: [],
          warningDefects: [],
          missingFields: [],
          sourceNotes: [],
          readiness: {
            usableForProductEditor: true,
            usableForGenerateIntelligence: true,
            usableForImageStudio: true,
            usableForOptiPixel: false,
            usableForOptiBay: true,
            usableForOptiWal: true,
            usableForOptizon: true,
            readyForChannelImageGeneration: false,
          },
        },
        {
          sku: "ROC002",
          productName: "Night Formula",
          skuType: "supplement",
          status: "blocked",
          blockingDefects: [{ field: "assets.coaUrl", code: "missing_coa_url", message: "COA missing" }],
          warningDefects: [{ field: "assets.mockupUrl", code: "missing_mockup", message: "Mockup missing" }],
          missingFields: ["coaUrl", "mockupUrl"],
          sourceNotes: ["catalog_pdf: partial extraction"],
          readiness: {
            usableForProductEditor: false,
            usableForGenerateIntelligence: false,
            usableForImageStudio: false,
            usableForOptiPixel: false,
            usableForOptiBay: false,
            usableForOptiWal: false,
            usableForOptizon: false,
            readyForChannelImageGeneration: false,
          },
        },
      ],
    };

    await fs.writeFile(path.join(latestDir, "validation-report.json"), JSON.stringify(report, null, 2));
  }

  return root;
}

describe("rocktomic admin audit reader", () => {
  const tempRoots: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    for (const root of tempRoots) {
      await fs.rm(root, { recursive: true, force: true });
    }
    tempRoots.length = 0;
  });

  it("loads package files and summarizes status/counts", async () => {
    const root = await writeFixturePackage();
    tempRoots.push(root);

    const vm = await getRocktomicAdminAuditViewModel({ rootDir: root, previewLimit: 10, topDefectLimit: 10 });

    expect(vm.packageStatus).toBe("fail");
    expect(vm.totalSkusDiscovered).toBe(2);
    expect(vm.totalSkusValidated).toBe(2);
    expect(vm.usableSkuCount).toBe(1);
    expect(vm.blockedSkuCount).toBe(1);
    expect(vm.aiLabelTextExtractionAttempted).toBe(2);
    expect(vm.aiLabelTextExtractionSucceeded).toBe(1);
    expect(vm.ingredientMatchingReadyCount).toBe(1);
    expect(vm.productEditorFactsBlockedCount).toBe(1);
    expect(vm.missingCoaWarningCount).toBe(1);
    expect(vm.missingCoaNoLongerGlobalBlockCount).toBe(1);
    expect(vm.aiTextFactsCoverage?.presentSkuCount).toBe(1);
    expect(vm.auditCsvPresent).toBe(true);
    expect(vm.auditCsvRowCount).toBe(2);
    expect(vm.sourceRegistrySummary).toHaveLength(2);
  });

  it("handles missing validation-report.json gracefully", async () => {
    const root = await writeFixturePackage({ includeValidationReport: false });
    tempRoots.push(root);

    const vm = await getRocktomicAdminAuditViewModel({ rootDir: root });

    expect(vm.packageStatus).toBe("unavailable");
    expect(vm.validationPolicyVersion).toBeNull();
    expect(vm.sourceErrors.some((entry) => entry.includes("validation-report.json is missing"))).toBe(true);
    expect(vm.issues.some((entry) => entry.includes("validation-report.json"))).toBe(true);
  });

  it("handles missing audit.csv gracefully", async () => {
    const root = await writeFixturePackage({ includeAuditCsv: false });
    tempRoots.push(root);

    const vm = await getRocktomicAdminAuditViewModel({ rootDir: root });

    expect(vm.auditCsvPresent).toBe(false);
    expect(vm.auditCsvRowCount).toBe(0);
    expect(vm.issues.some((entry) => entry.includes("latest/audit.csv"))).toBe(true);
  });

  it("surfaces blocking and warning defects in top SKU defects", async () => {
    const root = await writeFixturePackage();
    tempRoots.push(root);

    const vm = await getRocktomicAdminAuditViewModel({ rootDir: root, topDefectLimit: 1 });

    expect(vm.topSkuDefects).toHaveLength(1);
    expect(vm.topSkuDefects[0]?.sku).toBe("ROC002");
    expect(vm.topSkuDefects[0]?.blockingDefectCount).toBe(1);
    expect(vm.topSkuDefects[0]?.warningDefectCount).toBe(1);
  });

  it("does not call network fetch and does not require ecommerce/database env vars", async () => {
    const root = await writeFixturePackage({ packageStatus: "pass_with_warnings" });
    tempRoots.push(root);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    delete process.env.ECOMMERCE_DATABASE_URL;
    delete process.env.DATABASE_URL;

    const vm = await getRocktomicAdminAuditViewModel({ rootDir: root });

    expect(vm.packageStatus).toBe("pass_with_warnings");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
