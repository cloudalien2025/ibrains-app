import { describe, expect, it } from "vitest";
import {
  buildRocktomicSupplierIntelligence,
  loadRocktomicSourceManifest,
} from "@/lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence";

const MANIFEST_PATH = "data/ecomviper/suppliers/rocktomic/sources.json";

describe("rocktomic supplier intelligence extractor", () => {
  it("parses firecrawl manifest policy fields", async () => {
    const manifest = await loadRocktomicSourceManifest(MANIFEST_PATH);
    expect(manifest.firecrawl?.allowedModes).toContain("fixture");
    expect(manifest.firecrawl?.cacheDirEnvVar).toBe("ECOMVIPER_SUPPLIER_FIRECRAWL_CACHE_DIR");
    expect(manifest.sources.some((source) => source.id === "catalog_pdf")).toBe(true);
  });

  it("extracts ROC948 from fixtures with structured facts and provenance", async () => {
    const manifest = await loadRocktomicSourceManifest(MANIFEST_PATH);
    const result = await buildRocktomicSupplierIntelligence({
      manifest,
      skuFilter: ["ROC948"],
      useFixtures: true,
      useFirecrawl: false,
      useCache: true,
    });

    expect(result.sourceOrigin).toBe("fixture");
    expect(result.package.records).toHaveLength(1);

    const record = result.package.records[0];
    expect(record.sku).toBe("ROC948");
    expect(record.productName).toBe("Premium Nitric Oxide Gummies");
    expect(record.servingSize).toBe("2 Gummies");
    expect(record.servingsPerContainer).toBe(30);
    expect(record.activeIngredients.some((entry) => entry.name === "Beet Root Powder Extract" && entry.amount === 100)).toBe(true);
    expect(record.nutrientFacts.some((entry) => entry.name === "Vitamin C" && entry.amount === 30)).toBe(true);
    expect(record.provenance.length).toBeGreaterThan(0);
    expect(record.sourceStatus).toBe("structured");
  });

  it("supports all fixture records without SKU-specific hardcoding", async () => {
    const manifest = await loadRocktomicSourceManifest(MANIFEST_PATH);
    const result = await buildRocktomicSupplierIntelligence({
      manifest,
      skuFilter: null,
      useFixtures: true,
      useFirecrawl: false,
      useCache: true,
    });

    const skus = result.package.records.map((entry) => entry.sku);
    expect(skus).toContain("ROC948");
    expect(skus).toContain("ROC123");
  });
});
