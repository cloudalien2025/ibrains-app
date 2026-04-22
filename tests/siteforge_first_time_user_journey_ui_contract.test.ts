import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge first-time simple flow contract", () => {
  it("renders Setup/Build/Publish primary navigation with Settings as secondary", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Setup"')).toBe(true);
    expect(source.includes('label: "Build"')).toBe(true);
    expect(source.includes('label: "Publish"')).toBe(true);
    expect(source.includes("const primaryNav")).toBe(true);
    expect(source.includes("Settings")).toBe(true);
    expect(source.includes('label: "Content"')).toBe(false);
    expect(source.includes('label: "Growth"')).toBe(false);
    expect(source.includes('label: "Plan"')).toBe(true);
    expect(source.includes('label: "Pages"')).toBe(true);
    expect(source.includes('label: "Assets"')).toBe(true);
  });

  it("keeps first-time guidance aligned to Setup then Build then Publish", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Welcome to SiteForge")).toBe(true);
    expect(source.includes("Start in Setup. Once ready, use Build tabs (Plan, Pages, Assets), then Publish.")).toBe(true);
  });
});
