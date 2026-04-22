import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge growth workspace UI contract", () => {
  it("keeps growth truth visible in a dedicated workspace", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Growth")).toBe(true);
    expect(source.includes("Site Health Summary")).toBe(true);
    expect(source.includes("Opportunities")).toBe(true);
    expect(source.includes("Content Gaps")).toBe(true);
    expect(source.includes("Optimization")).toBe(true);
    expect(source.includes("Run Recommendation")).toBe(true);
  });
});
