import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
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
    expect(html).toContain("siteforge-command-center-sidebar");
    expect(html).toContain("siteforge-command-center-nav");
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
    expect(html).toContain("SiteForge 2050");
    expect(html).toContain("Your AI website partner");
    expect(html).toContain("No project selected");
    expect(html).toContain("Connect Website");
  });
});
