// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import BrainsTable from "@/app/(shell)/brains/_components/BrainsTable";
import type { BrainViewEntry } from "@/lib/brains/brainCatalog";

type BrainDockState = {
  entitled: boolean;
  lastUpdated?: string | null;
  readinessPct?: number | null;
  totalItems?: number | null;
};

type BrainDockView = BrainViewEntry & BrainDockState;

function sampleBrain(id: string, name: string): BrainDockView {
  return {
    id,
    name,
    shortDescription: `${name} description`,
    tags: ["Tag"],
    primaryCtaText: "Open Brain",
    upsellTitle: `Unlock ${name}`,
    upsellMessage: `Activate ${name}`,
    iconKey: "map",
    entitled: true,
    lastUpdated: null,
    readinessPct: null,
    totalItems: null,
  };
}

describe("brains table hydration resilience", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("still renders canonical cards when stats hydration fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network failure");
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const brains = [
      sampleBrain("ecomviper", "EcomViper"),
      sampleBrain("optibay", "OptiBay"),
      sampleBrain("optiwal", "OptiWal"),
      sampleBrain("optizon", "OptiZon"),
      sampleBrain("directoryiq", "DirectoryIQ"),
      sampleBrain("casaflix", "CasaFlix"),
      sampleBrain("pagebolt", "PageBolt"),
      sampleBrain("reelify", "Reelify"),
      sampleBrain("ipetzo", "iPetzo"),
    ];

    await act(async () => {
      root.render(<BrainsTable brains={brains} />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const rendered = container.textContent ?? "";
    expect(rendered).toContain("EcomViper");
    expect(rendered).toContain("OptiBay");
    expect(rendered).toContain("OptiWal");
    expect(rendered).toContain("OptiZon");
    expect(rendered).toContain("DirectoryIQ");
    expect(rendered).toContain("CasaFlix");
    expect(rendered).toContain("PageBolt");
    expect(rendered).toContain("Reelify");
    expect(rendered).toContain("iPetzo");
    expect(container.querySelectorAll('a[href*=\"/apps\"]').length).toBe(0);
  });
});
