export const SUPPLEMENT_FDA_DISCLAIMER_LEAD =
  "These statements have not been evaluated by the Food and Drug Administration.";

export const SUPPLEMENT_FDA_DISCLAIMER_TAIL =
  "This product is not intended to diagnose, treat, cure, or prevent any disease.";

export const SUPPLEMENT_FDA_DISCLAIMER =
  `${SUPPLEMENT_FDA_DISCLAIMER_LEAD} ${SUPPLEMENT_FDA_DISCLAIMER_TAIL}`;

const CANONICAL_DISCLAIMER_REGEX = new RegExp(
  SUPPLEMENT_FDA_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  "gi"
);

const DISCLAIMER_SENTENCE_VARIANTS = [
  /these\s+statements\s+have\s+not\s+been\s+evaluated\s+by\s+the\s+food\s+and\s+drug\s+administration\.?/gi,
  /this\s+product\s+is\s+not\s+intended\s+to\s+[^.\n]*?disease\.?/gi,
] as const;

const MALFORMED_DISCLAIMER_PATTERNS = [
  /diagnos\w*,\s*support\s*,\s*support\s*,\s*or\s*support\s+any\s+disease/i,
  /this\s+product\s+is\s+not\s+intended\s+to\s+diagnos\w*,\s*support\s*,\s*support\s*,\s*or\s*support\s+any\s+disease/i,
  /support\s*,\s*support\b/i,
] as const;

const REPEATED_SUPPORT_FRAGMENT_REGEX = /\bsupport\b(?:\s*,\s*support\b)+/gi;
const DISCLAIMER_INLINE_LABEL_PREFIX_PATTERN =
  /\b(?:fda\s+)?disclaimer\s*[:\-]\s*(?=(?:\*\*)?\s*(?:these\s+statements|this\s+product)\b)/gi;
const DISCLAIMER_HEADING_ARTIFACT_PATTERN =
  /(?:^|\n)\s*(?:[*_`>#-]+\s*)?(?:fda\s+)?disclaimer\s*[:\-]?\s*(?:[*_`]+)?\s*(?=\n|$)/gi;

export type SupplementDisclaimerStatus =
  | "inserted"
  | "preserved"
  | "deduped"
  | "repaired"
  | "missing";

export interface SupplementDisclaimerNormalizationResult {
  normalizedText: string;
  canonicalCountBefore: number;
  canonicalCountAfter: number;
  variantCountBefore: number;
  malformedFragments: string[];
  status: SupplementDisclaimerStatus;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSupportArtifacts(value: string): string {
  return normalizeWhitespace(
    value
      .replace(REPEATED_SUPPORT_FRAGMENT_REGEX, "support")
      .replace(/\b(\w+)(?:\s+\1){2,}\b/gi, "$1")
  );
}

function stripDisclaimerHeadingArtifacts(value: string): string {
  return normalizeWhitespace(
    value
      .replace(DISCLAIMER_INLINE_LABEL_PREFIX_PATTERN, "")
      .replace(DISCLAIMER_HEADING_ARTIFACT_PATTERN, "\n")
  );
}

export function countCanonicalSupplementDisclaimer(value: string): number {
  const matches = value.match(CANONICAL_DISCLAIMER_REGEX);
  return matches?.length ?? 0;
}

export function detectMalformedSupplementDisclaimerFragments(value: string): string[] {
  const fragments: string[] = [];
  const normalized = value.trim();
  if (!normalized) return fragments;

  for (const pattern of MALFORMED_DISCLAIMER_PATTERNS) {
    if (pattern.test(normalized)) {
      fragments.push(pattern.source);
    }
  }

  const lower = normalized.toLowerCase();
  const hasDisclaimerTail = /this\s+product\s+is\s+not\s+intended\s+to\s+[^.\n]*?disease\.?/i.test(
    normalized
  );
  const hasCanonicalTail = lower.includes(SUPPLEMENT_FDA_DISCLAIMER_TAIL.toLowerCase());
  if (hasDisclaimerTail && !hasCanonicalTail) {
    fragments.push("non_canonical_disclaimer_tail");
  }

  return Array.from(new Set(fragments));
}

export function containsRepeatedSupportArtifact(value: string): boolean {
  if (!value.trim()) return false;
  return (
    /\bsupport\s*,\s*support\b/i.test(value) ||
    /\bsupport\s+support\b/i.test(value) ||
    /\b(supports\s+\w+)(?:\s*,\s*\1){1,}/i.test(value)
  );
}

export function normalizeSupplementDisclaimerText(
  value: string,
  options?: { appendWhenMissing?: boolean }
): SupplementDisclaimerNormalizationResult {
  const appendWhenMissing = options?.appendWhenMissing ?? true;
  const original = normalizeWhitespace(value);
  const canonicalCountBefore = countCanonicalSupplementDisclaimer(original);
  const malformedFragments = detectMalformedSupplementDisclaimerFragments(original);

  let variantCountBefore = 0;
  for (const pattern of DISCLAIMER_SENTENCE_VARIANTS) {
    variantCountBefore += original.match(pattern)?.length ?? 0;
  }

  let stripped = original.replace(CANONICAL_DISCLAIMER_REGEX, " ");
  for (const pattern of DISCLAIMER_SENTENCE_VARIANTS) {
    stripped = stripped.replace(pattern, " ");
  }

  stripped = stripDisclaimerHeadingArtifacts(normalizeSupportArtifacts(stripped));

  const normalizedText = appendWhenMissing
    ? stripped
      ? `${stripped}\n\n${SUPPLEMENT_FDA_DISCLAIMER}`
      : SUPPLEMENT_FDA_DISCLAIMER
    : stripped;

  const canonicalCountAfter = countCanonicalSupplementDisclaimer(normalizedText);

  let status: SupplementDisclaimerStatus = "missing";
  if (!appendWhenMissing && canonicalCountAfter === 0) {
    status = "missing";
  } else if (malformedFragments.length > 0) {
    status = "repaired";
  } else if (canonicalCountBefore === 0) {
    status = "inserted";
  } else if (canonicalCountBefore > 1 || variantCountBefore > 2) {
    status = "deduped";
  } else if (canonicalCountAfter === 1) {
    status = "preserved";
  }

  return {
    normalizedText,
    canonicalCountBefore,
    canonicalCountAfter,
    variantCountBefore,
    malformedFragments,
    status,
  };
}

export function removeSupplementDisclaimerVariants(value: string): string {
  let stripped = normalizeWhitespace(value).replace(CANONICAL_DISCLAIMER_REGEX, " ");
  for (const pattern of DISCLAIMER_SENTENCE_VARIANTS) {
    stripped = stripped.replace(pattern, " ");
  }
  return stripDisclaimerHeadingArtifacts(stripped);
}
