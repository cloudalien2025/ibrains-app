import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge CTA and agency workspace contract", () => {
  it("keeps clear generate vs build CTA execution paths", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Generate Site")).toBe(true);
    expect(source.includes("Build Draft")).toBe(true);
    expect(source.includes('runSitePipeline("generate")')).toBe(true);
    expect(source.includes('runSitePipeline("build")')).toBe(true);
    expect(source.includes("Fix Required Items")).toBe(true);
    expect(source.includes("normalizePageApprovalName")).toBe(true);
  });

  it("includes agency IA sections for publish and collaboration", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Agency Pulse")).toBe(true);
    expect(source.includes("Publish Checklist")).toBe(true);
    expect(source.includes("Agent Collaboration")).toBe(true);
    expect(source.includes("Refinement Request")).toBe(false);
  });
});
