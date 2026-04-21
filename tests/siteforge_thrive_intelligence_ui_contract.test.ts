import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge thrive intelligence UI contract", () => {
  it("keeps Thrive-native truth visible without exposing legacy IA", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Build in Thrive")).toBe(true);
    expect(source.includes("Native path available:")).toBe(true);
    expect(source.includes("Build mode used:")).toBe(true);
    expect(source.includes("Thrive was detected, but the native build path is currently blocked.")).toBe(true);
    expect(source.includes("Mission Control")).toBe(false);
    expect(source.includes("Thrive Setup &amp; Assets")).toBe(false);
  });
});
