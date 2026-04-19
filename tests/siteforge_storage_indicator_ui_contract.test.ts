import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge storage indicator UI contract", () => {
  it("renders explicit storage mode and persistence health messaging", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Storage mode:")).toBe(true);
    expect(source.includes("Persistence health:")).toBe(true);
    expect(source.includes("Memory fallback active:")).toBe(true);
    expect(source.includes("Persistent storage unavailable. SiteForge is disabled until database storage is restored.")).toBe(true);
    expect(source.includes("SiteForge is running in memory mode (development/test only). Projects are not durable.")).toBe(true);
  });
});
