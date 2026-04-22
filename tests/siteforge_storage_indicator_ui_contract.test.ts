import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge storage indicator UI contract", () => {
  it("keeps storage details in diagnostics and only top-level critical unavailable banner", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Storage mode:")).toBe(true);
    expect(source.includes("Persistence health:")).toBe(true);
    expect(source.includes("Memory fallback active:")).toBe(true);
    expect(source.includes("storageSummary && storageSummary.persistenceHealth === \"unavailable\"")).toBe(true);
    expect(source.includes("Persistent storage unavailable. SiteForge is disabled until database storage is restored.")).toBe(true);
  });
});
