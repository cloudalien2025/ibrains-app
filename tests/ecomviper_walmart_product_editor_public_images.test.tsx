// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc808",
    marketplace: "walmart",
    sku: "ROC808",
    externalItemId: "wm_roc808",
    title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
    brand: "OPA Sleep",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 11,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Item Search returned no usable image.",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    issues: ["Image not provided by Walmart Item Search"],
    attributes: { form: "gummy" },
    shortDescription: "Current short description",
    longDescription: "Current long description",
    bulletPoints: ["Current bullet one", "Current bullet two", "Current bullet three"],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function flush() {
  return act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Walmart product editor public listing image flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("shows connect prompt for public listing images when SerpApi is not connected", async () => {
    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Public Walmart Listing Images");
    expect(container.textContent).toContain("Images missing");
    expect(container.textContent).toContain(
      "EcomViper could not find images through Walmart Marketplace APIs."
    );
    expect(container.textContent).toContain(
      "SerpApi key missing. Connect SerpApi to enable automated public Walmart image enrichment."
    );
  });

  it("finds public listing images, requires explicit Use Images in Draft, and saves draft fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/images/resolve")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              sku: "ROC808",
              resolved: {
                imageSyncStatus: "found",
                imageSource: "public_walmart_listing_serpapi",
                imageSourceLabel: "Public Walmart listing via SerpApi",
                imageMatchMethod: "public_url_product_id",
                publicWalmartUrl:
                  "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298",
                publicWalmartProductId: "18410702298",
                primaryImageUrl: "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
                galleryImageUrls: [
                  "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
                  "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
                ],
                variantImageUrls: [],
                imageCount: 2,
                imageSyncReason: "Public Walmart listing images found via SerpApi.",
                lastImageSyncedAt: "2026-05-10T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      if (url.includes("/api/ecomviper/walmart/drafts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              draft: {
                updatedAt: "2026-05-10T00:00:00.000Z",
                validationResult: {
                  valid: true,
                  violations: [],
                  warnings: [],
                  suggestions: [],
                },
              },
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }
          )
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const urlInput = container.querySelector(
      'input[placeholder="https://www.walmart.com/ip/.../18410702298"]'
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(
        urlInput,
        "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298"
      );
    });

    const findButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Find Images from Public Walmart Listing"
    ) as HTMLButtonElement;

    await act(async () => {
      findButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Public Walmart listing via SerpApi");
    expect(container.textContent).toContain("Public product ID: 18410702298");

    const useButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Use Images in Draft"
    ) as HTMLButtonElement;

    await act(async () => {
      useButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Images added to draft. Save Draft before submitting.");
    expect(container.textContent).not.toContain("Images missing");

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement;

    await act(async () => {
      saveDraftButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [resolveUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(resolveUrl).toBe("/api/ecomviper/walmart/products/ROC808/images/resolve");

    const [saveUrl, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(saveUrl).toBe("/api/ecomviper/walmart/drafts");

    const saveBody = JSON.parse(String(saveInit.body)) as {
      sku: string;
      draftPayload: Record<string, unknown>;
    };
    expect(saveBody.sku).toBe("ROC808");
    expect(saveBody.draftPayload.imageUrl).toBe(
      "https://i5.walmartimages.com/asr/18410702298-primary.jpeg"
    );
    expect(saveBody.draftPayload.primaryImageUrl).toBe(
      "https://i5.walmartimages.com/asr/18410702298-primary.jpeg"
    );
    expect(saveBody.draftPayload.additionalImageUrls).toEqual([
      "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
    ]);
    expect(saveBody.draftPayload.galleryImageUrls).toEqual([
      "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
      "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
    ]);
    expect(saveBody.draftPayload.imageSource).toBe("public_walmart_listing_serpapi");
    expect(saveBody.draftPayload.publicWalmartProductId).toBe("18410702298");
    expect(saveBody.draftPayload.imageMatchMethod).toBe("public_url_product_id");

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/feeds/submit"))).toBe(false);
  });

  it("shows Shopify source labels and preserves Shopify gallery/variant previews from persisted product metadata", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/ecomviper/walmart/drafts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              draft: {
                updatedAt: "2026-05-10T00:00:00.000Z",
                validationResult: {
                  valid: true,
                  violations: [],
                  warnings: [],
                  suggestions: [],
                },
              },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const stagedDraft: WalmartDraftRecord = {
      id: "ev_draft_shopify_gallery",
      productId: "walmart_roc808",
      marketplace: "walmart",
      sku: "ROC808",
      productTitle: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
      draftPayload: {
        title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
        price: 29.99,
        inventoryQuantity: 11,
        imageUrl: "https://cdn.shopify.com/variant-main.jpg?v=1",
        additionalImageUrls: [],
      },
      changeSummary: "shopify media draft",
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

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            imageUrl: "https://cdn.shopify.com/variant-main.jpg?v=1",
            primaryImageUrl: "https://cdn.shopify.com/variant-main.jpg?v=1",
            galleryImageUrls: [
              "https://cdn.shopify.com/variant-main.jpg?v=1",
              "https://cdn.shopify.com/gallery-2.jpg?v=2",
              "https://cdn.shopify.com/gallery-3.jpg?v=3",
            ],
            variantImageUrls: ["https://cdn.shopify.com/variant-main.jpg?v=1"],
            imageStatus: "image_available",
            imageStatusMessage: "Image available",
            imageSyncStatus: "found",
            imageSyncReason: "Shopify variant image matched and applied.",
            imageSource: "shopify_variant",
            issues: [],
          })}
          stagedDrafts={[stagedDraft]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const openEditorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Open Draft Editor"
    ) as HTMLButtonElement | undefined;
    expect(openEditorButton).toBeDefined();
    await act(async () => {
      openEditorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    expect(mediaTab).toBeDefined();
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Source: Shopify variant image");
    expect(container.textContent).toContain("Gallery images: 3");
    expect(container.textContent).toContain("Variant images: 1");

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement | undefined;
    expect(saveDraftButton).toBeDefined();
    await act(async () => {
      saveDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const saveCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(saveCall[0]).toBe("/api/ecomviper/walmart/drafts");
    const saveBody = JSON.parse(String(saveCall[1].body)) as {
      draftPayload: Record<string, unknown>;
    };
    expect(saveBody.draftPayload.additionalImageUrls).toEqual([
      "https://cdn.shopify.com/gallery-2.jpg?v=2",
      "https://cdn.shopify.com/gallery-3.jpg?v=3",
    ]);
    expect(saveBody.draftPayload.galleryImageUrls).toEqual([
      "https://cdn.shopify.com/variant-main.jpg?v=1",
      "https://cdn.shopify.com/gallery-2.jpg?v=2",
      "https://cdn.shopify.com/gallery-3.jpg?v=3",
    ]);
  });
});
