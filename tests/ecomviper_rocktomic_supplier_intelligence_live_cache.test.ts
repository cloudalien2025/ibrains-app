import fs from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ecomviper/suppliers/firecrawl/firecrawl-client", () => {
  class MockFirecrawlClient {
    async scrape() {
      const body = await fs.readFile(
        "data/ecomviper/suppliers/rocktomic/fixtures/firecrawl/roc948-live-cache-markdown.json",
        "utf8"
      );
      const fixture = JSON.parse(body) as { markdown: string; sourceUrl: string };
      return {
        source: "cache",
        url: fixture.sourceUrl,
        markdown: fixture.markdown,
        html: null,
        json: { records: [] },
        metadata: {},
        fetchedAt: new Date().toISOString(),
      };
    }
  }
  return { FirecrawlClient: MockFirecrawlClient };
});

vi.mock("@/lib/ecomviper/suppliers/rocktomic/pdf-evidence", () => ({
  resolveOrAcquireCatalogPdfPath: async () => ({
    pdfPath: null,
    sourceHash: null,
    acquisitionSource: "unavailable",
    warnings: ["pdf_source_unavailable"],
    errors: [],
  }),
  extractPdfEvidence: async () => ({
    found: false,
    sku: null,
    productName: null,
    candidatePages: [],
    pageNumbers: [],
    textSnippets: [],
    links: [],
    errors: ["pdf_missing"],
    sourceFile: "",
    sourceHash: null,
    provenance: { extractor: "mock", query: "" },
  }),
}));

import {
  buildRocktomicSupplierIntelligence,
  loadRocktomicSourceManifest,
} from "@/lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence";

describe("rocktomic supplier intelligence firecrawl markdown fallback", () => {
  it("returns ROC948 record from cached markdown when json records are empty", async () => {
    const manifest = await loadRocktomicSourceManifest("data/ecomviper/suppliers/rocktomic/sources.json");

    const result = await buildRocktomicSupplierIntelligence({
      manifest,
      skuFilter: ["ROC948"],
      useFixtures: false,
      useFirecrawl: true,
      useCache: true,
    });

    expect(result.sourceOrigin).toBe("firecrawl");
    expect(result.firecrawlSource).toBe("cache");
    expect(result.package.records).toHaveLength(1);
    expect(result.reason).toBe("ok");

    const record = result.package.records[0];
    expect(record.sku).toBe("ROC948");
    expect(record.productName).toContain("Premium Nitric Oxide Gummies");
    expect(record.sourceStatus === "partial" || record.sourceStatus === "needs_review").toBe(true);
  });
});
