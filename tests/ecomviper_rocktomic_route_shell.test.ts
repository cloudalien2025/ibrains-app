import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper dropshipping rocktomic route shell", () => {
  it("exposes source-backed diagnostics and sku lookup sections", () => {
    const routePath = path.join(process.cwd(), "app/ecomviper/dropshipping/rocktomic/page.tsx");
    const routeSource = fs.readFileSync(routePath, "utf8");

    expect(routeSource).toContain("Rocktomic Supplier Intelligence Engine");
    expect(routeSource).toContain("Source Status");
    expect(routeSource).toContain("SKU Lookup");
    expect(routeSource).toContain("Catalog Source References");
    expect(routeSource).toContain("fetchable");
    expect(routeSource).toContain("parsed");
    expect(routeSource).toContain("recordCount");
    expect(routeSource).toContain("lookupRocktomicSupplierProductBySku");
    expect(routeSource).toContain("getRocktomicSourceIngestionSnapshot");
  });
});
