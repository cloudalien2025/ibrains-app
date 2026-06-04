/**
 * FileIQ result parser tests.
 *
 * Covers: extractJsonFromAgentResult (Task A), detectProductCatalogSummary
 * (Task D), and computeExtractedCount (Task D).
 */

import { describe, expect, it } from "vitest";
import {
  extractJsonFromAgentResult,
  detectProductCatalogSummary,
  computeExtractedCount,
} from "@/lib/fileiq/result-parser";

// ─── extractJsonFromAgentResult ───────────────────────────────────────────────

describe("extractJsonFromAgentResult — pure JSON", () => {
  it("parses a direct JSON object string", () => {
    const result = extractJsonFromAgentResult(
      '{"schemaType":"product_catalog","products":[],"totalProductsFound":0}',
    );
    expect(result.parseMode).toBe("json");
    expect(result.payload).toMatchObject({ schemaType: "product_catalog" });
    expect(result.parseDiagnostics).toBeUndefined();
    expect(result.rawResultTextPreview).toBeUndefined();
  });

  it("parses a full product_catalog v1.1 JSON object", () => {
    const payload = {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products: [{ sku: "ROC001", productName: "Omega-3" }],
      totalProductsFound: 1,
      sourcesProcessed: 1,
      extractionNotes: "ok",
    };
    const result = extractJsonFromAgentResult(JSON.stringify(payload));
    expect(result.parseMode).toBe("json");
    expect(result.payload.schemaVersion).toBe("1.1");
    expect((result.payload.products as unknown[]).length).toBe(1);
  });
});

describe("extractJsonFromAgentResult — fenced JSON block", () => {
  it("extracts JSON from ```json ... ``` fence", () => {
    const resultText = [
      "I've read the full inventory report. Here is the FileIQ product_catalog v1.1 extraction:",
      "",
      "```json",
      JSON.stringify({ schemaType: "product_catalog", schemaVersion: "1.1", products: [{ sku: "X1" }], totalProductsFound: 1 }),
      "```",
    ].join("\n");

    const result = extractJsonFromAgentResult(resultText);
    expect(result.parseMode).toBe("fenced_json");
    expect(result.payload.schemaType).toBe("product_catalog");
    expect(result.parseDiagnostics).toContain("code fence");
    expect(result.rawResultTextPreview).toBeDefined();
    expect((result.rawResultTextPreview as string).length).toBeLessThanOrEqual(500);
  });

  it("extracts JSON from ``` ... ``` fence without json language tag", () => {
    const resultText = "Here is the result:\n\n```\n{\"foo\":\"bar\"}\n```";
    const result = extractJsonFromAgentResult(resultText);
    expect(result.parseMode).toBe("fenced_json");
    expect(result.payload.foo).toBe("bar");
  });

  it("attaches rawResultTextPreview capped at 500 chars", () => {
    const bigProse = "A".repeat(600);
    const resultText = `${bigProse}\n\`\`\`json\n{"ok":true}\n\`\`\``;
    const result = extractJsonFromAgentResult(resultText);
    expect(result.parseMode).toBe("fenced_json");
    expect((result.rawResultTextPreview as string).length).toBeLessThanOrEqual(500);
  });
});

describe("extractJsonFromAgentResult — balanced JSON extraction", () => {
  it("extracts the first balanced JSON object from prose text", () => {
    const resultText =
      'Here are the products I found: {"schemaType":"product_catalog","products":[],"totalProductsFound":0} — that is the complete extraction.';
    const result = extractJsonFromAgentResult(resultText);
    expect(result.parseMode).toBe("balanced_json");
    expect(result.payload.schemaType).toBe("product_catalog");
    expect(result.parseDiagnostics).toContain("balanced JSON");
  });
});

describe("extractJsonFromAgentResult — raw fallback", () => {
  it("returns parseMode=raw for plain prose with no JSON", () => {
    const resultText = "I could not find any products in the source.";
    const result = extractJsonFromAgentResult(resultText);
    expect(result.parseMode).toBe("raw");
    expect(result.payload).toHaveProperty("raw");
    expect(result.payload.raw).toBe(resultText);
    expect(result.parseDiagnostics).toBeDefined();
  });

  it("returns parseMode=raw for malformed JSON", () => {
    const resultText = "{ schemaType: 'product_catalog', products: [}";
    const result = extractJsonFromAgentResult(resultText);
    expect(result.parseMode).toBe("raw");
  });

  it("rawResultTextPreview is present in raw fallback", () => {
    const result = extractJsonFromAgentResult("not JSON at all");
    expect(result.rawResultTextPreview).toBeDefined();
  });
});

// ─── detectProductCatalogSummary ──────────────────────────────────────────────

describe("detectProductCatalogSummary", () => {
  it("returns summary for valid product_catalog payload with totalProductsFound", () => {
    const payload = {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products: [{ sku: "X1" }, { sku: "X2" }],
      totalProductsFound: 2,
    };
    const summary = detectProductCatalogSummary(payload);
    expect(summary).not.toBeNull();
    expect(summary!.schemaType).toBe("product_catalog");
    expect(summary!.schemaVersion).toBe("1.1");
    expect(summary!.totalProductsFound).toBe(2);
  });

  it("falls back to products.length when totalProductsFound is absent", () => {
    const payload = {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products: [{ sku: "A" }, { sku: "B" }, { sku: "C" }],
    };
    const summary = detectProductCatalogSummary(payload);
    expect(summary).not.toBeNull();
    expect(summary!.totalProductsFound).toBe(3);
  });

  it("uses totalProductsFound=154 over products.length=154 for the job evidence case", () => {
    const products = Array.from({ length: 154 }, (_, i) => ({ sku: `ROC${i}` }));
    const payload = {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products,
      totalProductsFound: 154,
    };
    const summary = detectProductCatalogSummary(payload);
    expect(summary!.totalProductsFound).toBe(154);
  });

  it("returns null when schemaType is not product_catalog", () => {
    const payload = {
      schemaType: "financial_statement",
      schemaVersion: "1.0",
      products: [],
      totalProductsFound: 0,
    };
    expect(detectProductCatalogSummary(payload)).toBeNull();
  });

  it("returns null when products is not an array", () => {
    const payload = {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products: null,
      totalProductsFound: 0,
    };
    expect(detectProductCatalogSummary(payload as Record<string, unknown>)).toBeNull();
  });
});

// ─── computeExtractedCount ────────────────────────────────────────────────────

describe("computeExtractedCount", () => {
  it("returns products.length for product_catalog schema", () => {
    const payload = {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products: [{ sku: "A" }, { sku: "B" }],
    };
    expect(computeExtractedCount(payload)).toBe(2);
  });

  it("prefers totalProductsFound over products.length for product_catalog", () => {
    const payload = {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products: [{ sku: "A" }],
      totalProductsFound: 154,
    };
    expect(computeExtractedCount(payload)).toBe(154);
  });

  it("returns transactions.length for financial schema", () => {
    const payload = {
      schemaType: "financial_statement",
      transactions: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
    };
    expect(computeExtractedCount(payload)).toBe(3);
  });

  it("returns clauses.length for legal schema", () => {
    const payload = {
      schemaType: "legal_contract",
      clauses: [{ text: "clause 1" }],
    };
    expect(computeExtractedCount(payload)).toBe(1);
  });

  it("returns 0 for empty payload", () => {
    expect(computeExtractedCount({})).toBe(0);
  });

  it("returns 1 when only a summary object is present", () => {
    const payload = { summary: { text: "Document summary..." } };
    expect(computeExtractedCount(payload)).toBe(1);
  });
});
