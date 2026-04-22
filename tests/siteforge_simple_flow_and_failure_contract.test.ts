import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge agency flow and failure language contract", () => {
  it("uses simplified workspace labels and clear growth guidance", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Site Health Summary")).toBe(true);
    expect(source.includes("Opportunities")).toBe(true);
    expect(source.includes("Content Gaps")).toBe(true);
    expect(source.includes("Optimization")).toBe(true);
    expect(source.includes("Run Recommendation")).toBe(true);

    expect(source.includes('label: "Connect Site"')).toBe(false);
    expect(source.includes('label: "Done"')).toBe(false);
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
