import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateLiveWalmartItemStateForUser } from "@/lib/ecomviper/walmart/walmart-live-item-hydrator";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const mocks = vi.hoisted(() => ({
  requestWalmartTokenForUser: vi.fn(),
}));

vi.mock("@/lib/ecomviper/walmart/walmart-auth", () => ({
  requestWalmartTokenForUser: mocks.requestWalmartTokenForUser,
}));

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_live_1",
    marketplace: "walmart",
    sku: "LIVE-1",
    externalItemId: "wm_live_1",
    title: "Snapshot Product Name",
    brand: "Snapshot Brand",
    category: "Supplements",
    price: 14.99,
    inventoryQuantity: 5,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "https://images.example.com/snapshot-primary.jpg",
    imageStatus: "image_available",
    imageStatusMessage: "Image available",
    imageSyncStatus: "found",
    imageSource: "walmart_catalog",
    issues: [],
    attributes: {
      product_type: "Supplement",
      supplement_type: "Daily Supplement",
    },
    searchBrowseAttributes: {
      product_type: "Supplement",
      supplement_type: "Daily Supplement",
    },
    shortDescription: "Snapshot short description",
    longDescription: "Snapshot long description",
    bulletPoints: ["Snapshot bullet"],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Walmart live item hydrator", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    mocks.requestWalmartTokenForUser.mockReset();
    delete (globalThis as typeof globalThis & {
      __ecomviper_walmart_live_hydration_cache__?: Map<string, unknown>;
    }).__ecomviper_walmart_live_hydration_cache__;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("hydrates currentWalmartState from live Walmart payloads when credentials exist", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      accessToken: "token_live",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      lastError: null,
    });

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          item: {
            sku: "LIVE-1",
            productName: "Live Product Name",
            brand: "Live Brand",
            siteDescription: "Live site description",
            longDescription: "Live long description",
            keyFeatures: ["Live bullet one", "Live bullet two"],
            priceInfo: { currentPrice: 19.95 },
            inventory: { quantity: 17 },
            imageInfo: {
              primaryImageUrl: "https://images.example.com/live-primary.jpg",
              allImages: [
                { url: "https://images.example.com/live-primary.jpg" },
                { url: "https://images.example.com/live-gallery-1.jpg" },
              ],
            },
            attributes: [
              { name: "product_type", value: "Supplement" },
              { name: "supplement_type", value: "Vitamin" },
              { name: "serving_size", value: "1 gummy" },
            ],
          },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await hydrateLiveWalmartItemStateForUser({
      userId: "user_live",
      product: createProduct(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.status).toBe("liveHydrated");
    expect(result.diagnostics.source).toBe("live_walmart_api");
    expect(result.currentWalmartState.hydration.status).toBe("liveHydrated");
    expect(result.currentWalmartState.hydration.source).toBe("live_walmart_api");
    expect(result.currentWalmartState.content.productName).toBe("Live Product Name");
    expect(result.currentWalmartState.content.brand).toBe("Live Brand");
    expect(result.currentWalmartState.searchBrowse.attributes.serving_size).toBe("1 gummy");
    expect(result.currentWalmartState.pricingInventory.currentPrice).toBe(19.95);
    expect(result.rawLivePayload).not.toBeNull();
  });

  it("falls back to snapshot hydration when Walmart credentials are unavailable", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: false,
      accessToken: null,
      expiresAt: null,
      lastError: { message: "Missing Walmart credentials." },
    });
    vi.stubGlobal("fetch", vi.fn());

    const result = await hydrateLiveWalmartItemStateForUser({
      userId: "user_missing_token",
      product: createProduct(),
    });

    expect(result.diagnostics.status).toBe("snapshotFallback");
    expect(result.diagnostics.source).toBe("imported_snapshot");
    expect(result.diagnostics.fallbackReason).toContain("Missing Walmart credentials");
    expect(result.currentWalmartState.hydration.status).toBe("snapshotFallback");
    expect(result.currentWalmartState.hydration.source).toBe("imported_snapshot");
    expect(JSON.stringify(result.currentWalmartState).toLowerCase()).not.toContain("faq");
  });

  it("uses cache hit and avoids redundant Walmart API calls", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      accessToken: "token_live",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      lastError: null,
    });

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          item: {
            sku: "LIVE-1",
            productName: "Live Product Name",
            brand: "Live Brand",
            priceInfo: { currentPrice: 15.75 },
            inventory: { quantity: 12 },
            attributes: [{ name: "product_type", value: "Supplement" }],
          },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await hydrateLiveWalmartItemStateForUser({
      userId: "cache_user",
      product: createProduct(),
    });
    const second = await hydrateLiveWalmartItemStateForUser({
      userId: "cache_user",
      product: createProduct(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.diagnostics.cacheState).toBe("hit");
    expect(second.currentWalmartState.hydration.cacheState).toBe("hit");
    expect(second.currentWalmartState.hydration.status).toBe("liveHydrated");
  });

  it("returns stale live cache as partial hydration when refresh fails", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      accessToken: "token_live",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      lastError: null,
    });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse({
            item: {
              sku: "LIVE-1",
              productName: "Initial Live Product Name",
              brand: "Live Brand",
              priceInfo: { currentPrice: 20.25 },
              inventory: { quantity: 11 },
            },
          })
        )
      )
      .mockImplementation(() => Promise.resolve(jsonResponse({ error: "down" }, 500)));
    vi.stubGlobal("fetch", fetchMock);

    await hydrateLiveWalmartItemStateForUser({
      userId: "stale_user",
      product: createProduct(),
    });
    const refreshed = await hydrateLiveWalmartItemStateForUser({
      userId: "stale_user",
      product: createProduct(),
      forceRefresh: true,
    });

    expect(refreshed.diagnostics.status).toBe("partialHydration");
    expect(refreshed.diagnostics.source).toBe("stale_live_cache");
    expect(refreshed.diagnostics.stale).toBe(true);
    expect(refreshed.currentWalmartState.hydration.status).toBe("partialHydration");
    expect(refreshed.currentWalmartState.hydration.source).toBe("stale_live_cache");
    expect(refreshed.currentWalmartState.content.productName).toBe("Initial Live Product Name");
  });
});
