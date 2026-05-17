// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc808",
    marketplace: "walmart",
    sku: "ROC808",
    externalItemId: "wm_roc808",
    title: "ROC808 Daily Wellness Formula",
    brand: "ROC Brand",
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
    attributes: { form: "capsule" },
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

describe("Walmart inline optimize button workflow", () => {
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

  it("shows missing-key state inline and does not call optimizer route", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

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

    const optimizeButton = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-button"]'
    ) as HTMLButtonElement;
    await act(async () => {
      optimizeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const stateText =
      container.querySelector('[data-testid="ecomviper-walmart-inline-ai-panel"]')?.textContent ?? "";
    expect(stateText).toContain("Connect your OpenAI API key first to optimize this product.");
    expect(stateText).toContain("Optimization: Failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("optimizes the same docket in place and updates editable fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/ecomviper/walmart/ai/generate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              suggestion: {
                sku: "ROC808",
                qualityScore: 91,
                suggestedTitle: "ROC808 Daily Wellness Formula | Optimized",
                suggestedShortDescription: "Optimized short summary",
                suggestedDescription: "Optimized long listing description",
                suggestedBullets: [
                  "Optimized bullet 1",
                  "Optimized bullet 2",
                  "Optimized bullet 3",
                ],
                suggestedBrand: "Optimized Brand",
                suggestedAttributes: { material: "Plant-based" },
                searchBrowseAttributes: {
                  product_type: "Dietary Supplement",
                  search_keywords: "daily wellness, supplement",
                },
                missingAttributes: [],
                complianceWarnings: [],
                disclaimer: "Review claims before publish.",
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
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
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

    const optimizeButton = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-button"]'
    ) as HTMLButtonElement;
    await act(async () => {
      optimizeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Optimized for Agentic Visibility and Selection.");
    expect(container.textContent).toContain(
      "Optimized for Agentic Visibility and Selection. Save Draft when ready."
    );

    const titleInput = container.querySelector('input[value="ROC808 Daily Wellness Formula | Optimized"]');
    expect(titleInput).not.toBeNull();
    expect(container.innerHTML).toContain("Optimized short summary");
    expect(container.innerHTML).toContain("Optimized long listing description");
    expect(container.innerHTML).toContain('value="Optimized Brand"');
    expect(container.textContent).toContain("Optimized bullet 1");

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("/api/ecomviper/walmart/ai/generate");
    const body = JSON.parse(String(requestInit.body)) as {
      sku: string;
      draftPayload: Record<string, unknown>;
      target?: string;
    };
    expect(body.sku).toBe("ROC808");
    expect(body.draftPayload.title).toBe("ROC808 Daily Wellness Formula");
    expect(body.target).toBe("agentic_visibility_and_selection");

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement | undefined;
    expect(saveDraftButton).toBeDefined();
    await act(async () => {
      saveDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const secondCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondCall[0]).toBe("/api/ecomviper/walmart/drafts");
    const saveBody = JSON.parse(String(secondCall[1].body)) as {
      sku: string;
      draftPayload: Record<string, unknown>;
    };
    expect(saveBody.sku).toBe("ROC808");
    expect(saveBody.draftPayload.shortDescription).toBe("Optimized short summary");
    expect(saveBody.draftPayload.longDescription).toBe("Optimized long listing description");
    expect(saveBody.draftPayload.bulletPoints).toEqual([
      "Optimized bullet 1",
      "Optimized bullet 2",
      "Optimized bullet 3",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
