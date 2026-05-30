import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper route render sync safety", () => {
  it("does not trigger supplier source sync runner during page render", () => {
    const dashboard = fs.readFileSync(path.join(process.cwd(), "app/ecomviper/page.tsx"), "utf8");
    const settings = fs.readFileSync(path.join(process.cwd(), "app/ecomviper/settings/page.tsx"), "utf8");
    const rocktomic = fs.readFileSync(path.join(process.cwd(), "app/ecomviper/dropshipping/rocktomic/page.tsx"), "utf8");

    expect(dashboard).not.toContain("runRocktomicSourceSync(");
    expect(settings).not.toContain("runRocktomicSourceSync(");
    expect(rocktomic).not.toContain("runRocktomicSourceSync(");

    expect(dashboard).toContain("allowRefresh: false");
    expect(settings).toContain("getGlobalSupplierSyncSummary");
    expect(rocktomic).toContain("allowRefresh: false");
    expect(rocktomic).toContain("includeSeedFallbackProducts: false");
  });
});
