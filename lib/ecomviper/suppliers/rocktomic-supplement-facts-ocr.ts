import { normalizeRocktomicSku } from "@/lib/ecomviper/suppliers/rocktomic-offline-audit";

export type RocktomicOcrConfidence = "high" | "medium" | "low";

export interface RocktomicParsedSupplementFacts {
  servingSize: string | null;
  servingsPerContainer: string | null;
  activeIngredients: string[];
  amountPerServing: string[];
  dailyValuePercentages: string[];
  otherIngredients: string[];
  suggestedUse: string | null;
  warnings: string | null;
  storage: string | null;
}

export interface RocktomicSupplementFactsOcrEvidence {
  sku: string;
  sourceMethod: "ocr";
  sourcePage: number | null;
  sourceAsset: string | null;
  rawText: string;
  parsed: RocktomicParsedSupplementFacts;
  confidence: RocktomicOcrConfidence;
  needsReview: boolean;
  parseWarnings: string[];
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function matchLineValue(text: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n|]{1,220})`, "i");
  const match = text.match(matcher);
  const value = match?.[1]?.trim() || "";
  return value || null;
}

function splitIngredientList(input: string | null): string[] {
  if (!input) return [];
  return input
    .split(/[;,\n]/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseAmounts(text: string): string[] {
  const values = Array.from(text.matchAll(/([A-Za-z][A-Za-z0-9 .\-()+]{1,80}\s\d+(?:\.\d+)?\s?(?:mg|mcg|g|iu|cfu))/gi)).map(
    (match) => match[1].trim()
  );
  return Array.from(new Set(values));
}

function parseDailyValues(text: string): string[] {
  const values = Array.from(text.matchAll(/([A-Za-z][A-Za-z0-9 .\-()+]{1,80}\s\d+(?:\.\d+)?\s*%)/gi)).map((match) =>
    match[1].trim()
  );
  return Array.from(new Set(values));
}

export function parseRocktomicSupplementFactsFromOcrText(rawText: string): {
  parsed: RocktomicParsedSupplementFacts;
  confidence: RocktomicOcrConfidence;
  needsReview: boolean;
  parseWarnings: string[];
} {
  const normalized = normalizeText(rawText);
  const parseWarnings: string[] = [];

  const servingSize = matchLineValue(normalized, "Serving Size");
  const servingsPerContainer = matchLineValue(normalized, "Servings Per Container") || matchLineValue(normalized, "Servings/Container");
  const activeIngredients = splitIngredientList(matchLineValue(normalized, "Active Ingredients"));
  const amountPerServing = parseAmounts(normalized);
  const dailyValuePercentages = parseDailyValues(normalized);
  const otherIngredients = splitIngredientList(matchLineValue(normalized, "Other Ingredients"));
  const suggestedUse = matchLineValue(normalized, "Suggested Use");
  const warnings = matchLineValue(normalized, "Warning") || matchLineValue(normalized, "Warnings");
  const storage = matchLineValue(normalized, "Storage");

  const hasSupplementHeading = /supplement\s+facts/i.test(normalized) || /nutrition\s+facts/i.test(normalized);
  if (!hasSupplementHeading) {
    parseWarnings.push("missing_facts_heading");
  }
  if (!servingSize) {
    parseWarnings.push("missing_serving_size");
  }
  if (!servingsPerContainer) {
    parseWarnings.push("missing_servings_per_container");
  }
  if (activeIngredients.length === 0 && amountPerServing.length === 0) {
    parseWarnings.push("missing_active_ingredients");
  }

  const parsed: RocktomicParsedSupplementFacts = {
    servingSize,
    servingsPerContainer,
    activeIngredients,
    amountPerServing,
    dailyValuePercentages,
    otherIngredients,
    suggestedUse,
    warnings,
    storage,
  };

  const strongSignals = [
    Boolean(hasSupplementHeading),
    Boolean(servingSize),
    Boolean(servingsPerContainer),
    activeIngredients.length > 0 || amountPerServing.length > 0,
  ].filter(Boolean).length;

  let confidence: RocktomicOcrConfidence = "low";
  if (strongSignals >= 4) confidence = "high";
  else if (strongSignals >= 3) confidence = "medium";

  const needsReview = confidence !== "high" || parseWarnings.length > 0;

  return {
    parsed,
    confidence,
    needsReview,
    parseWarnings,
  };
}

export function buildRocktomicSupplementFactsOcrEvidence(input: {
  entries: Array<{
    sku: string;
    rawText: string;
    sourcePage?: number | null;
    sourceAsset?: string | null;
  }>;
}): RocktomicSupplementFactsOcrEvidence[] {
  const rows: RocktomicSupplementFactsOcrEvidence[] = [];

  for (const entry of input.entries) {
    const sku = normalizeRocktomicSku(entry.sku || "");
    if (!sku) continue;
    const rawText = normalizeText(entry.rawText || "");
    if (!rawText) continue;

    const parsed = parseRocktomicSupplementFactsFromOcrText(rawText);
    rows.push({
      sku,
      sourceMethod: "ocr",
      sourcePage: entry.sourcePage ?? null,
      sourceAsset: entry.sourceAsset ?? null,
      rawText,
      parsed: parsed.parsed,
      confidence: parsed.confidence,
      needsReview: parsed.needsReview,
      parseWarnings: parsed.parseWarnings,
    });
  }

  return rows.sort((a, b) => a.sku.localeCompare(b.sku));
}
