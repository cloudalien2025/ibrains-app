import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge CTA and advanced visibility contract", () => {
  it("keeps a single build-start CTA and disables page approval without a selected page", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    const buildStartBindings = source.match(/onClick=\{generateSite\}/g) ?? [];
    expect(buildStartBindings).toHaveLength(1);
    expect(source.includes("Build Site Draft")).toBe(true);
    expect(source.includes("Build Draft")).toBe(false);
    expect(source.includes("Review Build Status")).toBe(true);

    expect(source.includes("const hasPages = pageRows.length > 0;")).toBe(true);
    expect(source.includes("const canApproveSelectedPage = hasPages && selectedPageRow !== null;")).toBe(true);
    expect(source.includes("disabled={!canApproveSelectedPage}")).toBe(true);
    expect(source.includes("Approve Page is unavailable until a generated page is selected.")).toBe(true);
  });

  it("keeps technical and legacy surfaces behind Advanced", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('const showAdvanced = activeNav === "strategy";')).toBe(true);
    expect(source.includes("Run History")).toBe(true);
    expect(source.includes("Refinement Request")).toBe(true);
    expect(source.includes('label: "Setup"')).toBe(true);
    expect(source.includes('label: "Build"')).toBe(true);
    expect(source.includes('label: "Publish"')).toBe(true);
    expect(source.includes('label: "Thrive Assets"')).toBe(false);
  });
});
