import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: mocks.query,
}));

describe("admin supplier intelligence data access", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.query.mockReset();
    process.env.DATABASE_URL = "postgres://example.test/ibrains";
  });

  it("reads audit rows from global supplier scope", async () => {
    mocks.query.mockImplementation(async (text: string) => {
      if (text.includes("sku_union")) return [{ sku: "ROC948" }];
      if (text.includes("FROM supplier_products_normalized")) {
        return [{
          sku: "ROC948",
          product_name: "Magnesium Gummies",
          supplement_facts_text: "facts",
          supplement_facts_raw: null,
          key_product_features: ["Vegan"],
          coa_url: "https://example.com/coa.pdf",
          label_template_url: "https://example.com/label.png",
          mockup_url: "https://example.com/mockup.png",
          extraction_status: "synced",
          extraction_errors: [],
          last_synced_at: "2026-05-30T00:00:00.000Z",
        }];
      }
      if (text.includes("FROM supplier_pricing_normalized")) {
        return [{ sku: "ROC948", extraction_status: "synced", extraction_errors: [], last_synced_at: "2026-05-30T00:00:00.000Z" }];
      }
      if (text.includes("FROM supplier_inventory_normalized")) {
        return [{ sku: "ROC948", extraction_status: "synced", extraction_errors: [], last_synced_at: "2026-05-30T00:00:00.000Z" }];
      }
      if (text.includes("FROM supplier_assets_normalized")) {
        return [{ sku: "ROC948", label_template_url: "https://example.com/label.png", mockup_url: "https://example.com/mockup.png", coa_url: "https://example.com/coa.pdf", extraction_status: "synced", extraction_errors: [], last_synced_at: "2026-05-30T00:00:00.000Z" }];
      }
      return [];
    });

    const { getSupplierAuditData } = await import("@/lib/admin/ecomviper/supplier-intelligence");
    const result = await getSupplierAuditData({ supplierId: "rocktomic", filter: "all", searchTerm: "ROC" });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.sku).toBe("ROC948");

    const queryCalls = mocks.query.mock.calls.map((call) => call[1]);
    expect(queryCalls.some((params) => Array.isArray(params) && params[0] === "__global__" && params[1] === "rocktomic")).toBe(true);
  });

  it("reads build history from sync run table", async () => {
    mocks.query.mockImplementation(async (text: string) => {
      if (text.includes("FROM supplier_source_sync_runs")) {
        return [
          {
            id: 9,
            sync_status: "synced",
            attempted_at: "2026-05-30T00:00:00.000Z",
            completed_at: "2026-05-30T00:00:03.000Z",
            products_parsed_count: 145,
            pricing_records_parsed_count: 145,
            inventory_records_parsed_count: 153,
            asset_records_parsed_count: 147,
            last_error: null,
            source_diagnostics: [],
          },
        ];
      }
      return [];
    });

    const { getSupplierBuildHistory } = await import("@/lib/admin/ecomviper/supplier-intelligence");
    const rows = await getSupplierBuildHistory("rocktomic", { limit: 10 });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.runId).toBe(9);
    expect(rows[0]?.status).toBe("synced");
    expect(rows[0]?.durationSeconds).toBe(3);
  });
});
