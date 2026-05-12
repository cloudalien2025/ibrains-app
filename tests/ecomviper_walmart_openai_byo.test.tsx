import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import WalmartConnectPage from "@/app/apps/ecomviper/walmart/connect/page";
import { POST as saveOpenAiRoute, GET as getOpenAiStatusRoute } from "@/app/api/ecomviper/walmart/connect/openai/route";
import { POST as generateWalmartAiRoute } from "@/app/api/ecomviper/walmart/ai/generate/route";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import { replaceProducts } from "@/lib/ecomviper/walmart/walmart-store";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString("base64");

function seedProduct() {
  const product = normalizeWalmartProduct({
    sku: "OPA-OMEGA3-120",
    title: "OPA Nutrition Omega-3 Daily Wellness Softgels 120ct",
    brand: "OPA Nutrition",
    price: 39.99,
    inventoryQuantity: 42,
    imageUrl: "https://images.example.com/opa-omega3-120.jpg",
    attributes: { serving_size: "2 softgels" },
    description: "Daily wellness supplement.",
    shortDescription: "Daily wellness support",
    bulletPoints: ["Premium quality", "Daily routine support", "Made with quality ingredients"],
  });

  replaceProducts([product], new Date().toISOString());
}

describe("EcomViper Walmart OpenAI BYO flow", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_token_cache__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_connection_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_openai_connection_fallback__ = undefined;

    vi.restoreAllMocks();
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    delete process.env.WALMART_AI_DETERMINISTIC_MOCK;

    authMocks.requireSignedInUser.mockReset();
    authMocks.requireSignedInUser.mockResolvedValue({ userId: "user_ibrains", unauthorizedResponse: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.WALMART_AI_DETERMINISTIC_MOCK;
  });

  it("renders OpenAI API connection section in Walmart Connect tab", async () => {
    const html = renderToStaticMarkup(await WalmartConnectPage());

    expect(html).toContain("OpenAI API");
    expect(html).toContain("Save OpenAI Key");
    expect(html).toContain("Disconnect OpenAI");
  });

  it("saves OpenAI key without exposing raw key in status responses", async () => {
    const rawApiKey = "sk-test-openai-secret-123456";

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
      method: "POST",
      body: JSON.stringify({ apiKey: rawApiKey }),
    });
    const saveResp = await saveOpenAiRoute(saveReq);
    const savePayload = await saveResp.json();

    expect(saveResp.status).toBe(200);
    expect(savePayload.connected).toBe(true);
    expect(savePayload.maskedApiKey).not.toBe("Not configured");
    expect(savePayload.maskedApiKey.endsWith(rawApiKey.slice(-4))).toBe(true);
    expect(JSON.stringify(savePayload)).not.toContain(rawApiKey);

    const statusResp = await getOpenAiStatusRoute();
    const statusPayload = await statusResp.json();

    expect(statusResp.status).toBe(200);
    expect(statusPayload.connected).toBe(true);
    expect(statusPayload.maskedApiKey.endsWith(rawApiKey.slice(-4))).toBe(true);
    expect(JSON.stringify(statusPayload)).not.toContain(rawApiKey);
  });

  it("blocks generation when OpenAI key is disconnected", async () => {
    seedProduct();

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/generate", {
      method: "POST",
      body: JSON.stringify({ sku: "OPA-OMEGA3-120" }),
    });

    const resp = await generateWalmartAiRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(400);
    expect(payload.error?.code).toBe("OPENAI_NOT_CONNECTED");
    expect(payload.error?.message).toBe("Connect your OpenAI API key first to generate product content.");
  });

  it("allows generation to proceed when OpenAI key is connected", async () => {
    seedProduct();
    const rawApiKey = "sk-test-openai-secret-123456";

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
      method: "POST",
      body: JSON.stringify({ apiKey: rawApiKey }),
    });
    await saveOpenAiRoute(saveReq);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestedTitle: "OPA Nutrition Omega-3 Daily Wellness Softgels 120ct | Daily Wellness Support",
                  suggestedDescription:
                    "Premium daily wellness formula with compliant benefit framing for routine support.",
                  suggestedBullets: [
                    "Daily wellness support formula",
                    "Quality ingredients for routine use",
                    "Compliant listing language for marketplace safety",
                  ],
                  missingAttributes: ["ingredients_highlights"],
                  complianceWarnings: ["Avoid disease references"],
                  qualityScore: 86,
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/generate", {
      method: "POST",
      body: JSON.stringify({ sku: "OPA-OMEGA3-120" }),
    });

    const resp = await generateWalmartAiRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.suggestion?.sku).toBe("OPA-OMEGA3-120");
    expect(payload.suggestion?.suggestedTitle).toContain("Daily Wellness Support");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${rawApiKey}`);
  });

  it("keeps Walmart compliance guardrails when OpenAI output is unsafe", async () => {
    seedProduct();
    const rawApiKey = "sk-test-openai-secret-123456";

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
      method: "POST",
      body: JSON.stringify({ apiKey: rawApiKey }),
    });
    await saveOpenAiRoute(saveReq);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestedTitle: "Natural Viagra Cure for Erectile Dysfunction",
                  suggestedDescription: "This cures erectile dysfunction and treats hypertension fast.",
                  suggestedBullets: [
                    "Works like Cialis",
                    "Treats anxiety and depression",
                    "Guaranteed results",
                  ],
                  missingAttributes: [],
                  complianceWarnings: [],
                  qualityScore: 92,
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/generate", {
      method: "POST",
      body: JSON.stringify({ sku: "OPA-OMEGA3-120" }),
    });

    const resp = await generateWalmartAiRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.suggestion?.suggestedTitle.toLowerCase()).not.toContain("viagra");
    expect(payload.suggestion?.suggestedDescription.toLowerCase()).not.toContain("erectile dysfunction");
    expect(payload.suggestion?.complianceWarnings.some((entry: string) => entry.includes("Policy blocker removed"))).toBe(true);

    const compliance = evaluateWalmartListingCompliance({
      title: payload.suggestion?.suggestedTitle,
      longDescription: payload.suggestion?.suggestedDescription,
      bulletPoints: payload.suggestion?.suggestedBullets,
    });
    expect(compliance.valid).toBe(true);
  });

  it("returns 401 on OpenAI routes when unauthenticated", async () => {
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 }),
    });

    const saveReq = new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
      method: "POST",
      body: JSON.stringify({ apiKey: "sk-test" }),
    });
    const saveResp = await saveOpenAiRoute(saveReq);
    expect(saveResp.status).toBe(401);
  });
});
