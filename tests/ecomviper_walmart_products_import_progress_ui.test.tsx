// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import WalmartProductsClient from "@/app/apps/ecomviper/walmart/products/products-client";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefresh,
  }),
}));

function createProduct(overrides?: Partial<WalmartEffectiveProductRecord>): WalmartEffectiveProductRecord {
  return {
    id: "walmart_sku_1",
    marketplace: "walmart",
    sku: "SKU-1",
    externalItemId: "wm_sku_1",
    title: "Sample",
    brand: "Brand",
    category: "Supplements",
    price: 12,
    inventoryQuantity: 5,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    imageStatusMessage: "Item Search returned no usable image.",
    issues: ["Image not provided by Walmart Item Search"],
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

describe("Walmart import progress UI", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    routerRefresh.mockReset();
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

  it("shows import+enrichment summary and SerpApi provider-needed message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          importedCount: 3,
          message: "Imported 3 Walmart product(s).",
          importDiagnostics: {
            imageFoundCount: 1,
            imageNotFoundCount: 1,
            imageAmbiguousCount: 1,
            imageFailedCount: 0,
            imageSkippedNoProviderCount: 1,
            enrichmentQueuedCount: 2,
            enrichmentCompletedCount: 2,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<WalmartProductsClient products={[createProduct()]} />);
    });

    const importButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Import Products"
    ) as HTMLButtonElement;

    await act(async () => {
      importButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Imported 3 Walmart product(s).");
    expect(container.textContent).toContain(
      "Images can be enriched automatically when you connect your SerpApi key."
    );
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });
});
