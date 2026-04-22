import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge 2050 CTA and advanced contract", () => {
  it("keeps one clear primary action per visible step", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Connect Website")).toBe(true);
    expect(source.includes("Create Website Plan")).toBe(true);
    expect(source.includes("Build Website")).toBe(true);
    expect(source.includes("Connect and begin")).toBe(false);
    expect(source.includes("Build this in Thrive")).toBe(false);
  });

  it("removes diagnostics and internals from default UI", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('<summary className="cursor-pointer font-medium text-white">Advanced</summary>')).toBe(false);
    expect(source.includes("Diagnostics")).toBe(false);
    expect(source.includes("Project controls")).toBe(false);
    expect(source.includes("Run logs")).toBe(false);
    expect(source.includes("Connection details")).toBe(false);
    expect(source.includes("Build mode used")).toBe(false);
    expect(source.includes("Native path available")).toBe(false);
    expect(source.includes("Promote to Publish")).toBe(false);
    expect(source.includes("Ask SiteForge")).toBe(false);
    expect(source.includes("Builder Feed")).toBe(false);
  });
});
