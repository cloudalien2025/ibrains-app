// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/optiwal/products/[sku]/product-editor-client";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_single_docket_1",
    marketplace: "walmart",
    sku: "SINGLE-DOCKET-1",
    externalItemId: "wm_single_docket_1",
    title: "Single Docket Product",
    brand: "Workflow Brand",
    category: "Supplements",
    price: 24.99,
    inventoryQuantity: 14,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/single-docket-primary.jpg",
    imageStatus: "available",
    imageStatusMessage: "Image available",
    imageSyncStatus: "found",
    imageSource: "shopify_product",
    publicWalmartUrl: "https://www.walmart.com/ip/2791205430",
    publicWalmartProductId: "2791205430",
    issues: ["Add more search attributes", "Improve FAQ coverage"],
    attributes: { product_form: "Capsule", target_audience: "Adult" },
    shortDescription: "Current short description",
    longDescription:
      "Current long description. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
    bulletPoints: ["Current bullet 1", "Current bullet 2", "Current bullet 3"],
    rawPayload: {
      salePrice: 19.99,
      fulfillmentType: "WFS",
      shippingTemplate: "Standard",
      shippingSpeed: "2 day",
    },
    normalizedPayload: {
      galleryImageUrls: [
        "https://images.example.com/single-docket-primary.jpg",
        "https://images.example.com/single-docket-gallery-1.jpg",
      ],
      publicWalmartUrl: "https://www.walmart.com/ip/2791205430",
      publicWalmartProductId: "2791205430",
      searchBrowseAttributes: {
        product_form: "Capsule",
        target_audience: "Adult",
      },
    },
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

describe("Walmart product editor single docket workflow", () => {
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

  it("renders one visible Walmart docket with required section order and bottom actions", async () => {
    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({ imageUrl: "", normalizedPayload: {}, rawPayload: {} })}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    expect(container.querySelector('[data-testid="ecomviper-walmart-product-editor-tabs"]')).toBeNull();
    expect(container.textContent).not.toContain("Step 1 - Current Walmart Listing");
    expect(container.textContent).not.toContain("Step 2 - Optimize Listing with AI");
    expect(container.textContent).not.toContain("Step 3 - Review and Publish");

    const singleDocket = container.querySelector(
      '[data-testid="ecomviper-walmart-single-docket"]'
    ) as HTMLElement | null;
    expect(singleDocket).not.toBeNull();

    const contentSection = container.querySelector(
      '[data-testid="ecomviper-walmart-docket-content"]'
    ) as HTMLElement | null;
    const mediaSection = container.querySelector(
      '[data-testid="ecomviper-walmart-docket-media"]'
    ) as HTMLElement | null;
    const pricingSection = container.querySelector(
      '[data-testid="ecomviper-walmart-docket-pricing-inventory"]'
    ) as HTMLElement | null;
    const searchBrowseSection = container.querySelector(
      '[data-testid="ecomviper-walmart-docket-search-browse"]'
    ) as HTMLElement | null;
    expect(contentSection).not.toBeNull();
    expect(mediaSection).not.toBeNull();
    expect(pricingSection).not.toBeNull();
    expect(searchBrowseSection).not.toBeNull();

    expect(
      Boolean(
        contentSection &&
          mediaSection &&
          (contentSection.compareDocumentPosition(mediaSection) & Node.DOCUMENT_POSITION_FOLLOWING)
      )
    ).toBe(true);
    expect(
      Boolean(
        mediaSection &&
          pricingSection &&
          (mediaSection.compareDocumentPosition(pricingSection) & Node.DOCUMENT_POSITION_FOLLOWING)
      )
    ).toBe(true);
    expect(
      Boolean(
        pricingSection &&
          searchBrowseSection &&
          (pricingSection.compareDocumentPosition(searchBrowseSection) & Node.DOCUMENT_POSITION_FOLLOWING)
      )
    ).toBe(true);

    const generatePanel = container.querySelector(
      '[data-testid="ecomviper-walmart-generate-product-images"]'
    ) as HTMLElement | null;
    expect(generatePanel).not.toBeNull();
    expect(Boolean(mediaSection?.parentElement?.contains(generatePanel))).toBe(true);
    expect(container.querySelectorAll('[data-testid="ecomviper-walmart-generate-product-images"]')).toHaveLength(1);

    expect(container.textContent).toContain("Optimize with AI");
    expect(
      container.querySelectorAll('[data-testid="ecomviper-walmart-optimize-top-button"]')
    ).toHaveLength(1);
    expect(container.querySelector('[data-testid="ecomviper-walmart-optimize-button"]')).toBeNull();
    const saveDraftButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Save Draft"
    );
    expect(saveDraftButtons).toHaveLength(1);
    expect(container.textContent).toContain("Publish to Walmart");
    expect(container.textContent).toContain("Agentic Visibility Score");
    const scoreRing = container.querySelector(
      '[data-testid="ecomviper-walmart-agentic-score-ring"]'
    ) as HTMLElement | null;
    expect(scoreRing).not.toBeNull();
    expect(scoreRing?.getAttribute("aria-label")).toContain("Agentic Visibility Score");
    expect(container.textContent).toContain(
      "Optimized according to EcomViper's Agentic Visibility and Selection scoring model."
    );
    expect(container.textContent).not.toContain("Optimize Listing with AI");
    expect(container.textContent).not.toContain("Mark Publish-Ready");
    expect(container.querySelector('[data-testid="ecomviper-walmart-hydration-status"]')).toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-walmart-docket-freshness-panel"]')).toBeNull();
    expect(container.textContent).not.toContain("Docket Freshness / Report Backfill");
    expect(container.textContent).not.toContain("FAQ (secondary)");
    expect(container.textContent).not.toContain("Sync history (secondary)");
    expect(container.textContent).not.toContain("Readiness & validation");
    expect(container.textContent).toContain("View diagnostics (optional)");
  });

  it("optimizes in place without triggering publish submission", async () => {
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
                sku: "SINGLE-DOCKET-1",
                qualityScore: 90,
                suggestedTitle: "Single Docket Product | Optimized",
                suggestedShortDescription: "Optimized short summary",
                suggestedDescription: "Optimized long listing description",
                suggestedBullets: [
                  "Optimized bullet 1",
                  "Optimized bullet 2",
                  "Optimized bullet 3",
                ],
                suggestedBrand: "Workflow Brand",
                suggestedAttributes: { material: "Plant-based" },
                searchBrowseAttributes: { product_type: "Dietary Supplement" },
                missingAttributes: [],
                complianceWarnings: [],
                disclaimer: "Review claims before publish.",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
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
      '[data-testid="ecomviper-walmart-optimize-top-button"]'
    ) as HTMLButtonElement;
    await act(async () => {
      optimizeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const titleInput = container.querySelector(
      'input[value="Single Docket Product | Optimized"]'
    ) as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    expect(container.textContent).toContain("Optimized for Agentic Visibility and Selection.");

    const generateCall = fetchMock.mock.calls.find(([request]) => {
      const url =
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.toString()
            : request.url;
      return url === "/api/ecomviper/walmart/ai/generate";
    });
    expect(generateCall).toBeDefined();

    const scoreText = container.textContent ?? "";
    const scoreMatch = scoreText.match(/Current\s*(\d+)%\s*->\s*Optimized\s*(\d+)%/);
    expect(scoreMatch).not.toBeNull();
    if (scoreMatch) {
      expect(Number(scoreMatch[2])).toBeGreaterThanOrEqual(Number(scoreMatch[1]));
    }
  });

  it("runs guarded publish confirmation and returns preview_only_no_publish_route", async () => {
    const fetchMock = vi.fn();
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

    const publishButton = container.querySelector(
      '[data-testid="ecomviper-walmart-publish-button"]'
    ) as HTMLButtonElement;
    await act(async () => {
      publishButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Preview ready");
    const confirmButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Confirm Publish"
    ) as HTMLButtonElement | undefined;
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Preview only - not submitted to Walmart.");
    expect(container.textContent).toContain("nothing was submitted");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("blocks publish with validation errors", async () => {
    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            title: "",
            price: 0,
            shortDescription: "",
            longDescription: "",
            bulletPoints: [],
            normalizedPayload: {},
            rawPayload: {},
          })}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const publishButton = container.querySelector(
      '[data-testid="ecomviper-walmart-publish-button"]'
    ) as HTMLButtonElement;
    await act(async () => {
      publishButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Needs review");
    expect(container.textContent).toContain("Product title is required before publish.");
  });

  it("shows skipped_no_credentials state after manual catalog refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          catalogBackfill: {
            status: "skipped_no_credentials",
            canonicalItemId: "2791205430",
            canonicalPublicUrl: "https://www.walmart.com/ip/2791205430",
            matchConfidence: "none",
            fieldPatches: [],
            warnings: [],
            sourceSummary: {
              winningSource: "unavailable",
              sourceLabel: "Unavailable",
              retrievedAt: "2026-05-15T00:00:00.000Z",
              credentialMode: "unavailable",
            },
            sourceConfidence: {
              overallConfidence: "none",
              totalFields: 0,
              actionableFields: 0,
              byAction: {
                kept_seller_native: 0,
                filled_missing: 0,
                replaced_placeholder: 0,
                skipped_lower_confidence: 0,
                skipped_conflict: 0,
                skipped_user_edited: 0,
              },
              byConfidence: {
                exact: 0,
                strong: 0,
                moderate: 0,
                weak: 0,
                none: 0,
              },
            },
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
            publicWalmartProductId: "2791205430",
            publicWalmartUrl: "https://www.walmart.com/ip/2791205430",
          })}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const button = container.querySelector(
      '[data-testid="ecomviper-walmart-refresh-catalog-details"]'
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("skipped because live Walmart/SerpApi credentials");
  });
});
