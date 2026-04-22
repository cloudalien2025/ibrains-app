import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge CTA and agency workspace contract", () => {
  it("routes AI generation through the persistent command bar", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("What do you want to build or improve?")).toBe(true);
    expect(source.includes(">Run<")).toBe(false);
    expect(source.includes("Run")).toBe(true);
    expect(source.includes('runSitePipeline("generate")')).toBe(true);
    expect(source.includes("siteforge-generate-site-action")).toBe(true);
    expect(source.includes("Run submitted. Generating next steps...")).toBe(true);
  });

  it("uses one primary action per destination", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("+ New Page")).toBe(true);
    expect(source.includes("+ Create Content")).toBe(true);
    expect(source.includes("Run Recommendation")).toBe(true);
    expect(source.includes("Refinement Request")).toBe(false);
  });
});
