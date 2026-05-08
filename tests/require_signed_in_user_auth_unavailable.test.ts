import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const verifyTokenMock = vi.fn();
const cookiesMock = vi.fn();
const cookieGetMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  verifyToken: verifyTokenMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

describe("requireSignedInUser auth unavailable handling", () => {
  beforeEach(() => {
    authMock.mockReset();
    verifyTokenMock.mockReset();
    cookiesMock.mockReset();
    cookieGetMock.mockReset();
    cookiesMock.mockResolvedValue({
      get: cookieGetMock,
    });
    cookieGetMock.mockReturnValue(undefined);
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

  it("returns a verified user when auth() fails but session token verifies", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_require_signed_in_user";
    authMock.mockRejectedValue(new Error("Clerk middleware unavailable"));
    cookieGetMock.mockReturnValue({ value: "session_token_value" });
    verifyTokenMock.mockResolvedValue({ sub: "user_from_verified_token" });
    const { requireSignedInUser } = await import("@/lib/auth/requireSignedInUser");

    const result = await requireSignedInUser();

    expect(result.userId).toBe("user_from_verified_token");
    expect(result.unauthorizedResponse).toBeNull();
  });
});
