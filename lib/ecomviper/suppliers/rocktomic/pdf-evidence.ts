import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PdfEvidenceLink {
  pageNumber: number;
  uri: string;
}

export interface PdfEvidenceSnippet {
  pageNumber: number;
  text: string;
}

export interface PdfEvidenceResult {
  found: boolean;
  pageNumbers: number[];
  textSnippets: PdfEvidenceSnippet[];
  links: PdfEvidenceLink[];
  errors: string[];
  sourceFile: string;
  provenance: {
    extractor: string;
    query: string;
  };
}

export async function checkPyMuPdfAvailability(pythonBin = "python3"): Promise<boolean> {
  try {
    await execFileAsync(pythonBin, ["-c", "import fitz"]);
    return true;
  } catch {
    return false;
  }
}

export async function resolveCatalogPdfPath(): Promise<string | null> {
  const candidates = [
    process.env.ECOMVIPER_SUPPLIER_ROCKTOMIC_CATALOG_PDF_PATH,
    path.join(process.cwd(), "data/ecomviper/suppliers/rocktomic/cache/Supplement-&-Apparel-Catalog.pdf"),
    path.join(process.cwd(), "data/ecomviper/suppliers/rocktomic/fixtures/Supplement-&-Apparel-Catalog.pdf"),
  ].filter((entry): entry is string => Boolean(entry && entry.trim()));

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // continue
    }
  }

  return null;
}

export async function extractPdfEvidence(options: {
  pdfPath: string;
  query: string;
  pythonBin?: string;
  scriptPath?: string;
}): Promise<PdfEvidenceResult> {
  const pythonBin = options.pythonBin || "python3";
  const scriptPath =
    options.scriptPath
    || path.join(process.cwd(), "scripts/ecomviper/pdf_evidence_extract.py");

  try {
    const { stdout } = await execFileAsync(pythonBin, [
      scriptPath,
      "--pdf",
      options.pdfPath,
      "--query",
      options.query,
    ]);

    const parsed = JSON.parse((stdout || "").trim() || "{}") as PdfEvidenceResult;
    return {
      found: Boolean(parsed.found),
      pageNumbers: Array.isArray(parsed.pageNumbers) ? parsed.pageNumbers : [],
      textSnippets: Array.isArray(parsed.textSnippets) ? parsed.textSnippets : [],
      links: Array.isArray(parsed.links) ? parsed.links : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      sourceFile: parsed.sourceFile || options.pdfPath,
      provenance: parsed.provenance || {
        extractor: "pymupdf_pdf_evidence_v1",
        query: options.query,
      },
    };
  } catch (error) {
    return {
      found: false,
      pageNumbers: [],
      textSnippets: [],
      links: [],
      errors: [error instanceof Error ? error.message : String(error || "pdf_evidence_error")],
      sourceFile: options.pdfPath,
      provenance: {
        extractor: "pymupdf_pdf_evidence_v1",
        query: options.query,
      },
    };
  }
}
