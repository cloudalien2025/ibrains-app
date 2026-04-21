import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge thrive intelligence UI contract", () => {
  it("keeps Thrive-native truth visible in a dedicated intelligence workspace", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Thrive Intelligence")).toBe(true);
    expect(source.includes("Environment Snapshot")).toBe(true);
    expect(source.includes("Inventory Summary")).toBe(true);
    expect(source.includes("Symbol Intelligence")).toBe(true);
    expect(source.includes("Template Intelligence")).toBe(true);
    expect(source.includes("Risk / Safety")).toBe(true);
    expect(source.includes("Refresh / Manifest")).toBe(true);
    expect(source.includes("Thrive was detected, but the native build path is currently blocked.")).toBe(true);
  });
});
