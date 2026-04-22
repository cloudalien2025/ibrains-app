import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("siteforge project controls contract", () => {
  it("removes deterministic project controls from default user shell", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Advanced")).toBe(false);
    expect(source.includes("No project selected")).toBe(true);
    expect(source.includes("Creating...")).toBe(false);
    expect(source.includes("Project created:")).toBe(true);
    expect(source.includes("Rename current project")).toBe(false);
    expect(source.includes("Project controls")).toBe(false);
  });

  it("does not include create-to-untitled fallback semantics in page code", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Untitled SiteForge Project")).toBe(false);
  });
});
