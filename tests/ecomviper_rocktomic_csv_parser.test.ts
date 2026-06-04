import { describe, it, expect } from "vitest";
import { parseRfc4180Csv, lookupRowBySku } from "@/lib/ecomviper/suppliers/rocktomic/rocktomic-csv-parser";

describe("parseRfc4180Csv", () => {
  it("parses a simple CSV", () => {
    const csv = "SKU,Name,Price\nROC010,Product A,29.99\nROC020,Product B,19.99";
    const result = parseRfc4180Csv(csv);
    expect(result.headers).toEqual(["SKU", "Name", "Price"]);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]["SKU"]).toBe("ROC010");
    expect(result.rows[0]["Name"]).toBe("Product A");
    expect(result.rows[1]["Price"]).toBe("19.99");
  });

  it("handles quoted fields containing commas", () => {
    const csv = `SKU,Name,Description\nROC010,"Pump, Pre-Workout","Cherry Blast, 312g"`;
    const result = parseRfc4180Csv(csv);
    expect(result.rows[0]["Name"]).toBe("Pump, Pre-Workout");
    expect(result.rows[0]["Description"]).toBe("Cherry Blast, 312g");
  });

  it("handles quoted fields containing embedded newlines", () => {
    const csv = `SKU,TierName,Price\nROC010,"Non Member\n(T1)",23.97`;
    const result = parseRfc4180Csv(csv);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]["TierName"]).toBe("Non Member\n(T1)");
    expect(result.rows[0]["Price"]).toBe("23.97");
  });

  it("handles escaped double-quotes inside quoted fields", () => {
    const csv = `SKU,Notes\nROC010,"Contains ""special"" chars"`;
    const result = parseRfc4180Csv(csv);
    expect(result.rows[0]["Notes"]).toBe('Contains "special" chars');
  });

  it("handles CRLF line endings", () => {
    const csv = "SKU,Name\r\nROC010,Alpha\r\nROC020,Beta";
    const result = parseRfc4180Csv(csv);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]["SKU"]).toBe("ROC010");
    expect(result.rows[1]["SKU"]).toBe("ROC020");
  });

  it("handles empty CSV", () => {
    const result = parseRfc4180Csv("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it("handles headers only", () => {
    const result = parseRfc4180Csv("SKU,Name,Price");
    expect(result.headers).toEqual(["SKU", "Name", "Price"]);
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it("handles missing trailing fields by leaving them empty", () => {
    const csv = "A,B,C\n1,2";
    const result = parseRfc4180Csv(csv);
    expect(result.rows[0]["C"]).toBe("");
  });

  it("correctly handles tier column names with embedded newlines (realistic Rocktomic data)", () => {
    const csv = `SKU,"Non Member Pricing\n(T1)","Standard & VIP\nLifetime Memberships (T4)"\nROC010,23.97,21.97`;
    const result = parseRfc4180Csv(csv);
    expect(result.headers[1]).toBe("Non Member Pricing\n(T1)");
    expect(result.rows[0]["Non Member Pricing\n(T1)"]).toBe("23.97");
    expect(result.rows[0]["Standard & VIP\nLifetime Memberships (T4)"]).toBe("21.97");
  });
});

describe("lookupRowBySku", () => {
  const rows = [
    { SKU: "ROC010", Name: "Alpha" },
    { SKU: "ROC020", Name: "Beta" },
    { "Product SKU": "ROC030", Name: "Gamma" },
  ];

  it("finds row by exact SKU match", () => {
    const result = lookupRowBySku(rows, "ROC010");
    expect(result).not.toBeNull();
    expect(result?.row["Name"]).toBe("Alpha");
    expect(result?.rowIndex).toBe(2);
  });

  it("finds row case-insensitively", () => {
    const result = lookupRowBySku(rows, "roc020");
    expect(result).not.toBeNull();
    expect(result?.row["Name"]).toBe("Beta");
  });

  it("finds row using Product SKU column variant", () => {
    const result = lookupRowBySku(rows, "ROC030");
    expect(result).not.toBeNull();
    expect(result?.row["Name"]).toBe("Gamma");
  });

  it("returns null when SKU is not found", () => {
    const result = lookupRowBySku(rows, "ROC999");
    expect(result).toBeNull();
  });

  it("returns correct 1-based row index", () => {
    const result = lookupRowBySku(rows, "ROC020");
    expect(result?.rowIndex).toBe(3); // row 1=header, row 2=ROC010, row 3=ROC020
  });
});
