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
          serpApiProviderConnected={false}
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
      container.querySelector('[data-testid="ecomviper-walmart-inline-ai-panel"]')?.textContent ?? "";
    expect(stateText).toContain("Connect your OpenAI API key first to optimize this product.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('a[href*="/apps/ecomviper/walmart/ai-optimizer"]')).toBeNull();
  });

  it("starts inline loading, renders AI suggestions, and applies suggestions to form fields", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes("/api/ecomviper/walmart/ai/generate")) {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
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
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }
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
    ) as HTMLButtonElement | null;

    await act(async () => {
      optimizeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(optimizeButton?.disabled).toBe(true);
    expect(optimizeButton?.textContent).toContain("Generating AI Improvements...");
    const loadingState =
      container.querySelector('[data-testid="ecomviper-walmart-inline-ai-panel"]')?.textContent ?? "";
    expect(loadingState).toContain("Generating AI Improvements...");

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
      container.querySelector('[data-testid="ecomviper-walmart-inline-ai-panel"]')?.textContent ?? "";
    expect(successState).toContain("AI Improvements Ready.");
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
    expect(container.textContent).toContain("AI improvements applied to draft fields. Save Draft when ready.");

    const formHtml = container.innerHTML;
    expect(formHtml).toContain("Optimized short summary");
    expect(formHtml).toContain("Optimized long listing description");
    expect(formHtml).toContain("Optimized bullet 1");
    expect(formHtml).toContain('value="Optimized Brand"');
    const attributesTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Search & Browse"
    ) as HTMLButtonElement | undefined;
    expect(attributesTab).toBeDefined();
    await act(async () => {
      attributesTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(container.innerHTML).toContain("Plant-based");
    expect(container.textContent).toContain("Current:");
    expect(container.textContent).toContain("Projected:");
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
    expect(saveBody.draftPayload.attributes).toMatchObject({ material: "Plant-based" });
    expect(saveBody.draftPayload.imageUrl).toBeUndefined();
    expect(saveBody.draftPayload.primaryImageUrl).toBeUndefined();
    expect(saveBody.draftPayload.additionalImageUrls).toBeUndefined();
    expect(container.textContent).toContain("Draft saved.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows improvement safeguards when projected score beats current score even if AI payload claims low quality", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          suggestion: {
            sku: "ROC808",
            qualityScore: 8,
            suggestedTitle:
              "OPA Joint Flex Capsules with Glucosamine, Chondroitin & MSM - 60ct",
            suggestedShortDescription: "Daily mobility support with compliant listing copy.",
            suggestedDescription:
              "Designed for compliant listing quality with clear shopper-facing product detail.",
            suggestedBullets: [
              "Joint and mobility support blend",
              "Glucosamine, chondroitin, and MSM formula",
              "Clear daily routine guidance",
              "Factual catalog language",
              "Structured key feature coverage",
            ],
            suggestedBrand: "ROC Brand",
            suggestedAttributes: { form: "Capsule", serving_size: "2 capsules" },
            missingAttributes: [],
            complianceWarnings: [],
            disclaimer: "compliance disclaimer",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            title: "OPA Joint Flex Capsules with Glucosamine, Chondroitin & MSM - 60ct",
            shortDescription: "",
            longDescription: "",
            bulletPoints: [],
            attributes: {},
            imageStatusMessage: "Image not provided by Walmart catalog",
            issues: ["Image not provided by Walmart catalog"],
          })}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const optimizeButton = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-button"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      optimizeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Optimization improved listing");
    expect(container.textContent).toContain("Current:");
    expect(container.textContent).not.toContain("Projected: 8/100");
    expect(container.textContent).toContain("Apply to Draft");
  });

  it("shows warning safeguards when projected score is worse and makes regenerate the primary action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          suggestion: {
            sku: "ROC808",
            qualityScore: 95,
            suggestedTitle: "Bad",
            suggestedShortDescription: "Too short",
            suggestedDescription: "Minimal",
            suggestedBullets: ["One", "Two", "Three"],
            suggestedBrand: "ROC Brand",
            suggestedAttributes: { form: "Capsule", serving_size: "2 capsules" },
            missingAttributes: [],
            complianceWarnings: [],
            disclaimer: "compliance disclaimer",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            title:
              "OPA Joint Flex Capsules with Glucosamine, Chondroitin & MSM - 60ct",
            shortDescription: "Daily support short description.",
            longDescription: "Detailed compliant listing description for marketplace shoppers.",
            bulletPoints: ["Feature one", "Feature two", "Feature three"],
            attributes: { form: "Capsule", serving_size: "2 capsules" },
            imageStatusMessage: "Image not provided by Walmart catalog",
            issues: ["Image not provided by Walmart catalog"],
          })}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const optimizeButton = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-button"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      optimizeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Suggestions need review - not recommended");
    expect(container.textContent).toContain("Apply Anyway to Draft");
    expect(container.textContent).toContain("Regenerate");
    expect(container.textContent).not.toContain("Optimization complete");
  });

  it("shows neutral state when projected score is unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          suggestion: {
            sku: "ROC808",
            qualityScore: 5,
            suggestedTitle:
              "OPA Joint Flex Capsules with Glucosamine, Chondroitin & MSM - 60ct",
            suggestedShortDescription: "Daily mobility support with compliant listing copy.",
            suggestedDescription:
              "Designed for compliant listing quality with clear shopper-facing product detail.",
            suggestedBullets: [
              "Joint and mobility support blend",
              "Glucosamine, chondroitin, and MSM formula",
              "Structured key feature coverage",
            ],
            suggestedBrand: "ROC Brand",
            suggestedAttributes: { form: "Capsule", serving_size: "2 capsules" },
            missingAttributes: [],
            complianceWarnings: [],
            disclaimer: "compliance disclaimer",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            title:
              "OPA Joint Flex Capsules with Glucosamine, Chondroitin & MSM - 60ct",
            shortDescription: "Daily mobility support with compliant listing copy.",
            longDescription:
              "Designed for compliant listing quality with clear shopper-facing product detail.",
            bulletPoints: [
              "Joint and mobility support blend",
              "Glucosamine, chondroitin, and MSM formula",
              "Structured key feature coverage",
            ],
            attributes: { form: "Capsule", serving_size: "2 capsules" },
            imageStatusMessage: "Image not provided by Walmart catalog",
            issues: ["Image not provided by Walmart catalog"],
          })}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const optimizeButton = container.querySelector(
      '[data-testid="ecomviper-walmart-optimize-button"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      optimizeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Suggestions available");
    expect(container.textContent).toContain("Change: 0");
    expect(container.textContent).toContain("Review Changes");
    expect(container.textContent).toContain("Apply to Draft");
  });

  it("renders structured Search & Browse fields and saves without raw JSON editing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
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

    const openEditorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Open Draft Editor"
    ) as HTMLButtonElement | undefined;
    expect(openEditorButton).toBeDefined();
    await act(async () => {
      openEditorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const searchBrowseTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Search & Browse"
    ) as HTMLButtonElement | undefined;
    expect(searchBrowseTab).toBeDefined();
    await act(async () => {
      searchBrowseTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain(
      "These structured attributes help Walmart understand where your product belongs in search and browse."
    );
    expect(container.querySelector("textarea.font-mono")).toBeNull();

    const depthInput = container.querySelector(
      'input[placeholder=\"4.0 in\"]'
    ) as HTMLInputElement | null;
    if (depthInput) {
      await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setValue?.call(depthInput, "4.5 in");
        depthInput.dispatchEvent(new Event("input", { bubbles: true }));
        depthInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flush();
    }

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement | undefined;
    expect(saveDraftButton).toBeDefined();
    await act(async () => {
      saveDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [saveUrl, saveInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(saveUrl).toBe("/api/ecomviper/walmart/drafts");

    const saveBody = JSON.parse(String(saveInit.body)) as {
      draftPayload: Record<string, unknown>;
    };
    expect(saveBody.draftPayload.searchBrowseAttributes).toBeDefined();
    expect(container.textContent).toContain("Draft saved.");
  });

  it("surfaces server draft-save error details when available", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: "Draft could not be saved because the product record was not found.",
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    );
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

    const openEditorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Open Draft Editor"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      openEditorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      saveDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain(
      "Draft could not be saved because the product record was not found."
    );
    expect(container.textContent).not.toContain("Failed to save draft.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a specific product-not-found save error instead of generic failure copy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "unexpected request" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
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

    const openEditorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Open Draft Editor"
    ) as HTMLButtonElement | undefined;
    expect(openEditorButton).toBeDefined();
    await act(async () => {
      openEditorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement | undefined;
    expect(saveDraftButton).toBeDefined();
    await act(async () => {
      saveDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Draft could not be saved. unexpected request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
