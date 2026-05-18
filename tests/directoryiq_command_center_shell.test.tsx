import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import DirectoryIqLayout from "@/app/apps/directoryiq/layout";
import DirectoryIQPage from "@/app/apps/directoryiq/page";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/apps/directoryiq",
}));

describe("DirectoryIQ workspace shell", () => {
  it("renders a desktop sidebar shell with command-center navigation", () => {
    const html = renderToStaticMarkup(
      <DirectoryIqLayout>
        <div>Workspace Content</div>
      </DirectoryIqLayout>
    );

    expect(html).toContain("directoryiq-layout-shell");
    expect(html).toContain("directoryiq-shell-sidebar");
    expect(html).toContain("Directory Intelligence Workspace");
    expect(html).toContain(">Dashboard<");
    expect(html).toContain(">Listings<");
    expect(html).toContain(">Authority<");
    expect(html).toContain(">Graph Integrity<");
    expect(html).toContain(">Connections<");
    expect(html).toContain(">History<");
    expect(html).toContain("Directory Intelligence Command Center");
  });

  it("keeps dashboard content inside the workspace shell", () => {
    const html = renderToStaticMarkup(
      <DirectoryIqLayout>
        <DirectoryIQPage />
      </DirectoryIqLayout>
    );

    expect(html).toContain("directoryiq-shell-sidebar");
    expect(html).toContain("AI Visibility Dashboard");
    expect(html).toContain("AI Selection Readiness");
    expect(html).toContain(">Review Listings<");
  });
});
