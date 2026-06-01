import {
  parseProductCopywritingOutput,
  validateProductCopywritingOutput,
  type ProductCopywritingInput,
  type ProductCopywritingOutput,
} from "@/lib/ecomviper/copywriting-agent/copywriting-agent-types";

export interface ProductCopywritingEvalResult {
  schemaValidity: number;
  factualGrounding: number;
  supplementCompliance: number;
  agenticVisibility: number;
  conversionQuality: number;
  missingDataBehavior: number;
  brandVoice: number;
  sourceUseTransparency: number;
  hardFailures: string[];
  warnings: string[];
  passed: boolean;
}

const PROHIBITED_CLAIM_PATTERNS = [
  /\bcure(s|d)?\b/i,
  /\btreat(s|ed|ment)?\b/i,
  /\bdiagnos(e|ed|is)\b/i,
  /\bprevent(s|ed)?\s+disease\b/i,
  /\bdrug\s+alternative\b/i,
  /\bpharmaceutical\b/i,
];

const INGREDIENT_AMOUNT_PATTERN = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|iu|ml)\b/gi;
const INGREDIENT_SEPARATORS = /[+/,;|]|\band\b|\bwith\b/gi;
const STOP_WORDS = new Set([
  "support",
  "supports",
  "promotes",
  "promote",
  "helps",
  "help",
  "healthy",
  "wellness",
  "function",
  "functions",
  "daily",
  "natural",
  "source",
  "of",
  "for",
  "and",
  "the",
  "a",
  "an",
  "is",
  "are",
  "that",
  "this",
  "to",
  "production",
  "synthesis",
  "aiding",
  "contributes",
]);

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function listText(output: ProductCopywritingOutput): string {
  return [
    output.optimizedTitle,
    output.listingSubtitle,
    output.shortDescription,
    output.fullDescription,
    output.usageSummary,
    output.metaTitle,
    output.metaDescription,
    ...output.benefitBullets,
    ...output.ingredientHighlights,
    ...output.complianceWarnings,
    ...output.missingDataNotices,
    ...output.sourceFactsUsed,
    ...output.faqSuggestions.flatMap((faq) => [faq.question, faq.answer]),
  ].join("\n");
}

function ensureMissingNotice(output: ProductCopywritingOutput, keyword: string): boolean {
  const lowerKeyword = keyword.toLowerCase();
  return output.missingDataNotices.some((line) => line.toLowerCase().includes(lowerKeyword));
}

function normalizeIngredientText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHighlightSubject(value: string): string {
  return value.split(/\s[-:]\s|—/, 1)[0]?.trim() || value.trim();
}

function extractAmountTokens(value: string): string[] {
  return (value.match(INGREDIENT_AMOUNT_PATTERN) || [])
    .map((entry) => entry.toLowerCase().replace(/\s+/g, " ").trim());
}

function ingredientTokens(value: string): string[] {
  return normalizeIngredientText(value)
    .split(/\s+/g)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function extractNameFromAmountLine(value: string): string {
  const normalized = normalizeIngredientText(value);
  const amountIndex = normalized.search(/\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|iu|ml)\b/i);
  if (amountIndex <= 0) return normalized;
  return normalized.slice(0, amountIndex).trim();
}

function ingredientMentionsFromTitle(title: string): string[] {
  const compact = normalizeIngredientText(title);
  return dedupe(
    compact
      .split(INGREDIENT_SEPARATORS)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 3)
  );
}

function highlightMatchesAllowedName(allowedNames: string[], highlight: string): boolean {
  const normalizedHighlight = normalizeIngredientText(extractHighlightSubject(highlight));
  const highlightTokens = ingredientTokens(normalizedHighlight);
  if (!highlightTokens.length) return false;
  return allowedNames.some((name) => {
    const normalizedName = normalizeIngredientText(name);
    if (!normalizedName) return false;
    if (normalizedHighlight.includes(normalizedName) || normalizedName.includes(normalizedHighlight)) return true;
    const nameTokens = ingredientTokens(normalizedName);
    if (!nameTokens.length) return false;
    const overlap = highlightTokens.filter((token) => nameTokens.includes(token));
    return overlap.length > 0;
  });
}

function highlightHasSupportedDosage(allowedAmounts: string[], highlight: string): boolean {
  const highlightAmounts = extractAmountTokens(highlight);
  if (!highlightAmounts.length) return true;
  const normalizedAllowedAmounts = dedupe(allowedAmounts.flatMap((value) => extractAmountTokens(value)));
  if (!normalizedAllowedAmounts.length) return false;
  return highlightAmounts.every((amount) => normalizedAllowedAmounts.includes(amount));
}

function classifyIngredientHighlights(
  input: ProductCopywritingInput,
  highlights: string[]
): { supported: string[]; unsupported: string[] } {
  const allowedNames = dedupe([
    ...input.supplementFacts.activeIngredients,
    ...input.supplementFacts.otherIngredients,
    ...input.supplementFacts.ingredientAmounts.map((entry) => extractNameFromAmountLine(entry)),
    ...ingredientMentionsFromTitle(input.productIdentity.title),
    ...(input.supplierContext.supplierProductName ? ingredientMentionsFromTitle(input.supplierContext.supplierProductName) : []),
  ]);
  const allowedAmounts = dedupe(input.supplementFacts.ingredientAmounts);

  const supported: string[] = [];
  const unsupported: string[] = [];
  for (const highlight of highlights) {
    const hasName = highlightMatchesAllowedName(allowedNames, highlight);
    const hasDosage = highlightHasSupportedDosage(allowedAmounts, highlight);
    if (hasName && hasDosage) {
      supported.push(highlight);
    } else {
      unsupported.push(highlight);
    }
  }
  return { supported, unsupported };
}

export function removeUnsupportedIngredientHighlights(
  input: ProductCopywritingInput,
  output: ProductCopywritingOutput
): { output: ProductCopywritingOutput; removed: string[] } {
  const split = classifyIngredientHighlights(input, output.ingredientHighlights);
  if (split.unsupported.length === 0) {
    return { output, removed: [] };
  }
  return {
    output: {
      ...output,
      ingredientHighlights: split.supported,
      complianceWarnings: dedupe([
        ...output.complianceWarnings,
        "Some ingredient highlights were removed because they were not source-backed.",
      ]),
    },
    removed: split.unsupported,
  };
}

function detectInventedIngredient(input: ProductCopywritingInput, output: ProductCopywritingOutput): string[] {
  const split = classifyIngredientHighlights(input, output.ingredientHighlights);
  return split.unsupported.map((highlight) => `invented ingredient highlight: ${highlight}`);
}

function detectFakeFactClaims(input: ProductCopywritingInput, output: ProductCopywritingOutput): string[] {
  const text = listText(output).toLowerCase();
  const failures: string[] = [];

  if (
    input.missingData.coaMissing
    && /\bcoa\b/.test(text)
    && /(verified|available|view coa|proof|certificate)/.test(text)
    && !/(coa missing|coa unavailable|not available|pending coa|no coa)/.test(text)
  ) {
    failures.push("fake COA availability claim");
  }

  if (input.missingData.pricingMissing && /(\$\d|price\s*:\s*\d|msrp\s*:\s*\d)/.test(text)) {
    failures.push("fake pricing claim");
  }

  if (input.missingData.inventoryMissing && /(in stock|available now|ships today)/.test(text)) {
    failures.push("fake inventory claim");
  }

  if (input.missingData.supplierMatchMissing && /supplier match confirmed|supplier verified/.test(text)) {
    failures.push("fake supplier-match claim");
  }

  return failures;
}

function detectProhibitedClaims(output: ProductCopywritingOutput): string[] {
  const text = listText(output);
  return PROHIBITED_CLAIM_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => `prohibited claim pattern: ${pattern}`);
}

function scoreAgenticVisibility(output: ProductCopywritingOutput): number {
  let score = 40;
  if (output.agenticVisibilitySignals.primaryIntents.length > 0) score += 15;
  if (output.agenticVisibilitySignals.comparisonHooks.length > 0) score += 15;
  if (output.agenticVisibilitySignals.trustSignals.length > 0) score += 15;
  if (output.faqSuggestions.length >= 2) score += 15;
  return clampScore(score);
}

function scoreConversion(output: ProductCopywritingOutput): number {
  let score = 45;
  if (output.optimizedTitle.length >= 20) score += 15;
  if (output.shortDescription.length >= 40) score += 10;
  if (output.benefitBullets.length >= 3) score += 15;
  if (output.fullDescription.length >= 120) score += 15;
  return clampScore(score);
}

function scoreBrandVoice(input: ProductCopywritingInput, output: ProductCopywritingOutput): number {
  const text = listText(output).toLowerCase();
  let score = 100;
  for (const forbidden of input.brandVoice.forbiddenTerms) {
    if (forbidden && text.includes(forbidden.toLowerCase())) {
      score -= 15;
    }
  }
  return clampScore(score);
}

function scoreSourceTransparency(input: ProductCopywritingInput, output: ProductCopywritingOutput): number {
  const allowed = new Set(input.sourceEvidence.sourceFactsUsed.map((value) => value.toLowerCase()));
  if (allowed.size === 0) {
    return output.sourceFactsUsed.length === 0 ? 100 : 70;
  }

  let score = 100;
  for (const fact of output.sourceFactsUsed) {
    if (!allowed.has(fact.toLowerCase())) score -= 10;
  }
  return clampScore(score);
}

export function evaluateProductCopywritingOutput(input: ProductCopywritingInput, rawOutput: unknown): ProductCopywritingEvalResult {
  const hardFailures: string[] = [];
  const warnings: string[] = [];

  const schema = validateProductCopywritingOutput(rawOutput);
  if (!schema.ok || !schema.value) {
    hardFailures.push(...schema.errors.map((error) => `schema invalid: ${error}`));
    return {
      schemaValidity: 0,
      factualGrounding: 0,
      supplementCompliance: 0,
      agenticVisibility: 0,
      conversionQuality: 0,
      missingDataBehavior: 0,
      brandVoice: 0,
      sourceUseTransparency: 0,
      hardFailures,
      warnings,
      passed: false,
    };
  }

  const output = parseProductCopywritingOutput(schema.value);

  const inventedIngredientFailures = detectInventedIngredient(input, output);
  const prohibitedClaims = detectProhibitedClaims(output);
  const fakeFactClaims = detectFakeFactClaims(input, output);

  if (inventedIngredientFailures.length > 0) hardFailures.push(...inventedIngredientFailures);
  if (prohibitedClaims.length > 0) hardFailures.push(...prohibitedClaims);
  if (fakeFactClaims.length > 0) hardFailures.push(...fakeFactClaims);

  let missingDataBehavior = 100;
  if (input.missingData.coaMissing && !ensureMissingNotice(output, "coa")) {
    hardFailures.push("missing required notice: COA missing");
    missingDataBehavior -= 30;
  }
  if (input.missingData.pricingMissing && !ensureMissingNotice(output, "pricing")) {
    hardFailures.push("missing required notice: pricing missing");
    missingDataBehavior -= 20;
  }
  if (input.missingData.supplementFactsMissing && !ensureMissingNotice(output, "supplement")) {
    hardFailures.push("missing required notice: supplement facts missing");
    missingDataBehavior -= 20;
  }
  if (input.missingData.servingSizeMissing && !ensureMissingNotice(output, "serving size")) {
    hardFailures.push("missing required notice: serving size missing");
    missingDataBehavior -= 10;
  }
  if (input.missingData.servingsPerContainerMissing && !ensureMissingNotice(output, "servings per container")) {
    hardFailures.push("missing required notice: servings per container missing");
    missingDataBehavior -= 10;
  }
  if (input.missingData.ingredientAmountsMissing && !input.missingData.ingredientFactsMissing && !ensureMissingNotice(output, "ingredient amounts")) {
    hardFailures.push("missing required notice: ingredient amounts missing");
    missingDataBehavior -= 10;
  }
  if (
    input.missingData.supplementFactsImageOnly
    && !ensureMissingNotice(output, "not structured")
  ) {
    hardFailures.push("missing required notice: supplement facts image available but not structured");
    missingDataBehavior -= 10;
  }
  if (input.missingData.supplementFactsTextNeedsReview && !ensureMissingNotice(output, "needs review")) {
    hardFailures.push("missing required notice: supplement facts text needs review");
    missingDataBehavior -= 10;
  }
  if (input.missingData.supplierMatchMissing && !ensureMissingNotice(output, "supplier")) {
    hardFailures.push("missing required notice: supplier match not found");
    missingDataBehavior -= 20;
  }

  const schemaValidity = 100;
  const factualGrounding = clampScore(100 - (inventedIngredientFailures.length * 25 + fakeFactClaims.length * 25));
  const supplementCompliance = clampScore(100 - prohibitedClaims.length * 40);
  const agenticVisibility = scoreAgenticVisibility(output);
  const conversionQuality = scoreConversion(output);
  const brandVoice = scoreBrandVoice(input, output);
  const sourceUseTransparency = scoreSourceTransparency(input, output);

  if (agenticVisibility < 70) warnings.push("weak agentic visibility coverage");
  if (conversionQuality < 70) warnings.push("weak conversion quality");
  if (sourceUseTransparency < 80) warnings.push("source fact references include non-listed facts");

  const passed = hardFailures.length === 0;

  return {
    schemaValidity,
    factualGrounding,
    supplementCompliance,
    agenticVisibility,
    conversionQuality,
    missingDataBehavior: clampScore(missingDataBehavior),
    brandVoice,
    sourceUseTransparency,
    hardFailures: dedupe(hardFailures),
    warnings: dedupe(warnings),
    passed,
  };
}

export function evaluateBatch(input: Array<{ input: ProductCopywritingInput; output: unknown }>): {
  total: number;
  passed: number;
  failed: number;
  results: ProductCopywritingEvalResult[];
} {
  const results = input.map((entry) => evaluateProductCopywritingOutput(entry.input, entry.output));
  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
