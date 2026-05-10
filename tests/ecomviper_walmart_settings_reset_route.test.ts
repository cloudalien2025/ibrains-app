import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  disconnectWalmart: vi.fn(),
  countActiveWalmartDraftsForUser: vi.fn(),
  clearWalmartProductsForUser: vi.fn(),
  clearPersistedWalmartDraftsForUser: vi.fn(),
  clearDrafts: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-auth", () => ({
  disconnectWalmart: mocks.disconnectWalmart,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-drafts", () => ({
  countActiveWalmartDraftsForUser: mocks.countActiveWalmartDraftsForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-products", () => ({
  clearWalmartProductsForUser: mocks.clearWalmartProductsForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-draft-repository", () => ({
  clearPersistedWalmartDraftsForUser: mocks.clearPersistedWalmartDraftsForUser,
}));

vi.mock("@/lib/ecomviper/walmart/walmart-store", () => ({
  clearDrafts: mocks.clearDrafts,
}));

describe("walmart settings reset route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.disconnectWalmart.mockReset();
    mocks.countActiveWalmartDraftsForUser.mockReset();
    mocks.clearWalmartProductsForUser.mockReset();
    mocks.clearPersistedWalmartDraftsForUser.mockReset();
    mocks.clearDrafts.mockReset();
  });

  it("blocks clear_products when active drafts exist", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.countActiveWalmartDraftsForUser.mockResolvedValue(2);

    const { POST } = await import("@/app/api/ecomviper/walmart/settings/reset/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/settings/reset", {
        method: "POST",
        body: JSON.stringify({ action: "clear_products" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.blockedDraftCount).toBe(2);
    expect(payload.error?.code).toBe("ACTIVE_DRAFTS_BLOCK_CLEAR");
    expect(mocks.clearWalmartProductsForUser).not.toHaveBeenCalled();
  });

  it("clears durable products when no active drafts exist", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_clerk_1",
      unauthorizedResponse: null,
    });
    mocks.countActiveWalmartDraftsForUser.mockResolvedValue(0);
    mocks.clearWalmartProductsForUser.mockResolvedValue({
      clearedProductCount: 4,
      clearedImportStateCount: 1,
      clearedImageMetadataCount: 4,
    });

    const { POST } = await import("@/app/api/ecomviper/walmart/settings/reset/route");
    const response = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/settings/reset", {
        method: "POST",
        body: JSON.stringify({ action: "clear_products" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.action).toBe("clear_products");
    expect(payload.clearedProductCount).toBe(4);
    expect(payload.clearedImportStateCount).toBe(1);
    expect(payload.clearedImageMetadataCount).toBe(4);
    expect(payload.blockedDraftCount).toBe(0);
    expect(mocks.clearWalmartProductsForUser).toHaveBeenCalledWith("user_clerk_1");
  });
});
