import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("iBrains global shell contract", () => {
  it("defines a shared global header with account controls and /brains logo link", () => {
    const source = readSource("components/ibrains/ibrains-global-header.tsx");

    expect(source).toContain("data-testid=\"ibrains-global-header\"");
    expect(source).toContain("sticky top-0");
    expect(source).toContain("href=\"/brains\"");
    expect(source).toContain("ibrains-logo-link");
    expect(source).toContain("ibrains-header-settings");
    expect(source).toContain("ibrains-header-notifications");
    expect(source).toContain("ibrains-header-user");
    expect(source).toContain("ibrains-header-logout");
    expect(source).toContain("SignOutButton");
    expect(source).toContain("Settings");
    expect(source).toContain("Notifications");
    expect(source).toContain("Log out");
  });

  it("wires the global header into /brains shell layout without top wrapper padding", () => {
    const shellSource = readSource("app/(shell)/layout.tsx");

    expect(shellSource).toContain("IbrainsGlobalHeader");
    expect(shellSource).toContain("data-testid=\"ibrains-shell-layout\"");
    expect(shellSource).toContain("max-w-[1600px] px-3 py-4");
  });

  it("uses shared workspace shell for ecomviper and admin route families", () => {
    const ecomLayoutSource = readSource("app/ecomviper/layout.tsx");
    const adminLayoutSource = readSource("app/admin/layout.tsx");

    expect(ecomLayoutSource).toContain("IbrainsWorkspaceShell");
    expect(ecomLayoutSource).toContain("ecomviper-shell-sidebar");
    expect(ecomLayoutSource).toContain("ecomviper-shell-workspace");

    expect(adminLayoutSource).toContain("requireAdmin");
    expect(adminLayoutSource).toContain("IbrainsWorkspaceShell");
    expect(adminLayoutSource).toContain("admin-shell-sidebar");
    expect(adminLayoutSource).toContain("admin-shell-workspace");
    expect(adminLayoutSource).toContain("admin-user-email");
  });

  it("keeps ecomviper page family rendered inside workspace body instead of standalone full-screen wrappers", () => {
    const dashboardClientSource = readSource("app/ecomviper/ecomviper-dashboard-client.tsx");
    const settingsSource = readSource("app/ecomviper/settings/page.tsx");
    const rocktomicSource = readSource("app/ecomviper/dropshipping/rocktomic/page.tsx");
    const productEditorSource = readSource(
      "app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx"
    );

    expect(dashboardClientSource).toContain("data-testid=\"ecomviper-overview-page\"");
    expect(settingsSource).toContain("data-testid=\"ecomviper-settings-page\"");
    expect(rocktomicSource).toContain("data-testid=\"ecomviper-rocktomic-page\"");
    expect(productEditorSource).toContain("data-testid=\"ecomviper-product-editor-page\"");

    expect(settingsSource).not.toContain("<main className=\"ibrains-shell min-h-screen");
    expect(rocktomicSource).not.toContain("<main className=\"ibrains-shell min-h-screen");
  });

  it("renders /brains without duplicate iBrains Dashboard or My Brains hero sections", async () => {
    const pageMod = await import("@/app/(shell)/brains/page");
    const html = renderToStaticMarkup(await pageMod.default());

    const headingMatches = html.match(/iBrains Dashboard/g) || [];
    expect(headingMatches.length).toBe(1);
    expect(html).not.toContain("My Brains");
  });
});
