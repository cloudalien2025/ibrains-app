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
      "PageBolt",
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

  it("brains index copy uses My Brains language and excludes legacy labels", () => {
    const brainsPagePath = path.join(process.cwd(), "app", "(shell)", "brains", "page.tsx");
    const source = fs.readFileSync(brainsPagePath, "utf8");

    expect(source).toContain("My Brains");
    expect(source).toContain("Open each standalone brain workspace");
    expect(source).not.toContain("/apps");
    expect(source).not.toContain("Open App");
    expect(source).not.toContain("Back to Apps");
    expect(source).not.toContain("SiteForge");
    expect(source).not.toContain("UAPForge");
    expect(source).not.toContain("Studio");
  });
});
