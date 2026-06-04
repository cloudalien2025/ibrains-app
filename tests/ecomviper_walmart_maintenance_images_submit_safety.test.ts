import { describe, expect, it } from "vitest";
import { buildMaintenancePayload } from "@/lib/ecomviper/walmart/walmart-maintenance";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct() {
  return normalizeWalmartProduct({
    sku: "ROC808",
    title: "OPA Sleep Magnesium Gummies",
    brand: "OPA Sleep",
    price: 29.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    imageUrl: "",
    shortDescription: "Short",
    description: "Long",
    bulletPoints: ["Bullet 1"],
    attributes: { form: "gummy" },
  });
}

function createDraft(overrides?: Partial<Record<string, unknown>>): WalmartDraftRecord {
  return {
    id: "ev_draft_1",
    productId: "walmart_roc808",
    marketplace: "walmart",
    sku: "ROC808",
    productTitle: "OPA Sleep Magnesium Gummies",
    draftPayload: {
      title: "OPA Sleep Magnesium Gummies",
      shortDescription: "Short",
      longDescription: "Long",
      bulletPoints: ["Bullet 1"],
      price: 29.99,
      inventoryQuantity: 9,
      attributes: { form: "gummy" },
      ...overrides,
    },
    changeSummary: "staged",
    createdBy: "tester",
    status: "validated",
    validationResult: {
      valid: true,
      warnings: [],
      suggestions: [],
    },
    publishStatus: "pending",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
  };
}

describe("Walmart maintenance payload image submit safety", () => {
  it("omits blank image fields from outbound updates", () => {
    const product = createProduct();
    const draft = createDraft({ imageUrl: "", additionalImageUrls: [] });

    const payload = buildMaintenancePayload({ draft, product });
    const updates = payload.updates as Record<string, unknown>;

    expect(updates.imageUrl).toBeUndefined();
    expect(updates.additionalImageUrls).toBeUndefined();
  });

  it("includes explicit draft images after Use Images in Draft", () => {
    const product = createProduct();
    const draft = createDraft({
      imageUrl: "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
      additionalImageUrls: [
        "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
        "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
      ],
      imageSource: "public_walmart_listing_serpapi",
    });

    const payload = buildMaintenancePayload({ draft, product });
    const updates = payload.updates as Record<string, unknown>;

    expect(updates.imageUrl).toBe("https://i5.walmartimages.com/asr/18410702298-primary.jpeg");
    expect(updates.additionalImageUrls).toEqual([
      "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
    ]);
  });

  it("keeps approved OpenAI-generated image URLs in outbound updates", () => {
    const product = createProduct();
    const generatedImageUrl =
      "https://app.ibrains.ai/api/ecomviper/walmart/generated-media/ev_wm_img_123";
    const draft = createDraft({
      imageUrl: "https://images.example.com/manual-primary.jpg",
      additionalImageUrls: [generatedImageUrl],
      imageSource: "openai_generated",
      generatedMediaAssets: [
        {
          id: "ev_wm_img_123",
          url: generatedImageUrl,
          source: "openai_generated",
          imageType: "lifestyle",
          createdAt: "2026-05-10T00:00:00.000Z",
          approved: true,
        },
      ],
    });

    const payload = buildMaintenancePayload({ draft, product });
    const updates = payload.updates as Record<string, unknown>;

    expect(updates.imageUrl).toBe("https://images.example.com/manual-primary.jpg");
    expect(updates.additionalImageUrls).toEqual([generatedImageUrl]);
  });

  it("keeps existing non-empty product image when draft does not override image fields", () => {
    const product = createProduct();
    product.imageUrl = "https://images.example.com/current.jpg";

    const draft = createDraft();
    const payload = buildMaintenancePayload({ draft, product });
    const updates = payload.updates as Record<string, unknown>;

    expect(updates.imageUrl).toBe("https://images.example.com/current.jpg");
  });

  it("omits blank or needs-confirmation attributes to avoid blank overwrites", () => {
    const product = createProduct();
    const draft = createDraft({
      attributes: {
        age_group: "",
        product_form: "Capsule",
      },
      searchBrowseAttributes: {
        support_areas: "needs product label confirmation",
        target_audience: "Adults",
      },
    });

    const payload = buildMaintenancePayload({ draft, product });
    const updates = payload.updates as Record<string, unknown>;
    const attributes = (updates.attributes ?? {}) as Record<string, string>;

    expect(attributes.age_group).toBeUndefined();
    expect(attributes.support_areas).toBeUndefined();
    expect(attributes.product_form).toBe("Capsule");
    expect(attributes.target_audience).toBe("Adults");
  });
});
