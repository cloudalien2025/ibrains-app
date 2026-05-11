import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import WalmartProductsClient from "@/app/apps/ecomviper/walmart/products/products-client";
import { walmartNavItems } from "@/lib/ecomviper/walmart/walmart-nav";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

function createProduct(overrides?: Partial<WalmartEffectiveProductRecord>): WalmartEffectiveProductRecord {
  return {
    id: "walmart_sku-30066-841",
    marketplace: "walmart",
    sku: "SKU 30066/841",
    externalItemId: "wm_sku-30066-841",
    title: "Walmart Product",
    brand: "Brand",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatusMessage: "Item Search returned no usable image.",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    issues: ["Image not provided by Walmart Item Search"],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-09T10:00:00.000Z",
    createdAt: "2026-05-09T10:00:00.000Z",
    updatedAt: "2026-05-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart products client UX", () => {
  it("removes redundant AI Optimizer sidebar nav entry", () => {
    expect(walmartNavItems.some((item) => item.label === "AI Optimizer")).toBe(false);
  });

  it("links SKU and title to the product editor route with encoded SKU", () => {
    const html = renderToStaticMarkup(<WalmartProductsClient products={[createProduct()]} />);

    expect(html).toContain('href="/apps/ecomviper/walmart/products/SKU%2030066%2F841"');
    expect(html).toContain(">SKU 30066/841<");
    expect(html).toContain(">Walmart Product<");
  });

  it("renders compact row actions control with key actions", () => {
    const html = renderToStaticMarkup(<WalmartProductsClient products={[createProduct()]} />);

    expect(html).toContain(">Actions<");
    expect(html).toContain(">Edit Product<");
    expect(html).toContain(">View Drafts<");
    expect(html).toContain(">Optimize with AI<");
    expect(html).toContain(">Sync<");
    expect(html).toContain(">Remove from EcomViper catalog<");
  });

  it("renders SKU sort control with accessible sort state", () => {
    const html = renderToStaticMarkup(<WalmartProductsClient products={[createProduct()]} />);

    expect(html).toContain("SKU ↕");
    expect(html).toContain('aria-sort="none"');
  });

  it("shows Item Search image issue copy for missing images", () => {
    const html = renderToStaticMarkup(<WalmartProductsClient products={[createProduct()]} />);

    expect(html).toContain("Item Search returned no usable image.");
    expect(html).toContain("Source: Walmart Item Search");
    expect(html).not.toContain("Missing image");
  });

  it("renders thumbnail image when primary image exists", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            imageUrl: "https://images.example.com/primary.jpg",
            imageSyncStatus: "found",
            imageSource: "walmart_item_report",
            issues: [],
          }),
        ]}
      />
    );

    expect(html).toContain('src="https://images.example.com/primary.jpg"');
    expect(html).toContain("Source: Walmart Item Report");
    expect(html).not.toContain(">N/A<");
  });

  it("renders Item Report safe not_found reason copy", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            imageSource: "walmart_item_report",
            imageStatusMessage: "Item Report row found, but no usable image URL was provided.",
            imageSyncStatus: "not_found",
          }),
        ]}
      />
    );

    expect(html).toContain("Item Report row found, but no usable image URL was provided.");
    expect(html).toContain("Source: Walmart Item Report");
  });

  it("renders Public Walmart listing SerpApi source and fallback status copy", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            imageStatusMessage: "",
            imageSyncStatus: "not_found",
            imageSource: "public_walmart_listing_serpapi",
            publicWalmartUrl:
              "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298",
          }),
        ]}
      />
    );

    expect(html).toContain("No safe public Walmart image match found.");
    expect(html).toContain("Source: Public Walmart listing via SerpApi");
    expect(html).toContain(">Resolve images<");
  });

  it("normalizes legacy generic SerpApi row error copy to provider-error wording", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            imageStatusMessage: "SerpApi returned an error response.",
            imageSyncStatus: "failed",
            imageSource: "public_walmart_listing_serpapi",
          }),
        ]}
      />
    );

    expect(html).toContain("SerpApi provider error.");
    expect(html).not.toContain("SerpApi returned an error response.");
  });

  it("renders sanitized SerpApi provider detail on row status", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            imageStatusMessage: "SerpApi provider error: upstream timeout api_key=[REDACTED]",
            imageSyncStatus: "failed",
            imageSource: "public_walmart_listing_serpapi",
          }),
        ]}
      />
    );

    expect(html).toContain("SerpApi provider error: upstream timeout api_key=[REDACTED]");
    expect(html).not.toContain("api_key=secret");
  });

  it("shows draft-aware brand value with pending draft indicator", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            brand: "OPA Nutrition",
            hasDraftChanges: true,
            liveBrand: "Unknown",
          }),
        ]}
      />
    );

    expect(html).toContain("OPA Nutrition");
    expect(html).toContain("Pending draft");
    expect(html).not.toContain(">Unknown<");
  });

  it("shows pending draft image context when draft image differs from live image", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            imageUrl: "https://images.example.com/draft-primary.jpg",
            imageSource: "public_walmart_listing_serpapi",
            imageSyncStatus: "found",
            hasDraftChanges: true,
            liveImageUrl: "",
          }),
        ]}
      />
    );

    expect(html).toContain('src="https://images.example.com/draft-primary.jpg"');
    expect(html).toContain("Source: Public Walmart listing via SerpApi");
    expect(html).toContain("Pending draft image");
  });

  it("shows draft-specific row action label when pending draft exists", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            hasDraftChanges: true,
          }),
        ]}
      />
    );

    expect(html).toContain(">View Draft<");
  });

  it("centers inventory header and renders unknown inventory placeholder", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[
          createProduct({
            inventoryStatus: "unknown",
          }),
        ]}
      />
    );

    expect(html).toContain("ecomviper-walmart-products-inventory-header");
    expect(html).toContain("text-center");
    expect(html).toContain(">—<");
  });

  it("renders safely when product row payload contains malformed runtime field types", () => {
    const malformedProduct = {
      ...createProduct(),
      price: "bad-number",
      issues: { code: "bad" },
      imageUrl: { href: "https://images.example.com/not-string.jpg" },
      imageStatusMessage: { detail: "bad" },
      liveImageUrl: 12345,
      liveGalleryImageUrls: "bad",
      galleryImageUrls: { url: "bad" },
      variantImageUrls: null,
      lastSyncedAt: { when: "bad" },
      brand: 22,
      title: null,
    } as unknown as WalmartEffectiveProductRecord;

    const html = renderToStaticMarkup(<WalmartProductsClient products={[malformedProduct]} />);

    expect(html).toContain("$0.00");
    expect(html).toContain(">None<");
    expect(html).toContain(">Item Search returned no usable image.<");
    expect(html).toContain(">22<");
    expect(html).toContain(">Untitled product<");
  });

  it("renders load error message provided by the server page", () => {
    const html = renderToStaticMarkup(
      <WalmartProductsClient
        products={[createProduct()]}
        loadError="Could not load draft overlays right now. Showing base imported products."
      />
    );

    expect(html).toContain("Could not load draft overlays right now. Showing base imported products.");
  });
});
