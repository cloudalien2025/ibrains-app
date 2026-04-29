import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import StudioDomaraClient from "@/app/apps/studio/studio-domara-client";

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: ReactNode;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

describe("CasaHUD entry shell", () => {
  it("renders the campaign-centered command center shell by default", () => {
    const html = renderToStaticMarkup(<StudioDomaraClient />);

    expect(html).toContain("casahud-workspace-shell");
    expect(html).toContain("casahud-sidebar");
    expect(html).toContain(">Generate Viral Video Title<");
    expect(html).toContain("No campaign selected.");
    expect(html).toContain(">Opportunity Brief<");
    expect(html).toContain(">Property Shortlist<");
    expect(html).toContain(">Video Builder<");
    expect(html).not.toContain(">Viral Titles<");
    expect(html).not.toContain("Generate Mock Viral Titles");
    expect(html).not.toContain("<form");
  });
});
