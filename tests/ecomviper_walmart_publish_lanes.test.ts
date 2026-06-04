import { describe, expect, it } from "vitest";
import { buildWalmartPublishLanePreview } from "@/lib/ecomviper/walmart/walmart-publish-lanes";

function baseState() {
  return {
    sku: "ROC948",
    current: {
      title: "Original Title",
      shortDescription: "Original short",
      longDescription: "Original long",
      bulletPoints: ["A", "B"],
      brand: "OPA",
      imageUrl: "https://images.example.com/original.jpg",
      galleryImageUrls: ["https://images.example.com/original.jpg"],
      searchBrowseAttributes: { product_form: "Capsule" },
      attributes: { product_form: "Capsule" },
      price: 19.99,
      inventoryQuantity: 10,
      publicWalmartUrl: "https://www.walmart.com/ip/2791205430",
      publicWalmartProductId: "2791205430",
      gtin: "00011122233344",
      upc: "011122233344",
    },
    draft: {
      title: "Updated Title",
      shortDescription: "Updated short",
      longDescription: "Updated long",
      bulletPoints: ["A", "C"],
      brand: "OPA",
      imageUrl: "https://images.example.com/new.jpg",
      galleryImageUrls: [
        "https://images.example.com/new.jpg",
        "https://images.example.com/gallery-2.jpg",
      ],
      searchBrowseAttributes: { product_form: "Capsule", support_areas: "Mobility" },
      attributes: { product_form: "Capsule", support_areas: "Mobility" },
      price: 24.99,
      inventoryQuantity: 16,
      publicWalmartUrl: "https://www.walmart.com/ip/2791205430",
      publicWalmartProductId: "2791205430",
    },
    complianceViolations: [] as string[],
  };
}

describe("Walmart publish lane preview", () => {
  it("splits changed fields across content, price, inventory, and status lanes", () => {
    const preview = buildWalmartPublishLanePreview(baseState());

    expect(preview.status).toBe("preview_only_no_publish_route");
    expect(preview.lanes.content_item_lane.changed).toBe(true);
    expect(preview.lanes.price_lane.changed).toBe(true);
    expect(preview.lanes.inventory_lane.changed).toBe(true);
    expect(preview.lanes.status_lane.changed).toBe(true);
    expect(preview.lanes.content_item_lane.payload.feedType).toBe("MP_MAINTENANCE");
    expect(preview.lanes.price_lane.payload).toMatchObject({
      singleSkuUpdate: { endpoint: "/v3/price", sku: "ROC948", price: 24.99 },
    });
    expect(preview.lanes.inventory_lane.payload).toMatchObject({
      singleSkuUpdate: { endpoint: "/v3/inventory", sku: "ROC948", quantity: 16 },
    });
  });

  it("returns no-op status when no lane has any changed field", () => {
    const state = baseState();
    state.draft = {
      ...state.current,
      publicWalmartUrl: state.current.publicWalmartUrl ?? null,
      publicWalmartProductId: state.current.publicWalmartProductId ?? null,
    };
    const preview = buildWalmartPublishLanePreview(state);

    expect(preview.status).toBe("no_changes");
    expect(preview.validation.warnings).toContain(
      "No publishable changes detected; preview is no-op."
    );
    expect(preview.lanes.status_lane.payload).toMatchObject({
      submitMode: "preview_only",
      submitted: false,
    });
  });

  it("blocks preview when missing confirmed Walmart identifier/url", () => {
    const state = baseState();
    state.current.publicWalmartProductId = null;
    state.current.publicWalmartUrl = null;
    state.draft.publicWalmartProductId = null;
    state.draft.publicWalmartUrl = null;
    const preview = buildWalmartPublishLanePreview(state);

    expect(preview.validation.errors).toContain(
      "Publish requires a confirmed Walmart item ID or canonical public listing URL."
    );
  });

  it("treats GTIN/UPC as lookup-only identifiers and rejects publish IDs using them", () => {
    const state = baseState();
    state.draft.publicWalmartProductId = "011122233344";
    const preview = buildWalmartPublishLanePreview(state);

    expect(preview.validation.errors).toContain(
      "GTIN/UPC are lookup identifiers only and cannot be used as Walmart item IDs."
    );
  });

  it("blocks content lane preview when unsafe supplement claims are present", () => {
    const state = baseState();
    state.complianceViolations = [
      "Contains disease claim",
      "Missing the canonical FDA supplement disclaimer",
    ];
    const preview = buildWalmartPublishLanePreview(state);

    expect(preview.validation.errors).toContain(
      "Unsafe supplement claims/compliance violations must be resolved before content publish."
    );
  });

  it("preserves status lane error types and preview-only tracking scaffold", () => {
    const preview = buildWalmartPublishLanePreview(baseState());
    expect(preview.lanes.status_lane.payload).toMatchObject({
      confirmationRequired: true,
      feedId: null,
      submitMode: "preview_only",
    });
    expect(preview.lanes.status_lane.payload.supportedErrorTypes).toEqual([
      "DATA_ERROR",
      "SYSTEM_ERROR",
      "TIMEOUT_ERROR",
      "UNKNOWN_ERROR",
    ]);
  });
});
