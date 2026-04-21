import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge CTA and advanced visibility contract", () => {
  it("keeps clear CTA ownership for generate vs build", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Generate Site")).toBe(true);
    expect(source.includes("Build Draft")).toBe(true);
    expect(source.includes("runSitePipeline(\"generate\")")).toBe(true);
    expect(source.includes("runSitePipeline(\"build\")")).toBe(true);
    expect(source.includes("Fix Required Items")).toBe(true);
    expect(source.includes("buttonLabel: `Approve ${normalizePageApprovalName(selectedPage.title)}`")).toBe(true);
    expect(source.includes("normalizePageApprovalName")).toBe(true);
    expect(source.includes("Review Build Status")).toBe(false);
  });

  it("keeps technical and legacy surfaces behind Advanced", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Advanced")).toBe(true);
    expect(source.includes("Run History")).toBe(true);
    expect(source.includes("Diagnostics")).toBe(true);
    expect(source.includes("Raw Errors")).toBe(true);
    expect(source.includes("Mission Control")).toBe(false);
    expect(source.includes("Publish readiness")).toBe(false);
    expect(source.includes("Refinement Request")).toBe(false);
  });
});
