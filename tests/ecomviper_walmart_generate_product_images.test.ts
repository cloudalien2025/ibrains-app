import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST as saveOpenAiRoute } from "@/app/api/ecomviper/walmart/connect/openai/route";
import { POST as generateImageRoute } from "@/app/api/ecomviper/walmart/ai/images/generate/route";
import { GET as getGeneratedMediaRoute } from "@/app/api/ecomviper/walmart/generated-media/[assetId]/route";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { replaceProducts } from "@/lib/ecomviper/walmart/walmart-store";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64");

function seedProduct(overrides?: Record<string, unknown>) {
  const product = normalizeWalmartProduct({
    sku: "ROC949",
    title: "OPA Nutrition Magnesium Glycinate Gummies 60 Ct",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 23,
    imageUrl: "https://cdn.shopify.com/roc949-main.jpg?v=1",
    description: "Calming mineral complex with grape flavor gummies.",
    shortDescription: "Magnesium glycinate gummies for daily relaxation support.",
    bulletPoints: [
      "Magnesium glycinate",
      "Grape flavored gummies",
      "One gummy daily",
      "60 count",
    ],
    attributes: {
      serving_size: "1 gummy",
      main_ingredients: "Magnesium glycinate",
      flavor: "Grape",
      ...(overrides ?? {}),
    },
  });
  replaceProducts([product], new Date().toISOString());
}

describe("EcomViper Walmart generated product images", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_openai_connection_fallback__ =
      undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_generated_media_fallback__ =
      undefined;

    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    authMocks.requireSignedInUser.mockReset();
    authMocks.requireSignedInUser.mockResolvedValue({
      userId: "user_ibrains",
      unauthorizedResponse: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
  });

  it("returns setup error when OpenAI key is missing", async () => {
    seedProduct();

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({
        sku: "ROC949",
        imageType: "lifestyle",
      }),
    });

    const resp = await generateImageRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(400);
    expect(payload.error?.code).toBe("OPENAI_NOT_CONNECTED");
    expect(payload.error?.message).toContain("Connect your OpenAI API key first");
  });

  it("generates lifestyle image with product-aware prompt and serves durable URL", async () => {
    seedProduct();

    await saveOpenAiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test-openai-secret-abcdef" }),
      })
    );

    const fakePng = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              b64_json: fakePng.toString("base64"),
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({
        sku: "ROC949",
        imageType: "lifestyle",
        styleGuidance: "bedside table evening scene",
        quantity: 1,
      }),
    });

    const resp = await generateImageRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.generated)).toBe(true);
    expect(payload.generated?.length).toBe(1);
    expect(payload.generated?.[0]?.source).toBe("openai_generated");
    expect(payload.generated?.[0]?.imageType).toBe("lifestyle");
    expect(payload.generated?.[0]?.approved).toBe(false);
    expect(String(payload.generated?.[0]?.url)).toContain(
      "/api/ecomviper/walmart/generated-media/"
    );
    expect(JSON.stringify(payload)).not.toContain("sk-test-openai-secret-abcdef");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    const body = JSON.parse(String(init.body)) as {
      prompt?: string;
      model?: string;
      size?: string;
      n?: number;
      response_format?: string;
      image?: unknown;
      mask?: unknown;
    };
    expect(body.model).toBeTruthy();
    expect(body.size).toBe("1024x1024");
    expect(body.n).toBe(1);
    expect(body.response_format).toBeUndefined();
    expect(body.image).toBeUndefined();
    expect(body.mask).toBeUndefined();
    expect(body.prompt).toContain("Task: Generate one Lifestyle image");
    expect(body.prompt).toContain("Title: OPA Nutrition Magnesium Glycinate Gummies 60 Ct");
    expect(body.prompt).toContain("Brand: OPA Nutrition");
    expect(body.prompt).toContain("User style guidance: bedside table evening scene");

    const assetUrl = String(payload.generated?.[0]?.url);
    const assetId = assetUrl.split("/").pop() ?? "";
    expect(assetId).toBeTruthy();

    const mediaResp = await getGeneratedMediaRoute(
      new NextRequest(`http://localhost/api/ecomviper/walmart/generated-media/${assetId}`, {
        method: "GET",
      }),
      { params: Promise.resolve({ assetId }) }
    );
    expect(mediaResp.status).toBe(200);
    expect(mediaResp.headers.get("content-type")).toContain("image/");
    const bytes = new Uint8Array(await mediaResp.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("degrades safely when supplement facts inputs are insufficient", async () => {
    seedProduct({
      serving_size: "",
      main_ingredients: "",
      flavor: "",
    });

    await saveOpenAiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test-openai-secret-abcdef" }),
      })
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({
        sku: "ROC949",
        imageType: "supplement_facts",
      }),
    });

    const resp = await generateImageRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(400);
    expect(payload.error?.code).toBe("INSUFFICIENT_SUPPLEMENT_FACTS");
    expect(payload.error?.message).toContain("Supplement facts generation needs");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns actionable sanitized error for OpenAI 400 invalid request", async () => {
    seedProduct();

    await saveOpenAiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test-openai-secret-abcdef" }),
      })
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Unsupported parameter: 'response_format'.",
            type: "invalid_request_error",
            param: "response_format",
            code: "unsupported_parameter",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({
        sku: "ROC949",
        imageType: "lifestyle",
      }),
    });

    const resp = await generateImageRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(400);
    expect(payload.error?.code).toBe("OPENAI_UNSUPPORTED_PARAMETER");
    expect(payload.error?.category).toBe("invalid_request");
    expect(payload.error?.statusCode).toBe(400);
    expect(payload.error?.message).toContain("unsupported response format parameter");
    expect(payload.error?.recommendation).toContain("Retry with default generation settings");
    expect(payload.error?.provider?.param).toBe("response_format");
    expect(payload.error?.requestDiagnostics?.promptLength).toBeTypeOf("number");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(payload)).not.toContain("sk-test-openai-secret-abcdef");
  });

  it("returns 401 on image generation route when unauthenticated", async () => {
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign-in required" } },
        { status: 401 }
      ),
    });

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({ sku: "ROC949", imageType: "lifestyle" }),
    });
    const resp = await generateImageRoute(req);

    expect(resp.status).toBe(401);
  });
});
