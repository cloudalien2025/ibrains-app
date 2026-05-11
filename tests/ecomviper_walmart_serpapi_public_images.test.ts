import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { replaceWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import {
  enrichProductImagesFromPublicWalmartListing,
  extractWalmartPublicProductIdFromUrl,
  fetchWalmartProductImagesViaSerpApi,
  normalizeSerpApiWalmartImages,
  serpApiWalmartImageInternals,
} from "@/lib/ecomviper/walmart/serpapi-walmart-images";
import { GET as getSerpApiRoute, POST as saveSerpApiRoute } from "@/app/api/ecomviper/walmart/connect/serpapi/route";
import { POST as testSerpApiRoute } from "@/app/api/ecomviper/walmart/connect/serpapi/test/route";
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

  it("SerpApi test route returns not_connected when no key is available", async () => {
    const resp = await testSerpApiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi/test", {
        method: "POST",
        body: JSON.stringify({ apiKey: "" }),
      })
    );
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.providerStatus).toBe("not_connected");
    expect(payload.providerStatusReason).toContain("SerpApi key missing");
  });

  it("SerpApi test route classifies invalid key safely", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid API key api_key=secret_should_hide" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    const resp = await testSerpApiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi/test", {
        method: "POST",
        body: JSON.stringify({ apiKey: "serpapi_invalid_123" }),
      })
    );
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.providerStatus).toBe("invalid_key");
    expect(payload.providerStatusReason).toBe("SerpApi key was rejected.");
    expect(JSON.stringify(payload)).not.toContain("serpapi_invalid_123");
    expect(JSON.stringify(payload)).not.toContain("secret_should_hide");
  });

  it("SerpApi test route classifies forbidden and rate-limited states", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "forbidden for this plan" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "out of searches" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      );

    const forbiddenResp = await testSerpApiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi/test", {
        method: "POST",
        body: JSON.stringify({ apiKey: "serpapi_forbidden_123" }),
      })
    );
    const forbiddenPayload = await forbiddenResp.json();
    expect(forbiddenPayload.providerStatus).toBe("forbidden");

    const rateResp = await testSerpApiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi/test", {
        method: "POST",
        body: JSON.stringify({ apiKey: "serpapi_rate_123" }),
      })
    );
    const ratePayload = await rateResp.json();
    expect(ratePayload.providerStatus).toBe("rate_limited");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("SerpApi test route returns connected with safe usage diagnostics", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total_searches_left: 112,
            this_month_usage: 18,
            plan_searches_per_month: 250,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            product_result: {
              title: "OPA Sleep Magnesium Gummies",
              image: "https://i5.walmartimages.com/asr/c-test.jpg",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const resp = await testSerpApiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi/test", {
        method: "POST",
        body: JSON.stringify({ apiKey: "serpapi_connected_123" }),
      })
    );
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.providerStatus).toBe("connected");
    expect(payload.statusCode).toBe(200);
    expect(payload.usage).toEqual({
      totalSearchesLeft: 112,
      thisMonthUsage: 18,
      planSearchesPerMonth: 250,
    });
    expect(JSON.stringify(payload)).not.toContain("serpapi_connected_123");
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

  it("maps bad-request provider messages with safe detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Unable to process request: product_id is required. api_key=secret_key_123" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "bad-request-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("validation_error");
    expect(result.errorCode).toBe("SERPAPI_BAD_REQUEST");
    expect(result.statusReason).toContain("SerpApi bad request:");
    expect(result.statusReason).toContain("product_id is required");
    expect(result.statusReason).not.toContain("secret_key_123");
  });

  it("maps 429 status responses to rate_limited", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "rate-limit-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("rate_limited");
    expect(result.errorCode).toBe("SERPAPI_RATE_LIMITED");
  });

  it("maps HTTP 400 missing-parameter errors to bad_request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "product_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "bad-request-http-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("validation_error");
    expect(result.errorCode).toBe("SERPAPI_BAD_REQUEST");
    expect(result.statusReason).toContain("SerpApi bad request");
  });

  it("maps 5xx status responses to provider_error with safe detail", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response("Upstream provider error api_key=leak_me", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "provider-error-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("provider_error");
    expect(result.errorCode).toBe("SERPAPI_PROVIDER_ERROR");
    expect(result.statusReason).toContain("SerpApi provider request failed");
    expect(result.statusReason).not.toContain("leak_me");
  });

  it("maps repeated ETIMEDOUT failures to network_error", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("connect ETIMEDOUT token=abc123"));

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "network-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("network_error");
    expect(result.errorCode).toBe("SERPAPI_NETWORK_ERROR");
    expect(result.statusReason).toContain("network error");
    expect(result.statusReason).not.toContain("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("maps malformed JSON responses to malformed_response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "malformed-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("malformed_response");
    expect(result.errorCode).toBe("SERPAPI_MALFORMED_RESPONSE");
  });

  it("uses safe detail for unknown provider errors instead of generic-only text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error:
            "Something odd happened in upstream provider module XYZ. request=https://serpapi.com/search.json?api_key=secret-key",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "unknown-provider-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("provider_error");
    expect(result.statusReason).toContain("SerpApi returned a provider error:");
    expect(result.statusReason).not.toContain("secret-key");
  });

  it("treats valid payload without image fields as not_found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          product_result: {
            title: "Product without media",
            brand: "Brandless",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchWalmartProductImagesViaSerpApi({
      apiKey: "no-image-key",
      productId: "18410702298",
    });

    expect(result.ok).toBe(false);
    expect(result.statusCategory).toBe("not_found");
    expect(result.errorCode).toBe("SERPAPI_NO_IMAGES_FOUND");
  });

  it("sanitizes api_key values from provider error detail", () => {
    const detail = serpApiWalmartImageInternals.sanitizeSerpApiErrorDetail(
      "Provider error request=https://serpapi.com/search.json?engine=walmart_product&api_key=secret_123"
    );

    expect(detail).toContain("api_key=[REDACTED]");
    expect(detail).not.toContain("secret_123");
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

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(url);
      if (parsed.searchParams.get("engine") === "walmart") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              organic_results: [
                {
                  product_id: "18410702298",
                  title: "OPA Sleep Magnesium Gummies",
                  brand: "OPA Sleep",
                  image: "https://i5.walmartimages.com/asr/18410702298-a.jpg",
                  images: [
                    "https://i5.walmartimages.com/asr/18410702298-a.jpg",
                    "https://i5.walmartimages.com/asr/18410702298-b.jpg",
                  ],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "walmart_product should not be required" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );
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

  it("uses Walmart search payload images by exact product ID without requiring walmart_product lookup", async () => {
    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi", {
      method: "POST",
      body: JSON.stringify({ apiKey: "serpapi_test_secret_123456" }),
    });
    await saveSerpApiRoute(saveReq);

    let calledWalmartProductEndpoint = false;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(url);
      if (parsed.searchParams.get("engine") === "walmart") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              organic_results: [
                {
                  product_id: "18410702298",
                  title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
                  brand: "OPA Sleep",
                  thumbnail: "https://i5.walmartimages.com/asr/18410702298-thumb.jpeg",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (parsed.searchParams.get("engine") === "walmart_product") {
        calledWalmartProductEndpoint = true;
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "walmart_product should not be called" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const result = await enrichProductImagesFromPublicWalmartListing({
      userId: "user_ibrains",
      product: {
        ...createProduct(),
        itemId: "18410702298",
      },
    });

    expect(result.imageSyncStatus).toBe("found");
    expect(result.imageMatchMethod).toBe("serpapi_product_id");
    expect(result.diagnostics.endpointFamily).toBe("walmart_search");
    expect(result.primaryImageUrl).toBe("https://i5.walmartimages.com/asr/18410702298-thumb.jpeg");
    expect(fetchMock).toHaveBeenCalled();
    expect(calledWalmartProductEndpoint).toBe(false);
  });

  it("falls back after walmart_product not-found provider error and still resolves image from search", async () => {
    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/serpapi", {
      method: "POST",
      body: JSON.stringify({ apiKey: "serpapi_test_secret_123456" }),
    });
    await saveSerpApiRoute(saveReq);

    const warnMock = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(url);
      const engine = parsed.searchParams.get("engine");
      const query = parsed.searchParams.get("query");

      if (engine === "walmart" && query === "18410702298") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              organic_results: [
                {
                  product_id: "18410702298",
                  title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
                  brand: "OPA Sleep",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      if (engine === "walmart_product") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: "The product has not found." }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      if (engine === "walmart") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              organic_results: [
                {
                  product_id: "18410702298",
                  title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
                  brand: "OPA Sleep",
                  image: "https://i5.walmartimages.com/asr/18410702298-found.jpeg",
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
        itemId: "18410702298",
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.imageSyncStatus).toBe("found");
    expect(result.imageMatchMethod).toBe("serpapi_search_title_brand");
    expect(result.primaryImageUrl).toBe("https://i5.walmartimages.com/asr/18410702298-found.jpeg");
    expect(warnMock).toHaveBeenCalledWith(
      "[ecomviper:walmart:serpapi] walmart_product identifier not found",
      expect.objectContaining({
        sku: "ROC808",
        identifierType: "product_record_item_id",
        identifierValue: "18410702298",
      })
    );
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
