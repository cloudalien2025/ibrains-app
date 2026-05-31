import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getSupplierAdminSummary: vi.fn(),
  getSupplierBuildHistory: vi.fn(),
  getRocktomicAdminAuditViewModel: vi.fn(),
}));

vi.mock("@/lib/admin/ecomviper/supplier-intelligence", () => ({
  getSupplierAdminSummary: mocks.getSupplierAdminSummary,
  getSupplierBuildHistory: mocks.getSupplierBuildHistory,
}));

vi.mock("@/lib/ecomviper/suppliers/rocktomic-admin-audit", () => ({
  getRocktomicAdminAuditViewModel: mocks.getRocktomicAdminAuditViewModel,
}));

describe("admin ecomviper routes contract", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getSupplierAdminSummary.mockReset();
    mocks.getSupplierBuildHistory.mockReset();
    mocks.getRocktomicAdminAuditViewModel.mockReset();

    mocks.getSupplierAdminSummary.mockResolvedValue({
      supplierId: "rocktomic",
      supplierLabel: "Rocktomic",
      sourceRegistryStatus: "synced",
      datasetStatus: "healthy",
      productCount: 145,
      pricingCount: 145,
      inventoryCount: 145,
      assetCount: 145,
      lastSuccessfulSyncAt: "2026-05-30T00:00:00.000Z",
      lastFailedSyncAt: null,
      currentPublishedDatasetVersion: "v2026.05.30",
      currentReleaseBuildId: "2564623133",
      sourceStatuses: [
        {
          sourceId: "catalog_pdf",
          sourceLabel: "Catalog PDF",
          syncStatus: "synced",
          configured: true,
          fetchable: true,
          parsed: true,
          recordCount: 147,
          lastCheckedAt: "2026-05-30T00:00:00.000Z",
          lastSuccessfulSyncAt: "2026-05-30T00:00:00.000Z",
          lastError: null,
        },
      ],
    });

    mocks.getRocktomicAdminAuditViewModel.mockResolvedValue({
      supplierSlug: "rocktomic",
      supplierName: "Rocktomic",
      packageGeneratedAt: "2026-05-31T00:00:00.000Z",
      validationPolicyVersion: "rocktomic_phase2_v1",
      packageStatus: "fail",
      totalSkusDiscovered: 156,
      totalSkusValidated: 156,
      usableSkuCount: 0,
      usableWithWarningsSkuCount: 4,
      blockedSkuCount: 152,
      extractionErrorSkuCount: 0,
      fieldCoverageSummary: [],
      blockingFieldCoverageSummary: [],
      warningFieldCoverageSummary: [],
      sourceErrors: ["catalog_pdf: parse failed"],
      packageDefects: ["package: blocked_sku_count: blocked SKUs exist"],
      topSkuDefects: [
        {
          sku: "ROC010",
          productName: "Pump Formula",
          skuType: "supplement",
          status: "blocked",
          blockingDefectCount: 3,
          warningDefectCount: 0,
          blockingDefects: ["assets.coaUrl: missing"],
          warningDefects: [],
          missingFields: ["coaUrl"],
          sourceNotes: [],
        },
      ],
      skuValidationPreview: [
        {
          sku: "ROC010",
          productName: "Pump Formula",
          skuType: "supplement",
          status: "blocked",
          blockingDefectCount: 3,
          warningDefectCount: 0,
          readiness: {
            usableForProductEditor: false,
            usableForGenerateIntelligence: false,
            usableForImageStudio: false,
            usableForOptiBay: false,
            usableForOptiWal: false,
            usableForOptizon: false,
          },
          missingFields: ["coaUrl"],
          sourceNotes: [],
        },
      ],
      totalSkuValidationResults: 156,
      sourceRegistrySummary: [
        {
          id: "catalog_pdf",
          name: "Catalog PDF",
          type: "pdf",
          urlLabel: "example.com/catalog.pdf",
          urlPreview: "https://example.com/catalog.pdf",
          notes: "catalog",
          status: "present",
        },
      ],
      artifactStatuses: [
        {
          artifact: "validation-report.json",
          relativePath: "latest/validation-report.json",
          exists: true,
          sizeBytes: 1024,
          lastModifiedAt: "2026-05-31T00:00:00.000Z",
          error: null,
        },
      ],
      auditCsvPresent: true,
      auditCsvRowCount: 156,
      issues: [],
    });

    mocks.getSupplierBuildHistory.mockResolvedValue([
      {
        runId: 12,
        status: "synced",
        startedAt: "2026-05-30T00:00:00.000Z",
        finishedAt: "2026-05-30T00:00:03.000Z",
        durationSeconds: 3,
        productCount: 145,
        pricingCount: 145,
        inventoryCount: 153,
        assetCount: 147,
        errorSummary: null,
        sourceVersion: "v2026.05.30",
      },
    ]);
  });

  it("renders /admin route overview", async () => {
    const pageMod = await import("@/app/admin/page");
    const html = renderToStaticMarkup(pageMod.default());

    expect(html).toContain("iBrains Admin");
    expect(html).toContain("EcomViper Admin");
    expect(html).toContain("OptiZon Admin");
    expect(html).toContain("DirectoryIQ Admin");
  });

  it("renders /admin/ecomviper overview", async () => {
    const pageMod = await import("@/app/admin/ecomviper/page");
    const html = renderToStaticMarkup(await pageMod.default());

    expect(html).toContain("EcomViper Admin Overview");
    expect(html).toContain("Supplier Intelligence");
    expect(html).toContain("Dataset Health");
    expect(html).toContain("Rocktomic Supplier Intelligence");
  });

  it("renders /admin/ecomviper/suppliers/rocktomic summary", async () => {
    const pageMod = await import("@/app/admin/ecomviper/suppliers/rocktomic/page");
    const html = renderToStaticMarkup(await pageMod.default());

    expect(html).toContain("Rocktomic Supplier Intelligence");
    expect(html).toContain("Source Registry");
    expect(html).toContain("All-SKU Audit");
    expect(html).toContain('data-testid="admin-rocktomic-source-registry-table"');
  });

  it("renders /admin/ecomviper/suppliers/rocktomic/audit package status + sku table", async () => {
    const pageMod = await import("@/app/admin/ecomviper/suppliers/rocktomic/audit/page");
    const html = renderToStaticMarkup(await pageMod.default());

    expect(html).toContain("Rocktomic Supplier Audit");
    expect(html).toContain("Package status");
    expect(html).toContain("Total SKUs Discovered");
    expect(html).toContain("Validation Status");
    expect(html).toContain('data-testid="admin-rocktomic-audit-table"');
    expect(html).toContain("Artifact Status");
    expect(html).toContain("Top SKU Defects");
  });

  it("renders /admin/ecomviper/suppliers/rocktomic/builds run history", async () => {
    const pageMod = await import("@/app/admin/ecomviper/suppliers/rocktomic/builds/page");
    const html = renderToStaticMarkup(await pageMod.default());

    expect(html).toContain("Build History");
    expect(html).toContain('data-testid="admin-rocktomic-build-history-table"');
    expect(html).toContain("Run ID");
    expect(html).toContain("Products");
    expect(html).toContain("Source Version");
  });
});
