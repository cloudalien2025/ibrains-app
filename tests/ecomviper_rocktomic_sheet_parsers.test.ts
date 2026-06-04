import { describe, it, expect } from "vitest";
import { parsePldsCatalogCsv, parseMsrpReportCsv, parseInventoryReportCsv, indexBySku } from "@/lib/ecomviper/suppliers/rocktomic/rocktomic-sheet-parsers";

const PLDS_CSV = `SKU,Product Name,Category,Label Size,Container Size,Weight
ROC010,Pump Non-Stim Pre-Workout,Supplement,4x6,312g,350g
ROC020,Magnesium Glycinate,Supplement,4x6,60ct,200g
ROC030,Black Short Sleeve Tee,Apparel,,,
`;

const MSRP_CSV = `SKU,Product Name,MSRP,"Non Member Pricing\n(T1)","Standard & VIP\nLifetime Memberships (T4)"
ROC010,Pump Non-Stim Pre-Workout,$29.99,$23.97,$21.97
ROC020,Magnesium Glycinate,$24.99,$19.99,
`;

const INVENTORY_CSV = `SKU,Product Name,Status,Quantity,ETA,Notes
ROC010,Pump Non-Stim,In Stock,500,,
ROC020,Magnesium,Low Stock,15,2026-07-15,Replenishing
ROC030,Tee,Out of Stock,0,2026-08-01,Back-ordered from supplier
`;

const SOURCE_URL = "https://docs.google.com/spreadsheets/d/test123/edit";

describe("parsePldsCatalogCsv", () => {
  it("parses product names, categories, and dimensions", () => {
    const records = parsePldsCatalogCsv(PLDS_CSV, SOURCE_URL);
    expect(records.length).toBe(3);
    const pump = records.find((r) => r.sku === "ROC010");
    expect(pump).toBeDefined();
    expect(pump?.productName).toBe("Pump Non-Stim Pre-Workout");
    expect(pump?.category).toBe("Supplement");
    expect(pump?.labelSize).toBe("4x6");
    expect(pump?.containerSize).toBe("312g");
    expect(pump?.productWeight).toBe("350g");
  });

  it("defaults membershipAccess to 'unknown' when column is absent", () => {
    const records = parsePldsCatalogCsv(PLDS_CSV, SOURCE_URL);
    for (const record of records) {
      expect(record.membershipAccess).toBe("unknown");
    }
  });

  it("includes row-level provenance with row numbers", () => {
    const records = parsePldsCatalogCsv(PLDS_CSV, SOURCE_URL, "plds_catalog_csv");
    const pump = records.find((r) => r.sku === "ROC010");
    expect(pump?.provenance.productName?.source).toBe("plds_catalog_csv");
    expect(pump?.provenance.productName?.row).toBe(2);
    expect(pump?.provenance.productName?.url).toBe(SOURCE_URL);
  });

  it("normalizes SKU to uppercase", () => {
    const csv = "SKU,Name\nroc010,Pump";
    const records = parsePldsCatalogCsv(csv, SOURCE_URL);
    expect(records[0].sku).toBe("ROC010");
  });

  it("skips rows without a SKU", () => {
    const csv = "SKU,Name\n,No SKU row\nROC010,Valid";
    const records = parsePldsCatalogCsv(csv, SOURCE_URL);
    expect(records.length).toBe(1);
    expect(records[0].sku).toBe("ROC010");
  });
});

describe("parseMsrpReportCsv", () => {
  it("parses MSRP and tier pricing from columns with embedded newlines", () => {
    const records = parseMsrpReportCsv(MSRP_CSV, SOURCE_URL, "msrp_report_csv");
    expect(records.length).toBe(2);
    const pump = records.find((r) => r.sku === "ROC010");
    expect(pump).toBeDefined();
    expect(pump?.msrp).toBe(29.99);
    expect(pump?.tiers.t1).toBe(23.97);
    expect(pump?.tiers.t4).toBe(21.97);
  });

  it("handles null tier prices", () => {
    const records = parseMsrpReportCsv(MSRP_CSV, SOURCE_URL);
    const mag = records.find((r) => r.sku === "ROC020");
    expect(mag?.tiers.t4).toBeNull();
  });

  it("includes pricing provenance with column names", () => {
    const records = parseMsrpReportCsv(MSRP_CSV, SOURCE_URL, "msrp_report_csv");
    const pump = records.find((r) => r.sku === "ROC010");
    expect(pump?.provenance["pricing.msrp"]?.source).toBe("msrp_report_csv");
    expect(pump?.provenance["pricing.msrp"]?.row).toBe(2);
  });

  it("strips currency symbols and whitespace from prices", () => {
    const csv = "SKU,MSRP\nROC010,$29.99\n";
    const records = parseMsrpReportCsv(csv, SOURCE_URL);
    expect(records[0].msrp).toBe(29.99);
  });

  it("returns null for empty price cells", () => {
    const records = parseMsrpReportCsv(MSRP_CSV, SOURCE_URL);
    const mag = records.find((r) => r.sku === "ROC020");
    expect(mag?.estimatedProfit).toBeNull();
  });
});

describe("parseInventoryReportCsv", () => {
  it("parses inventory status with normalized values", () => {
    const records = parseInventoryReportCsv(INVENTORY_CSV, SOURCE_URL);
    expect(records.length).toBe(3);
    const pump = records.find((r) => r.sku === "ROC010");
    expect(pump?.inventoryStatus).toBe("in_stock");
    const mag = records.find((r) => r.sku === "ROC020");
    expect(mag?.inventoryStatus).toBe("low_stock");
    const tee = records.find((r) => r.sku === "ROC030");
    expect(tee?.inventoryStatus).toBe("out_of_stock");
  });

  it("extracts replenishment ETA separately from comments", () => {
    const records = parseInventoryReportCsv(INVENTORY_CSV, SOURCE_URL);
    const mag = records.find((r) => r.sku === "ROC020");
    expect(mag?.replenishmentEta).toBe("2026-07-15");
    expect(mag?.replenishmentComments).toBe("Replenishing");
  });

  it("includes inventory field provenance", () => {
    const records = parseInventoryReportCsv(INVENTORY_CSV, SOURCE_URL, "inventory_report_csv");
    const pump = records.find((r) => r.sku === "ROC010");
    expect(pump?.provenance["inventory.status"]?.source).toBe("inventory_report_csv");
    expect(pump?.provenance["inventory.status"]?.row).toBe(2);
  });

  it("returns unknown for unrecognized inventory values", () => {
    const csv = "SKU,Status\nROC999,TBD";
    const records = parseInventoryReportCsv(csv, SOURCE_URL);
    expect(records[0].inventoryStatus).toBe("unknown");
  });
});

describe("indexBySku", () => {
  it("indexes records by normalized SKU", () => {
    const records = parsePldsCatalogCsv(PLDS_CSV, SOURCE_URL);
    const map = indexBySku(records);
    expect(map.get("ROC010")).toBeDefined();
    expect(map.get("ROC020")).toBeDefined();
    expect(map.size).toBe(3);
  });
});
