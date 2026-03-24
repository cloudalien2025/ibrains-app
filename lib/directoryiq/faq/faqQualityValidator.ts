import type { FaqEntry, FaqQualityScores, FaqValidationResult, ListingFaqContext } from "@/lib/directoryiq/faq/types";

const GENERIC_LANGUAGE_PATTERNS = [
  /it is important to/i,
  /guests should consider/i,
  /understanding this can help/i,
  /this can help travelers decide/i,
  /answering these questions will help/i,
  /informed decision/i,
];

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp100(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

export function evaluateFaqQuality(input: {
  context: ListingFaqContext;
  faqEntries: FaqEntry[];
  selectedClusters: string[];
}): FaqValidationResult {
  const directnessScores = input.faqEntries.map((entry) => {
    const firstSentence = entry.answer_plaintext.split(".")[0] ?? "";
    return /^(yes|no|some|this|guests|the listing|it)/i.test(firstSentence.trim()) ? 100 : 55;
  });

  const genericHits = input.faqEntries.reduce((count, entry) => {
    return count + (GENERIC_LANGUAGE_PATTERNS.some((pattern) => pattern.test(entry.answer_plaintext)) ? 1 : 0);
  }, 0);

  const listingSpecificity = clamp100(
    avg(
      input.faqEntries.map((entry) =>
        entry.answer_plaintext.toLowerCase().includes(input.context.listing_name.toLowerCase()) ||
        entry.local_anchor_terms.length > 0
          ? 88
          : 62
      )
    )
  );

  const localRelevance = clamp100(
    avg(input.faqEntries.map((entry) => (entry.local_anchor_terms.length > 0 ? 90 : input.context.city ? 70 : 45)))
  );

  const directness = clamp100(avg(directnessScores));
  const factualGrounding = clamp100(
    avg(input.faqEntries.map((entry) => (entry.fact_confidence === "unknown" ? 55 : entry.source_facts.length > 0 ? 90 : 65)))
  );
  const selectionIntentCoverage = clamp100(Math.min(100, new Set(input.selectedClusters).size * 12));
  const genericLanguagePenalty = clamp100((genericHits / Math.max(1, input.faqEntries.length)) * 100);
  const hallucinationRisk = clamp100(
    avg(input.faqEntries.map((entry) => (entry.fact_confidence === "unknown" ? 45 : entry.fact_confidence === "inferred" ? 35 : 18)))
  );
  const answerCompleteness = clamp100(avg(input.faqEntries.map((entry) => (entry.answer_plaintext.length >= 80 ? 88 : 65))));
  const internalLinkQuality = clamp100(
    avg(input.faqEntries.map((entry) => (entry.internal_links.length >= 1 && entry.internal_links.length <= 3 ? 92 : 55)))
  );

  const quality: FaqQualityScores = {
    listing_specificity: listingSpecificity,
    local_relevance: localRelevance,
    directness,
    factual_grounding: factualGrounding,
    selection_intent_coverage: selectionIntentCoverage,
    generic_language_penalty: genericLanguagePenalty,
    hallucination_risk: hallucinationRisk,
    answer_completeness: answerCompleteness,
    internal_link_quality: internalLinkQuality,
  };

  const blockedReasons: string[] = [];
  if (listingSpecificity < 60) blockedReasons.push("listing specificity too low");
  if (directness < 70) blockedReasons.push("answer directness too low");
  if (genericLanguagePenalty > 35) blockedReasons.push("generic language penalty too high");
  if (hallucinationRisk > 50) blockedReasons.push("hallucination risk too high");
  if (selectionIntentCoverage < 55) blockedReasons.push("question diversity too low");

  return { quality, blockedReasons };
}
