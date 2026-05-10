// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalmartInventoryClient from "@/app/apps/ecomviper/walmart/inventory/inventory-client";
import WalmartPricingClient from "@/app/apps/ecomviper/walmart/pricing/pricing-client";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

function createProduct(
  sku: string,
  overrides?: Partial<WalmartEffectiveProductRecord>
): WalmartEffectiveProductRecord {
  return {
    id: `walmart_${sku}`,
    marketplace: "walmart",
    sku,
    externalItemId: `wm_${sku}`,
    title: `${sku} Product Title`,
    brand: "Walmart Brand",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Item Search returned no usable image.",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    issues: [],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
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

describe("Walmart inventory and pricing product selectors", () => {
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

  it("inventory selector is searchable and update payload uses selected SKU", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Inventory change saved as draft." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const products = [
      createProduct("SKU-ONE", { title: "First Product", inventoryQuantity: 4 }),
      createProduct("ROC808", { title: "OPA Joint Flex Capsules", inventoryQuantity: 9 }),
    ];

    await act(async () => {
      root.render(
        <WalmartInventoryClient
          products={products}
          lowStock={[]}
          outOfStock={[]}
          recentChanges={[]}
        />
      );
    });

    expect(container.innerHTML).toContain("Select product / SKU");
    expect(container.innerHTML).toContain("ROC808 - OPA Joint Flex Capsules");

    const selector = container.querySelector(
      '[data-testid="ecomviper-walmart-inventory-sku-selector"]'
    ) as HTMLInputElement | null;
    const currentQuantity = container.querySelector(
      '[data-testid="ecomviper-walmart-inventory-current-quantity"]'
    ) as HTMLInputElement | null;
    const newQuantity = container.querySelector(
      '[data-testid="ecomviper-walmart-inventory-new-quantity"]'
    ) as HTMLInputElement | null;
    const saveDraft = container.querySelector(
      '[data-testid="ecomviper-walmart-inventory-save-draft"]'
    ) as HTMLButtonElement | null;

    expect(selector).not.toBeNull();
    expect(currentQuantity?.value).toBe("4");

    await act(async () => {
      setInputValue(selector!, "ROC808");
    });
    await flush();

    expect(currentQuantity?.value).toBe("9");

    await act(async () => {
      setInputValue(newQuantity!, "13");
    });

    await act(async () => {
      saveDraft?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { sku: string; quantity: number };
    expect(body.sku).toBe("ROC808");
    expect(body.quantity).toBe(13);
    expect(container.textContent).toContain("Inventory change saved as draft.");
  });

  it("pricing selector is searchable and submit payload uses selected SKU", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Price change saved as draft." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const products = [
      createProduct("SKU-ONE", { title: "First Product", price: 19.99 }),
      createProduct("ROC808", { title: "OPA Joint Flex Capsules", price: 29.99 }),
    ];

    await act(async () => {
      root.render(
        <WalmartPricingClient
          products={products}
          warnings={[]}
          recentChanges={[]}
        />
      );
    });

    expect(container.innerHTML).toContain("Select product / SKU");
    expect(container.innerHTML).toContain("ROC808 - OPA Joint Flex Capsules");

    const selector = container.querySelector(
      '[data-testid="ecomviper-walmart-pricing-sku-selector"]'
    ) as HTMLInputElement | null;
    const currentPrice = container.querySelector(
      '[data-testid="ecomviper-walmart-pricing-current-price"]'
    ) as HTMLInputElement | null;
    const newPrice = container.querySelector(
      '[data-testid="ecomviper-walmart-pricing-new-price"]'
    ) as HTMLInputElement | null;
    const saveDraft = container.querySelector(
      '[data-testid="ecomviper-walmart-pricing-save-draft"]'
    ) as HTMLButtonElement | null;

    expect(selector).not.toBeNull();
    expect(currentPrice?.value).toBe("$19.99");

    await act(async () => {
      setInputValue(selector!, "ROC808");
    });
    await flush();

    expect(currentPrice?.value).toBe("$29.99");

    await act(async () => {
      setInputValue(newPrice!, "31.5");
    });

    await act(async () => {
      saveDraft?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { sku: string; price: number };
    expect(body.sku).toBe("ROC808");
    expect(body.price).toBe(31.5);
    expect(container.textContent).toContain("Price change saved as draft.");
  });

  it("keeps the no-products empty state copy", async () => {
    await act(async () => {
      root.render(
        <WalmartInventoryClient products={[]} lowStock={[]} outOfStock={[]} recentChanges={[]} />
      );
    });
    expect(container.textContent).toContain(
      "No Walmart products imported yet. Connect Walmart, then import your products before inventory updates."
    );

    await act(async () => {
      root.render(
        <WalmartPricingClient products={[]} warnings={[]} recentChanges={[]} />
      );
    });
    expect(container.textContent).toContain(
      "No Walmart products imported yet. Connect Walmart, then import your products before price updates."
    );
  });
});
