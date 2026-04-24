import { describe, expect, it, vi } from "vitest";
import { importListingFromUrl, validateListingImportUrl } from "@/lib/studio/domara/listing-url-importer";

function mockResponse(params: {
  status?: number;
  url?: string;
  contentType?: string;
  body?: string;
  headers?: Record<string, string>;
}) {
  const status = params.status ?? 200;
  const body = params.body ?? "";
  const headers = new Headers({
    "content-type": params.contentType ?? "text/html; charset=utf-8",
    ...(params.headers || {}),
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    url: params.url || "https://example.com/listing/1",
    text: async () => body,
  };
}

describe("Domara listing URL importer", () => {
  it("rejects unsafe URLs", () => {
    expect(() => validateListingImportUrl("ftp://example.com/listing")).toThrow("Only http/https");
    expect(() => validateListingImportUrl("http://localhost/listing")).toThrow("Private or local network");
  });

  it("imports listing metadata and deduplicates/validates images", async () => {
    const fetchFn = vi.fn(async () =>
      mockResponse({
        body: `
          <html><head>
            <meta property="og:title" content="Imported Flat" />
            <meta property="og:image" content="https://cdn.example.com/1.jpg" />
            <script type="application/ld+json">
              {
                "@type":"Residence",
                "description":"Imported from public listing page",
                "offers":{"price":"390000"},
                "image":["https://cdn.example.com/1.jpg","javascript:alert(1)","https://cdn.example.com/2.jpg"]
              }
            </script>
          </head><body></body></html>
        `,
      }),
    );

    const result = await importListingFromUrl(
      {
        listingUrl: "https://example.com/listing/1",
        providerHint: "auto",
      },
      { fetchFn },
    );

    expect(result.status).toBe("imported");
    expect(result.normalizedListingInput?.provider).toBe("import_url");
    expect(result.normalizedListingInput?.title).toBe("Imported Flat");
    expect(result.normalizedListingInput?.imageUrls).toEqual([
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg",
    ]);
    expect(result.warnings.join(" ")).toContain("unsupported protocol");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns partial result when only images are found", async () => {
    const fetchFn = vi.fn(async () =>
      mockResponse({
        body: `
          <html><body>
            <img srcset="/img-small.jpg 320w, /img-large.jpg 1280w" />
          </body></html>
        `,
      }),
    );

    const result = await importListingFromUrl(
      {
        listingUrl: "https://example.com/listing/2",
        providerHint: "generic",
      },
      { fetchFn },
    );

    expect(result.status).toBe("partial");
    expect(result.extracted.imageUrls).toEqual(["https://example.com/img-large.jpg"]);
    expect(result.fallbackMessage).toContain("Images imported");
  });

  it("returns blocked response when source blocks access", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ status: 403, body: "blocked" }));

    const result = await importListingFromUrl(
      {
        listingUrl: "https://example.com/listing/blocked",
        providerHint: "auto",
      },
      { fetchFn },
    );

    expect(result.status).toBe("blocked");
    expect(result.normalizedListingInput).toBeNull();
    expect(result.fallbackMessage).toContain("blocked or incomplete");
  });

  it("uses deterministic fallback for unsupported content type", async () => {
    const fetchFn = vi.fn(async () =>
      mockResponse({
        contentType: "application/json",
        body: "{}",
      }),
    );

    const result = await importListingFromUrl(
      {
        listingUrl: "https://example.com/listing/json",
        providerHint: "generic",
      },
      { fetchFn },
    );

    expect(result.status).toBe("failed");
    expect(result.warnings.join(" ")).toContain("Unsupported content type");
  });
});
