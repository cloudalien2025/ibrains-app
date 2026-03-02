import { describe, expect, it, vi } from "vitest";
import { gzipSync } from "zlib";

describe("sitemap parsing", () => {
  it("parses sitemap index with nested sitemap URLs", async () => {
    const { parseSitemapXml } = await import("@/lib/ingest/sitemap/parseSitemap");
    const xml = `
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-a.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap-b.xml</loc></sitemap>
      </sitemapindex>
    `;
    const parsed = parseSitemapXml(xml);
    expect(parsed.kind).toBe("sitemapindex");
    expect(parsed.nestedSitemaps).toEqual([
      "https://example.com/sitemap-a.xml",
      "https://example.com/sitemap-b.xml",
    ]);
  });

  it("parses urlset entries + lastmod", async () => {
    const { parseSitemapXml } = await import("@/lib/ingest/sitemap/parseSitemap");
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/products/a</loc>
          <lastmod>2026-02-01</lastmod>
        </url>
        <url>
          <loc>https://example.com/blog/post-1</loc>
        </url>
      </urlset>
    `;
    const parsed = parseSitemapXml(xml);
    expect(parsed.kind).toBe("urlset");
    expect(parsed.urls).toHaveLength(2);
    expect(parsed.urls[0]).toEqual({
      url: "https://example.com/products/a",
      lastmod: "2026-02-01",
    });
  });

  it("parses .xml.gz payloads", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ingest/sitemap/http", () => ({
      fetchBufferWithRetry: vi.fn(async () => {
        const xml = `
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page-a</loc></url>
          </urlset>
        `;
        return {
          status: 200,
          body: gzipSync(Buffer.from(xml, "utf8")),
          finalUrl: "https://example.com/sitemap.xml.gz",
        };
      }),
    }));
    const { parseSitemap } = await import("@/lib/ingest/sitemap/parseSitemap");
    const parsed = await parseSitemap({ sitemapUrl: "https://example.com/sitemap.xml.gz" });
    expect(parsed.kind).toBe("urlset");
    expect(parsed.urls[0].url).toBe("https://example.com/page-a");
  });
});

describe("sitemap resolution", () => {
  it("resolves robots sitemap index + nested urlsets with dedupe and caps", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ingest/sitemap/http", () => ({
      fetchTextWithRetry: vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) {
          return {
            status: 200,
            body: "User-agent: *\nSitemap: https://example.com/sitemap-index.xml\n",
            finalUrl: url,
          };
        }
        return { status: 404, body: "", finalUrl: url };
      }),
    }));
    vi.doMock("@/lib/ingest/sitemap/parseSitemap", () => ({
      parseSitemap: vi.fn(async ({ sitemapUrl }: { sitemapUrl: string }) => {
        if (sitemapUrl.endsWith("sitemap-index.xml")) {
          return {
            kind: "sitemapindex" as const,
            urls: [],
            nestedSitemaps: ["https://example.com/sitemap-a.xml"],
          };
        }
        return {
          kind: "urlset" as const,
          urls: [
            { url: "https://example.com/a", lastmod: null },
            { url: "https://example.com/a", lastmod: null },
            { url: "https://example.com/b", lastmod: "2026-01-01" },
          ],
          nestedSitemaps: [],
        };
      }),
    }));
    const { resolveSitemaps } = await import("@/lib/ingest/sitemap/resolveSitemaps");
    const resolved = await resolveSitemaps({
      baseUrl: "example.com",
      maxUrls: 2,
      maxSitemaps: 5,
    });
    expect(resolved.sitemapUrlsUsed).toContain("https://example.com/sitemap-index.xml");
    expect(resolved.urls).toHaveLength(2);
    expect(new Set(resolved.urls.map((r) => r.url)).size).toBe(2);
  });
});
