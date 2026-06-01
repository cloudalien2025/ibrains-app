import { describe, expect, it } from "vitest";
import {
  toSupplierIntelligenceAuditCsv,
  validateSupplierIntelligencePackage,
} from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-validation";
import { buildRocktomicSupplierIntelligence, loadRocktomicSourceManifest } from "@/lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence";

describe("supplier intelligence validation", () => {
  it("reports structured/image-text-only/missing metrics", async () => {
    const manifest = await loadRocktomicSourceManifest("data/ecomviper/suppliers/rocktomic/sources.json");
    const built = await buildRocktomicSupplierIntelligence({
      manifest,
      skuFilter: null,
      useFixtures: true,
      useFirecrawl: false,
      useCache: true,
    });

    const report = validateSupplierIntelligencePackage(built.package);
    expect(report.totalSkus).toBeGreaterThanOrEqual(2);
    expect(report.structuredSupplementFactsCount).toBeGreaterThanOrEqual(1);
    expect(report.imageTextOnlyCount).toBeGreaterThanOrEqual(1);

    const csv = toSupplierIntelligenceAuditCsv(report);
    expect(csv).toContain("ROC948");
    expect(csv).toContain("sourceStatus");
  });
});
