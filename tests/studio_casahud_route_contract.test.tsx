import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import StudioAppPage from "@/app/apps/studio/page";

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
  it("renders the consolidated CasaHUD command center shell instead of the old mock-first workflow", () => {
    const html = renderToStaticMarkup(<StudioAppPage />);

    expect(html).toContain(">Generate Viral Video Title<");
    expect(html).toContain(">Campaign Overview<");
    expect(html).toContain(">Opportunity Brief<");
    expect(html).toContain(">Render &amp; Publish<");
    expect(html).not.toContain("Generate Mock Viral Titles");
    expect(html).not.toContain("Mode: Mock-first MVP");
    expect(html).not.toContain("CasaHUD Campaign Workflow");
    expect(html).not.toContain("Campaign Setup");
  });
});
