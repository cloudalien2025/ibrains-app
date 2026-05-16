// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_copy_agent_1",
    marketplace: "walmart",
    sku: "COPY-AGENT-1",
    externalItemId: "wm_copy_agent_1",
    title: "Magnesium Wellness Gummies",
    brand: "Wellness Co",
    category: "Supplements",
    price: 21.99,
    inventoryQuantity: 18,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/main.jpg",
    imageStatus: "image_available",
    imageSyncStatus: "found",
    imageSource: "manual",
    issues: [],
    attributes: {},
    searchBrowseAttributes: {
      product_name: "Magnesium Wellness Gummies",
      search_keywords: "magnesium gummies, daily wellness",
      search_terms: "sleep support gummies",
      suggested_use: "Use as directed on label.",
      directions_suggested_use: "Adults take as directed on label.",
      support_areas: "Sleep quality, relaxation",
      safety_warnings: "Consult a healthcare professional before use.",
    },
    shortDescription: "Supports relaxation and daily wellness.",
    longDescription:
      "Magnesium gummies designed to support relaxation and sleep quality. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
    bulletPoints: ["Supports relaxation", "Great-tasting gummies", "Daily wellness support"],
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

describe("Walmart product editor copywriting agent UX", () => {
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("renders one top blue Extract Label Facts From Images action and preserves status states", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({ imageUrl: "", galleryImageUrls: [] })}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const topAction = container.querySelector(
      '[data-testid="ecomviper-walmart-extract-label-facts-top-button"]'
    ) as HTMLButtonElement | null;
    expect(topAction).not.toBeNull();
    expect(topAction?.textContent).toBe("Extract Label Facts From Images");
    expect(topAction?.getAttribute("data-color-intent")).toBe("primary-blue");
    expect(
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Extract Label Facts From Images"
      )
    ).toHaveLength(1);

    await act(async () => {
      topAction?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const statusText =
      container.querySelector(
        '[data-testid="ecomviper-walmart-extract-label-facts-status"]'
      )?.textContent ?? "";
    expect(statusText).toContain("no images available");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows field-level Copywriting Agent affordances for copy-heavy fields and excludes numeric fields", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient
        product={createProduct()}
        stagedDrafts={[]}
        aiProviderConnected={true}
        serpApiProviderConnected={true}
      />
    );

    expect(html).toContain("ecomviper-walmart-copywriting-agent-title");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-short-description");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-long-description");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-bullet-points");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-search-browse-search-keywords");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-search-browse-search-terms");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-search-browse-product-name");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-search-browse-directions-suggested-use");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-search-browse-suggested-use");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-search-browse-support-areas");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-search-browse-safety-warnings");
    expect(html).toContain("ecomviper-walmart-copywriting-agent-alt-text");

    expect(html).not.toContain("ecomviper-walmart-copywriting-agent-price");
    expect(html).not.toContain("ecomviper-walmart-copywriting-agent-inventory-quantity");
    expect(html).not.toContain("ecomviper-walmart-copywriting-agent-search-browse-count");
    expect(html).not.toContain("ecomviper-walmart-copywriting-agent-search-browse-assembled-product-depth");
  });

  it("optimizes only the selected field and keeps full Optimize with AI action separate", async () => {
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
                sku: "COPY-AGENT-1",
                qualityScore: 92,
                suggestedTitle: "Magnesium Wellness Gummies | Optimized",
                suggestedShortDescription: "This should not be applied in title-only action.",
                suggestedDescription:
                  "Optimized long description with compliant support language. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
                suggestedBullets: ["Optimized bullet one", "Optimized bullet two", "Optimized bullet three"],
                searchBrowseAttributes: {
                  search_keywords: "magnesium gummies, relaxation support",
                },
                missingAttributes: [],
                complianceWarnings: [],
                disclaimer:
                  "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
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

    const titleAgentButton = container.querySelector(
      '[data-testid="ecomviper-walmart-copywriting-agent-title"]'
    ) as HTMLButtonElement | null;
    expect(titleAgentButton).not.toBeNull();

    await act(async () => {
      titleAgentButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const titleInput = container.querySelector(
      'input[value="Magnesium Wellness Gummies | Optimized"]'
    ) as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    expect(container.innerHTML).toContain(">Supports relaxation and daily wellness.</textarea>");
    expect(container.textContent).toContain("Optimize with AI");
    expect(container.textContent).toContain("Publish to Walmart");
    expect(container.textContent).toContain("Publish status:");
    expect(container.textContent).toContain("idle");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a truthful provider-unavailable message when field agent cannot run", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={true}
        />
      );
    });

    const titleAgentButton = container.querySelector(
      '[data-testid="ecomviper-walmart-copywriting-agent-title"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      titleAgentButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain(
      "Provider unavailable. Connect AI provider or use full Optimize with AI when available."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

