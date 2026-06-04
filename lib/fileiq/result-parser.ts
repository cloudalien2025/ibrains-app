/**
 * FileIQ result parser.
 *
 * Extracts structured JSON from agent result text using a cascade of
 * strategies: direct parse → fenced code block → first balanced object → raw.
 * Pure and side-effect-free; safe to call from worker or route contexts.
 */

export type ParseMode = "json" | "fenced_json" | "balanced_json" | "raw";

export interface ParsedAgentResult {
  payload: Record<string, unknown>;
  parseMode: ParseMode;
  parseDiagnostics?: string;
  rawResultTextPreview?: string;
}

export interface ProductCatalogSummary {
  schemaType: string;
  schemaVersion: string;
  totalProductsFound: number;
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

function extractFencedJson(text: string): string | null {
  const match = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return match ? match[1].trim() : null;
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Extract a JSON object from agent result text using a four-step cascade:
 *
 * 1. Direct JSON.parse (ideal — agent obeyed the "no prose" instruction)
 * 2. First ```json ... ``` fenced block
 * 3. First balanced { ... } object in the text
 * 4. Raw fallback: { raw: resultText }
 *
 * Steps 2-4 attach parse diagnostics and a result text preview to `_meta`
 * so debugging can identify which strategy was needed.
 */
export function extractJsonFromAgentResult(resultText: string): ParsedAgentResult {
  // 1. Direct JSON parse
  const direct = tryParseJsonObject(resultText);
  if (direct) {
    return { payload: direct, parseMode: "json" };
  }

  // 2. Fenced JSON block  ``` json ... ```
  const fenced = extractFencedJson(resultText);
  if (fenced) {
    const fromFence = tryParseJsonObject(fenced);
    if (fromFence) {
      return {
        payload: fromFence,
        parseMode: "fenced_json",
        parseDiagnostics: "Extracted from markdown code fence",
        rawResultTextPreview: resultText.slice(0, 500),
      };
    }
  }

  // 3. First balanced JSON object found anywhere in the text
  const balanced = extractBalancedJsonObject(resultText);
  if (balanced) {
    const fromBalance = tryParseJsonObject(balanced);
    if (fromBalance) {
      return {
        payload: fromBalance,
        parseMode: "balanced_json",
        parseDiagnostics: "Extracted first balanced JSON object from prose",
        rawResultTextPreview: resultText.slice(0, 500),
      };
    }
  }

  // 4. Raw fallback
  return {
    payload: { raw: resultText },
    parseMode: "raw",
    parseDiagnostics: "Could not extract valid JSON from agent result",
    rawResultTextPreview: resultText.slice(0, 500),
  };
}

/**
 * Detect whether a parsed payload is a product_catalog v1.x extraction.
 * Returns a summary with the schema type, version, and product count, or
 * null when the payload does not match the product_catalog schema.
 *
 * Falls back to products.length when totalProductsFound is absent.
 */
export function detectProductCatalogSummary(
  payload: Record<string, unknown>,
): ProductCatalogSummary | null {
  if (
    payload.schemaType !== "product_catalog" ||
    typeof payload.schemaVersion !== "string" ||
    !Array.isArray(payload.products)
  ) {
    return null;
  }
  const totalFromPayload =
    typeof payload.totalProductsFound === "number" ? payload.totalProductsFound : null;
  const totalProductsFound =
    totalFromPayload !== null
      ? totalFromPayload
      : (payload.products as unknown[]).length;
  return {
    schemaType: "product_catalog",
    schemaVersion: payload.schemaVersion,
    totalProductsFound,
  };
}

/**
 * Compute a schema-aware extracted item count from a parsed payload.
 * Checks common result array keys in priority order.
 */
export function computeExtractedCount(payload: Record<string, unknown>): number {
  if (payload.schemaType === "product_catalog" && Array.isArray(payload.products)) {
    return typeof payload.totalProductsFound === "number"
      ? payload.totalProductsFound
      : (payload.products as unknown[]).length;
  }
  for (const key of [
    "transactions",
    "accounts",
    "clauses",
    "obligations",
    "entities",
    "sections",
  ]) {
    const arr = payload[key];
    if (Array.isArray(arr)) return arr.length;
  }
  if (typeof payload.totalProductsFound === "number") return payload.totalProductsFound;
  if (payload.summary && typeof payload.summary === "object") return 1;
  return 0;
}
