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

const routerRefreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

function createProduct(
  sku: string,
  overrides?: Partial<WalmartEffectiveProductRecord>
): WalmartEffectiveProductRecord {
  return {
    id: `walmart_${sku}`,
    marketplace: "walmart",
    sku,
    externalItemId: `wm_${sku}`,
    title: `${sku} Product`,
    brand: "Walmart Brand",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "active",
    imageUrl: "",
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

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(element: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function getVisibleSkus(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody tr"))
    .map((row) => row.querySelector("td:nth-child(2) a")?.textContent?.trim() ?? "")
    .filter((value) => value.length > 0);
}

describe("Walmart products client filters, sorting, and local removal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    routerRefreshMock.mockReset();
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

  it("shows draft-pending products without falling back to import-empty copy", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[
            createProduct("ROC808", { hasDraftChanges: true, draftPublishStatus: "pending" }),
            createProduct("ROC830", { hasDraftChanges: false }),
          ]}
        />
      );
    });

    const filterSelect = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      setSelectValue(filterSelect, "draft_pending");
    });

    expect(container.textContent).toContain("ROC808");
    expect(container.textContent).not.toContain("ROC830 Product");
    expect(container.textContent).not.toContain(
      "No Walmart products imported yet. Connect Walmart, then import your products."
    );
  });

  it("shows filter-specific empty copy when imported products exist but no filter matches", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[createProduct("ROC808", { hasDraftChanges: false, status: "active" })]}
        />
      );
    });

    const filterSelect = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      setSelectValue(filterSelect, "draft_pending");
    });

    expect(container.textContent).toContain("No products with pending drafts match this filter.");
    expect(container.textContent).not.toContain(
      "No Walmart products imported yet. Connect Walmart, then import your products."
    );
  });

  it("shows generic filtered-empty copy for non-draft filters with no matches", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[createProduct("ROC808", { attributes: { size: "L" } })]}
        />
      );
    });

    const filterSelect = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      setSelectValue(filterSelect, "missing_attributes");
    });

    expect(container.textContent).toContain("No products match the selected filter.");
  });

  it("shows import-empty copy only when there are no imported products", async () => {
    await act(async () => {
      root.render(<WalmartProductsClient products={[]} />);
    });

    expect(container.textContent).toContain(
      "No Walmart products imported yet. Connect Walmart, then import your products."
    );
  });

  it("renders legacy product rows when status and image diagnostics are null", async () => {
    const legacyProduct = createProduct("LEGACY-NULL", {
      status: null as unknown as WalmartEffectiveProductRecord["status"],
      inventoryStatus: null as unknown as WalmartEffectiveProductRecord["inventoryStatus"],
      imageSource: null as unknown as WalmartEffectiveProductRecord["imageSource"],
      imageSyncStatus: null as unknown as WalmartEffectiveProductRecord["imageSyncStatus"],
      imageStatusMessage: null as unknown as string,
      issues: null as unknown as string[],
    });

    await act(async () => {
      root.render(<WalmartProductsClient products={[legacyProduct]} />);
    });

    expect(container.textContent).toContain("LEGACY-NULL");
    expect(container.textContent).toContain("Image enrichment not synced.");
  });

  it("renders products when SKU contains invalid URI surrogate characters", async () => {
    const invalidSku = `SURROGATE-\uD800-SKU`;
    await act(async () => {
      root.render(<WalmartProductsClient products={[createProduct(invalidSku)]} />);
    });

    expect(container.textContent).toContain("SURROGATE-");
    expect(container.textContent).toContain("Item Search returned no usable image.");
  });

  it("renders strict View Walmart Listing link from verified public Walmart URL", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[
            createProduct("WMT-LINK-URL", {
              publicWalmartUrl:
                "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate/17812552813?classType=REGULAR",
            }),
          ]}
        />
      );
    });

    const link = Array.from(container.querySelectorAll("a")).find(
      (entry) => entry.textContent?.trim() === "View Walmart Listing"
    ) as HTMLAnchorElement | undefined;

    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe(
      "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate/17812552813?classType=REGULAR"
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.getAttribute("rel")).toContain("noreferrer");
  });

  it("renders strict View Walmart Listing link from verified public item ID when URL is missing", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[
            createProduct("WMT-LINK-ID", {
              publicWalmartProductId: "17812552813",
              publicWalmartUrl: undefined,
              upc: "850054016119",
              gtin: "0850054016119",
            }),
          ]}
        />
      );
    });

    const link = Array.from(container.querySelectorAll("a")).find(
      (entry) => entry.textContent?.trim() === "View Walmart Listing"
    ) as HTMLAnchorElement | undefined;

    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("https://www.walmart.com/ip/17812552813");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("does not render View Walmart Listing link from UPC/GTIN/WPID or generic Walmart search URL", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[
            createProduct("WMT-NO-LINK", {
              upc: "850054016119",
              gtin: "0850054016119",
              wpid: "1X1X1X1",
              publicWalmartProductId: undefined,
              publicWalmartUrl: "https://www.walmart.com/search?q=opa+sleep+magnesium",
            }),
          ]}
        />
      );
    });

    const link = Array.from(container.querySelectorAll("a")).find(
      (entry) => entry.textContent?.trim() === "View Walmart Listing"
    );
    expect(link).toBeUndefined();
  });

  it("sorts SKU ascending and descending with natural ordering and accessible sort state", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[
            createProduct("ROC830"),
            createProduct("DB-46"),
            createProduct("ROC808"),
          ]}
        />
      );
    });

    const sortButton = container.querySelector('button[aria-label="Sort by SKU"]') as HTMLButtonElement;
    const sortHeader = container.querySelector('th[aria-sort]') as HTMLTableCellElement;
    expect(getVisibleSkus(container)).toEqual(["ROC830", "DB-46", "ROC808"]);
    expect(sortHeader.getAttribute("aria-sort")).toBe("none");

    await act(async () => {
      sortButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(getVisibleSkus(container)).toEqual(["DB-46", "ROC808", "ROC830"]);
    expect(sortHeader.getAttribute("aria-sort")).toBe("ascending");

    await act(async () => {
      sortButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(getVisibleSkus(container)).toEqual(["ROC830", "ROC808", "DB-46"]);
    expect(sortHeader.getAttribute("aria-sort")).toBe("descending");
  });

  it("preserves search and filter state when sorting", async () => {
    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[
            createProduct("ROC830", { hasDraftChanges: true }),
            createProduct("ROC808", { hasDraftChanges: true }),
            createProduct("DB-46", { hasDraftChanges: true }),
          ]}
        />
      );
    });

    const searchInput = container.querySelector('input[placeholder="Search SKU, title, brand, status"]') as HTMLInputElement;
    const filterSelect = container.querySelector("select") as HTMLSelectElement;
    const sortButton = container.querySelector('button[aria-label="Sort by SKU"]') as HTMLButtonElement;

    await act(async () => {
      setSelectValue(filterSelect, "draft_pending");
      setInputValue(searchInput, "ROC");
    });

    await act(async () => {
      sortButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getVisibleSkus(container)).toEqual(["ROC808", "ROC830"]);
    expect(container.textContent).not.toContain("DB-46 Product");
  });

  it("opens local-only removal confirmation and removes product after confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          sku: "ROC808",
          removed: true,
          archived: true,
          affectedDraftCount: 1,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <WalmartProductsClient
          products={[createProduct("ROC808", { hasDraftChanges: true })]}
        />
      );
    });

    const removeAction = container.querySelector(
      '[data-testid="ecomviper-walmart-remove-ROC808"]'
    ) as HTMLButtonElement;
    await act(async () => {
      removeAction.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Remove product from EcomViper catalog?");
    expect(container.textContent).toContain(
      "This removes the product from your EcomViper workspace only. It will not delete, retire, unpublish, or change the product on Walmart."
    );
    expect(container.textContent).toContain(
      "Any local EcomViper drafts for this product will also be removed."
    );
    expect(container.textContent).toContain("SKU: ROC808");

    const cancelButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Cancel"
    ) as HTMLButtonElement;
    await act(async () => {
      cancelButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("Remove product from EcomViper catalog?");
    expect(container.textContent).toContain("ROC808");

    await act(async () => {
      removeAction.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const confirmButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Remove from EcomViper"
    ) as HTMLButtonElement;
    await act(async () => {
      confirmButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ecomviper/walmart/products/ROC808");
    expect(init.method).toBe("DELETE");
    expect(container.textContent).toContain("Removed ROC808 from EcomViper catalog.");
    expect(container.textContent).not.toContain("ROC808 Product");
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
  });
});
