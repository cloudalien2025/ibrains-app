import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getSupplierAdminSummary: vi.fn(),
  getSupplierAuditData: vi.fn(),
  getSupplierBuildHistory: vi.fn(),
}));

vi.mock("@/lib/admin/ecomviper/supplier-intelligence", () => ({
  ADMIN_AUDIT_FILTER_OPTIONS: [
    { value: "all", label: "All" },
    { value: "ready", label: "Ready" },
    { value: "partial", label: "Partial" },
    { value: "missing_pricing", label: "Missing Pricing" },
    { value: "missing_inventory", label: "Missing Inventory" },
    { value: "missing_coa", label: "Missing COA" },
    { value: "missing_assets", label: "Missing Assets" },
    { value: "missing_key_features", label: "Missing Key Features" },
    { value: "supplement_facts_not_extracted", label: "Supplement Facts Not Extracted" },
    { value: "missing_product", label: "Unmatched / Missing Product Record" },
  ],
  getSupplierAdminSummary: mocks.getSupplierAdminSummary,
  getSupplierAuditData: mocks.getSupplierAuditData,
  getSupplierBuildHistory: mocks.getSupplierBuildHistory,
}));

describe("admin ecomviper routes contract", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getSupplierAdminSummary.mockReset();
    mocks.getSupplierAuditData.mockReset();
    mocks.getSupplierBuildHistory.mockReset();

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

    mocks.getSupplierAuditData.mockResolvedValue({
      summary: {
        totalSupplierSkus: 2,
        readySkus: 1,
        partialSkus: 1,
        missingCoa: 1,
        missingPricing: 1,
        missingInventory: 1,
        supplementFactsNotExtracted: 1,
      },
      filteredCount: 2,
      rows: [
        {
          sku: "ROC948",
          productName: "Magnesium Gummies",
          productFactsStatus: "ready",
          pricingStatus: "ready",
          inventoryStatus: "ready",
          coaLinkStatus: "ready",
          labelMockupStatus: "ready",
          supplementFactsStatus: "ready",
          keyFeaturesStatus: "ready",
          generateReadiness: "ready",
          lastSyncedAt: "2026-05-30T00:00:00.000Z",
          missingProductRecord: false,
        },
      ],
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

  it("renders /admin/ecomviper/suppliers/rocktomic/audit table + filters", async () => {
    const pageMod = await import("@/app/admin/ecomviper/suppliers/rocktomic/audit/page");
    const html = renderToStaticMarkup(
      await pageMod.default({ searchParams: Promise.resolve({ filter: "all", q: "ROC" }) })
    );

    expect(html).toContain("All-SKU Source Audit");
    expect(html).toContain('data-testid="admin-rocktomic-audit-table"');
    expect(html).toContain("Search SKU / Product Name");
    expect(html).toContain("Missing Pricing");
    expect(html).toContain("Generate Readiness");
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
