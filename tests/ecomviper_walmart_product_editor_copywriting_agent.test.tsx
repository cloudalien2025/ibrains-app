// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/optiwal/products/[sku]/product-editor-client";
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

describe("Walmart product editor optimize action placement", () => {
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

  it("renders one top Optimize with AI action and no field-level agent buttons", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient
        product={createProduct()}
        stagedDrafts={[]}
        aiProviderConnected={true}
        serpApiProviderConnected={true}
      />
    );

    expect(html.match(/ecomviper-walmart-optimize-top-button/g)?.length ?? 0).toBe(1);
    expect(html).not.toContain("ecomviper-walmart-optimize-button");
    expect(html).toContain("ecomviper-walmart-save-draft-button");
    expect(html).not.toContain("ecomviper-walmart-viper-agent-");
  });

  it("top Optimize with AI runs full-docket optimization and applies updates", async () => {
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
                suggestedTitle: "Magnesium Wellness Gummies Agentic",
                suggestedShortDescription: "Optimized short summary.",
                suggestedDescription:
                  "Optimized long description with compliant support language. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
                suggestedBullets: [
                  "Optimized bullet one",
                  "Optimized bullet two",
                  "Optimized bullet three",
                  "Optimized bullet four",
                  "Optimized bullet five",
                ],
                searchBrowseAttributes: {
                  search_terms: "agentic listing visibility",
                },
                complianceWarnings: [],
                missingAttributes: [],
                disclaimer:
                  "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
                applyDiagnostics: {
                  factsUpdated: [],
                  factsSources: [],
                  staleFieldsReplaced: [],
                  staleFieldsCleared: [],
                  copyFieldsUpdated: [],
                  searchBrowseFieldsUpdated: [],
                  searchBrowseFieldsReplaced: [],
                  complianceChanges: [],
                  skippedProtectedFields: [],
                  skippedLowConfidenceFields: [],
                  rejectedClaims: [],
                  disclaimerStatus: "preserved",
                  finalDecision: "accepted",
                  competitorResearchStatus: "available",
                  optimizationFlow: "full_docket_rules_engine",
                },
              },
              optimizationMeta: {
                competitorResearchStatus: "available",
                flow: "full_docket_rules_engine",
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

    const optimizeCall = fetchMock.mock.calls.find(([request]) => {
      const url =
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.toString()
            : request.url;
      return url.includes("/api/ecomviper/walmart/ai/generate");
    });

    expect(optimizeCall).toBeDefined();
    expect(container.textContent).toContain("Optimized draft ready for review.");
    expect(container.textContent).toContain("Optimized for Agentic Visibility and Selection.");

    const titleInput = container.querySelector(
      'input[value="Magnesium Wellness Gummies Agentic"]'
    ) as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    expect(container.innerHTML).toContain("Optimized short summary");
  });

  it("returns provider unavailable when top optimize cannot run", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({ imageUrl: "", normalizedPayload: {}, rawPayload: {} })}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={true}
        />
      );
    });

    const topAction = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-top-button"]'
    ) as HTMLButtonElement | null;

    await act(async () => {
      topAction?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Provider unavailable.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
