import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge 2050 first-time flow contract", () => {
  it("renders Describe/Connect/Preview/Approve/Build/Launch as primary journey", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Describe"')).toBe(true);
    expect(source.includes('label: "Connect"')).toBe(true);
    expect(source.includes('label: "Preview"')).toBe(true);
    expect(source.includes('label: "Approve"')).toBe(true);
    expect(source.includes('label: "Build"')).toBe(true);
    expect(source.includes('label: "Launch"')).toBe(true);
    expect(source.includes('label: "Setup"')).toBe(false);
    expect(source.includes('label: "Publish"')).toBe(false);
    expect(source.includes('label: "Plan"')).toBe(false);
    expect(source.includes('label: "Pages"')).toBe(false);
    expect(source.includes('label: "Assets"')).toBe(false);
  });

  it("keeps first screen intent-first", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("What kind of website do you want me to build?")).toBe(true);
    expect(source.includes("Create first direction")).toBe(true);
  });
});
