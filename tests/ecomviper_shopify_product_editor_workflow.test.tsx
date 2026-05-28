// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ShopifyProductEditorClient from "@/app/ecomviper/shopify/products/[productId-or-handle]/shopify-product-editor-client";
import {
  buildCurrentShopifyListingDocket,
  buildEditableShopifyDraft,
} from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

function createProductRecord(): ShopifyProductRecord {
  return {
    id: "gid://shopify/Product/101",
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
    metafields: [
      {
        id: "gid://shopify/Metafield/1",
        namespace: "facts",
        key: "serving_size",
        type: "single_line_text_field",
        value: "2 capsules",
        description: "Suggested serving",
      },
    ],
    onlineStoreUrl: "https://opanutrition.myshopify.com/products/opa-enzyme-balance",
    primaryImageUrl: "https://cdn.shopify.com/opa-main.jpg",
    galleryImageUrls: [
      "https://cdn.shopify.com/opa-main.jpg",
      "https://cdn.shopify.com/opa-secondary.jpg",
    ],
    galleryImages: [
      {
        id: "gid://shopify/Image/1",
        url: "https://cdn.shopify.com/opa-main.jpg",
        altText: "OPA bottle front",
        width: 1200,
        height: 1200,
        source: "product",
        variantId: null,
      },
      {
        id: "gid://shopify/Image/2",
        url: "https://cdn.shopify.com/opa-secondary.jpg",
        altText: null,
        width: 1200,
        height: 1200,
        source: "product",
        variantId: null,
      },
    ],
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    variants: [
      {
        id: "gid://shopify/ProductVariant/201",
        productId: "gid://shopify/Product/101",
        title: "Default",
        sku: "OPA-ENZ-60",
        barcode: "0123456789012",
        price: 24.99,
        compareAtPrice: 29.99,
        inventoryQuantity: 12,
        selectedOptions: [{ name: "Size", value: "60 ct" }],
        imageUrl: "https://cdn.shopify.com/opa-main.jpg",
        imageAltText: "OPA bottle front",
        imageUrls: ["https://cdn.shopify.com/opa-main.jpg"],
      },
    ],
  };
}

function createInitialState(openAiConnected: boolean): ShopifyProductEditorInitialState {
  const current = buildCurrentShopifyListingDocket(createProductRecord(), {
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    collections: ["Digestive Support"],
  });

  return {
    productReference: current.handle,
    productFound: true,
    notFoundMessage: null,
    source: "live_shopify",
    sourceLabel: "Live Shopify API",
    hydrationMode: "live",
    currentShopifyListing: current,
    optimizedShopifyProposal: null,
    editableShopifyDraft: buildEditableShopifyDraft(current, null),
    openAiConnected,
    openAiStatusLabel: openAiConnected ? "Connected" : "Not connected",
    lastSyncedAt: "2026-05-15T00:00:00.000Z",
    warnings: [],
  };
}

describe("Shopify product editor docket workflow", () => {
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
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("renders 3-step editor tabs and Step 1 source-provenance docket", async () => {
    await act(async () => {
      root.render(<ShopifyProductEditorClient initialState={createInitialState(false)} />);
    });

    expect(container.querySelector('[data-testid="ecomviper-shopify-product-editor"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-editor-tabs"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-tab-current-listing"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-tab-optimize-ai"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-tab-review-publish"]')).not.toBeNull();
    expect(container.textContent).toContain("Step 1 - Current Shopify Listing");
    expect(container.textContent).toContain("Step 2 - Optimize Listing with AI");
    expect(container.textContent).toContain("Step 3 - Review and Publish");

    const currentPanel = container.querySelector('[data-testid="ecomviper-shopify-current-docket"]') as HTMLElement;
    expect(currentPanel.className.includes("hidden")).toBe(false);
    expect(currentPanel.textContent).toContain("Source: Live Shopify API");
    expect(currentPanel.textContent).toContain("OPA Enzyme Balance");
    expect(currentPanel.textContent).toContain("No FAQ is shown here unless it exists in actual Shopify content.");
    expect(currentPanel.textContent).not.toContain("Agentic Referral Notes");
  });

  it("gates Step 2 AI optimization when OpenAI is not connected", async () => {
    await act(async () => {
      root.render(<ShopifyProductEditorClient initialState={createInitialState(false)} />);
    });

    const optimizeTab = container.querySelector(
      '[data-testid="ecomviper-shopify-tab-optimize-ai"]'
    ) as HTMLButtonElement;
    await act(async () => {
      optimizeTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const optimizePanel = container.querySelector('[data-testid="ecomviper-shopify-optimized-docket"]') as HTMLElement;
    expect(optimizePanel.className.includes("hidden")).toBe(false);
    expect(container.textContent).toContain("OpenAI connection required to generate AI optimization.");
  });

  it("generates proposal from current listing when OpenAI is connected", async () => {
    await act(async () => {
      root.render(<ShopifyProductEditorClient initialState={createInitialState(true)} />);
    });

    const optimizeTab = container.querySelector(
      '[data-testid="ecomviper-shopify-tab-optimize-ai"]'
    ) as HTMLButtonElement;
    await act(async () => {
      optimizeTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const generateButton = container.querySelector("button") as HTMLButtonElement;
    const generateByText = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Generate AI Optimization")
    ) as HTMLButtonElement;
    expect(generateButton || generateByText).not.toBeNull();

    await act(async () => {
      (generateByText || generateButton).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("AI optimization proposal generated from current Shopify listing.");
    expect(container.textContent).toContain("Before/After Summary");
    expect(container.textContent).toContain("Live OpenAI");
  });

  it("shows editable draft actions and preserves current listing when draft is edited", async () => {
    await act(async () => {
      root.render(<ShopifyProductEditorClient initialState={createInitialState(true)} />);
    });

    const reviewTab = container.querySelector(
      '[data-testid="ecomviper-shopify-tab-review-publish"]'
    ) as HTMLButtonElement;
    await act(async () => {
      reviewTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ecomviper-shopify-editable-draft"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-save-draft"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-prepare-update"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-request-publish-dry-run"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-publish-confirmation"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-shopify-diff-preview-summary"]')).not.toBeNull();

    const titleInput = container.querySelector('input[value="OPA Enzyme Balance"]') as HTMLInputElement;
    expect(titleInput).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(titleInput, "Edited Draft Shopify Title");
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      titleInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('input[value="Edited Draft Shopify Title"]')).not.toBeNull();

    const currentTab = container.querySelector(
      '[data-testid="ecomviper-shopify-tab-current-listing"]'
    ) as HTMLButtonElement;
    await act(async () => {
      currentTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const currentPanel = container.querySelector('[data-testid="ecomviper-shopify-current-docket"]') as HTMLElement;
    expect(currentPanel.textContent).toContain("OPA Enzyme Balance");
    expect(currentPanel.textContent).not.toContain("Edited Draft Shopify Title");
  });

  it("keeps publish request guarded with confirmation gate and non-mutating dry-run blocking", async () => {
    await act(async () => {
      root.render(<ShopifyProductEditorClient initialState={createInitialState(true)} />);
    });

    const reviewTab = container.querySelector(
      '[data-testid="ecomviper-shopify-tab-review-publish"]'
    ) as HTMLButtonElement;
    await act(async () => {
      reviewTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const publishButton = container.querySelector(
      '[data-testid="ecomviper-shopify-request-publish-dry-run"]'
    ) as HTMLButtonElement;
    expect(publishButton).not.toBeNull();

    await act(async () => {
      publishButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const firstOutcome = container.querySelector(
      '[data-testid="ecomviper-shopify-publish-dry-run-outcome"]'
    ) as HTMLElement;
    expect(firstOutcome).not.toBeNull();
    expect(firstOutcome.textContent).toContain("confirmation_required");
    expect(container.textContent).toContain("publish_blocked_confirmation_required");
    expect(container.textContent).toContain("Publish confirmation is required before dry-run publish review.");

    const confirmation = container.querySelector(
      '[data-testid="ecomviper-shopify-publish-confirmation"]'
    ) as HTMLInputElement;
    expect(confirmation.checked).toBe(false);

    await act(async () => {
      confirmation.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(confirmation.checked).toBe(true);

    await act(async () => {
      publishButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const secondOutcome = container.querySelector(
      '[data-testid="ecomviper-shopify-publish-dry-run-outcome"]'
    ) as HTMLElement;
    expect(secondOutcome.textContent).toContain("publish_not_enabled");
    expect(secondOutcome.textContent).toContain("Live Shopify publish remains disabled in Sprint 004.");
    expect(container.textContent).toContain("publish_intent_confirmed_dry_run");
    expect(container.textContent).toContain("publish_blocked_not_enabled");
  });
});
