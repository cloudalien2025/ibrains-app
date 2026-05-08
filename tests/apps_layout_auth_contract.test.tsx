import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn<[], Promise<{ userId: string | null }>>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/components/auth/configured-clerk-provider", () => ({
  default: ({ children }: { children: ReactNode }) => createElement("div", { "data-testid": "clerk-provider" }, children),
}));

describe("apps layout auth contract", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.redirect.mockClear();
    delete process.env.E2E_MOCK_GRAPH;
    process.env.CLERK_PUBLISHABLE_KEY = "pk_test_apps_layout";
  });

  it("renders children when a user session exists", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_test_123" });

    const { default: AppsLayout } = await import("@/app/apps/layout");
    const tree = await AppsLayout({ children: createElement("span", null, "launcher-ready") });
    const html = renderToString(tree);

    expect(html).toContain("launcher-ready");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects signed-out requests to /sign-in", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const { default: AppsLayout } = await import("@/app/apps/layout");

    await expect(async () => {
      const tree = await AppsLayout({ children: createElement("span", null, "launcher") });
      renderToString(tree);
    }).rejects.toThrow("NEXT_REDIRECT:/sign-in");
  });
});
