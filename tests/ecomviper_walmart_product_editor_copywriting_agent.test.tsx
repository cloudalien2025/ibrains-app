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

describe("Walmart product editor viper optimization UX", () => {
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

  it("renders top blue Optimize with AI action and removes old top-action wording", async () => {
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
      '[data-testid="ecomviper-walmart-optimize-top-button"]'
    ) as HTMLButtonElement | null;
    expect(topAction).not.toBeNull();
    expect(topAction?.textContent).toBe("Optimize with AI");
    expect(topAction?.getAttribute("data-color-intent")).toBe("primary-blue");
    expect(container.textContent).not.toContain("Extract Label Facts From Images");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders blue Viper field agents with field-specific tooltip labels and excludes protected numeric fields", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient
        product={createProduct()}
        stagedDrafts={[]}
        aiProviderConnected={true}
        serpApiProviderConnected={true}
      />
    );

    expect(html).toContain("ecomviper-walmart-viper-agent-title");
    expect(html).toContain("ecomviper-walmart-viper-agent-short-description");
    expect(html).toContain("ecomviper-walmart-viper-agent-long-description");
    expect(html).toContain("ecomviper-walmart-viper-agent-bullet-points");
    expect(html).toContain("ecomviper-walmart-viper-agent-search-browse-search-keywords");
    expect(html).toContain("ecomviper-walmart-viper-agent-search-browse-search-terms");
    expect(html).toContain("ecomviper-walmart-viper-agent-search-browse-product-name");
    expect(html).toContain("ecomviper-walmart-viper-agent-search-browse-directions-suggested-use");
    expect(html).toContain("ecomviper-walmart-viper-agent-search-browse-suggested-use");
    expect(html).toContain("ecomviper-walmart-viper-agent-search-browse-support-areas");
    expect(html).toContain("ecomviper-walmart-viper-agent-search-browse-safety-warnings");
    expect(html).toContain("ecomviper-walmart-viper-agent-alt-text");
    expect(html).toContain('title="Optimize Title for Agentic Selection"');
    expect(html).toContain('title="Optimize Short Description for Agentic Visibility"');
    expect(html).toContain(
      'title="Optimize Long Description for Agentic Visibility and Selection"'
    );
    expect(html).toContain('title="Optimize Bullets for Agentic Selection"');
    expect(html).toContain('title="Optimize Search Keywords for Agentic Visibility"');
    expect(html).toContain('title="Optimize Safety Copy for Compliance and Agentic Selection"');
    expect(html).toContain('data-color-intent="primary-blue"');

    expect(html).not.toContain("ecomviper-walmart-viper-agent-price");
    expect(html).not.toContain("ecomviper-walmart-viper-agent-inventory-quantity");
    expect(html).not.toContain("ecomviper-walmart-viper-agent-search-browse-count");
    expect(html).not.toContain("ecomviper-walmart-viper-agent-search-browse-assembled-product-depth");
  });

  it("top Optimize with AI coordinates image facts extraction and full optimization", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes("/api/ecomviper/walmart/ai/images/extract-facts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              extraction: { status: "extracted", message: "Facts extracted from images." },
              mappedSearchBrowseAttributes: {
                search_keywords: "label-backed magnesium facts",
              },
              visionFactPayload: {
                status: "extracted",
                message: "Image facts extracted",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("/api/ecomviper/walmart/ai/generate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              suggestion: {
                sku: "COPY-AGENT-1",
                qualityScore: 93,
                suggestedTitle: "Magnesium Wellness Gummies | Agentic",
                suggestedShortDescription: "Optimized short summary",
                suggestedDescription:
                  "Optimized long description with compliant support language. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
                suggestedBullets: ["Optimized bullet one", "Optimized bullet two", "Optimized bullet three"],
                searchBrowseAttributes: {
                  search_terms: "agentic listing visibility",
                },
                complianceWarnings: [],
                missingAttributes: [],
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

    const topAction = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-top-button"]'
    ) as HTMLButtonElement | null;
    expect(topAction).not.toBeNull();
    await act(async () => {
      topAction?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const extractCall = fetchMock.mock.calls.find(([request]) => {
      const url =
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.toString()
            : request.url;
      return url.includes("/api/ecomviper/walmart/ai/images/extract-facts");
    });
    const optimizeCall = fetchMock.mock.calls.find(([request]) => {
      const url =
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.toString()
            : request.url;
      return url.includes("/api/ecomviper/walmart/ai/generate");
    });
    expect(extractCall).toBeDefined();
    expect(optimizeCall).toBeDefined();

    const optimizeBody = JSON.parse(String((optimizeCall?.[1] as RequestInit).body)) as {
      draftPayload: {
        searchBrowseAttributes?: Record<string, string>;
      };
    };
    expect(optimizeBody.draftPayload.searchBrowseAttributes?.search_keywords).toBe(
      "label-backed magnesium facts"
    );

    const titleInput = container.querySelector(
      'input[value="Magnesium Wellness Gummies | Agentic"]'
    ) as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    expect(container.textContent).toContain("Optimized for Agentic Visibility and Selection.");
  });

  it("optimizes only the selected field when clicking a Title viper agent", async () => {
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
      '[data-testid="ecomviper-walmart-viper-agent-title"]'
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
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("/api/ecomviper/walmart/ai/generate");
    const body = JSON.parse(String(requestInit.body)) as {
      fieldKey: string;
      fieldIntent: string;
      intent: string;
      target: string;
    };
    expect(body.fieldKey).toBe("title");
    expect(body.fieldIntent).toBe("optimize_title_for_agentic_selection");
    expect(body.intent).toBe("optimize_title_for_agentic_selection");
    expect(body.target).toBe("agentic_visibility_and_selection");
    expect(container.textContent).toContain("Optimized Title for Agentic Selection.");
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
      '[data-testid="ecomviper-walmart-viper-agent-title"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      titleAgentButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Provider unavailable.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
