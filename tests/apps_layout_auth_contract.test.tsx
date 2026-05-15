import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn<[], Promise<{ userId: string | null }>>(),
  redirect: vi.fn(),
  providerProps: [] as Array<{ publishableKey?: string }>,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/components/auth/configured-clerk-provider", () => ({
  default: ({ children, publishableKey }: { children: ReactNode; publishableKey?: string }) => {
    mocks.providerProps.push({ publishableKey });
    return createElement("div", { "data-testid": "clerk-provider" }, children);
  },
}));

describe("apps layout auth contract", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.mockReset();
    mocks.redirect.mockClear();
    mocks.providerProps.length = 0;
    process.env.CLERK_PUBLISHABLE_KEY = "pk_test_apps_layout";
  });

  it("renders children without server-side auth() dependency", async () => {
    const { default: AppsLayout } = await import("@/app/apps/layout");
    const tree = AppsLayout({ children: createElement("span", null, "launcher-ready") });
    const html = renderToString(tree);

    expect(html).toContain("apps-shell-layout");
    expect(html).toContain("launcher-ready");
    expect(mocks.providerProps.at(0)?.publishableKey).toBe("pk_test_apps_layout");
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
