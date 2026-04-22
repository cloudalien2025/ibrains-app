import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("siteforge setup create UX contract", () => {
  it("keeps deterministic project creation and naming controls in Setup", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("No project selected")).toBe(true);
    expect(source.includes("Creating...")).toBe(true);
    expect(source.includes("Project created:")).toBe(true);
    expect(source.includes("Rename current project")).toBe(true);
    expect(source.includes("Project")).toBe(true);
  });

  it("does not include create-to-untitled fallback semantics in page code", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Untitled SiteForge Project")).toBe(false);
  });
});
