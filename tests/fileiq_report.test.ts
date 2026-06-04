import { describe, expect, it } from "vitest";
import { buildFileIqPdfReport } from "@/lib/fileiq/fileiq-report";
import type { FileIqOwnedJob, FileIqStoredArtifact } from "@/lib/fileiq/fileiq-db-core";

function makeJob(overrides: Partial<FileIqOwnedJob> = {}): FileIqOwnedJob {
  return {
    id: overrides.id ?? "job_1",
    bundleId: overrides.bundleId ?? "bundle_1",
    bundleName: overrides.bundleName ?? "FileIQ Demo Bundle",
    status: overrides.status ?? "completed",
    agentSessionId: overrides.agentSessionId ?? "sess_1",
    summary: overrides.summary ?? { supplierName: "Acme Supplier", agentStatus: "completed" },
    errorCode: overrides.errorCode ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? "2026-06-04T12:00:00.000Z",
    completedAt: overrides.completedAt ?? "2026-06-04T12:03:00.000Z",
  };
}

function makeArtifact(overrides: Partial<FileIqStoredArtifact> = {}): FileIqStoredArtifact {
  return {
    id: overrides.id ?? "artifact_1",
    extractionJobId: overrides.extractionJobId ?? "job_1",
    artifactType: overrides.artifactType ?? "agent_result",
    storageUri: overrides.storageUri ?? "inline:payload",
    payload: overrides.payload ?? {},
    createdAt: overrides.createdAt ?? "2026-06-04T12:03:00.000Z",
  };
}

describe("buildFileIqPdfReport", () => {
  it("builds a readable product-catalog PDF report", () => {
    const report = buildFileIqPdfReport(
      makeJob(),
      makeArtifact({
        payload: {
          schemaType: "product_catalog",
          schemaVersion: "1.1",
          supplier: { name: "Acme Supplier" },
          products: [
            {
              sku: "SKU-1",
              productName: "Product 1",
              category: "Supplements",
              inventory: { status: "in_stock" },
              pricing: { msrp: 19.99 },
            },
            {
              sku: "SKU-2",
              productName: "Product 2",
              category: "Supplements",
              inventory: { status: "low_stock" },
              pricing: {},
            },
          ],
          totalProductsFound: 2,
          sourcesProcessed: 1,
          extractionNotes: "All catalog pages parsed.",
        },
      }),
    );

    const content = report.buffer.toString("utf8");
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("FileIQ Product Catalog Report");
    expect(content).toContain("CATEGORY BREAKDOWN");
    expect(content).toContain("Supplements: 2");
  });

  it("builds a readable financial-statement PDF report", () => {
    const report = buildFileIqPdfReport(
      makeJob({
        bundleName: "Bank Statements May 2026",
        summary: { agentStatus: "completed" },
      }),
      makeArtifact({
        payload: {
          schemaType: "financial_statement",
          schemaVersion: "1.0",
          institution: { name: "Example Bank", accountType: "checking", accountLast4: "1234" },
          statementPeriod: { startDate: "2026-05-01", endDate: "2026-05-31", statementCount: 2 },
          currency: "USD",
          transactions: [
            { date: "2026-05-04", description: "WHOLE FOODS", category: "Groceries", amount: -86.42 },
            { date: "2026-05-07", description: "PAYROLL", category: "Income", amount: 2400.0 },
            { date: "2026-05-08", description: "STARBUCKS", category: "Dining", amount: -12.55 },
          ],
          totalTransactions: 3,
          extractionNotes: "Merged two checking statements.",
        },
      }),
    );

    const content = report.buffer.toString("utf8");
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("FileIQ Spending Summary Report");
    expect(content).toContain("CATEGORIZED SPENDING");
    expect(content).toContain("Groceries");
    expect(content).toContain("WHOLE FOODS");
  });
});
