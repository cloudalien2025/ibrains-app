import { describe, expect, it } from "vitest";
import {
  buildCurrentShopifyListingDocket,
  buildEditableShopifyDraft,
  type ShopifyCurrentListingDocket,
} from "@/lib/ecomviper/shopify/shopify-product-docket";
import {
  buildShopifyStep3DiffPreview,
  buildShopifyStep3PublishIntent,
  evaluateShopifyStep3PublishDryRun,
} from "@/lib/ecomviper/shopify/shopify-product-editor-publish-workflow";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

function createProductRecord(): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/770",
    storeDomain: "opanutrition.myshopify.com",
    title: "OPA Enzyme Balance",
    handle: "opa-enzyme-balance",
    vendor: "OPA Nutrition",
    productType: "Supplements",
    status: "ACTIVE",
    tags: ["digestive", "enzyme"],
    description: "Digestive enzyme blend for daily wellness support.",
    descriptionHtml: "<p>Digestive enzyme blend for daily wellness support.</p>",
    seoTitle: "OPA Enzyme Balance",
    seoDescription: "Digestive enzyme support for daily wellness.",
    metafields: [],
    onlineStoreUrl: "https://opanutrition.myshopify.com/products/opa-enzyme-balance",
    primaryImageUrl: "https://cdn.shopify.com/opa-main.jpg",
    galleryImageUrls: [
      "https://cdn.shopify.com/opa-secondary.jpg",
      "https://cdn.shopify.com/opa-main.jpg",
    ],
    galleryImages: [
      {
        id: "gid://shopify/Image/2",
        url: "https://cdn.shopify.com/opa-secondary.jpg",
        altText: null,
        width: 1200,
        height: 1200,
        source: "product",
        variantId: null,
      },
      {
        id: "gid://shopify/Image/1",
        url: "https://cdn.shopify.com/opa-main.jpg",
        altText: null,
        width: 1200,
        height: 1200,
        source: "product",
        variantId: null,
      },
    ],
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    variants: [],
  };
}

function createCurrentListing(): ShopifyCurrentListingDocket {
  return buildCurrentShopifyListingDocket(createProductRecord(), {
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    collections: ["Digestive Support"],
  });
}

describe("Shopify product editor publish workflow contract", () => {
  it("builds deterministic diff preview ordering and counts", () => {
    const current = createCurrentListing();
    const draft = buildEditableShopifyDraft(current, null);
    draft.title = "OPA Enzyme Balance Plus";
    draft.tagsText = "digestive, enzyme, wellness";
    draft.imageAltTextByImageId["gid://shopify/Image/2"] = "Secondary label image";
    draft.imageAltTextByImageId["gid://shopify/Image/1"] = "Primary bottle image";
    draft.collectionSuggestions = ["Digestive Support", "Wellness"];

    const diffPreview = buildShopifyStep3DiffPreview(current, draft, {
      generatedAt: "2026-05-18T00:00:00.000Z",
    });

    expect(diffPreview.generatedAt).toBe("2026-05-18T00:00:00.000Z");
    expect(diffPreview.totalChanges).toBe(5);
    expect(diffPreview.apiPushableChanges).toBe(4);
    expect(diffPreview.recommendationOnlyChanges).toBe(1);
    expect(diffPreview.changes.map((change) => change.field)).toEqual([
      "Title",
      "Tags",
      "Image alt text (gid://shopify/Image/1)",
      "Image alt text (gid://shopify/Image/2)",
      "Collection suggestions",
    ]);
  });

  it("blocks dry-run publish when confirmation gate is missing", () => {
    const current = createCurrentListing();
    const diffPreview = buildShopifyStep3DiffPreview(current, buildEditableShopifyDraft(current, null), {
      generatedAt: "2026-05-18T00:00:00.000Z",
    });
    const intent = buildShopifyStep3PublishIntent({
      current,
      diffPreview,
      confirmationAccepted: false,
      requestedAt: "2026-05-18T00:00:01.000Z",
    });

    const outcome = evaluateShopifyStep3PublishDryRun(intent);
    expect(outcome.status).toBe("blocked");
    expect(outcome.code).toBe("confirmation_required");
    expect(outcome.auditEvents.map((event) => event.code)).toEqual(["publish_blocked_confirmation_required"]);
  });

  it("remains non-mutating when confirmation is accepted", () => {
    const current = createCurrentListing();
    const draft = buildEditableShopifyDraft(current, null);
    draft.title = "OPA Enzyme Balance Plus";
    const diffPreview = buildShopifyStep3DiffPreview(current, draft, {
      generatedAt: "2026-05-18T00:00:00.000Z",
    });
    const intent = buildShopifyStep3PublishIntent({
      current,
      diffPreview,
      confirmationAccepted: true,
      requestedAt: "2026-05-18T00:00:02.000Z",
    });

    const outcome = evaluateShopifyStep3PublishDryRun(intent);
    expect(outcome.status).toBe("blocked");
    expect(outcome.code).toBe("publish_not_enabled");
    expect(outcome.auditEvents.map((event) => event.code)).toEqual([
      "publish_intent_confirmed_dry_run",
      "publish_blocked_not_enabled",
    ]);
  });
});
