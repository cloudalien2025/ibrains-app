import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import StudioAppPage from "@/app/apps/studio/page";
import StudioCasaFlixPage from "@/app/apps/studio/casaflix/page";
import StudioCasaHudPage from "@/app/apps/studio/casahud/page";

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

describe("/apps/studio route contract", () => {
  it("renders Studio as the launcher with app cards", () => {
    const html = renderToStaticMarkup(<StudioAppPage />);

    expect(html).toContain("studio-app-launcher");
    expect(html).toContain(">Studio<");
    expect(html).toContain(">CasaFlix<");
    expect(html).toContain("Real-estate YouTube content engine.");
    expect(html).toContain('href="/apps/studio/casaflix"');
    expect(html).toContain(">Open CasaFlix<");
    expect(html).toContain(">UAP Forge<");
    expect(html).toContain(">Coming Soon<");
    expect(html).toContain(">Future Studio Apps<");
    expect(html).not.toContain("Generate Mock Viral Titles");
    expect(html).not.toContain("Mode: Mock-first MVP");
  });

  it("renders CasaFlix on /apps/studio/casaflix instead of the Studio launcher", () => {
    const html = renderToStaticMarkup(<StudioCasaFlixPage />);

    expect(html).toContain("casahud-workspace-shell");
    expect(html).toContain(">CasaFlix<");
    expect(html).toContain(">Campaigns<");
    expect(html).toContain(">Viral Titles<");
    expect(html).not.toContain("studio-app-launcher");
  });

  it("keeps /apps/studio/casahud as backward-compatible alias", () => {
    const html = renderToStaticMarkup(<StudioCasaHudPage />);

    expect(html).toContain("casahud-workspace-shell");
    expect(html).toContain(">CasaFlix<");
    expect(html).toContain(">Campaigns<");
    expect(html).toContain(">Viral Titles<");
    expect(html).not.toContain("studio-app-launcher");
  });
});
