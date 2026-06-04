import { describe, it, expect } from "vitest";
import { validateSourceIdentity } from "@/lib/ecomviper/suppliers/rocktomic/source-identity-validator";

const CATALOG_PDF_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/Supplement-%26-Apparel-Catalog.pdf?t=1780083599627";
const TEMPLATES_HTML_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html?t=1780083599627";
const POLICY_DOCX_URL = "https://rocktomicplatform.blob.core.windows.net/client-resources/Order-Refund-Policy-Template.docx?t=1780083599627";
const MSRP_SHEET_URL = "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing";
const INVENTORY_SHEET_URL = "https://docs.google.com/spreadsheets/d/1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY/edit?usp=sharing";

describe("validateSourceIdentity", () => {
  it("passes when all sources have unique, correctly typed URLs", () => {
    const report = validateSourceIdentity({
      sources: [
        { id: "catalog_pdf", name: "Supplement & Apparel Catalog", url: CATALOG_PDF_URL, type: "pdf" },
        { id: "label_mockup_templates", name: "Label & 3D Mockup Templates", url: TEMPLATES_HTML_URL, type: "html" },
        { id: "order_refund_policy", name: "Order Refund Policy Template", url: POLICY_DOCX_URL, type: "docx" },
        { id: "msrp_profit_margins_report", name: "Full MSRP and Estimated Profit Margins Report", url: MSRP_SHEET_URL, type: "google_sheet" },
        { id: "inventory_report", name: "Inventory Report", url: INVENTORY_SHEET_URL, type: "google_sheet" },
      ],
      manifestVersion: 2,
    });

    expect(report.overallValid).toBe(true);
    expect(report.duplicateUrlWarnings).toHaveLength(0);
    expect(report.mislabelWarnings).toHaveLength(0);
    expect(report.sources).toHaveLength(5);
  });

  it("detects duplicate Google Sheet URL assigned to different source IDs", () => {
    const report = validateSourceIdentity({
      sources: [
        { id: "plds_catalog", name: "PLDS Catalog", url: MSRP_SHEET_URL, type: "google_sheet" },
        { id: "msrp_profit_margins_report", name: "Full MSRP Report", url: MSRP_SHEET_URL, type: "google_sheet" },
        { id: "inventory_report", name: "Inventory Report", url: INVENTORY_SHEET_URL, type: "google_sheet" },
      ],
      manifestVersion: 2,
    });

    expect(report.overallValid).toBe(false);
    expect(report.duplicateSheetIdWarnings.length).toBeGreaterThanOrEqual(1);
    const warning = report.duplicateSheetIdWarnings.find((w) => w.sheetId === "15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU");
    expect(warning).toBeDefined();
    expect(warning?.assignedLabels).toContain("PLDS Catalog");
    expect(warning?.assignedLabels).toContain("Full MSRP Report");
  });

  it("warns when Supplement & Apparel Catalog label points to a Google Sheet instead of a PDF", () => {
    const report = validateSourceIdentity({
      sources: [
        {
          id: "catalog_pdf",
          name: "Supplement & Apparel Catalog",
          url: INVENTORY_SHEET_URL,
          type: "google_sheet",
        },
      ],
      manifestVersion: 2,
    });

    expect(report.overallValid).toBe(false);
    const mislabel = report.mislabelWarnings.find((w) => w.id === "catalog_pdf");
    expect(mislabel).toBeDefined();
    expect(mislabel?.details).toMatch(/expected PDF/i);
  });

  it("detects type mismatch when declared type does not match URL extension", () => {
    const report = validateSourceIdentity({
      sources: [
        { id: "catalog_pdf", name: "Catalog", url: CATALOG_PDF_URL, type: "html" },
      ],
      manifestVersion: 2,
    });

    expect(report.overallValid).toBe(false);
    expect(report.mislabelWarnings.length).toBeGreaterThanOrEqual(1);
    expect(report.mislabelWarnings[0].detectedType).toBe("pdf");
  });

  it("correctly detects PDF type from Azure Blob URL with query string", () => {
    const report = validateSourceIdentity({
      sources: [{ id: "catalog_pdf", name: "Catalog PDF", url: CATALOG_PDF_URL, type: "pdf" }],
    });

    expect(report.sources[0].detectedType).toBe("pdf");
  });

  it("correctly detects html type", () => {
    const report = validateSourceIdentity({
      sources: [{ id: "templates_html", name: "Templates", url: TEMPLATES_HTML_URL, type: "html" }],
    });

    expect(report.sources[0].detectedType).toBe("html");
    expect(report.sources[0].detectedRoles).toContain("templates_html");
  });

  it("correctly detects docx type", () => {
    const report = validateSourceIdentity({
      sources: [{ id: "policy_docx", name: "Policy", url: POLICY_DOCX_URL, type: "docx" }],
    });

    expect(report.sources[0].detectedType).toBe("docx");
    expect(report.sources[0].detectedRoles).toContain("policy_docx");
  });

  it("correctly detects google_sheet type and roles", () => {
    const report = validateSourceIdentity({
      sources: [{ id: "inventory_report", name: "Inventory Report", url: INVENTORY_SHEET_URL, type: "google_sheet" }],
    });

    expect(report.sources[0].detectedType).toBe("google_sheet");
    expect(report.sources[0].detectedRoles).toContain("inventory_report_sheet");
  });

  it("handles empty sources list", () => {
    const report = validateSourceIdentity({ sources: [] });
    expect(report.overallValid).toBe(true);
    expect(report.sources).toHaveLength(0);
  });
});
