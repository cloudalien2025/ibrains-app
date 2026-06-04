import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import StudioCasaFlixPage from "@/app/casaflix/page";
import StudioCasaHudPage from "@/app/reelify/page";

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

describe("CasaFlix and Reelify route contract", () => {
  it("renders CasaFlix on /casaflix instead of the Studio launcher", () => {
    const html = renderToStaticMarkup(<StudioCasaFlixPage />);

    expect(html).toContain("casahud-workspace-shell");
    expect(html).toContain(">CasaFlix<");
    expect(html).toContain(">Campaigns<");
    expect(html).toContain(">Viral Titles<");
    expect(html).not.toContain("studio-app-launcher");
  });

  it("renders /reelify as independent top-level brain route", () => {
    const html = renderToStaticMarkup(<StudioCasaHudPage />);

    expect(html).toContain("casahud-workspace-shell");
    expect(html).toContain(">CasaFlix<");
    expect(html).toContain(">Campaigns<");
    expect(html).toContain(">Viral Titles<");
    expect(html).not.toContain("studio-app-launcher");
  });
});
