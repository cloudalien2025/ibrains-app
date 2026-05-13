import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST as saveOpenAiRoute } from "@/app/api/ecomviper/walmart/connect/openai/route";
import { POST as generateImageRoute } from "@/app/api/ecomviper/walmart/ai/images/generate/route";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { replaceProducts } from "@/lib/ecomviper/walmart/walmart-store";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64");

function seedSupplementFactsProduct(overrides?: Record<string, unknown>) {
  const product = normalizeWalmartProduct({
    sku: "ROC822",
    title: "OPA Nutrition Ashwagandha + Black Pepper Capsules 60 Ct",
    brand: "OPA Nutrition",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 15,
    imageUrl: "https://cdn.shopify.com/roc822-back-label.jpg?v=1",
    description: "Ashwagandha and black pepper capsule formula for daily wellness support.",
    shortDescription: "Ashwagandha root extract plus black pepper fruit extract capsules.",
    bulletPoints: [
      "Ashwagandha root extract",
      "Black pepper fruit extract",
      "Capsule form",
      "60 count",
    ],
    attributes: {
      serving_size: "2 capsules",
      servings_per_container: "30",
      main_ingredients: "Ashwagandha root extract; Black pepper fruit extract",
      product_form: "Capsule",
      ...(overrides ?? {}),
    },
  });
  replaceProducts([product], new Date().toISOString());
}

describe("Supplement Facts reference-layout prompt fidelity", () => {
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

  it("prioritizes uploaded-reference layout instructions while preserving product facts", async () => {
    seedSupplementFactsProduct();

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
          data: [{ b64_json: fakePng.toString("base64") }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({
        sku: "ROC822",
        imageType: "supplement_facts",
        styleGuidance:
          "Create an image similar to the reference image with the patches on either side",
        referenceImages: [
          {
            source: "uploaded",
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAJUb6f4AAAAASUVORK5CYII=",
            label: "reference-layout-with-side-patches",
            mimeType: "image/png",
          },
        ],
      }),
    });

    const resp = await generateImageRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.generationDiagnostics?.imageType).toBe("supplement_facts");
    expect(payload.generationDiagnostics?.layoutMode).toBe("reference_layout");
    expect(payload.generationDiagnostics?.referenceCount).toBe(1);
    expect(payload.generationDiagnostics?.userGuidanceIncluded).toBe(true);
    expect(payload.generationDiagnostics?.layoutPreservationInstruction).toBe(true);
    expect(payload.generationDiagnostics?.productFactsSource).toBe("product_data");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(init.body).toBeInstanceOf(FormData);

    const prompt = String((init.body as FormData).get("prompt") ?? "");
    expect(prompt).toContain("Use the uploaded reference image as the primary visual layout reference.");
    expect(prompt).toContain("central supplement facts panel");
    expect(prompt).toContain("circular quality badges/patches");
    expect(prompt).toContain("left and right sides");
    expect(prompt).toContain("Use a clean square 1:1 white marketplace-ready canvas.");
    expect(prompt).toContain("Do not remove the side badges/patches if the reference includes them.");
    expect(prompt).toContain(
      "User style guidance (high priority): Create an image similar to the reference image with the patches on either side"
    );
    expect(prompt).toContain("Canonical product facts:");
    expect(prompt).toContain("Ashwagandha");
    expect(prompt).toContain("Black pepper");
    expect(prompt).toContain("exactly 1024x1024 output");
  });

  it("keeps fallback supplement-facts flow when uploaded references are absent", async () => {
    seedSupplementFactsProduct();

    await saveOpenAiRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/connect/openai", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test-openai-secret-abcdef" }),
      })
    );

    const fakePng = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("cdn.shopify.com/roc822-back-label.jpg")) {
        return Promise.resolve(
          new Response(fakePng, { status: 200, headers: { "Content-Type": "image/png" } })
        );
      }
      if (url === "https://api.openai.com/v1/images/edits") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [{ b64_json: fakePng.toString("base64") }] }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(new Response("unexpected", { status: 500 }));
    });

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({
        sku: "ROC822",
        imageType: "supplement_facts",
      }),
    });

    const resp = await generateImageRoute(req);
    const payload = await resp.json();

    expect(resp.status).toBe(200);
    expect(payload.generationDiagnostics?.imageType).toBe("supplement_facts");
    expect(payload.generationDiagnostics?.layoutMode).toBe("standard");
    expect(payload.generationDiagnostics?.layoutPreservationInstruction).toBe(false);
    expect(payload.generationDiagnostics?.referenceCount).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [, secondInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    const prompt = String((secondInit.body as FormData).get("prompt") ?? "");
    expect(prompt).not.toContain("uploaded reference image as the primary visual layout reference");
  });

  it("returns 401 when unauthenticated", async () => {
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign-in required" } },
        { status: 401 }
      ),
    });

    const req = new NextRequest("http://localhost/api/ecomviper/walmart/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({ sku: "ROC822", imageType: "supplement_facts" }),
    });

    const resp = await generateImageRoute(req);
    expect(resp.status).toBe(401);
  });
});
