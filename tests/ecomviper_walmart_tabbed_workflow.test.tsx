// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_tabflow_1",
    marketplace: "walmart",
    sku: "TABFLOW-1",
    externalItemId: "wm_tabflow_1",
    title: "Tabbed Workflow Product",
    brand: "Workflow Brand",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 14,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/tabflow-primary.jpg",
    imageStatus: "available",
    imageStatusMessage: "Image available",
    imageSyncStatus: "found",
    imageSource: "shopify_product",
    issues: ["Add more search attributes", "Improve FAQ coverage"],
    attributes: { product_form: "Capsule", target_audience: "Adult" },
    shortDescription: "Current short description",
    longDescription: "Current long description",
    bulletPoints: ["Current bullet 1", "Current bullet 2"],
    rawPayload: {
      salePrice: 19.99,
      fulfillmentType: "WFS",
      shippingTemplate: "Standard",
      shippingSpeed: "2 day",
    },
    normalizedPayload: {
      galleryImageUrls: [
        "https://images.example.com/tabflow-primary.jpg",
        "https://images.example.com/tabflow-gallery-1.jpg",
      ],
      searchBrowseAttributes: {
        product_form: "Capsule",
        target_audience: "Adult",
      },
    },
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart product editor tabbed workflow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    (globalThis.HTMLElement.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView = vi.fn();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders Review, Improve, and Edit/Submit tabs with expected panel content", async () => {
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

    expect(container.querySelector('[data-testid="ecomviper-walmart-product-editor-tabs"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-walmart-tab-review-listing"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-walmart-tab-improve-with-ai"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-walmart-tab-edit-submit"]')).not.toBeNull();

    const reviewPanel = container.querySelector(
      '[data-testid="ecomviper-walmart-review-panel"]'
    ) as HTMLElement;
    expect(reviewPanel.className.includes("hidden")).toBe(false);
    expect(container.querySelector('[data-testid="ecomviper-walmart-current-listing-content"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-walmart-current-listing-media"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="ecomviper-walmart-current-listing-pricing-inventory"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="ecomviper-walmart-current-listing-search-browse"]')
    ).not.toBeNull();

    const improveTab = container.querySelector(
      '[data-testid="ecomviper-walmart-tab-improve-with-ai"]'
    ) as HTMLButtonElement;
    await act(async () => {
      improveTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const improvePanel = container.querySelector(
      '[data-testid="ecomviper-walmart-improve-panel"]'
    ) as HTMLElement;
    expect(improvePanel.className.includes("hidden")).toBe(false);
    expect(container.textContent).toContain("Generate AI Improvements");
    expect(container.textContent).toContain("Current listing reference");

    const editTab = container.querySelector(
      '[data-testid="ecomviper-walmart-tab-edit-submit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      editTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const editPanel = container.querySelector(
      '[data-testid="ecomviper-walmart-edit-submit-panel"]'
    ) as HTMLElement;
    expect(editPanel.className.includes("hidden")).toBe(false);
    expect(container.querySelector('[data-testid="ecomviper-walmart-final-draft-editor"]')).not.toBeNull();
    expect(container.textContent).toContain("Save Draft");
    expect(container.textContent).toContain("Submit Update");
    expect(container.textContent).toContain("Readiness & validation");
    expect(container.textContent).toContain("Staged changes");
  });

  it("preserves draft edits when switching workflow tabs", async () => {
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

    const editTab = container.querySelector(
      '[data-testid="ecomviper-walmart-tab-edit-submit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      editTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const titleInput = container.querySelector('input[value="Tabbed Workflow Product"]') as
      | HTMLInputElement
      | null;
    expect(titleInput).not.toBeNull();

    await act(async () => {
      titleInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      if (titleInput) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(titleInput, "Edited Draft Title");
      }
      titleInput?.dispatchEvent(new Event("input", { bubbles: true }));
      titleInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const reviewTab = container.querySelector(
      '[data-testid="ecomviper-walmart-tab-review-listing"]'
    ) as HTMLButtonElement;
    await act(async () => {
      reviewTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      editTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const persistedTitleInput = container.querySelector('input[value="Edited Draft Title"]');
    expect(persistedTitleInput).not.toBeNull();
  });
});
