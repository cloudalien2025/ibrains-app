import { describe, expect, it } from "vitest";
import {
  buildGoogleSheetsCsvExportUrl,
  findCsvRowBySku,
  parseCsvTable,
} from "@/lib/ecomviper/suppliers/google-sheets-csv";

describe("google sheets csv foundation", () => {
  it("builds CSV export URL from spreadsheet URL and gid", () => {
    const url = buildGoogleSheetsCsvExportUrl({
      spreadsheetIdOrUrl: "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing",
      gid: "123456",
    });

    expect(url).toBe(
      "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/export?format=csv&gid=123456"
    );
  });

  it("parses CSV rows and finds row by SKU", () => {
    const table = parseCsvTable(["SKU,Wholesale,MSRP", "ROC948,10.49,29.99", "ROC123,9.50,25.99"].join("\n"));

    expect(table.rows).toHaveLength(2);
    const row = findCsvRowBySku({ rows: table.rows, sku: "roc-948" });
    expect(row).not.toBeNull();
    expect(row?.Wholesale).toBe("10.49");
  });
});
