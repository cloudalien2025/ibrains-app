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

  it("shows missing key state inline and does not call optimizer request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={false}
        />
      );
    });

    const optimizeButton = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-button"]'
    ) as HTMLButtonElement | null;
    expect(optimizeButton).not.toBeNull();

    await act(async () => {
      optimizeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const stateText =
      container.querySelector('[data-testid="ecomviper-walmart-inline-ai-state"]')?.textContent ?? "";
    expect(stateText).toContain("Connect your OpenAI API key first to optimize this product.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('a[href*="/apps/ecomviper/walmart/ai-optimizer"]')).toBeNull();
  });

  it("starts inline loading, renders AI suggestions, and applies suggestions to form fields", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn(() =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
        />
      );
    });

    const optimizeButton = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-button"]'
    ) as HTMLButtonElement | null;

    await act(async () => {
      optimizeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(optimizeButton?.disabled).toBe(true);
    expect(optimizeButton?.textContent).toContain("Optimizing product with AI...");
    const loadingState =
      container.querySelector('[data-testid="ecomviper-walmart-inline-ai-state"]')?.textContent ?? "";
    expect(loadingState).toContain("Optimizing product with AI...");

    const responsePayload = {
      ok: true,
      suggestion: {
        sku: "ROC808",
        qualityScore: 91,
        suggestedTitle: "ROC808 Daily Wellness Formula | Optimized",
        suggestedShortDescription: "Optimized short summary",
        suggestedDescription: "Optimized long listing description",
        suggestedBullets: ["Optimized bullet 1", "Optimized bullet 2", "Optimized bullet 3"],
        suggestedBrand: "Optimized Brand",
        suggestedAttributes: { material: "Plant-based" },
        missingAttributes: ["ingredients_highlights"],
        complianceWarnings: ["Avoid disease claims"],
        disclaimer:
          "*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
      },
    };

    await act(async () => {
      resolveFetch?.(
        new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    await flush();

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("/api/ecomviper/walmart/ai/generate");
    const body = JSON.parse(String(requestInit.body)) as {
      sku: string;
      draftPayload: Record<string, unknown>;
    };
    expect(body.sku).toBe("ROC808");
    expect(body.draftPayload.title).toBe("ROC808 Daily Wellness Formula");

    const successState =
      container.querySelector('[data-testid="ecomviper-walmart-inline-ai-state"]')?.textContent ?? "";
    expect(successState).toContain("AI suggestions are ready to review inline.");
    expect(container.textContent).toContain("ROC808 Daily Wellness Formula | Optimized");

    const applyButton = container.querySelector(
      '[data-testid="ecomviper-walmart-apply-ai-suggestions"]'
    ) as HTMLButtonElement | null;
    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const titleInput = container.querySelector('input[value="ROC808 Daily Wellness Formula | Optimized"]');
    expect(titleInput).not.toBeNull();
    expect(container.textContent).toContain("AI suggestions applied to draft fields. Save Draft when ready.");

    const formHtml = container.innerHTML;
    expect(formHtml).toContain("Optimized short summary");
    expect(formHtml).toContain("Optimized long listing description");
    expect(formHtml).toContain("Optimized bullet 1");
    expect(formHtml).toContain('value="Optimized Brand"');
    expect(formHtml).toContain("Plant-based");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
