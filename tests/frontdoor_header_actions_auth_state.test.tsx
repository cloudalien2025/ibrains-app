import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FrontdoorHeaderActions from "@/components/frontdoor/frontdoor-header-actions";

const { resolveFrontdoorAuthStateMock } = vi.hoisted(() => ({
  resolveFrontdoorAuthStateMock: vi.fn(),
}));

vi.mock("@/lib/auth/frontdoorAuthState", () => ({
  resolveFrontdoorAuthState: resolveFrontdoorAuthStateMock,
}));

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

describe("frontdoor header actions", () => {
  beforeEach(() => {
    resolveFrontdoorAuthStateMock.mockReset();
  });

  it("shows Sign in and Create account when the launcher is signed out", async () => {
    resolveFrontdoorAuthStateMock.mockResolvedValue({ status: "signed-out" });

    const html = renderToStaticMarkup(await FrontdoorHeaderActions({ currentPath: "/apps" }));

    expect(html).toContain(">Sign in<");
    expect(html).toContain(">Create account<");
    expect(html).not.toContain("frontdoor-authenticated-state");
  });

  it("hides Sign in and Create account when the launcher is signed in", async () => {
    resolveFrontdoorAuthStateMock.mockResolvedValue({ status: "signed-in", userId: "user_123" });

    const html = renderToStaticMarkup(await FrontdoorHeaderActions({ currentPath: "/apps" }));

    expect(html).not.toContain(">Sign in<");
    expect(html).not.toContain(">Create account<");
    expect(html).toContain("frontdoor-authenticated-state");
    expect(html).toContain(">Open Console<");
  });

  it("re-resolves auth state on each render so refresh can switch the visible header state", async () => {
    resolveFrontdoorAuthStateMock
      .mockResolvedValueOnce({ status: "signed-out" })
      .mockResolvedValueOnce({ status: "signed-in", userId: "user_456" });

    const firstRender = renderToStaticMarkup(await FrontdoorHeaderActions({ currentPath: "/apps" }));
    const secondRender = renderToStaticMarkup(await FrontdoorHeaderActions({ currentPath: "/apps" }));

    expect(firstRender).toContain(">Sign in<");
    expect(secondRender).not.toContain(">Sign in<");
    expect(secondRender).toContain("frontdoor-authenticated-state");
    expect(resolveFrontdoorAuthStateMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a single auth state in the mobile header layout", async () => {
    resolveFrontdoorAuthStateMock.mockResolvedValue({ status: "signed-in", userId: "user_mobile" });

    const html = renderToStaticMarkup(await FrontdoorHeaderActions({ currentPath: "/apps" }));

    expect(html).toContain("flex-wrap");
    expect(html).not.toContain(">Sign in<");
    expect(html).not.toContain(">Create account<");
    expect((html.match(/frontdoor-authenticated-state/g) ?? []).length).toBe(1);
  });
});
