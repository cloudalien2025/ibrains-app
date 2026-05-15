import type { ShopifySupplementComplianceResult } from "@/lib/ecomviper/shopify/shopify-agentic-types";

export const SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER =
  "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.";

const BLOCKED_PHRASE_PATTERNS: Array<{ phrase: string; pattern: RegExp }> = [
  { phrase: "ED", pattern: /\bed\b/i },
  { phrase: "erectile dysfunction", pattern: /\berectile\s+dysfunction\b/i },
  { phrase: "hypertension", pattern: /\bhypertension\b/i },
  { phrase: "anxiety", pattern: /\banxiety\b/i },
  { phrase: "insomnia", pattern: /\binsomnia\b/i },
  { phrase: "depression", pattern: /\bdepression\b/i },
  { phrase: "cure", pattern: /\bcure\b/i },
  { phrase: "treat", pattern: /\btreat\b/i },
  { phrase: "prevent", pattern: /\bprevent\b/i },
  { phrase: "reverse", pattern: /\breverse\b/i },
  { phrase: "Natural Viagra", pattern: /\bnatural\s+viagra\b/i },
  { phrase: "works like Cialis", pattern: /\bworks\s+like\s+cialis\b/i },
];

const SAFE_ALTERNATIVES = [
  "supports hydration",
  "supports daily wellness",
  "supports metabolism",
  "supports digestion",
  "supports immune wellness",
  "supports relaxation",
  "supports sleep quality",
  "supports men's wellness",
  "supports women's wellness",
  "supports joint comfort",
  "supports focus",
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function findBlockedSupplementPhrases(text: string): string[] {
  const candidate = text.trim();
  if (!candidate) return [];

  return BLOCKED_PHRASE_PATTERNS.filter((entry) => entry.pattern.test(candidate)).map(
    (entry) => entry.phrase
  );
}

export function stripRepeatedDisclaimer(text: string): string {
  const escaped = SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const disclaimerPattern = new RegExp(escaped, "gi");
  return normalizeWhitespace(text.replace(disclaimerPattern, " "));
}

export function ensureSingleFdaDisclaimer(text: string): string {
  const withoutDisclaimer = stripRepeatedDisclaimer(text);
  if (!withoutDisclaimer) return SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER;
  return `${withoutDisclaimer} ${SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER}`;
}

export function validateShopifySupplementCompliance(text: string): ShopifySupplementComplianceResult {
  const normalizedText = normalizeWhitespace(text);
  const blockedPhrases = findBlockedSupplementPhrases(normalizedText);
  const disclaimerIncluded =
    new RegExp(
      SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    ).test(normalizedText);

  return {
    safe: blockedPhrases.length === 0,
    blockedPhrases,
    safeAlternatives: SAFE_ALTERNATIVES,
    disclaimerIncluded,
    normalizedText,
  };
}

export function buildSupplementSafeFaqBundle(
  entries: Array<{ question: string; answer: string }>
): { bundleText: string; disclaimerCount: number } {
  const formattedEntries = entries
    .map((entry) => {
      const safeQuestion = normalizeWhitespace(entry.question);
      const safeAnswer = normalizeWhitespace(entry.answer);
      if (!safeQuestion || !safeAnswer) return "";
      const compliance = validateShopifySupplementCompliance(safeAnswer);
      const answerWithDisclaimer = compliance.disclaimerIncluded
        ? ensureSingleFdaDisclaimer(safeAnswer)
        : safeAnswer;
      return `Q: ${safeQuestion}\nA: ${answerWithDisclaimer}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const finalBundle = ensureSingleFdaDisclaimer(formattedEntries);
  const disclaimerCount =
    finalBundle.split(SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER).length - 1;

  return {
    bundleText: finalBundle,
    disclaimerCount,
  };
}

export function supplementComplianceGuardrails(): string[] {
  return unique([...SAFE_ALTERNATIVES, SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER]);
}
