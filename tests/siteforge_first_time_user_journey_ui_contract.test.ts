import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge 2050 first-time flow contract", () => {
  it("renders Connect/Describe/Launch as primary journey", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Connect"')).toBe(true);
    expect(source.includes('label: "Describe"')).toBe(true);
    expect(source.includes('label: "Launch"')).toBe(true);
    expect(source.includes('label: "Preview"')).toBe(false);
    expect(source.includes('label: "Approve"')).toBe(false);
    expect(source.includes('label: "Build"')).toBe(false);
  });

  it("keeps describe screen intent-first", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Describe the homepage and additional pages you want created.")).toBe(true);
    expect(source.includes("Create Website Plan")).toBe(true);
  });
});
