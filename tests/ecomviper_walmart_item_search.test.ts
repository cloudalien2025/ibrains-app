import { beforeEach, describe, expect, it, vi } from "vitest";
import { enrichWalmartImageFromItemSearch, walmartItemSearchInternals } from "@/lib/ecomviper/walmart/walmart-item-search";

function buildSearchResponse(items: unknown[]) {
  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Walmart Item Search image enrichment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses primary/gallery/variant images and normalizes URLs to HTTPS with dedupe", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSearchResponse([
        {
          itemId: "12345",
          gtin: "000111222333",
          productName: "Sample Product",
          brand: "Brand",
          images: [
            { url: " http://images.example.com/a.jpg " },
            { imageUrl: "https://images.example.com/a.jpg" },
            { url: "https://images.example.com/b.jpg" },
          ],
          properties: {
            variants: {
              variantData: [
                { productImageUrl: "http://images.example.com/variant-a.jpg" },
                { productImageUrl: "https://images.example.com/variant-b.jpg" },
              ],
            },
          },
        },
      ])
    );

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "000111222333",
        upc: "",
        itemId: "",
        wpid: "",
        title: "Sample Product",
        brand: "Brand",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.matchMethod).toBe("gtin");
    expect(result.primaryImageUrl).toBe("https://images.example.com/a.jpg");
    expect(result.galleryImageUrls).toEqual([
      "https://images.example.com/a.jpg",
      "https://images.example.com/b.jpg",
    ]);
    expect(result.variantImageUrls).toEqual([
      "https://images.example.com/variant-a.jpg",
      "https://images.example.com/variant-b.jpg",
    ]);
  });

  it("prioritizes GTIN search over UPC/query fallback", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("gtin=000111222333")) {
        return buildSearchResponse([
          {
            itemId: "GTIN-ITEM",
            gtin: "000111222333",
            productName: "Match by GTIN",
            brand: "Brand",
            images: [{ url: "https://images.example.com/gtin.jpg" }],
          },
        ]);
      }
      if (url.includes("upc=999888777666")) {
        return buildSearchResponse([
          {
            itemId: "UPC-ITEM",
            upc: "999888777666",
            productName: "Match by UPC",
            brand: "Brand",
            images: [{ url: "https://images.example.com/upc.jpg" }],
          },
        ]);
      }
      return buildSearchResponse([]);
    });

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "000111222333",
        upc: "999888777666",
        itemId: "",
        wpid: "",
        title: "Fallback Product",
        brand: "Brand",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.matchMethod).toBe("gtin");
    expect(result.primaryImageUrl).toBe("https://images.example.com/gtin.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to query search when identifier search is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("/v3/items/walmart/search")) {
        const query = parsed.searchParams.get("query") ?? "";
        if (query === "Daily Wellness Formula BrandX") {
          return buildSearchResponse([
            {
              itemId: "QUERY-ITEM",
              productName: "Daily Wellness Formula",
              brand: "BrandX",
              images: [{ url: "https://images.example.com/query.jpg" }],
            },
          ]);
        }
      }

      return buildSearchResponse([]);
    });

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "",
        upc: "",
        itemId: "",
        wpid: "",
        title: "Daily Wellness Formula",
        brand: "BrandX",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.matchMethod).toBe("query");
    expect(result.primaryImageUrl).toBe("https://images.example.com/query.jpg");
  });

  it("marks ambiguous matches when confidence is low", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSearchResponse([
        {
          itemId: "AMB-1",
          productName: "Supplement One",
          brand: "BrandA",
          images: [{ url: "https://images.example.com/amb-1.jpg" }],
        },
        {
          itemId: "AMB-2",
          productName: "Supplement Two",
          brand: "BrandB",
          images: [{ url: "https://images.example.com/amb-2.jpg" }],
        },
      ])
    );

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "",
        upc: "",
        itemId: "",
        wpid: "",
        title: "Unknown",
        brand: "NoBrand",
      },
    });

    expect(result.imageSyncStatus).toBe("ambiguous");
    expect(result.primaryImageUrl).toBe("");
  });

  it("returns not_found when Item Search has no matching images", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(buildSearchResponse([]));

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "",
        upc: "999888777666",
        itemId: "",
        wpid: "",
        title: "",
        brand: "",
      },
    });

    expect(result.imageSyncStatus).toBe("not_found");
    expect(result.primaryImageUrl).toBe("");
    expect(result.diagnostics.attempts.length).toBe(1);
  });

  it("exposes URL normalization helpers for regression coverage", () => {
    expect(walmartItemSearchInternals.normalizeImageUrl("http://images.example.com/a.jpg")).toBe(
      "https://images.example.com/a.jpg"
    );
    expect(
      walmartItemSearchInternals.dedupeUrls([
        "https://images.example.com/a.jpg",
        "http://images.example.com/a.jpg",
        "not-a-url",
      ])
    ).toEqual(["https://images.example.com/a.jpg"]);
  });
});
