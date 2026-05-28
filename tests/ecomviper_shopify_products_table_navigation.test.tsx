// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ShopifyWorkspaceClient from "@/app/ecomviper/shopify/shopify-workspace-client";
import { buildShopifyAgenticDemoWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-demo-data";
import type { ShopifyAgenticWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-types";

function buildWorkspaceState(): ShopifyAgenticWorkspaceState {
  const demo = buildShopifyAgenticDemoWorkspaceState();
  return {
    ...demo,
    workspaceSource: "live_shopify",
    workspaceSourceLabel: "Live Shopify API",
    hydrationMode: "live",
    mockModeEnabled: false,
    modeLabel: "Live data hydration",
    connectionStatus: {
      ...demo.connectionStatus,
      shopify: {
        ...demo.connectionStatus.shopify,
        connected: true,
        mode: "live",
        credentialSource: "secure_store",
        statusLabel: "Live",
      },
    },
    products: demo.products.map((product) => ({
      ...product,
      sourceLabel: "Live Shopify API",
    })),
  };
}

describe("Shopify workspace products table navigation", () => {
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

  it("renders clickable product links to product-specific Shopify editor routes", async () => {
    await act(async () => {
      root.render(<ShopifyWorkspaceClient initialState={buildWorkspaceState()} />);
    });

    const productsNav = container.querySelector('[data-testid="ecomviper-shopify-nav-products"]') as HTMLButtonElement;
    await act(async () => {
      productsNav.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ecomviper-shopify-products-table"]')).not.toBeNull();
    const firstLink = container.querySelector('[data-testid="ecomviper-shopify-product-link"]') as HTMLAnchorElement;
    expect(firstLink).not.toBeNull();
    expect(firstLink.getAttribute("href")).toContain("/ecomviper/shopify/products/");
    expect(container.textContent).not.toContain("Demo data");
  });

  it("disables editor navigation when no stable id or handle is available", async () => {
    const state = buildWorkspaceState();
    state.products = [
      {
        ...state.products[0],
        id: "shopify_product_without_identifier",
        handle: undefined,
        editorIdentifier: null,
        editorLinkEnabled: false,
        editorLinkDisabledReason: "No stable Shopify product id/handle available.",
      },
    ];

    await act(async () => {
      root.render(<ShopifyWorkspaceClient initialState={state} />);
    });

    const productsNav = container.querySelector('[data-testid="ecomviper-shopify-nav-products"]') as HTMLButtonElement;
    await act(async () => {
      productsNav.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ecomviper-shopify-product-link"]')).toBeNull();
    expect(container.textContent).toContain("No stable Shopify product id/handle available.");
  });
});

