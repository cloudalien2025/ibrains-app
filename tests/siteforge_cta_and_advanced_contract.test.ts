import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge CTA and default-path contract", () => {
  it("uses setup and build primary actions instead of mission-control prompts", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Generate Plan")).toBe(true);
    expect(source.includes("Build Draft")).toBe(true);
    expect(source.includes("Tell Us About Your Business")).toBe(false);
    expect(source.includes("What do you want to build or improve?")).toBe(false);
    expect(source.includes('runSitePipeline("generate")')).toBe(true);
    expect(source.includes('runSitePipeline("build")')).toBe(true);
  });

  it("keeps one clear primary action per main workspace", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Primary action")).toBe(true);
    expect(source.includes("Generate Plan")).toBe(true);
    expect(source.includes("Build Draft")).toBe(true);
    expect(source.includes("Promote to Publish")).toBe(true);
    expect(source.includes("Refinement Request")).toBe(false);
  });
});
