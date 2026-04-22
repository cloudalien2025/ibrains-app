import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge advanced diagnostics contract", () => {
  it("keeps storage details only in Advanced diagnostics", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Diagnostics")).toBe(true);
    expect(source.includes("Storage mode:")).toBe(true);
    expect(source.includes("Persistence health:")).toBe(true);
    expect(source.includes("Memory fallback active:")).toBe(true);
    expect(source.includes("storageSummary && storageSummary.persistenceHealth === \"unavailable\"")).toBe(false);
  });
});
