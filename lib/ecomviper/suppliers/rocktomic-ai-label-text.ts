import { normalizeRocktomicSku } from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";

export type RocktomicAiCompatibility = "pdf_compatible" | "non_pdf_ai";
export type RocktomicAiExtractionStatus = "success" | "reused_cached" | "non_pdf_ai" | "no_extractable_text" | "extraction_error";
export type RocktomicAiConfidence = "high" | "medium" | "low";

export interface RocktomicAiRemoteAssetMetadata {
  url: string;
  fileName: string;
  format: "ai";
  assetRole: "label_template";
  templatePageLastUpdated: string | null;
  httpEtag: string | null;
  httpLastModified: string | null;
  httpContentLength: number | null;
  httpContentType: string | null;
  lastCheckedAt: string;
  source: "templates_page" | "catalog_pdf_annotation" | "other";
}

export interface RocktomicAiParsedFacts {
  servingSize: string | null;
  servingsPerContainer: string | null;
  activeIngredients: string[];
  amountPerServing: string[];
  dailyValuePercentages: string[];
  otherIngredients: string[];
  directions: string | null;
  warnings: string | null;
  storage: string | null;
}

export interface RocktomicAiLabelTextEvidenceRecord extends RocktomicAiRemoteAssetMetadata {
  sku: string;
  compatibility: RocktomicAiCompatibility | null;
  extractionStatus: RocktomicAiExtractionStatus;
  extractedAt: string | null;
  extractionMethod: "ai_pdf_text" | "ocr_fallback_eligible" | "none";
  tempDownloadedBytes: number | null;
  rawText: string | null;
  normalizedLabelText: string | null;
  parsedFacts: RocktomicAiParsedFacts | null;
  confidence: RocktomicAiConfidence | null;
  needsReview: boolean;
  parseWarnings: string[];
  errorDetail: string | null;
}

function parseNumberHeader(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[^\S\n]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unescapePdfString(value: string): string {
  return value
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

function firstValue(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n|]{1,240})`, "i"));
    const value = match?.[1]?.trim() || "";
    if (value) return value;
  }
  return null;
}

function splitList(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,\n;]/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseIngredientAmounts(text: string): string[] {
  const values = Array.from(
    text.matchAll(/([A-Za-z][A-Za-z0-9 ,.'()+\-/%]{1,120}\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|iu|kcal|cal))\b/gi)
  ).map((match) => match[1].replace(/\s+/g, " ").trim());
  return Array.from(new Set(values));
}

function parseDailyValues(text: string): string[] {
  const values = Array.from(text.matchAll(/([A-Za-z][A-Za-z0-9 ,.'()+\-/%]{1,120}\s+\d+(?:\.\d+)?\s*%)/gi)).map((match) =>
    match[1].replace(/\s+/g, " ").trim()
  );
  return Array.from(new Set(values));
}

export function maskAssetUrlForLogs(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0] || "invalid_url";
  }
}

export function normalizeTemplateLastUpdated(value: string | null | undefined): string | null {
  const raw = (value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toUTCString();
}

export async function readRemoteAssetMetadata(input: {
  url: string;
  fileName: string;
  templatePageLastUpdated: string | null;
  fetchImpl?: typeof fetch;
}): Promise<RocktomicAiRemoteAssetMetadata> {
  const fetchImpl = input.fetchImpl || fetch;
  const lastCheckedAt = new Date().toISOString();
  const templatePageLastUpdated = normalizeTemplateLastUpdated(input.templatePageLastUpdated);

  let httpEtag: string | null = null;
  let httpLastModified: string | null = null;
  let httpContentLength: number | null = null;
  let httpContentType: string | null = null;

  try {
    const response = await fetchImpl(input.url, { method: "HEAD", cache: "no-store" });
    if (response.ok) {
      httpEtag = response.headers.get("etag");
      httpLastModified = response.headers.get("last-modified");
      httpContentLength = parseNumberHeader(response.headers.get("content-length"));
      httpContentType = response.headers.get("content-type");
    }
  } catch {
    // Keep metadata null; extraction path can still continue with GET.
  }

  return {
    url: input.url,
    fileName: input.fileName,
    format: "ai",
    assetRole: "label_template",
    templatePageLastUpdated,
    httpEtag,
    httpLastModified,
    httpContentLength,
    httpContentType,
    lastCheckedAt,
    source: "templates_page",
  };
}

export function shouldDownloadForExtraction(
  previous: RocktomicAiLabelTextEvidenceRecord | null | undefined,
  current: RocktomicAiRemoteAssetMetadata
): boolean {
  if (!previous) return true;
  if (!previous.extractedAt) return true;
  if (previous.extractionStatus !== "success") return true;
  if (!previous.parsedFacts) return true;
  if (previous.url !== current.url) return true;
  if ((previous.templatePageLastUpdated || null) !== (current.templatePageLastUpdated || null)) return true;

  const keys: Array<keyof RocktomicAiRemoteAssetMetadata> = ["httpEtag", "httpLastModified", "httpContentLength", "httpContentType"];
  for (const key of keys) {
    const prevValue = previous[key] ?? null;
    const currValue = current[key] ?? null;
    if (prevValue && currValue && prevValue !== currValue) return true;
  }
  return false;
}

export function detectAiCompatibility(bytes: ArrayBuffer): RocktomicAiCompatibility {
  const header = Buffer.from(bytes).subarray(0, 16).toString("latin1");
  if (header.startsWith("%PDF")) return "pdf_compatible";
  return "non_pdf_ai";
}

export function extractPdfCompatibleAiText(bytes: ArrayBuffer): string {
  const content = Buffer.from(bytes).toString("latin1");
  const chunks: string[] = [];

  for (const match of content.matchAll(/\(([^()]{1,300})\)\s*Tj/g)) {
    const text = unescapePdfString(match[1] || "").trim();
    if (text) chunks.push(text);
  }

  for (const match of content.matchAll(/\[([\s\S]+?)\]\s*TJ/g)) {
    for (const inner of (match[1] || "").matchAll(/\(([^()]{1,300})\)/g)) {
      const text = unescapePdfString(inner[1] || "").trim();
      if (text) chunks.push(text);
    }
  }

  if (chunks.length === 0) {
    const fallback = content
      .replace(/[^\x20-\x7E\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return fallback.slice(0, 40_000);
  }

  return normalizeText(chunks.join("\n"));
}

export function parseSupplementFactsFromAiText(rawText: string): {
  parsedFacts: RocktomicAiParsedFacts;
  normalizedLabelText: string;
  confidence: RocktomicAiConfidence;
  needsReview: boolean;
  parseWarnings: string[];
} {
  const normalizedLabelText = normalizeText(rawText);
  const parseWarnings: string[] = [];

  const hasFactsHeading = /supplement\s+facts/i.test(normalizedLabelText) || /nutrition\s+facts/i.test(normalizedLabelText);
  if (!hasFactsHeading) parseWarnings.push("missing_facts_heading");

  const servingSize = firstValue(normalizedLabelText, ["Serving Size"]);
  const servingsPerContainer = firstValue(normalizedLabelText, ["Servings Per Container", "Servings/Container"]);
  const ingredientsLine = firstValue(normalizedLabelText, ["Active Ingredients", "Ingredients"]);
  const otherIngredientsLine = firstValue(normalizedLabelText, ["Other Ingredients"]);
  const directions = firstValue(normalizedLabelText, ["Directions", "Suggested Use"]);
  const warnings = firstValue(normalizedLabelText, ["Warnings", "Warning"]);
  const storage = firstValue(normalizedLabelText, ["Storage", "Store In"]);
  const amountPerServing = parseIngredientAmounts(normalizedLabelText);
  const dailyValuePercentages = parseDailyValues(normalizedLabelText);
  const activeIngredients = splitList(ingredientsLine);
  const otherIngredients = splitList(otherIngredientsLine);

  if (!servingSize) parseWarnings.push("missing_serving_size");
  if (!servingsPerContainer) parseWarnings.push("missing_servings_per_container");
  if (activeIngredients.length === 0 && amountPerServing.length === 0) parseWarnings.push("missing_active_ingredients");

  const parsedFacts: RocktomicAiParsedFacts = {
    servingSize,
    servingsPerContainer,
    activeIngredients,
    amountPerServing,
    dailyValuePercentages,
    otherIngredients,
    directions,
    warnings,
    storage,
  };

  const strongSignals = [
    hasFactsHeading,
    Boolean(servingSize),
    Boolean(servingsPerContainer),
    activeIngredients.length > 0 || amountPerServing.length > 0,
    Boolean(directions || warnings),
  ].filter(Boolean).length;

  let confidence: RocktomicAiConfidence = "low";
  if (strongSignals >= 4) confidence = "high";
  else if (strongSignals >= 3) confidence = "medium";

  const needsReview = confidence !== "high" || parseWarnings.length > 0;
  return {
    parsedFacts,
    normalizedLabelText,
    confidence,
    needsReview,
    parseWarnings,
  };
}

export async function extractRocktomicAiLabelTextForSku(input: {
  sku: string;
  assetUrl: string;
  fileName: string;
  templatePageLastUpdated: string | null;
  previousEvidence?: RocktomicAiLabelTextEvidenceRecord | null;
  fetchImpl?: typeof fetch;
}): Promise<RocktomicAiLabelTextEvidenceRecord> {
  const fetchImpl = input.fetchImpl || fetch;
  const sku = normalizeRocktomicSku(input.sku);
  const metadata = await readRemoteAssetMetadata({
    url: input.assetUrl,
    fileName: input.fileName,
    templatePageLastUpdated: input.templatePageLastUpdated,
    fetchImpl,
  });

  const baseRecord: RocktomicAiLabelTextEvidenceRecord = {
    sku,
    ...metadata,
    compatibility: null,
    extractionStatus: "extraction_error",
    extractedAt: null,
    extractionMethod: "none",
    tempDownloadedBytes: null,
    rawText: null,
    normalizedLabelText: null,
    parsedFacts: null,
    confidence: null,
    needsReview: true,
    parseWarnings: [],
    errorDetail: null,
  };

  if (!shouldDownloadForExtraction(input.previousEvidence, metadata) && input.previousEvidence) {
    return {
      ...input.previousEvidence,
      ...metadata,
      sku,
      extractionStatus: "reused_cached",
      extractionMethod: input.previousEvidence.extractionMethod,
      errorDetail: null,
    };
  }

  let response: Response;
  try {
    response = await fetchImpl(input.assetUrl, { method: "GET", cache: "no-store" });
  } catch (error) {
    return {
      ...baseRecord,
      extractionStatus: "extraction_error",
      extractionMethod: "none",
      errorDetail: error instanceof Error ? error.message : "asset_download_failed",
    };
  }

  if (!response.ok) {
    return {
      ...baseRecord,
      extractionStatus: "extraction_error",
      extractionMethod: "none",
      errorDetail: `asset_download_http_${response.status}`,
    };
  }

  const bytes = await response.arrayBuffer();
  const compatibility = detectAiCompatibility(bytes);
  const contentType = response.headers.get("content-type");
  const contentLength = parseNumberHeader(response.headers.get("content-length"));

  if (compatibility !== "pdf_compatible") {
    return {
      ...baseRecord,
      compatibility,
      extractionStatus: "non_pdf_ai",
      extractionMethod: "ocr_fallback_eligible",
      tempDownloadedBytes: bytes.byteLength,
      httpContentType: metadata.httpContentType || contentType,
      httpContentLength: metadata.httpContentLength ?? contentLength,
    };
  }

  const rawText = extractPdfCompatibleAiText(bytes);
  if (!rawText.trim() || rawText.trim().length < 24) {
    return {
      ...baseRecord,
      compatibility,
      extractionStatus: "no_extractable_text",
      extractionMethod: "ai_pdf_text",
      tempDownloadedBytes: bytes.byteLength,
      extractedAt: new Date().toISOString(),
      rawText: rawText || null,
      httpContentType: metadata.httpContentType || contentType,
      httpContentLength: metadata.httpContentLength ?? contentLength,
    };
  }

  const parsed = parseSupplementFactsFromAiText(rawText);
  return {
    ...baseRecord,
    compatibility,
    extractionStatus: "success",
    extractionMethod: "ai_pdf_text",
    extractedAt: new Date().toISOString(),
    tempDownloadedBytes: bytes.byteLength,
    rawText,
    normalizedLabelText: parsed.normalizedLabelText,
    parsedFacts: parsed.parsedFacts,
    confidence: parsed.confidence,
    needsReview: parsed.needsReview,
    parseWarnings: parsed.parseWarnings,
    errorDetail: null,
    httpContentType: metadata.httpContentType || contentType,
    httpContentLength: metadata.httpContentLength ?? contentLength,
  };
}
