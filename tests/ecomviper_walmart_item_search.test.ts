import { beforeEach, describe, expect, it, vi } from "vitest";
import { enrichWalmartImageFromItemSearch, walmartItemSearchInternals } from "@/lib/ecomviper/walmart/walmart-item-search";

function buildSearchResponse(items: unknown[], status = 200) {
  return new Response(JSON.stringify({ items }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Walmart Item Search image enrichment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts primary/gallery/variant images and normalizes URLs", async () => {
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
      "https://images.example.com/variant-a.jpg",
      "https://images.example.com/variant-b.jpg",
    ]);
    expect(result.variantImageUrls).toEqual([
      "https://images.example.com/variant-a.jpg",
      "https://images.example.com/variant-b.jpg",
    ]);
  });

  it("returns found for exact GTIN match", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSearchResponse([
        {
          itemId: "GTIN-ITEM",
          gtin: "000111222333",
          productName: "Daily Wellness Formula",
          brand: "BrandX",
          images: [{ url: "https://images.example.com/gtin.jpg" }],
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
        title: "Daily Wellness Formula",
        brand: "BrandX",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.matchMethod).toBe("gtin");
    expect(result.statusReason).toContain("Exact identifier match");
    expect(result.primaryImageUrl).toBe("https://images.example.com/gtin.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns found for exact UPC match", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSearchResponse([
        {
          itemId: "UPC-ITEM",
          upc: "111222333444",
          productName: "UPC Formula",
          brand: "BrandX",
          images: [{ url: "https://images.example.com/upc.jpg" }],
        },
      ])
    );

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "",
        upc: "111222333444",
        itemId: "",
        wpid: "",
        title: "UPC Formula",
        brand: "BrandX",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.matchMethod).toBe("upc");
    expect(result.primaryImageUrl).toBe("https://images.example.com/upc.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns found for exact itemId query fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(url);
      expect(parsed.searchParams.get("query")).toBe("WM-ITEM-123");
      return buildSearchResponse([
        {
          itemId: "WM-ITEM-123",
          productName: "Identifier Match Product",
          brand: "BrandY",
          images: [{ url: "https://images.example.com/itemid.jpg" }],
        },
      ]);
    });

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "",
        upc: "",
        itemId: "WM-ITEM-123",
        wpid: "",
        title: "Identifier Match Product",
        brand: "BrandY",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.matchMethod).toBe("itemId");
    expect(result.matchedItemId).toBe("WM-ITEM-123");
    expect(result.primaryImageUrl).toBe("https://images.example.com/itemid.jpg");
  });

  it("accepts strong title+brand query fallback with a single candidate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSearchResponse([
        {
          itemId: "QUERY-ITEM-1",
          productName: "Daily Wellness Formula with Vitamin C and Zinc",
          brand: "BrandX",
          images: [{ url: "https://images.example.com/query.jpg" }],
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
        title: "Daily Wellness Formula with Vitamin C and Zinc",
        brand: "BrandX",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.matchMethod).toBe("query");
    expect(result.statusReason).toContain("Strong title and brand match");
  });

  it("marks query fallback as ambiguous when candidates are close", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSearchResponse([
        {
          itemId: "AMB-1",
          productName: "Daily Wellness Formula with Vitamin C and Zinc 60ct",
          brand: "BrandX",
          images: [{ url: "https://images.example.com/amb-1.jpg" }],
        },
        {
          itemId: "AMB-2",
          productName: "Daily Wellness Formula with Vitamin C and Zinc - 60 count",
          brand: "BrandX",
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
        title: "Daily Wellness Formula with Vitamin C and Zinc",
        brand: "BrandX",
      },
    });

    expect(result.imageSyncStatus).toBe("ambiguous");
    expect(result.primaryImageUrl).toBe("");
    expect(result.statusReason).toBe("Multiple Walmart Item Search candidates matched this product.");
  });

  it("returns not_found when exact match has no usable image", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildSearchResponse([
        {
          itemId: "NO-IMG-1",
          gtin: "000111222333",
          productName: "No Image Product",
          brand: "BrandX",
          images: [],
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
        title: "No Image Product",
        brand: "BrandX",
      },
    });

    expect(result.imageSyncStatus).toBe("not_found");
    expect(result.primaryImageUrl).toBe("");
    expect(result.statusReason).toBe("Item Search returned no usable image.");
  });

  it("retries transient failures and succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(buildSearchResponse([], 503))
      .mockResolvedValueOnce(
        buildSearchResponse([
          {
            itemId: "RETRY-1",
            gtin: "123123123123",
            productName: "Retry Product",
            brand: "BrandZ",
            images: [{ url: "https://images.example.com/retry.jpg" }],
          },
        ])
      );

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "123123123123",
        upc: "",
        itemId: "",
        wpid: "",
        title: "Retry Product",
        brand: "BrandZ",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.diagnostics.attempts[0]?.transientRetries).toBe(1);
    expect(result.diagnostics.attempts[0]?.retryCount).toBe(1);
  });

  it("does not retry permanent auth/validation failures", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => buildSearchResponse([], 401));

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "",
        upc: "000111222333",
        itemId: "",
        wpid: "",
        title: "",
        brand: "",
      },
    });

    expect(result.imageSyncStatus).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.attempts[0]?.failureReason).toBe("http_non_retryable");
    expect(result.diagnostics.attempts[0]?.retryCount).toBe(0);
    expect(result.statusReason).toBe("Item Search request failed after retry.");
  });

  it("returns failed with safe reason after transient retries are exhausted", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => buildSearchResponse([], 503));

    const result = await enrichWalmartImageFromItemSearch({
      accessToken: "token",
      product: {
        gtin: "000111222333",
        upc: "",
        itemId: "",
        wpid: "",
        title: "",
        brand: "",
      },
    });

    expect(result.imageSyncStatus).toBe("failed");
    expect(result.statusReason).toBe("Item Search request failed after retry.");
    expect(result.diagnostics.attempts[0]?.failureReason).toBe("transient_http_exhausted");
    expect(result.diagnostics.attempts[0]?.retryCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
