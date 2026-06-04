/**
 * FileIQ performance router.
 *
 * Classifies an extraction job into a processing route and caps maxTurns
 * accordingly. Structured files (CSV, XLSX) use cheaper paths; large PDF/DOCX
 * bundles use chunked agent; everything else uses the standard agent.
 *
 * Pure and side-effect-free; safe to call from route or worker contexts.
 */

export type ExtractionRoute =
  | "deterministic_structured" // local parse first; compact Claude validation pass
  | "hybrid_structured_agent"  // local parse first; agent for ambiguous mapping
  | "agent_unstructured"        // full agent reasoning (PDF, DOCX, image, URL)
  | "chunked_agent";            // multi-doc bundle split into chunks

export interface RouterDecision {
  route: ExtractionRoute;
  maxTurns: number;
  rationale: string;
}

function fileExt(filePath: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filePath);
  return m ? `.${m[1].toLowerCase()}` : "";
}

/**
 * Classify a FileIQ extraction job and choose the fastest safe route.
 *
 * CSV-only → deterministic_structured (maxTurns=3, compact Claude validation after local parse)
 * XLSX-only → hybrid_structured_agent (maxTurns=8)
 * PDF/DOCX (≤3 files) → agent_unstructured (maxTurns=20)
 * PDF/DOCX (>3 files) → chunked_agent (maxTurns=40)
 * Mixed CSV+PDF → hybrid_structured_agent (maxTurns=20)
 * URL-only → agent_unstructured (maxTurns=16)
 * Image-only → agent_unstructured (maxTurns=16)
 */
export function classifyExtractionJob(params: {
  filePaths: Array<{ path: string; type: string }>;
  urls: string[];
  intent?: string;
}): RouterDecision {
  const types = params.filePaths.map((f) => f.type.toLowerCase());
  const exts = params.filePaths.map((f) => fileExt(f.path));
  const urlExts = params.urls.map((u) => fileExt(u));

  const hasPdf = types.includes("pdf") || exts.includes(".pdf");
  const hasDocx = types.includes("docx") || exts.includes(".docx");
  const hasCsv =
    types.includes("csv") || exts.includes(".csv") || types.includes("text/csv");
  const hasXlsx =
    types.includes("xlsx") ||
    exts.includes(".xlsx") ||
    exts.includes(".xls");
  const hasImage = types.some((t) => ["png", "jpeg", "jpg", "tif", "tiff"].includes(t));

  // URL-only ingestion
  if (params.filePaths.length === 0) {
    if (urlExts.includes(".csv")) {
      return {
        route: "hybrid_structured_agent",
        maxTurns: 6,
        rationale: "URL → CSV — hybrid path for remote structured file",
      };
    }
    return {
      route: "agent_unstructured",
      maxTurns: 16,
      rationale: "URL-only source — agent reasoning required",
    };
  }

  // Chunked: more than 3 PDFs or DOCX files
  if ((hasPdf || hasDocx) && params.filePaths.length > 3) {
    return {
      route: "chunked_agent",
      maxTurns: 40,
      rationale: `${params.filePaths.length} documents — chunked agent for large bundle`,
    };
  }

  // PDF or DOCX (with or without structured files mixed in)
  if (hasPdf || hasDocx) {
    if (hasCsv || hasXlsx) {
      return {
        route: "hybrid_structured_agent",
        maxTurns: 20,
        rationale: "Mixed structured + unstructured — hybrid path",
      };
    }
    return {
      route: "agent_unstructured",
      maxTurns: 20,
      rationale: "PDF/DOCX source — agent reasoning required",
    };
  }

  // CSV-only (no PDF/DOCX)
  if (hasCsv && !hasPdf && !hasDocx) {
    return {
      route: "deterministic_structured",
      maxTurns: 3,
      rationale: "CSV pre-parsed locally; Claude validates and finalizes schema output.",
    };
  }

  // XLSX-only (no PDF/DOCX, no CSV)
  if (hasXlsx && !hasPdf && !hasDocx && !hasCsv) {
    return {
      route: "hybrid_structured_agent",
      maxTurns: 8,
      rationale: "XLSX — hybrid path; local parse first then agent for mapping",
    };
  }

  // Image-only
  if (hasImage) {
    return {
      route: "agent_unstructured",
      maxTurns: 16,
      rationale: "Image source — agent vision required",
    };
  }

  // Default fallback for unknown or mixed file types
  return {
    route: "agent_unstructured",
    maxTurns: 20,
    rationale: "Unknown or mixed file types — agent reasoning fallback",
  };
}
