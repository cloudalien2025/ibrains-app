import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FirecrawlClient, createFirecrawlCacheKey } from "@/lib/ecomviper/suppliers/firecrawl/firecrawl-client";

const TEMP_CACHE_DIR = path.join(process.cwd(), ".cache/test-firecrawl-client");

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(TEMP_CACHE_DIR, { recursive: true, force: true });
});

describe("Firecrawl client wrapper", () => {
  it("uses cache when available and avoids additional requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          markdown: "# catalog",
          html: "<h1>catalog</h1>",
          metadata: { title: "Catalog" },
        },
      }),
    });

    vi.stubGlobal("fetch", mockFetch);

    const client = new FirecrawlClient({
      apiKey: "fc-test",
      enabled: true,
      allowLiveRequests: true,
      cacheDir: TEMP_CACHE_DIR,
    });

    const first = await client.scrape({
      url: "https://example.com/catalog.pdf",
      formats: ["markdown", "html"],
      useCache: true,
      parsers: ["pdf"],
    });

    const second = await client.scrape({
      url: "https://example.com/catalog.pdf",
      formats: ["markdown", "html"],
      useCache: true,
      parsers: ["pdf"],
    });

    expect(first.source).toBe("live");
    expect(second.source).toBe("cache");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when API key is missing in live mode", async () => {
    const client = new FirecrawlClient({ enabled: true, allowLiveRequests: true, cacheDir: TEMP_CACHE_DIR });
    await expect(
      client.scrape({ url: "https://example.com", formats: ["markdown"], useCache: false })
    ).rejects.toThrow("FIRECRAWL_API_KEY");
  });

  it("produces deterministic cache keys", () => {
    const first = createFirecrawlCacheKey({
      mode: "scrape",
      url: "https://example.com/PDF",
      formats: ["markdown", { type: "json", schema: { type: "object", properties: { sku: { type: "string" } } } }],
    });
    const second = createFirecrawlCacheKey({
      mode: "scrape",
      url: "https://example.com/pdf",
      formats: ["markdown", { type: "json", schema: { properties: { sku: { type: "string" }, }, type: "object" } }],
    });

    expect(first).toBe(second);
  });
});
