import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge preview contract", () => {
  it("shows unified preview instead of legacy tabbed build workspace", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Here is the site I think you need")).toBe(true);
    expect(source.includes("AI reasoning summary")).toBe(true);
    expect(source.includes("Live site blueprint")).toBe(true);
    expect(source.includes("Active decision")).toBe(true);
    expect(source.includes("Asset intelligence")).toBe(false);
    expect(source.includes("Top symbols")).toBe(false);
    expect(source.includes("Builder payload present")).toBe(false);
  });
});
