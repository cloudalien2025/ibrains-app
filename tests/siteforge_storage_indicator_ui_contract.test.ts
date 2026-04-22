import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge advanced diagnostics contract", () => {
  it("keeps storage diagnostics out of default SiteForge UI", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Diagnostics")).toBe(false);
    expect(source.includes("Storage mode:")).toBe(false);
    expect(source.includes("Persistence health:")).toBe(false);
    expect(source.includes("Memory fallback active:")).toBe(false);
    expect(source.includes("storageSummary && storageSummary.persistenceHealth === \"unavailable\"")).toBe(false);
  });
});
