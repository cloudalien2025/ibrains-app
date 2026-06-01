import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { acquireCatalogPdfSource } from "@/lib/ecomviper/suppliers/rocktomic/pdf-source-cache";

describe("rocktomic pdf source cache", () => {
  it("returns unavailable when cache is missing and live download is disabled", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rocktomic-pdf-cache-"));
    process.env.ECOMVIPER_SUPPLIER_ROCKTOMIC_CACHE_DIR = tempDir;
    const result = await acquireCatalogPdfSource({
      sourceUrl: "https://example.com/catalog.pdf?t=123",
      allowLiveDownload: false,
    });
    expect(result.available).toBe(false);
    expect(result.source).toBe("unavailable");
    expect(result.warnings).toContain("pdf_cache_miss_live_download_disabled");
  });

  it("uses cached local file when present", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rocktomic-pdf-cache-"));
    process.env.ECOMVIPER_SUPPLIER_ROCKTOMIC_CACHE_DIR = tempDir;
    const pdfPath = path.join(tempDir, "Supplement-&-Apparel-Catalog.pdf");
    await fs.writeFile(pdfPath, Buffer.from("%PDF-1.4\nfake\n"), "utf8");

    const result = await acquireCatalogPdfSource({
      sourceUrl: "https://example.com/catalog.pdf?t=123",
      allowLiveDownload: false,
    });
    expect(result.available).toBe(true);
    expect(result.source).toBe("cache");
    expect(result.filePath).toBe(pdfPath);
    expect(result.metadata?.contentHash).toBeTruthy();
  });

  it("downloads and caches pdf when enabled", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rocktomic-pdf-cache-"));
    process.env.ECOMVIPER_SUPPLIER_ROCKTOMIC_CACHE_DIR = tempDir;

    const fetchMock = vi.fn(async () => new Response(Buffer.from("%PDF-1.4\nfake\n"), { status: 200 }));
    const originalFetch = global.fetch;
    // @ts-expect-error mocked for test
    global.fetch = fetchMock;

    try {
      const result = await acquireCatalogPdfSource({
        sourceUrl: "https://example.com/catalog.pdf?t=123",
        allowLiveDownload: true,
      });
      expect(result.available).toBe(true);
      expect(result.source).toBe("downloaded");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

