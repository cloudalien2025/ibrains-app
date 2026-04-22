import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge simplified IA contract", () => {
  it("renders top navigation with the four canonical destinations", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Pages")).toBe(true);
    expect(source.includes("Content")).toBe(true);
    expect(source.includes("Growth")).toBe(true);
    expect(source.includes("Settings")).toBe(true);
    expect(source.includes("What do you want to build or improve?")).toBe(true);
  });

  it("keeps first-time guidance integrated with the AI command bar", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Welcome to SiteForge")).toBe(true);
    expect(source.includes("Real estate website")).toBe(true);
    expect(source.includes("AI blog")).toBe(true);
    expect(source.includes("Supplement store")).toBe(true);
  });
});
