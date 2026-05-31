import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin supplier intelligence data contract", () => {
  it("reads global normalized supplier data + sync runs", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/admin/ecomviper/supplier-intelligence.ts"),
      "utf8"
    );

    expect(source).toContain("GLOBAL_SUPPLIER_SCOPE_USER_ID");
    expect(source).toContain("supplier_products_normalized");
    expect(source).toContain("supplier_pricing_normalized");
    expect(source).toContain("supplier_inventory_normalized");
    expect(source).toContain("supplier_assets_normalized");
    expect(source).toContain("supplier_source_sync_status");
    expect(source).toContain("supplier_source_sync_runs");
  });

  it("defines required audit filters and status vocabulary", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/admin/ecomviper/supplier-intelligence.ts"),
      "utf8"
    );

    expect(source).toContain('"ready"');
    expect(source).toContain('"partial"');
    expect(source).toContain('"missing"');
    expect(source).toContain('"extraction_failed"');
    expect(source).toContain('"not_applicable"');
    expect(source).toContain('"extraction_needed"');

    expect(source).toContain('"missing_pricing"');
    expect(source).toContain('"missing_inventory"');
    expect(source).toContain('"missing_coa"');
    expect(source).toContain('"missing_assets"');
    expect(source).toContain('"missing_key_features"');
    expect(source).toContain('"supplement_facts_not_extracted"');
    expect(source).toContain('"missing_product"');
  });

  it("keeps admin routes free of runtime sync/extraction triggers", () => {
    const auditPage = fs.readFileSync(
      path.join(process.cwd(), "app/admin/ecomviper/suppliers/rocktomic/audit/page.tsx"),
      "utf8"
    );
    const buildsPage = fs.readFileSync(
      path.join(process.cwd(), "app/admin/ecomviper/suppliers/rocktomic/builds/page.tsx"),
      "utf8"
    );

    const combined = `${auditPage}\n${buildsPage}`;
    expect(combined).not.toContain("runRocktomicSourceSync(");
    expect(combined).not.toContain("getRocktomicSourceIngestionSnapshot(");
    expect(combined).not.toContain("runOpenAi");
    expect(combined).not.toContain("fetch(");
  });
});
