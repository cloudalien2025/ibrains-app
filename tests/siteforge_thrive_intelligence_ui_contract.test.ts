import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge thrive intelligence UI contract", () => {
  it("renders explicit thrive-aware safe mode and symbol intelligence summaries", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Thrive Mode:")).toBe(true);
    expect(source.includes("Thrive-aware safe mode")).toBe(true);
    expect(source.includes("Active Thrive skin:")).toBe(true);
    expect(source.includes("Thrive symbols:")).toBe(true);
    expect(source.includes("Thrive primitives:")).toBe(true);
    expect(source.includes("Thrive intel available:")).toBe(true);
    expect(source.includes("Symbol inventory:")).toBe(true);
    expect(source.includes("Thrive Intelligence")).toBe(true);
    expect(source.includes("Section Resolution")).toBe(true);
    expect(source.includes("Runtime modes: wp_safe_mode=")).toBe(true);
    expect(source.includes("Native Target Panel")).toBe(true);
    expect(source.includes("Native Composition & Verification")).toBe(true);
    expect(source.includes("Native Validation")).toBe(true);
    expect(source.includes("Validation mode:")).toBe(true);
    expect(source.includes("promotion candidate:")).toBe(true);
    expect(source.includes("Native validation outcomes")).toBe(true);
    expect(source.includes("Approved target:")).toBe(true);
    expect(source.includes("approval source:")).toBe(true);
    expect(source.includes("thrive_native_staging_mode")).toBe(true);
    expect(source.includes("Rollback/reset availability")).toBe(true);
    expect(source.includes("Section-native mapping")).toBe(true);
  });
});
