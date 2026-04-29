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
  it("renders the premium CasaHUD entry shell instead of the old mock-first workflow", () => {
    const html = renderToStaticMarkup(<StudioAppPage />);

    expect(html).toContain(">Generate Viral Video Title<");
    expect(html).toContain(">Connections<");
    expect(html).toContain(">Recent Campaigns<");
    expect(html).toContain(">Campaigns<");
    expect(html).not.toContain("Generate your next viral property video");
    expect(html).not.toContain("Mode: Mock-first MVP");
    expect(html).not.toContain("CasaHUD Campaign Workflow");
    expect(html).not.toContain("Campaign Setup");
    expect(html).not.toContain("Generate Mock Viral Titles");
  });
});
