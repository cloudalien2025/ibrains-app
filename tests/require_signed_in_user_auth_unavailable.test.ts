import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

describe("requireSignedInUser auth unavailable handling", () => {
  beforeEach(() => {
    authMock.mockReset();
    delete process.env.E2E_MOCK_GRAPH;
  });

  it("returns 503 response instead of throwing when clerk auth is unavailable", async () => {
    authMock.mockRejectedValue(new Error("Clerk middleware unavailable"));
    const { requireSignedInUser } = await import("@/lib/auth/requireSignedInUser");

    const result = await requireSignedInUser();
    expect(result.userId).toBeNull();
    expect(result.unauthorizedResponse).not.toBeNull();
    expect(result.unauthorizedResponse?.status).toBe(503);
    const body = await result.unauthorizedResponse?.json();
    expect(body?.error?.code).toBe("AUTH_UNAVAILABLE");
  });
});
