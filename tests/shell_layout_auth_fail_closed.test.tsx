import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn<[], Promise<{ userId: string | null }>>(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  resolveVerifiedClerkSessionUserId: vi.fn<[], Promise<string | null>>(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => createElement("div", { "data-testid": "user-button" }, "user"),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  usePathname: () => "/brains",
}));

vi.mock("@/components/auth/configured-clerk-provider", () => ({
  default: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "configured-clerk-provider" }, children),
}));

vi.mock("@/lib/auth/clerkSessionToken", () => ({
  resolveVerifiedClerkSessionUserId: mocks.resolveVerifiedClerkSessionUserId,
}));

describe("shell layout auth fail-closed behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.redirect.mockClear();
    mocks.resolveVerifiedClerkSessionUserId.mockReset();
    process.env.E2E_MOCK_GRAPH = "0";
    process.env.NODE_ENV = "development";
    process.env.CLERK_SECRET_KEY = "sk_test_shell_layout";
    process.env.CLERK_PUBLISHABLE_KEY = "pk_test_shell_layout";
  });

  it("recovers from auth() throw when verified session user id is available", async () => {
    mocks.auth.mockRejectedValue(new Error("auth unavailable"));
    mocks.resolveVerifiedClerkSessionUserId.mockResolvedValue("user_verified_123");

    const { default: ShellLayout } = await import("@/app/(shell)/layout");
    const element = await ShellLayout({ children: createElement("span", null, "brains-shell") });
    const html = renderToString(element);

    expect(html).toContain("brains-shell");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.resolveVerifiedClerkSessionUserId).toHaveBeenCalledTimes(1);
  });

  it("redirects to sign-in instead of throwing server error when auth cannot resolve a user", async () => {
    mocks.auth.mockRejectedValue(new Error("auth unavailable"));
    mocks.resolveVerifiedClerkSessionUserId.mockResolvedValue(null);

    const { default: ShellLayout } = await import("@/app/(shell)/layout");

    await expect(
      ShellLayout({ children: createElement("span", null, "brains-shell") })
    ).rejects.toThrow("REDIRECT:/sign-in");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });
});
