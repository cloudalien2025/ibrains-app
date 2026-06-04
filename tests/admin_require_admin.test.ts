import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

describe("admin require-admin helper", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.redirect.mockClear();
    mocks.notFound.mockClear();
    delete process.env.E2E_MOCK_GRAPH;
  });

  it("redirects unauthenticated users to sign-in", async () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = "admin@example.com";
    mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });

    const { requireAdmin } = await import("@/lib/admin/require-admin");

    await expect(requireAdmin({ redirectPath: "/admin/ecomviper" })).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?redirect_url=%2Fadmin%2Fecomviper"
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("denies signed-in users that are not allowlisted", async () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = "admin@example.com";
    mocks.auth.mockResolvedValue({
      userId: "user_123",
      sessionClaims: { email: "member@example.com" },
    });

    const { requireAdmin } = await import("@/lib/admin/require-admin");

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("allows allowlisted admin users", async () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = "admin@example.com,owner@example.com";
    mocks.auth.mockResolvedValue({
      userId: "user_admin",
      sessionClaims: { email: "owner@example.com" },
    });

    const { requireAdmin } = await import("@/lib/admin/require-admin");

    await expect(requireAdmin()).resolves.toEqual({
      userId: "user_admin",
      email: "owner@example.com",
    });
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
