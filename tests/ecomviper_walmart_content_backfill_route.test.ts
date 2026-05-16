import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  queueWalmartHistoricalContentBackfillForUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-products", () => ({
  queueWalmartHistoricalContentBackfillForUser: mocks.queueWalmartHistoricalContentBackfillForUser,
}));

describe("walmart historical content backfill route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.queueWalmartHistoricalContentBackfillForUser.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: new Response(null, { status: 401 }),
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/content-backfill/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/products/content-backfill", {
        method: "POST",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error?.code).toBe("UNAUTHORIZED");
  });

  it("queues historical content backfill with parsed maxSkus", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_1",
      unauthorizedResponse: null,
    });
    mocks.queueWalmartHistoricalContentBackfillForUser.mockResolvedValue({
      queued: true,
      reason: "queued",
      requestedSkuCount: 87,
      candidateSkuCount: 153,
      cycleCount: 2,
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/content-backfill/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/products/content-backfill", {
        method: "POST",
        body: JSON.stringify({ maxSkus: "150" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload?.ok).toBe(true);
    expect(payload?.queued).toBe(true);
    expect(payload?.message).toContain("queued for 87 SKU");
    expect(mocks.queueWalmartHistoricalContentBackfillForUser).toHaveBeenCalledWith({
      userId: "user_1",
      maxSkus: 150,
    });
  });

  it("returns deterministic no-target message when no candidates exist", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_1",
      unauthorizedResponse: null,
    });
    mocks.queueWalmartHistoricalContentBackfillForUser.mockResolvedValue({
      queued: false,
      reason: "no_target_skus",
      requestedSkuCount: 0,
      candidateSkuCount: 0,
      cycleCount: 0,
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/products/content-backfill/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ecomviper/walmart/products/content-backfill", {
        method: "POST",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload?.ok).toBe(true);
    expect(payload?.queued).toBe(false);
    expect(payload?.reason).toBe("no_target_skus");
    expect(payload?.message).toContain("No missing-content Walmart products");
  });
});
