import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { replaceWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import {
  enrichProductImagesFromPublicWalmartListing,
  extractWalmartPublicProductIdFromUrl,
  fetchWalmartProductImagesViaSerpApi,
  normalizeSerpApiWalmartImages,
} from "@/lib/ecomviper/walmart/serpapi-walmart-images";
import { GET as getSerpApiRoute, POST as saveSerpApiRoute } from "@/app/api/ecomviper/walmart/connect/serpapi/route";
import { POST as resolvePublicImageRoute } from "@/app/api/ecomviper/walmart/products/[sku]/images/resolve/route";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString("base64");

function createProduct() {
  return normalizeWalmartProduct({
    sku: "ROC808",
    title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
    brand: "OPA Sleep",
    price: 19.99,
    inventoryQuantity: 7,
    inventoryStatus: "known",
    imageUrl: "",
    upc: "123456789012",
    shortDescription: "Short description",
    description: "Long description",
    bulletPoints: ["Bullet one"],
    attributes: { form: "gummy" },
  });
}

describe("Walmart SerpApi public listing images", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    authMocks.requireSignedInUser.mockReset();
    authMocks.requireSignedInUser.mockResolvedValue({ userId: "user_ibrains", unauthorizedResponse: null });

    (globalThis as Record<string, unknown>).__ecomviper_walmart_serpapi_connection_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
  });

  it("saves BYO SerpApi key and masks key in status responses", async () => {
    const rawApiKey = "serpapi_test_secret_123456";

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi", {
      method: "POST",
      body: JSON.stringify({ apiKey: rawApiKey }),
    });
    const saveResp = await saveSerpApiRoute(saveReq);
    const savePayload = await saveResp.json();

    expect(saveResp.status).toBe(200);
    expect(savePayload.connected).toBe(true);
    expect(savePayload.maskedApiKey.endsWith(rawApiKey.slice(-4))).toBe(true);
    expect(JSON.stringify(savePayload)).not.toContain(rawApiKey);

    const statusResp = await getSerpApiRoute();
    const statusPayload = await statusResp.json();

    expect(statusResp.status).toBe(200);
    expect(statusPayload.connected).toBe(true);
    expect(statusPayload.maskedApiKey.endsWith(rawApiKey.slice(-4))).toBe(true);
    expect(JSON.stringify(statusPayload)).not.toContain(rawApiKey);
  });

  it("extracts Walmart public product ID from supported URL formats", () => {
    expect(
      extractWalmartPublicProductIdFromUrl(
        "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298"
      )
    ).toBe("18410702298");

    expect(extractWalmartPublicProductIdFromUrl("https://www.walmart.com/ip/18410702298")).toBe(
      "18410702298"
    );

    expect(
      extractWalmartPublicProductIdFromUrl(
        "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298?athbdg=L1600"
      )
    ).toBe("18410702298");

    expect(extractWalmartPublicProductIdFromUrl("https://example.com/ip/18410702298")).toBeNull();
  });

  it("normalizes SerpApi image payloads to HTTPS deduplicated gallery URLs", () => {
    const normalized = normalizeSerpApiWalmartImages({
      product_result: {
        image: "http://i5.walmartimages.com/asr/primary.jpeg?odnHeight=200",
        images: [
          "https://i5.walmartimages.com/asr/primary.jpeg?odnHeight=200",
          "https://i5.walmartimages.com/asr/primary.jpeg?utm_source=test",
          "https://cdn.example.com/img-two.jpg",
        ],
      },
      thumbnails: [
        "https://i5.walmartimages.com/asr/thumb-one.jpeg",
        "https://i5.walmartimages.com/asr/thumb-one.jpeg?tracking=1",
      ],
    });

    expect(normalized.primaryImageUrl.startsWith("https://")).toBe(true);
    expect(normalized.galleryImageUrls.length).toBeGreaterThan(0);
    expect(new Set(normalized.galleryImageUrls).size).toBe(normalized.galleryImageUrls.length);
    expect(normalized.galleryImageUrls.every((url) => url.startsWith("https://"))).toBe(true);
  });

  it("calls SerpApi Walmart Product API with engine and product_id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            product_result: {
              title: "OPA Sleep Magnesium Gummies",
              images: [
                "https://i5.walmartimages.com/asr/a.jpg",
                "https://i5.walmartimages.com/asr/b.jpg",
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "serpapi-test-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(true);
    expect(result.primaryImageUrl).toContain("https://");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://serpapi.com/search.json");
    expect(parsed.searchParams.get("engine")).toBe("walmart_product");
    expect(parsed.searchParams.get("product_id")).toBe("18410702298");
  });

  it("categorizes SerpApi 401 as invalid_key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "bad_key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("invalid_key");
    expect(result.errorCode).toBe("SERPAPI_INVALID_KEY");
    expect(result.statusReason).toBe("SerpApi key was rejected.");
  });

  it("categorizes SerpApi 403 as forbidden", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "forbidden_key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("forbidden");
    expect(result.errorCode).toBe("SERPAPI_FORBIDDEN");
    expect(result.statusReason).toBe("SerpApi account does not have permission.");
  });

  it("maps SerpApi provider quota errors to rate_limited", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "You have run out of searches for this account." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "quota_key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("rate_limited");
    expect(result.errorCode).toBe("SERPAPI_RATE_LIMITED");
    expect(result.statusReason).toBe("SerpApi account has no remaining searches.");
  });

  it("maps SerpApi plan restriction errors to forbidden", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Walmart API is not available on your current plan. Please upgrade." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "plan_key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("forbidden");
    expect(result.errorCode).toBe("SERPAPI_FORBIDDEN");
    expect(result.statusReason).toBe("SerpApi account does not include Walmart API access.");
  });

  it("retries transient SerpApi timeout before succeeding", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("The operation was aborted.", "AbortError"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            product_result: {
              title: "OPA Sleep Magnesium Gummies",
              images: ["https://i5.walmartimages.com/asr/retry-success.jpg"],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "retry_key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(true);
    expect(result.primaryImageUrl).toContain("retry-success.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resolves images via route using URL product ID and returns source metadata", async () => {
    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi", {
      method: "POST",
      body: JSON.stringify({ apiKey: "serpapi_test_secret_123456" }),
    });
    await saveSerpApiRoute(saveReq);

    await replaceWalmartProductsForUser({
      userId: "user_ibrains",
      products: [createProduct()],
      importedAt: new Date().toISOString(),
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            product_result: {
              title: "OPA Sleep Magnesium Gummies",
              brand: "OPA Sleep",
              images: [
                "https://i5.walmartimages.com/asr/18410702298-a.jpg",
                "https://i5.walmartimages.com/asr/18410702298-b.jpg",
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const response = await resolvePublicImageRoute(
      new NextRequest(
        "http://localhost/api/ecomviper/walmart/products/ROC808/images/resolve",
        {
          method: "POST",
          body: JSON.stringify({
            publicWalmartUrl:
              "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298",
          }),
        }
      ),
      { params: Promise.resolve({ sku: "ROC808" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.resolved.imageSource).toBe("public_walmart_listing_serpapi");
    expect(payload.resolved.imageMatchMethod).toBe("public_url_product_id");
    expect(payload.resolved.publicWalmartProductId).toBe("18410702298");
    expect(payload.resolved.galleryImageUrls.length).toBeGreaterThan(0);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("serpapi.com/search.json");
  });

  it("returns connect-required error when SerpApi key is missing", async () => {
    await replaceWalmartProductsForUser({
      userId: "user_ibrains",
      products: [createProduct()],
      importedAt: new Date().toISOString(),
    });

    const response = await resolvePublicImageRoute(
      new NextRequest(
        "http://localhost/api/ecomviper/walmart/products/ROC808/images/resolve",
        {
          method: "POST",
          body: JSON.stringify({
            publicWalmartUrl:
              "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298",
          }),
        }
      ),
      { params: Promise.resolve({ sku: "ROC808" }) }
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("SERPAPI_NOT_CONNECTED");
  });

  it("marks weak title-only fallback as ambiguous", async () => {
    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi", {
      method: "POST",
      body: JSON.stringify({ apiKey: "serpapi_test_secret_123456" }),
    });
    await saveSerpApiRoute(saveReq);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(url);

      if (parsed.searchParams.get("engine") === "walmart_product") {
        return Promise.resolve(new Response(JSON.stringify({ product_result: {} }), { status: 200 }));
      }

      if (parsed.searchParams.get("engine") === "walmart") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              organic_results: [
                {
                  product_id: "18410702298",
                  title: "OPA Sleep Magnesium Gummies for Relaxation",
                  brand: "OPA Sleep",
                  image: "https://i5.walmartimages.com/asr/c1.jpg",
                },
                {
                  product_id: "18410709999",
                  title: "OPA Sleep Magnesium Gummies Relaxation Formula",
                  brand: "OPA Sleep",
                  image: "https://i5.walmartimages.com/asr/c2.jpg",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(new Response(JSON.stringify({}), { status: 500 }));
    });

    const result = await enrichProductImagesFromPublicWalmartListing({
      userId: "user_ibrains",
      product: {
        ...createProduct(),
        upc: "",
        gtin: "",
        itemId: "",
        externalItemId: "wm_roc808",
      },
      publicWalmartUrl: "",
    });

    expect(result.imageSyncStatus).toBe("ambiguous");
    expect(result.errorCode).toBe("SERPAPI_AMBIGUOUS_MATCH");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("returns 401 on SerpApi routes when unauthenticated", async () => {
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign-in required" } },
        { status: 401 }
      ),
    });

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi", {
      method: "POST",
      body: JSON.stringify({ apiKey: "serpapi-test" }),
    });
    const saveResp = await saveSerpApiRoute(saveReq);
    expect(saveResp.status).toBe(401);
  });
});
