import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

describe("admin layout auth contract", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireAdmin.mockReset();
    mocks.requireAdmin.mockResolvedValue({
      userId: "user_admin",
      email: "admin@example.com",
    });
  });

  it("requires admin session server-side for /admin route tree", async () => {
    const { default: AdminLayout } = await import("@/app/admin/layout");
    const html = renderToString(
      await AdminLayout({ children: createElement("div", null, "admin-content") })
    );

    expect(mocks.requireAdmin).toHaveBeenCalledWith({ redirectPath: "/admin" });
    expect(html).toContain("iBrains Admin");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("admin-content");
  });
});
