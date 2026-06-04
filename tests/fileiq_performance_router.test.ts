/**
 * FileIQ performance router tests.
 *
 * Covers: classifyExtractionJob routing decisions and maxTurns assignments
 * for all major file type combinations (Task C).
 */

import { describe, expect, it } from "vitest";
import { classifyExtractionJob } from "@/lib/fileiq/performance-router";

// ─── CSV routing ──────────────────────────────────────────────────────────────

describe("classifyExtractionJob — CSV", () => {
  it("routes CSV-only to deterministic_structured", () => {
    const decision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/fileiq-123/inventory.csv", type: "csv" }],
      urls: [],
    });
    expect(decision.route).toBe("deterministic_structured");
    expect(decision.maxTurns).toBe(0);
  });

  it("routes CSV-only (by extension when type is unknown) to deterministic_structured", () => {
    const decision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/fileiq-abc/rocktomic_inventory.csv", type: "unknown" }],
      urls: [],
    });
    expect(decision.route).toBe("deterministic_structured");
    expect(decision.maxTurns).toBe(0);
  });

  it("CSV gets maxTurns=0 — no agent turns needed", () => {
    const decision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/x.csv", type: "csv" }],
      urls: [],
    });
    expect(decision.maxTurns).toBe(0);
  });
});

// ─── XLSX routing ─────────────────────────────────────────────────────────────

describe("classifyExtractionJob — XLSX", () => {
  it("routes XLSX-only to hybrid_structured_agent", () => {
    const decision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/catalog.xlsx", type: "xlsx" }],
      urls: [],
    });
    expect(decision.route).toBe("hybrid_structured_agent");
    expect(decision.maxTurns).toBeLessThanOrEqual(12);
    expect(decision.maxTurns).toBeGreaterThan(0);
  });

  it("XLSX gets lower maxTurns than PDF", () => {
    const xlsxDecision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/catalog.xlsx", type: "xlsx" }],
      urls: [],
    });
    const pdfDecision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/catalog.pdf", type: "pdf" }],
      urls: [],
    });
    expect(xlsxDecision.maxTurns).toBeLessThan(pdfDecision.maxTurns);
  });
});

// ─── PDF/DOCX routing ─────────────────────────────────────────────────────────

describe("classifyExtractionJob — PDF/DOCX", () => {
  it("routes single PDF to agent_unstructured", () => {
    const decision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/catalog.pdf", type: "pdf" }],
      urls: [],
    });
    expect(decision.route).toBe("agent_unstructured");
    expect(decision.maxTurns).toBeGreaterThan(0);
  });

  it("routes DOCX to agent_unstructured", () => {
    const decision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/contract.docx", type: "docx" }],
      urls: [],
    });
    expect(decision.route).toBe("agent_unstructured");
  });

  it("routes >3 PDFs to chunked_agent", () => {
    const decision = classifyExtractionJob({
      filePaths: [
        { path: "/tmp/a.pdf", type: "pdf" },
        { path: "/tmp/b.pdf", type: "pdf" },
        { path: "/tmp/c.pdf", type: "pdf" },
        { path: "/tmp/d.pdf", type: "pdf" },
      ],
      urls: [],
    });
    expect(decision.route).toBe("chunked_agent");
    expect(decision.maxTurns).toBe(40);
  });

  it("3 PDFs (not exceeding limit) routes to agent_unstructured not chunked", () => {
    const decision = classifyExtractionJob({
      filePaths: [
        { path: "/tmp/a.pdf", type: "pdf" },
        { path: "/tmp/b.pdf", type: "pdf" },
        { path: "/tmp/c.pdf", type: "pdf" },
      ],
      urls: [],
    });
    expect(decision.route).toBe("agent_unstructured");
  });

  it("PDF and DOCX get higher maxTurns than simple structured files", () => {
    const csvDecision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/x.csv", type: "csv" }],
      urls: [],
    });
    const pdfDecision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/x.pdf", type: "pdf" }],
      urls: [],
    });
    expect(pdfDecision.maxTurns).toBeGreaterThan(csvDecision.maxTurns);
  });
});

// ─── Mixed routing ────────────────────────────────────────────────────────────

describe("classifyExtractionJob — mixed file types", () => {
  it("routes CSV + PDF to hybrid_structured_agent", () => {
    const decision = classifyExtractionJob({
      filePaths: [
        { path: "/tmp/inventory.csv", type: "csv" },
        { path: "/tmp/catalog.pdf", type: "pdf" },
      ],
      urls: [],
    });
    expect(decision.route).toBe("hybrid_structured_agent");
  });
});

// ─── URL-only routing ─────────────────────────────────────────────────────────

describe("classifyExtractionJob — URL-only", () => {
  it("routes URL-only to agent_unstructured", () => {
    const decision = classifyExtractionJob({
      filePaths: [],
      urls: ["https://example.com/catalog.pdf"],
    });
    expect(decision.route).toBe("agent_unstructured");
    expect(decision.maxTurns).toBeGreaterThan(0);
  });

  it("routes URL pointing to CSV to hybrid_structured_agent", () => {
    const decision = classifyExtractionJob({
      filePaths: [],
      urls: ["https://example.com/inventory.csv"],
    });
    expect(decision.route).toBe("hybrid_structured_agent");
    expect(decision.maxTurns).toBeLessThanOrEqual(10);
    expect(decision.maxTurns).toBeGreaterThan(0);
  });
});

// ─── Image routing ────────────────────────────────────────────────────────────

describe("classifyExtractionJob — image files", () => {
  it("routes image-only to agent_unstructured", () => {
    const decision = classifyExtractionJob({
      filePaths: [{ path: "/tmp/label.png", type: "png" }],
      urls: [],
    });
    expect(decision.route).toBe("agent_unstructured");
  });
});

// ─── maxTurns ordering contract ───────────────────────────────────────────────

describe("classifyExtractionJob — maxTurns ordering", () => {
  it("deterministic CSV gets maxTurns=0 (no agent)", () => {
    const d = classifyExtractionJob({
      filePaths: [{ path: "/tmp/x.csv", type: "csv" }],
      urls: [],
    });
    expect(d.maxTurns).toBe(0);
  });

  it("XLSX gets maxTurns ≤ 12 (hybrid — small ambiguity)", () => {
    const d = classifyExtractionJob({
      filePaths: [{ path: "/tmp/x.xlsx", type: "xlsx" }],
      urls: [],
    });
    expect(d.maxTurns).toBeLessThanOrEqual(12);
  });

  it("single PDF gets maxTurns between 12 and 30 (standard agent)", () => {
    const d = classifyExtractionJob({
      filePaths: [{ path: "/tmp/x.pdf", type: "pdf" }],
      urls: [],
    });
    expect(d.maxTurns).toBeGreaterThanOrEqual(12);
    expect(d.maxTurns).toBeLessThanOrEqual(30);
  });

  it("large PDF bundle (>3) gets maxTurns=40 (chunked)", () => {
    const d = classifyExtractionJob({
      filePaths: Array.from({ length: 5 }, (_, i) => ({
        path: `/tmp/doc${i}.pdf`,
        type: "pdf",
      })),
      urls: [],
    });
    expect(d.maxTurns).toBe(40);
  });
});

// ─── Rationale presence ───────────────────────────────────────────────────────

describe("classifyExtractionJob — rationale field", () => {
  it("always returns a non-empty rationale string", () => {
    const cases = [
      { filePaths: [{ path: "/tmp/x.csv", type: "csv" }], urls: [] },
      { filePaths: [{ path: "/tmp/x.pdf", type: "pdf" }], urls: [] },
      { filePaths: [], urls: ["https://example.com/catalog.pdf"] },
      {
        filePaths: Array.from({ length: 5 }, (_, i) => ({ path: `/tmp/d${i}.pdf`, type: "pdf" })),
        urls: [],
      },
    ];
    for (const c of cases) {
      const d = classifyExtractionJob(c);
      expect(typeof d.rationale).toBe("string");
      expect(d.rationale.length).toBeGreaterThan(5);
    }
  });
});
