import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge thrive intelligence UI contract", () => {
  it("keeps Thrive setup available but secondary to Setup/Build/Publish", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Setup"')).toBe(true);
    expect(source.includes('label: "Build"')).toBe(true);
    expect(source.includes('label: "Publish"')).toBe(true);
    expect(source.includes("Advanced")).toBe(true);
    expect(source.includes('label: "Thrive Assets"')).toBe(false);

    expect(source.includes("Thrive Setup &amp; Assets")).toBe(true);
    expect(source.includes("Connection Status")).toBe(true);
    expect(source.includes("Assets Found")).toBe(true);
    expect(source.includes("Reusable Blocks")).toBe(true);
    expect(source.includes("Template Matches")).toBe(true);
    expect(source.includes("Warnings")).toBe(true);
    expect(source.includes("Advanced Tools")).toBe(true);

    expect(source.includes("Environment Snapshot Card")).toBe(false);
    expect(source.includes("Inventory Summary Card")).toBe(false);
    expect(source.includes("Symbol Intelligence Panel")).toBe(false);
    expect(source.includes("Template Intelligence Panel")).toBe(false);
    expect(source.includes("Risk / Safety Panel")).toBe(false);
    expect(source.includes("Refresh / Manifest Panel")).toBe(false);
  });
});
