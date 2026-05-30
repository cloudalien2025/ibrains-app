import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  runRocktomicSourceSync: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/dropshipping/rocktomic-source-ingestion", () => ({
  runRocktomicSourceSync: mocks.runRocktomicSourceSync,
}));

describe("supplier sync route auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.runRocktomicSourceSync.mockReset();
    delete process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN;
    delete process.env.ECOMVIPER_SYNC_DEFAULT_USER_ID;
  });

  it("accepts valid internal bearer token without signed-in session", async () => {
    process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN = "internal_sync_token";
    mocks.runRocktomicSourceSync.mockResolvedValue({
      supplier: "Rocktomic",
      syncStatus: "synced",
      lastAttemptedSyncAt: "2026-05-30T20:00:00.000Z",
      lastSuccessfulSyncAt: "2026-05-30T20:00:00.000Z",
      lastSyncError: null,
      syncRunSummary: {
        productsParsedCount: 10,
        inventoryRecordsParsedCount: 10,
        pricingRecordsParsedCount: 10,
        assetRecordsParsedCount: 10,
      },
      productCount: 10,
      inventorySkuCount: 10,
      catalogSkuCount: 10,
      catalogExtractedSkuCount: 10,
      sourceDiagnostics: [],
    });

    const { POST } = await import("@/app/api/ecomviper/supplier-sources/sync/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/supplier-sources/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer internal_sync_token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "__global__" }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.requireSignedInUser).not.toHaveBeenCalled();
    expect(mocks.runRocktomicSourceSync).toHaveBeenCalledWith({
      userId: "__global__",
      triggerKind: "cli",
    });
  });

  it("rejects invalid internal bearer token when no signed-in user exists", async () => {
    process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN = "internal_sync_token";
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: null,
    });

    const { POST } = await import("@/app/api/ecomviper/supplier-sources/sync/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/supplier-sources/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong_token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "__global__" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error?.code).toBe("UNAUTHORIZED");
    expect(mocks.runRocktomicSourceSync).not.toHaveBeenCalled();
  });

  it("rejects missing token when caller is not signed in", async () => {
    process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN = "internal_sync_token";
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: null,
    });

    const { POST } = await import("@/app/api/ecomviper/supplier-sources/sync/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/supplier-sources/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "__global__" }),
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.runRocktomicSourceSync).not.toHaveBeenCalled();
  });
});
