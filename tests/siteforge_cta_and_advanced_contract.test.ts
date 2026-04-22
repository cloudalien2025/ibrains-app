import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge 2050 CTA and advanced contract", () => {
  it("keeps one clear primary action per phase", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Create first direction")).toBe(true);
    expect(source.includes("Connect and begin")).toBe(true);
    expect(source.includes("Review approvals")).toBe(true);
    expect(source.includes("Build this in Thrive")).toBe(true);
    expect(source.includes("Publish draft")).toBe(true);
  });

  it("demotes diagnostics and internals into Advanced", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("<summary className=\"cursor-pointer font-medium text-white\">Advanced</summary>")).toBe(true);
    expect(source.includes("Build mode used")).toBe(false);
    expect(source.includes("Native path available")).toBe(false);
    expect(source.includes("Promote to Publish")).toBe(false);
    expect(source.includes("Ask SiteForge")).toBe(false);
    expect(source.includes("Builder Feed")).toBe(false);
  });
});
