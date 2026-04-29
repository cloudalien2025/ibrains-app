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

describe("CasaHUD Phase 1 entry shell", () => {
  it("renders the premium title-first entry experience by default", () => {
    const html = renderToStaticMarkup(<StudioDomaraClient />);

    expect(html).toContain("Generate your next viral property video");
    expect(html).toContain(">Generate Viral Video Title<");
    expect(html).toContain(">Connections<");
    expect(html).toContain(">Recent Campaigns<");
    expect(html).toContain("No campaigns yet.");
    expect(html).toContain("Generate your first viral property video title to start a CasaHUD campaign.");
    expect(html).toContain(">Dashboard<");
    expect(html).toContain("Current workspace");
    expect(html).toContain("casahud-entry-hero");
    expect(html).toContain("casahud-recent-campaigns");
    expect(html).toContain("casahud-connections-entry");
    expect(html).not.toContain(">Generate Viral Video<");
    expect(html).not.toContain("Generate Mock Viral Titles");
    expect(html).not.toContain("<form");
  });
});
