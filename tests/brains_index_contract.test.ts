import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brainCatalog, brainIds, brainRoute } from "@/lib/brains/brainCatalog";

const expectedRoutes: Record<(typeof brainIds)[number], string> = {
  ecomviper: "/ecomviper",
  optibay: "/optibay",
  optiwal: "/optiwal",
  optizon: "/optizon",
  directoryiq: "/directoryiq",
  casaflix: "/casaflix",
  pagebolt: "/pagebolt",
  reelify: "/reelify",
  ipetzo: "/ipetzo",
};

describe("brains index contract", () => {
  it("keeps canonical standalone brain inventory", () => {
    expect(brainCatalog.map((brain) => brain.name)).toEqual([
      "EcomViper",
      "OptiBay",
      "OptiWal",
      "OptiZon",
      "DirectoryIQ",
      "CasaFlix",
      "SiteForge",
      "Reelify",
      "iPetzo",
    ]);
  });

  it("routes canonical brains to top-level standalone paths", () => {
    for (const id of brainIds) {
      expect(brainRoute(id)).toBe(expectedRoutes[id]);
      expect(brainRoute(id)).not.toContain("/apps");
    }
  });

  it("renders /brains as iBrains Dashboard launcher", () => {
    const brainsPagePath = path.join(process.cwd(), "app", "(shell)", "brains", "page.tsx");
    const source = fs.readFileSync(brainsPagePath, "utf8");

    expect(source).toContain("iBrains Dashboard");
    expect(source).toContain("BrainsTable");
    expect(source).not.toContain('redirect("/ecomviper")');
    expect(source).not.toContain("BrainOS");
  });

  it("keeps /brains free of route-coupled runtime fetches and risky imports", () => {
    const brainsPagePath = path.join(process.cwd(), "app", "(shell)", "brains", "page.tsx");
    const brainsTablePath = path.join(process.cwd(), "app", "(shell)", "brains", "_components", "BrainsTable.tsx");
    const source = fs.readFileSync(brainsPagePath, "utf8");
    const tableSource = fs.readFileSync(brainsTablePath, "utf8");
    const combined = `${source}\n${tableSource}`;

    expect(combined).not.toContain('"use client"');
    expect(combined).not.toContain("useEffect");
    expect(combined).not.toContain("useState");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("/api/brains");
    expect(combined).not.toContain("localStorage");
    expect(combined).not.toContain("sessionStorage");
    expect(combined).not.toContain("rocktomic-source-ingestion");
    expect(combined).not.toContain("ecomviper-dashboard-client");
    expect(combined).not.toContain("product-editor-client");
    expect(combined).not.toContain("shopify-product-editor");
  });

  it("keeps app catalog icons/logos in the supported safe set", () => {
    const allowedIconKeys = new Set(["map", "zap", "clapperboard"]);
    for (const brain of brainCatalog) {
      expect(allowedIconKeys.has(brain.iconKey)).toBe(true);
      expect(brain.name.trim().length).toBeGreaterThan(0);
      expect(brain.shortDescription.trim().length).toBeGreaterThan(0);
    }
  });
});
