import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getWalmartProductBySkuForUser: vi.fn(),
  isWalmartProductArchivedForUser: vi.fn(),
  listWalmartDraftsForUser: vi.fn(),
  normalizeWalmartDraftsForEditor: vi.fn(),
  getWalmartOpenAiConnectionStatusForUser: vi.fn(),
  getWalmartSerpApiConnectionStatusForUser: vi.fn(),
  getWalmartConnectionHealthForUser: vi.fn(),
  hydrateLiveWalmartItemStateForUser: vi.fn(),
  hydrateCurrentWalmartState: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-products", () => ({
  getWalmartProductBySkuForUser: mocks.getWalmartProductBySkuForUser,
  isWalmartProductArchivedForUser: mocks.isWalmartProductArchivedForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-drafts", () => ({
  listWalmartDraftsForUser: mocks.listWalmartDraftsForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-product-editor-hardening", () => ({
  normalizeWalmartDraftsForEditor: mocks.normalizeWalmartDraftsForEditor,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-openai-connection", () => ({
  getWalmartOpenAiConnectionStatusForUser: mocks.getWalmartOpenAiConnectionStatusForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-serpapi-connection", () => ({
  getWalmartSerpApiConnectionStatusForUser: mocks.getWalmartSerpApiConnectionStatusForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-auth", () => ({
  getWalmartConnectionHealthForUser: mocks.getWalmartConnectionHealthForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-live-item-hydrator", () => ({
  hydrateLiveWalmartItemStateForUser: mocks.hydrateLiveWalmartItemStateForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-native-state", () => ({
  hydrateCurrentWalmartState: mocks.hydrateCurrentWalmartState,
}));

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_live_page_1",
    marketplace: "walmart",
    sku: "ROC948",
    externalItemId: "wm_roc948",
    title: "Sample Product",
    brand: "Sample Brand",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 7,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
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

describe("Walmart product editor page live hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_live_page",
      unauthorizedResponse: null,
    });
    mocks.getWalmartProductBySkuForUser.mockResolvedValue(createProduct());
    mocks.isWalmartProductArchivedForUser.mockResolvedValue(false);
    mocks.listWalmartDraftsForUser.mockResolvedValue([]);
    mocks.normalizeWalmartDraftsForEditor.mockReturnValue({
      drafts: [],
      diagnostics: {
        repairedCount: 0,
        droppedCount: 0,
        warnings: [],
      },
    });
    mocks.getWalmartOpenAiConnectionStatusForUser.mockResolvedValue({ connected: false });
    mocks.getWalmartSerpApiConnectionStatusForUser.mockResolvedValue({ connected: false });
    mocks.getWalmartConnectionHealthForUser.mockResolvedValue({
      connectionStatus: "connected",
      summary: {
        tokenStatus: "valid",
        safeReadStatus: "valid",
      },
    });
  });

  it("uses live hydration state on page load when live hydration succeeds", async () => {
    const liveState = {
      stateType: "current",
      sku: "ROC948",
      hydration: { status: "liveHydrated" },
    };
    mocks.hydrateLiveWalmartItemStateForUser.mockResolvedValue({
      currentWalmartState: liveState,
      diagnostics: {},
      rawLivePayload: null,
    });

    const WalmartProductEditorPage = (await import("@/app/apps/ecomviper/walmart/products/[sku]/page")).default;
    const result = await WalmartProductEditorPage({
      params: Promise.resolve({ sku: "ROC948" }),
    });

    expect(mocks.hydrateLiveWalmartItemStateForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_live_page",
        product: expect.objectContaining({ sku: "ROC948" }),
      })
    );
    expect(mocks.hydrateCurrentWalmartState).not.toHaveBeenCalled();
    expect((result as { props: Record<string, unknown> }).props.hydratedCurrentWalmartState).toEqual(
      liveState
    );
  });

  it("falls back to snapshot hydration when live hydration fails", async () => {
    const snapshotState = {
      stateType: "current",
      sku: "ROC948",
      hydration: { status: "snapshotFallback" },
    };
    mocks.hydrateLiveWalmartItemStateForUser.mockRejectedValue(new Error("live hydration failed"));
    mocks.hydrateCurrentWalmartState.mockReturnValue(snapshotState);

    const WalmartProductEditorPage = (await import("@/app/apps/ecomviper/walmart/products/[sku]/page")).default;
    const result = await WalmartProductEditorPage({
      params: Promise.resolve({ sku: "ROC948" }),
    });

    expect(mocks.hydrateCurrentWalmartState).toHaveBeenCalledWith({
      product: expect.objectContaining({ sku: "ROC948" }),
    });
    expect((result as { props: Record<string, unknown> }).props.hydratedCurrentWalmartState).toEqual(
      snapshotState
    );
  });

  it("uses snapshot fallback when credentials are unavailable and reports truthful hydration status", async () => {
    const snapshotState = {
      stateType: "current",
      sku: "ROC948",
      hydration: { status: "snapshotFallback" },
    };
    mocks.getWalmartConnectionHealthForUser.mockResolvedValue({
      connectionStatus: "not_connected",
      summary: {
        tokenStatus: "unknown",
        safeReadStatus: "unknown",
      },
    });
    mocks.getWalmartProductBySkuForUser.mockResolvedValue(
      createProduct({
        normalizedPayload: {
          docketHydrationStatus: ["imported_docket_ready"],
        },
      })
    );
    mocks.hydrateCurrentWalmartState.mockReturnValue(snapshotState);

    const WalmartProductEditorPage = (await import("@/app/apps/ecomviper/walmart/products/[sku]/page")).default;
    const result = await WalmartProductEditorPage({
      params: Promise.resolve({ sku: "ROC948" }),
    });

    expect(mocks.hydrateLiveWalmartItemStateForUser).not.toHaveBeenCalled();
    expect(mocks.hydrateCurrentWalmartState).toHaveBeenCalled();
    const props = (result as { props: Record<string, unknown> }).props;
    expect(props.hydratedCurrentWalmartState).toEqual(snapshotState);
    expect(props.hydrationStatuses).toEqual(
      expect.arrayContaining(["imported_docket_ready", "live_refresh_unavailable_no_credentials"])
    );
  });
});
