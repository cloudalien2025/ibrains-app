import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import StudioDomaraClient from "@/app/casaflix/studio-domara-client";

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

describe("CasaFlix entry shell", () => {
  it("renders the compact CasaFlix workspace shell with the reset sidebar labels", () => {
    const html = renderToStaticMarkup(<StudioDomaraClient />);

    expect(html).toContain("casahud-workspace-shell");
    expect(html).toContain("casahud-sidebar");
    expect(html).toContain(">Campaigns<");
    expect(html).toContain(">Viral Titles<");
    expect(html).toContain(">Properties<");
    expect(html).toContain(">Connections<");
    expect(html).toContain(">Generate Viral Video Title<");
    expect(html).toContain("No campaign selected.");
    expect(html).not.toContain("CasaHUD");
    expect(html).not.toContain("Domara");
    expect(html).not.toContain(">Dashboard<");
    expect(html).not.toContain(">Opportunity Brief<");
    expect(html).not.toContain(">Property Shortlist<");
    expect(html).not.toContain(">Video Builder<");
    expect(html).not.toContain("Generate your next viral property video");

    for (const bubble of ["DB", "VT", "PS", "LI", "SS", "ML", "SB", "RP", "PB", "CN", "ST"]) {
      expect(html).not.toContain(`>${bubble}<`);
    }
  });
});
