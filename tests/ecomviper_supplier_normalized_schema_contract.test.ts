import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper supplier normalized schema contract", () => {
  it("defines normalized supplier persistence tables", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "db/migrations/20260530_ecomviper_supplier_normalized.sql"),
      "utf8"
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS supplier_products_normalized");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS supplier_inventory_normalized");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS supplier_pricing_normalized");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS supplier_assets_normalized");

    expect(migration).toContain("supplement_facts_raw");
    expect(migration).toContain("inventory_status_normalized");
    expect(migration).toContain("costs_by_membership_tier");
    expect(migration).toContain("asset_status");
  });
});
