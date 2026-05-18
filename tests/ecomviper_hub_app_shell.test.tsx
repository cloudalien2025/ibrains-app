import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import HubLayout from "@/app/apps/ecomviper/hub/layout";
import EcomViperHubPage from "@/app/apps/ecomviper/hub/page";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

describe("EcomViper Hub app shell route", () => {
  it("renders a Walmart-style workspace shell with left sidebar and right command-center panels", () => {
    const page = EcomViperHubPage();
    const html = renderToStaticMarkup(<HubLayout>{page}</HubLayout>);

    expect(html).toContain("ecomviper-hub-layout");
    expect(html).toContain("ecomviper-hub-sidebar");
    expect(html).toContain("ecomviper-hub-workspace");
    expect(html).toContain("Hub Control Plane");
    expect(html).toContain("Overview");
    expect(html).toContain("Feed Control Center");
    expect(html).toContain("Canonical Product Manager");
    expect(html).toContain("Agentic Visibility");
    expect(html).toContain("Marketplace Routing");
    expect(html).toContain("Trust &amp; Verification");
    expect(html).toContain("Operations");
    expect(html).toContain("Roadmap");
  });

  it("renders required Hub shell sections with planning-aligned initial-shell messaging", () => {
    const html = renderToStaticMarkup(EcomViperHubPage());

    expect(html).toContain("AI-Native Commerce Intelligence Command Center");
    expect(html).toContain("Hub Overview");
    expect(html).toContain("Canonical Product Intelligence Graph");
    expect(html).toContain("Feed Control Center");
    expect(html).toContain("Marketplace Routing");
    expect(html).toContain("Agentic Visibility");
    expect(html).toContain("Trust and Verification");
    expect(html).toContain("Operator Workflows");
    expect(html).toContain("Roadmap / Coming Next");

    expect(html).toContain("not a listing database");
    expect(html).toContain("initial Hub shell only");
    expect(html).toContain("No feed ingestion");
    expect(html).toContain("planning/apps/ecomviper/hub/");
  });
});
