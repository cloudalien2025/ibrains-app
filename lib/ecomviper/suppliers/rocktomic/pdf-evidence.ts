import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { acquireCatalogPdfSource } from "@/lib/ecomviper/suppliers/rocktomic/pdf-source-cache";

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
  sku: string | null;
  productName: string | null;
  candidatePages: Array<{
    pageNumber: number;
    pdfPageIndex: number;
    catalogPageLabel: string | null;
    text: string;
    links: string[];
    renderedImagePath: string | null;
    panelImagePath: string | null;
    warnings: string[];
  }>;
  // Back-compat fields for older callers/tests.
  pageNumbers: number[];
  textSnippets: PdfEvidenceSnippet[];
  links: PdfEvidenceLink[];
  errors: string[];
  sourceFile: string;
  sourceHash: string | null;
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
  sku?: string | null;
  productName?: string | null;
  renderPages?: boolean;
  cropPanel?: boolean;
  renderDir?: string | null;
  pythonBin?: string;
  scriptPath?: string;
}): Promise<PdfEvidenceResult> {
  const pythonBin = options.pythonBin || "python3";
  const scriptPath =
    options.scriptPath
    || path.join(process.cwd(), "scripts/ecomviper/pdf_evidence_extract.py");

  try {
    const args = [
      scriptPath,
      "--pdf",
      options.pdfPath,
      "--query",
      options.query,
      ...(options.sku ? ["--sku", options.sku] : []),
      ...(options.productName ? ["--product-name", options.productName] : []),
      ...(options.renderPages ? ["--render-pages"] : []),
      ...(options.cropPanel ? ["--crop-panel"] : []),
      ...(options.renderDir ? ["--render-dir", options.renderDir] : []),
    ];

    const { stdout } = await execFileAsync(pythonBin, args);

    const parsed = JSON.parse((stdout || "").trim() || "{}") as PdfEvidenceResult;
    const candidatePages = Array.isArray(parsed.candidatePages) ? parsed.candidatePages : [];
    const pageNumbers = candidatePages.map((entry) => entry.pageNumber);
    const textSnippets: PdfEvidenceSnippet[] = candidatePages.map((entry) => ({
      pageNumber: entry.pageNumber,
      text: entry.text,
    }));
    const links = candidatePages.flatMap((entry) =>
      (entry.links || []).map((uri) => ({
        pageNumber: entry.pageNumber,
        uri,
      }))
    );
    return {
      found: Boolean(parsed.found),
      sku: parsed.sku || options.sku || null,
      productName: parsed.productName || options.productName || null,
      candidatePages,
      pageNumbers: Array.isArray(parsed.pageNumbers) && parsed.pageNumbers.length > 0 ? parsed.pageNumbers : pageNumbers,
      textSnippets: Array.isArray(parsed.textSnippets) && parsed.textSnippets.length > 0 ? parsed.textSnippets : textSnippets,
      links: Array.isArray(parsed.links) && parsed.links.length > 0 ? parsed.links : links,
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      sourceFile: parsed.sourceFile || options.pdfPath,
      sourceHash: parsed.sourceHash || null,
      provenance: parsed.provenance || {
        extractor: "pymupdf_pdf_evidence_v1",
        query: options.query,
      },
    };
  } catch (error) {
    return {
      found: false,
      sku: options.sku || null,
      productName: options.productName || null,
      candidatePages: [],
      pageNumbers: [],
      textSnippets: [],
      links: [],
      errors: [error instanceof Error ? error.message : String(error || "pdf_evidence_error")],
      sourceFile: options.pdfPath,
      sourceHash: null,
      provenance: {
        extractor: "pymupdf_pdf_evidence_v1",
        query: options.query,
      },
    };
  }
}

export async function resolveOrAcquireCatalogPdfPath(input: {
  sourceUrl: string;
  allowLiveDownload: boolean;
}): Promise<{
  pdfPath: string | null;
  sourceHash: string | null;
  acquisitionSource: "cache" | "downloaded" | "unavailable";
  warnings: string[];
  errors: string[];
}> {
  const explicit = await resolveCatalogPdfPath();
  if (explicit) {
    return {
      pdfPath: explicit,
      sourceHash: null,
      acquisitionSource: "cache",
      warnings: [],
      errors: [],
    };
  }

  const acquired = await acquireCatalogPdfSource({
    sourceUrl: input.sourceUrl,
    allowLiveDownload: input.allowLiveDownload,
  });

  return {
    pdfPath: acquired.filePath,
    sourceHash: acquired.metadata?.contentHash || null,
    acquisitionSource: acquired.source,
    warnings: acquired.warnings,
    errors: acquired.errors,
  };
}
