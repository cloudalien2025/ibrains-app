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

  it("redirects /brains to /ecomviper during hotfix to avoid blank launcher shells", () => {
    const brainsPagePath = path.join(process.cwd(), "app", "(shell)", "brains", "page.tsx");
    const source = fs.readFileSync(brainsPagePath, "utf8");

    expect(source).toContain('redirect("/ecomviper")');
  });

  it("does not server-render fetch protected /api/brains endpoints", () => {
    const brainsPagePath = path.join(process.cwd(), "app", "(shell)", "brains", "page.tsx");
    const source = fs.readFileSync(brainsPagePath, "utf8");

    expect(source).not.toContain('fetch("/api/brains');
    expect(source).not.toContain("fetch(`/api/brains");
  });
});
