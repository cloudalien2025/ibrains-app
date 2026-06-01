import {
  ensureUniqueMissingFields,
  type SupplierActiveIngredient,
  type SupplierFactProvenance,
  type SupplierNutrientFact,
} from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";

export interface SupplementFactsExtractionResult {
  servingSize: string | null;
  servingsPerContainer: number | null;
  nutrientFacts: SupplierNutrientFact[];
  activeIngredients: SupplierActiveIngredient[];
  otherIngredients: string[];
  warnings: string[];
  rawEvidence: string;
  extractionMethod: "deterministic_pdf_text" | "deterministic_markdown_text" | "openai_vision";
  confidence: number;
  needsReview: boolean;
  missingFields: string[];
}

const NUTRIENT_NAMES = [
  "calories",
  "total fat",
  "cholesterol",
  "sodium",
  "total carbohydrate",
  "total carbohydrates",
  "dietary fiber",
  "total sugars",
  "added sugars",
  "vitamin",
  "niacin",
  "folate",
  "calcium",
  "iron",
  "potassium",
  "magnesium",
  "zinc",
  "copper",
  "manganese",
  "selenium",
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitPanelLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]+/g, "\n")
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function parseAmountAndUnit(line: string): { amount: number | null; unit: string | null; dailyValue: string | null } {
  const unitMatch = line.match(/(-?\d+(?:\.\d+)?)\s*(mcg|mg|g|iu|ml|kcal|cal)\b/i);
  const dailyValue = line.match(/(\d{1,4}%|\*\*|†)\s*$/)?.[1] || null;
  if (!unitMatch) {
    // Calories are frequently unitless in labels.
    const calories = line.match(/\bcalories\b\s*(\d+(?:\.\d+)?)/i);
    if (calories) {
      return { amount: Number.parseFloat(calories[1]), unit: "cal", dailyValue };
    }
    return { amount: null, unit: null, dailyValue };
  }
  return {
    amount: Number.parseFloat(unitMatch[1]),
    unit: unitMatch[2].toLowerCase(),
    dailyValue,
  };
}

function looksLikeNutrient(name: string): boolean {
  const lower = name.toLowerCase();
  return NUTRIENT_NAMES.some((token) => lower.includes(token));
}

function rowName(line: string): string {
  const compact = normalizeWhitespace(line);
  const withoutNumbers = compact.replace(/\d+(?:\.\d+)?\s*(mcg|mg|g|iu|ml|kcal|cal)\b.*$/i, "").trim();
  const withoutPercent = withoutNumbers.replace(/(\d{1,4}%|\*\*|†)\s*$/g, "").trim();
  return withoutPercent.replace(/\s{2,}/g, " ");
}

function parseOtherIngredients(lines: string[]): string[] {
  const source = lines.find((line) => /^other ingredients\s*:/i.test(line));
  if (!source) return [];
  const payload = source.replace(/^other ingredients\s*:/i, "").trim();
  return payload
    .split(",")
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);
}

function servingSizeFromLines(lines: string[]): string | null {
  const line = lines.find((entry) => /serving size/i.test(entry));
  if (!line) return null;
  const value = line.replace(/^.*serving size\s*:?\s*/i, "").trim();
  return value || null;
}

function servingsPerContainerFromLines(lines: string[]): number | null {
  const line = lines.find((entry) => /servings?\s+per\s+container/i.test(entry));
  if (!line) return null;
  const numeric = line.match(/(\d{1,4})/);
  if (!numeric) return null;
  return Number.parseInt(numeric[1], 10);
}

function parseRows(lines: string[], provenance: SupplierFactProvenance[]): {
  nutrientFacts: SupplierNutrientFact[];
  activeIngredients: SupplierActiveIngredient[];
} {
  const nutrientFacts: SupplierNutrientFact[] = [];
  const activeIngredients: SupplierActiveIngredient[] = [];

  for (const line of lines) {
    if (
      /supplement facts|serving size|servings?\s+per\s+container|amount per serving|daily value|other ingredients/i.test(line)
    ) {
      continue;
    }

    const amount = parseAmountAndUnit(line);
    const name = rowName(line);
    if (!name || amount.amount == null) continue;

    if (looksLikeNutrient(name)) {
      nutrientFacts.push({
        name,
        amount: amount.amount,
        unit: amount.unit,
        dailyValue: amount.dailyValue,
        rawText: line,
        confidence: 0.92,
        provenance,
      });
      continue;
    }

    activeIngredients.push({
      name,
      amount: amount.amount,
      unit: amount.unit,
      standardization: null,
      rawText: line,
      confidence: 0.9,
      provenance,
    });
  }

  return { nutrientFacts, activeIngredients };
}

export function extractSupplementFactsDeterministic(input: {
  text: string;
  provenance: SupplierFactProvenance[];
  extractionMethod: "deterministic_pdf_text" | "deterministic_markdown_text";
}): SupplementFactsExtractionResult {
  const lines = splitPanelLines(input.text);
  const servingSize = servingSizeFromLines(lines);
  const servingsPerContainer = servingsPerContainerFromLines(lines);
  const parsedRows = parseRows(lines, input.provenance);
  const otherIngredients = parseOtherIngredients(lines);

  const missingFields = ensureUniqueMissingFields([
    ...(servingSize ? [] : ["servingSize"]),
    ...(servingsPerContainer != null ? [] : ["servingsPerContainer"]),
    ...(parsedRows.nutrientFacts.length > 0 ? [] : ["nutrientFacts"]),
    ...(parsedRows.activeIngredients.length > 0 ? [] : ["activeIngredients"]),
  ]);

  const structuredReady = Boolean(
    servingSize
    && servingsPerContainer != null
    && (parsedRows.nutrientFacts.length > 0 || parsedRows.activeIngredients.length > 0)
  );

  const warnings = [
    ...(structuredReady ? [] : ["supplement_facts_incomplete_from_deterministic_parse"]),
  ];

  return {
    servingSize,
    servingsPerContainer,
    nutrientFacts: parsedRows.nutrientFacts,
    activeIngredients: parsedRows.activeIngredients,
    otherIngredients,
    warnings,
    rawEvidence: normalizeWhitespace(input.text).slice(0, 16_000),
    extractionMethod: input.extractionMethod,
    confidence: structuredReady ? 0.9 : 0.62,
    needsReview: !structuredReady,
    missingFields,
  };
}

export function isStructuredSupplementFactsValid(input: {
  sku: string;
  productName: string | null;
  servingSize: string | null;
  servingsPerContainer: number | null;
  nutrientFacts: SupplierNutrientFact[];
  activeIngredients: SupplierActiveIngredient[];
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.sku) errors.push("sku");
  if (!input.productName) errors.push("productName");
  if (!input.servingSize) errors.push("servingSize");
  if (input.servingsPerContainer == null) errors.push("servingsPerContainer");
  if (input.nutrientFacts.length === 0 && input.activeIngredients.length === 0) {
    errors.push("facts");
  }

  const missingNutrientProvenance = input.nutrientFacts.some((entry) => !entry.provenance?.length);
  const missingActiveProvenance = input.activeIngredients.some((entry) => !entry.provenance?.length);
  if (missingNutrientProvenance || missingActiveProvenance) {
    errors.push("fact_provenance");
  }

  return { valid: errors.length === 0, errors };
}

