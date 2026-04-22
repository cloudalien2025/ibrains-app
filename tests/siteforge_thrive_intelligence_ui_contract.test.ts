import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge build assets UI contract", () => {
  it("keeps thrive intelligence in Build > Assets instead of a separate growth shell", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Assets"')).toBe(true);
    expect(source.includes("Asset intelligence")).toBe(true);
    expect(source.includes("Top symbols")).toBe(true);
    expect(source.includes("Builder payload present")).toBe(true);
    expect(source.includes("Growth")).toBe(false);
    expect(source.includes("Site Health Summary")).toBe(false);
  });
});
