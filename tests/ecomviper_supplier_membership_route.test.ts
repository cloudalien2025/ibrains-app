import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSignedInUserMock = vi.fn();
const getTierMock = vi.fn();
const saveTierMock = vi.fn();

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: (...args: unknown[]) => requireSignedInUserMock(...args),
}));

vi.mock("@/lib/ecomviper/settings/supplier-membership", () => ({
  getSupplierMembershipTierSelectionForUser: (...args: unknown[]) => getTierMock(...args),
  saveSupplierMembershipTierSelectionForUser: (...args: unknown[]) => saveTierMock(...args),
}));

describe("ecomviper supplier membership settings route", () => {
  beforeEach(() => {
    requireSignedInUserMock.mockReset();
    getTierMock.mockReset();
    saveTierMock.mockReset();
  });

  it("returns saved membership tier for authenticated user", async () => {
    requireSignedInUserMock.mockResolvedValue({ userId: "user-1", unauthorizedResponse: null });
    getTierMock.mockResolvedValue("VIP");

    const { GET } = await import("@/app/api/ecomviper/settings/supplier-membership/route");
    const response = await GET();
    const json = (await response.json()) as { ok?: boolean; membershipTier?: string | null };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.membershipTier).toBe("VIP");
  });

  it("persists submitted membership tier", async () => {
    requireSignedInUserMock.mockResolvedValue({ userId: "user-2", unauthorizedResponse: null });
    saveTierMock.mockResolvedValue("Starter");

    const { POST } = await import("@/app/api/ecomviper/settings/supplier-membership/route");
    const request = new Request("http://localhost/api/ecomviper/settings/supplier-membership", {
      method: "POST",
      body: JSON.stringify({ membershipTier: "Starter" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request as never);
    const json = (await response.json()) as { ok?: boolean; membershipTier?: string | null };

    expect(response.status).toBe(200);
    expect(saveTierMock).toHaveBeenCalledWith({ userId: "user-2", membershipTier: "Starter" });
    expect(json.ok).toBe(true);
    expect(json.membershipTier).toBe("Starter");
  });
});
