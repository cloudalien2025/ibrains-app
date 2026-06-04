import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecommerce supplier intelligence schema contract", () => {
  it("defines Phase 4 ecommerce_supplier_* tables and unique constraints", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "db/ecommerce/migrations/20260601_ecommerce_supplier_intelligence.sql"),
      "utf8"
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_suppliers");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_supplier_package_imports");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_supplier_products");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_supplier_product_facts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_supplier_pricing");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_supplier_inventory");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_supplier_assets");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ecommerce_supplier_validation_results");

    expect(migration).toContain("UNIQUE (supplier_slug, sku)");
    expect(migration).toContain("UNIQUE (supplier_slug, package_generated_at, package_policy_version)");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS idx_ecommerce_supplier_products_validation_status");
  });
});
