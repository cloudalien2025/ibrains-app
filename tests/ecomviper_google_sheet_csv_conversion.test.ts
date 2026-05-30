import { describe, expect, it } from "vitest";
import { toGoogleSheetCsvUrl } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";

describe("ecomviper Google Sheets CSV conversion", () => {
  it("converts standard edit URL to CSV export", () => {
    const url =
      "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing";
    expect(toGoogleSheetCsvUrl(url)).toBe(
      "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/export?format=csv&gid=0"
    );
  });

  it("preserves gid when present in URL", () => {
    const url =
      "https://docs.google.com/spreadsheets/d/1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY/edit#gid=123456";
    expect(toGoogleSheetCsvUrl(url)).toBe(
      "https://docs.google.com/spreadsheets/d/1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY/export?format=csv&gid=123456"
    );
  });

  it("returns null for non-sheet URLs", () => {
    expect(toGoogleSheetCsvUrl("https://example.com/not-a-sheet")).toBeNull();
  });
});
