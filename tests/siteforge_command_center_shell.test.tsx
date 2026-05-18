import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import fs from "node:fs";
import path from "node:path";
import SiteForgeLayout from "@/app/apps/siteforge/layout";
import SiteForgePage from "@/app/apps/siteforge/page";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/apps/siteforge",
}));

describe("siteforge command-center shell", () => {
  it("renders shell layout with sidebar navigation", () => {
    const html = renderToStaticMarkup(
      <SiteForgeLayout>
        <div>Workspace Content</div>
      </SiteForgeLayout>
    );

    expect(html).toContain("siteforge-command-center-layout");
    expect(html).toContain("siteforge-shell-root");
    expect(html).toContain("siteforge-command-center-sidebar");
    expect(html).toContain("siteforge-command-center-nav");
    expect(html).toContain("siteforge-command-center-workspace");
    expect(html).toContain(">Command Center<");
    expect(html).toContain(">Connect<");
    expect(html).toContain(">Describe<");
    expect(html).toContain(">Launch<");
    expect(html).toContain(">Project Status<");
  });

  it("keeps existing SiteForge workspace content inside the shell", () => {
    const html = renderToStaticMarkup(
      <SiteForgeLayout>
        <SiteForgePage />
      </SiteForgeLayout>
    );

    expect(html).toContain("siteforge-command-center-sidebar");
    expect(html).toContain("siteforge-workspace-content");
    expect(html).toContain("siteforge-primary-workspace");
    expect(html).toContain("SiteForge 2050");
    expect(html).toContain("Your AI website partner");
    expect(html).toContain("No project selected");
    expect(html).toContain("Connect Website");
  });

  it("keeps page content shell-free so route layout owns command-center framing", () => {
    const pagePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const layoutPath = path.join(process.cwd(), "app/apps/siteforge/layout.tsx");
    const pageSource = fs.readFileSync(pagePath, "utf8");
    const layoutSource = fs.readFileSync(layoutPath, "utf8");

    expect(pageSource.includes('className="ibrains-shell min-h-screen text-[#0F172A]"')).toBe(false);
    expect(pageSource.includes('className="mx-auto max-w-[1280px] px-4 py-6 md:px-8"')).toBe(false);
    expect(pageSource.includes('data-testid="siteforge-workspace-content"')).toBe(true);
    expect(layoutSource.includes('data-testid="siteforge-command-center-layout"')).toBe(true);
    expect(layoutSource.includes('data-testid="siteforge-command-center-workspace"')).toBe(true);
  });
});
