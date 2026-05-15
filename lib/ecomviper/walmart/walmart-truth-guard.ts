export type TruthConfidence = "high" | "medium" | "low" | "none";

const CUSTOMER_FACING_SENTINEL_EXACT = new Set([
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "see product label",
  "see product label for ingredient details",
  "complete ingredients from label",
  "ingredient details",
]);

const CUSTOMER_FACING_SENTINEL_PATTERNS: RegExp[] = [
  /\bunknown\b/i,
  /\bsee\s+product\s+label\b/i,
  /\bingredient\s+details\b/i,
  /\bcomplete\s+ingredients\s+from\s+label\b/i,
];

export const PDP_INTERNAL_BANNED_PHRASES = [
  "AI Recommendation Readiness",
  "Agentic referral readiness",
  "machine-readable confidence",
  "EcomViper",
  "internal diagnostic",
  "recommendation-only output",
] as const;

const INTERNAL_PDP_BANNED_PATTERNS = PDP_INTERNAL_BANNED_PHRASES.map(
  (entry) => new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

export function normalizeTruthText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  return normalizeWhitespace(value);
}

export function isCustomerFacingSentinelValue(value: unknown): boolean {
  const normalized = normalizeTruthText(value);
  if (!normalized) return true;
  if (CUSTOMER_FACING_SENTINEL_EXACT.has(normalized.toLowerCase())) return true;
  return false;
}

export function findCustomerFacingSentinelTokens(value: unknown): string[] {
  const normalized = normalizeTruthText(value);
  if (!normalized) return [];
  const hits: string[] = [];
  for (const pattern of CUSTOMER_FACING_SENTINEL_PATTERNS) {
    if (pattern.test(normalized)) hits.push(pattern.source);
  }
  return Array.from(new Set(hits));
}

export function sanitizeCustomerFacingText(value: unknown): string {
  const normalized = normalizeTruthText(value);
  if (!normalized) return "";
  if (isCustomerFacingSentinelValue(normalized)) return "";
  if (findCustomerFacingSentinelTokens(normalized).length > 0) return "";
  if (containsInternalPdpLanguage(normalized)) return "";
  return normalized;
}

export function sanitizeCustomerFacingList(values: unknown[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = sanitizeCustomerFacingText(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

export function findInternalPdpPhrases(value: unknown): string[] {
  const normalized = normalizeTruthText(value);
  if (!normalized) return [];
  const hits: string[] = [];
  for (const pattern of INTERNAL_PDP_BANNED_PATTERNS) {
    if (pattern.test(normalized)) hits.push(pattern.source);
  }
  return Array.from(new Set(hits));
}

export function containsInternalPdpLanguage(value: unknown): boolean {
  return findInternalPdpPhrases(value).length > 0;
}

export interface StaleDemoMatchInput {
  key: string;
  value: unknown;
  titleHint?: string;
  formHint?: string;
  servingsHint?: string;
}

export interface StaleDemoMatch {
  blocked: boolean;
  reason: string;
}

function normalizeAlpha(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function titleMentions(value: string, token: string): boolean {
  const normalizedValue = normalizeAlpha(value);
  const normalizedToken = normalizeAlpha(token);
  if (!normalizedValue || !normalizedToken) return false;
  return normalizedValue.includes(normalizedToken);
}

export function detectKnownStaleDemoValue(input: StaleDemoMatchInput): StaleDemoMatch | null {
  const key = normalizeAlpha(input.key).replace(/\s+/g, "_");
  const value = normalizeTruthText(input.value);
  if (!value) return null;

  const lower = value.toLowerCase();
  const titleHint = normalizeTruthText(input.titleHint);
  const formHint = normalizeTruthText(input.formHint).toLowerCase();

  if (key === "flavor" && /^mixed\s+berry$/i.test(value)) {
    return { blocked: true, reason: "known_demo_flavor" };
  }

  if (
    (key === "main_ingredients" || key === "ingredients_list") &&
    /turmeric/i.test(value) &&
    /glucosamine/i.test(value) &&
    /chondroitin/i.test(value)
  ) {
    return { blocked: true, reason: "known_demo_joint_ingredient_trio" };
  }

  if (key === "serving_size" && /\b2\s*capsules?\b/i.test(value)) {
    if (/powder|greens|reds|blend/i.test(formHint) || /greens|reds|powder/i.test(titleHint)) {
      return { blocked: true, reason: "capsule_serving_size_conflicts_with_powder" };
    }
    return { blocked: true, reason: "known_demo_capsule_serving_size" };
  }

  if ((key === "servings" || key === "servings_per_container") && /\b30\b/.test(lower)) {
    const titleServings = titleHint.match(/\b(\d{1,4})\s*servings?\b/i)?.[1] ?? "";
    if (titleServings && titleServings !== "30") {
      return {
        blocked: true,
        reason: `servings_conflicts_with_title_${titleServings}`,
      };
    }
  }

  if (key === "dosage_strength" && /\bmagnesium\b/.test(lower) && /\b30\s*mg\b/i.test(value)) {
    const titleSupportsMagnesium =
      titleMentions(titleHint, "magnesium") || titleMentions(titleHint, "glycinate");
    const powderLike = /powder|greens|reds|blend/i.test(formHint) || /greens|reds|powder/i.test(titleHint);
    if (!titleSupportsMagnesium || powderLike) {
      return { blocked: true, reason: "known_demo_magnesium_strength" };
    }
  }

  if (key === "ingredients_list" && /complete\s+ingredients\s+from\s+label/i.test(value)) {
    return { blocked: true, reason: "placeholder_ingredients_list" };
  }

  return null;
}

export function shouldQuarantineStaleValue(input: StaleDemoMatchInput): boolean {
  return Boolean(detectKnownStaleDemoValue(input));
}

export function faqThresholdMet(input: {
  productName: string;
  productType: string;
  brand: string;
  form: string;
  mainIngredients: string[];
  servingSize: string;
  servingsPerContainer: string;
  suggestedUse: string;
  supportAreas: string[];
}): boolean {
  const identity = [input.productName, input.productType].some((entry) => normalizeTruthText(entry));
  const form = Boolean(normalizeTruthText(input.form));
  const grounding =
    input.mainIngredients.length > 0 ||
    Boolean(normalizeTruthText(input.servingSize)) ||
    Boolean(normalizeTruthText(input.servingsPerContainer)) ||
    Boolean(normalizeTruthText(input.suggestedUse)) ||
    input.supportAreas.length > 0;

  return identity && form && grounding;
}

export function shouldBlockGenericFaqAnswer(value: unknown): boolean {
  const normalized = normalizeTruthText(value);
  if (!normalized) return true;
  if (findCustomerFacingSentinelTokens(normalized).length > 0) return true;
  if (/\bdaily\s+wellness\s+support\b/i.test(normalized)) return true;
  return false;
}

export function hasGroundedValue(value: unknown): boolean {
  return Boolean(sanitizeCustomerFacingText(value));
}

export function preferTruthy<T>(...values: T[]): T | null {
  for (const value of values) {
    if (typeof value === "string") {
      if (normalizeTruthText(value)) return value;
      continue;
    }
    if (value) return value;
  }
  return null;
}

export function textIncludesUnknownToken(value: unknown): boolean {
  return titleMentions(normalizeTruthText(value), "unknown");
}
