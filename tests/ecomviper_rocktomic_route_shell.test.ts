import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper dropshipping rocktomic route shell", () => {
  it("exposes a rocktomic dropshipping route with source status and sku lookup sections", () => {
    const routePath = path.join(process.cwd(), "app/ecomviper/dropshipping/rocktomic/page.tsx");
    const routeSource = fs.readFileSync(routePath, "utf8");

    expect(routeSource).toContain("Rocktomic Supplier Intelligence Engine");
    expect(routeSource).toContain("Source Status");
    expect(routeSource).toContain("SKU Lookup");
    expect(routeSource).toContain("Catalog Source References");
    expect(routeSource).toContain("Open source");
    expect(routeSource).toContain("sourceConfig.references.map");
    expect(routeSource).toContain("Sync Placeholder / Logs");
    expect(routeSource).toContain("lookupRocktomicSupplierProductBySku");
  });
});
