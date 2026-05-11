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
          importProgress: {
            stage: "completed_with_warnings",
            providerConnected: false,
            noImageReason: "Connect SerpApi to enable automated public Walmart image enrichment.",
            enrichmentBounded: true,
            enrichmentBoundedLimit: 4,
            enrichmentDeferredCount: 24,
            totals: {
              importedCount: 3,
              fetchedCount: 3,
              processedCount: 2,
              queuedCount: 2,
              imageFoundCount: 1,
              imageFromImportPayloadCount: 1,
              imageEnrichedCount: 0,
              imageFromWalmartSearchCount: 0,
              imageFromSerpApiFallbackCount: 0,
              imageFromSerpApiProductGalleryCount: 0,
              imageFromSerpApiSearchFallbackCount: 0,
              walmartSearchNotFoundCount: 1,
              imageStillMissingCount: 2,
              imageMissingCount: 2,
              imageNotFoundCount: 1,
              imageAmbiguousCount: 1,
              imageFailedCount: 0,
              imageSkippedNoProviderCount: 1,
            },
          },
          importDiagnostics: {
            imageFoundCount: 1,
            imageNotFoundCount: 1,
            imageAmbiguousCount: 1,
            imageFailedCount: 0,
            imageSkippedNoProviderCount: 1,
            enrichmentQueuedCount: 2,
            enrichmentCompletedCount: 2,
            enrichmentProviderConnected: false,
            imageEnrichmentNoImageReason: "Connect SerpApi to enable automated public Walmart image enrichment.",
            imageEnrichmentBounded: true,
            imageEnrichmentImportLimit: 4,
            imageEnrichmentDeferredCount: 24,
            imageFromImportPayloadCount: 1,
            imageEnrichedCount: 0,
            imageFromWalmartSearchCount: 0,
            imageFromSerpApiFallbackCount: 0,
            imageFromSerpApiProductGalleryCount: 0,
            imageFromSerpApiSearchFallbackCount: 0,
            walmartSearchNotFoundCount: 1,
            imageStillMissingCount: 2,
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
    expect(container.textContent).toContain("Completed with warnings");
    expect(container.textContent).toContain("Products imported: 3");
    expect(container.textContent).toContain("Products fetched: 3");
    expect(container.textContent).toContain("Products processed: 2");
    expect(container.textContent).toContain("Queued for resolver + fallback: 2");
    expect(container.textContent).toContain("Images found: 1");
    expect(container.textContent).toContain("Images from import payload: 1");
    expect(container.textContent).toContain("Resolved via Walmart Item Search: 0");
    expect(container.textContent).toContain("Images from Walmart Item Search: 0");
    expect(container.textContent).toContain("Images from SerpApi product gallery: 0");
    expect(container.textContent).toContain("Images from SerpApi search fallback: 0");
    expect(container.textContent).toContain("Images from SerpApi fallback: 0");
    expect(container.textContent).toContain("Total fallback enriched successfully: 0");
    expect(container.textContent).toContain("Still missing images: 2");
    expect(container.textContent).toContain("Failed (provider/request): 0");
    expect(container.textContent).toContain("Missing/not found: 2");
    expect(container.textContent).toContain("Not found: 1");
    expect(container.textContent).toContain("Walmart Item Search not found: 1");
    expect(container.textContent).toContain("Skipped (SerpApi not connected): 1");
    expect(container.textContent).toContain("SerpApi: Not connected");
    expect(container.textContent).toContain(
      "Connect SerpApi to enable automated public Walmart image enrichment."
    );
    expect(container.textContent).toContain(
      "Import image enrichment checks the first 4 missing-image products during import."
    );
    expect(container.textContent).toContain("Retry image enrichment (continue remaining products)");
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders completed progress safely when new diagnostics fields are missing or null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          importedCount: 2,
          fetchedCount: 2,
          message: "Imported 2 Walmart product(s).",
          importProgress: {
            stage: "complete",
            providerConnected: true,
            providerStatus: "connected",
            providerStatusReason: null,
            providerCanAttempt: true,
            totals: {
              importedCount: 2,
              fetchedCount: 2,
            },
          },
          importDiagnostics: null,
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

    expect(container.textContent).toContain("Complete");
    expect(container.textContent).toContain("Products imported: 2");
    expect(container.textContent).toContain("Products fetched: 2");
    expect(container.textContent).toContain("Products processed: 0");
    expect(container.textContent).toContain("Images found: 0");
    expect(container.textContent).toContain("Still missing images: 0");
    expect(container.textContent).toContain("SerpApi: Connected");
  });

  it("shows failed import diagnostics without zeroing context when previous products exist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "IMPORT_FAILED",
            message: "Production token request failed: HTTP 401 unauthorized.",
          },
          importProgress: {
            stage: "failed",
            providerConnected: true,
            providerStatus: "connected",
            providerStatusReason: null,
            providerCanAttempt: true,
            importErrorCategory: "walmart_auth_failed",
            importErrorReason: "Production token request failed: HTTP 401 unauthorized.",
            importErrorPhase: "walmart_auth",
            importErrorStatusCode: 401,
            importErrorEndpointFamily: "walmart_token",
            existingProductsShownCount: 1,
            totals: {
              importedCount: 0,
              fetchedCount: 0,
              processedCount: 0,
              queuedCount: 0,
              imageFoundCount: 0,
              imageFromImportPayloadCount: 0,
              imageEnrichedCount: 0,
              imageStillMissingCount: 0,
              imageMissingCount: 0,
              imageNotFoundCount: 0,
              imageAmbiguousCount: 0,
              imageFailedCount: 0,
              imageSkippedNoProviderCount: 0,
            },
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
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
    expect(container.textContent).toContain("Failed");
    expect(container.textContent).toContain("Import error (walmart_auth_failed): Production token request failed: HTTP 401 unauthorized.");
    expect(container.textContent).toContain("Failure phase: walmart_auth (HTTP 401) · endpoint: walmart_token");
    expect(container.textContent).toContain("Existing products shown below are from the previous successful import.");
    expect(container.textContent).toContain("SerpApi: Connected");
  });

  it("shows sanitized provider-error detail and Connect guidance", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          importedCount: 4,
          importProgress: {
            stage: "completed_with_warnings",
            providerConnected: true,
            providerStatus: "provider_error",
            providerStatusReason:
              "SerpApi returned a provider error: timeout from upstream api_key=[REDACTED]",
            providerCanAttempt: true,
            noImageReason:
              "SerpApi returned a provider error: timeout from upstream api_key=[REDACTED]",
            totals: {
              importedCount: 4,
              fetchedCount: 4,
              processedCount: 4,
              queuedCount: 4,
              imageFoundCount: 0,
              imageFromImportPayloadCount: 0,
              imageEnrichedCount: 0,
              imageFromWalmartSearchCount: 0,
              imageFromSerpApiFallbackCount: 0,
              walmartSearchNotFoundCount: 0,
              imageStillMissingCount: 4,
              imageMissingCount: 4,
              imageNotFoundCount: 0,
              imageAmbiguousCount: 0,
              imageFailedCount: 4,
              imageSkippedNoProviderCount: 0,
            },
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

    expect(container.textContent).toContain(
      "SerpApi returned a provider error: timeout from upstream api_key=[REDACTED]"
    );
    expect(container.textContent).toContain("Still missing images: 4");
    expect(container.textContent).toContain("Failed (provider/request): 4");
    expect(container.textContent).toContain(
      "SerpApi is connected, but Walmart did not find a product for the identifier used. Verify identifier mapping."
    );
    expect(container.textContent).not.toContain("Connect SerpApi to enable automated public Walmart image enrichment.");
    expect(container.textContent).not.toContain("Test SerpApi connection in Connect.");
    expect(container.textContent).not.toContain("api_key=secret");
  });

  it("does not show disconnected guidance when provider reports product-not-found while connected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          importedCount: 4,
          importProgress: {
            stage: "completed_with_warnings",
            providerConnected: true,
            providerStatus: "bad_request",
            providerStatusReason: "SerpApi bad request: The product has not found.",
            providerCanAttempt: true,
            noImageReason: "SerpApi bad request: The product has not found.",
            totals: {
              importedCount: 4,
              fetchedCount: 4,
              processedCount: 4,
              queuedCount: 4,
              imageFoundCount: 0,
              imageFromImportPayloadCount: 0,
              imageEnrichedCount: 0,
              imageFromWalmartSearchCount: 0,
              imageFromSerpApiFallbackCount: 0,
              walmartSearchNotFoundCount: 4,
              imageStillMissingCount: 4,
              imageMissingCount: 4,
              imageNotFoundCount: 4,
              imageAmbiguousCount: 0,
              imageFailedCount: 0,
              imageSkippedNoProviderCount: 0,
            },
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

    expect(container.textContent).toContain("SerpApi: Bad request");
    expect(container.textContent).toContain(
      "SerpApi is connected, but Walmart did not find a product for the identifier used. Verify identifier mapping."
    );
    expect(container.textContent).not.toContain("Connect SerpApi to enable automated public Walmart image enrichment.");
    expect(container.textContent).not.toContain("Test SerpApi connection in Connect.");
  });

  it("shows gateway timeout failure without incorrectly marking SerpApi as not connected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("Gateway Time-out", { status: 504 }));
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
    expect(container.textContent).toContain("Failed");
    expect(container.textContent).toContain("Import error (import_gateway_timeout)");
    expect(container.textContent).toContain("Failure phase: gateway_timeout (HTTP 504) · endpoint: gateway");
    expect(container.textContent).toContain("SerpApi: Unknown error");
    expect(container.textContent).toContain(
      "Provider status unavailable because the import request timed out."
    );
  });
});
