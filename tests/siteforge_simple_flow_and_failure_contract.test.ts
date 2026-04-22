import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge simple flow and failure language contract", () => {
  it("enforces Setup/Build/Publish with Build subtabs Plan/Pages/Assets", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Setup"')).toBe(true);
    expect(source.includes('label: "Build"')).toBe(true);
    expect(source.includes('label: "Publish"')).toBe(true);
    expect(source.includes('label: "Plan"')).toBe(true);
    expect(source.includes('label: "Pages"')).toBe(true);
    expect(source.includes('label: "Assets"')).toBe(true);
    expect(source.includes("mission-control")).toBe(false);
  });

  it("retains user-friendly failure copy and diagnostics visibility", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("We couldn’t generate your site yet.")).toBe(true);
    expect(source.includes("Your WordPress site connected, but the build failed.")).toBe(true);
    expect(source.includes("Thrive was detected, but the native build path is currently blocked.")).toBe(true);
    expect(source.includes("Raw Errors")).toBe(true);
    expect(source.includes("Diagnostics")).toBe(true);
  });
});
