import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkPyMuPdfAvailability,
  extractPdfEvidence,
} from "@/lib/ecomviper/suppliers/rocktomic/pdf-evidence";

describe("rocktomic PyMuPDF evidence helper", () => {
  it("returns false when python binary cannot import fitz", async () => {
    const ok = await checkPyMuPdfAvailability("node");
    expect(ok).toBe(false);
  });

  it("parses JSON emitted by helper process", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-evidence-test-"));
    const helperPath = path.join(tempDir, "fake_helper.js");

    await fs.writeFile(
      helperPath,
      [
        "const payload = {",
        " found: true,",
        " pageNumbers: [42],",
        " textSnippets: [{ pageNumber: 42, text: 'ROC948 Premium Nitric Oxide Gummies' }],",
        " links: [{ pageNumber: 42, uri: 'https://example.com/roc948-coa.pdf' }],",
        " errors: [],",
        " sourceFile: '/tmp/catalog.pdf',",
        " provenance: { extractor: 'pymupdf_pdf_evidence_v1', query: 'ROC948' }",
        "};",
        "process.stdout.write(JSON.stringify(payload));",
      ].join("\n"),
      "utf8"
    );

    const result = await extractPdfEvidence({
      pdfPath: "/tmp/catalog.pdf",
      query: "ROC948",
      pythonBin: "node",
      scriptPath: helperPath,
    });

    expect(result.found).toBe(true);
    expect(result.pageNumbers).toEqual([42]);
    expect(result.links[0]?.uri).toContain("coa");
  });
});
