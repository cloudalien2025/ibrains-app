import type { FaqEntry, FaqQualityScores, FaqValidationResult, ListingFaqContext } from "@/lib/directoryiq/faq/types";

const GENERIC_LANGUAGE_PATTERNS = [
  /it is important to/i,
  /guests should consider/i,
  /understanding this can help/i,
  /this can help travelers decide/i,
  /answering these questions will help/i,
  /informed decision/i,
  /some details are not confirmed yet/i,
];

const TITLE_JARGON_PATTERN = /(pre[\s_-]*selection|friction|slot|publish_|mission control)/i;
const ADDRESS_LIKE_PATTERN = /\b\d{1,6}\s+[a-z0-9].*(street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|frontage|highway|hwy\.?|court|ct\.?)\b/i;

function normalizeAnswer(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

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
  const answers = input.faqEntries.map((entry) => entry.answer_plaintext.trim()).filter(Boolean);
  const normalizedAnswers = answers.map((entry) => normalizeAnswer(entry));
  const duplicateRatio =
    normalizedAnswers.length <= 1
      ? 0
      : (normalizedAnswers.length - new Set(normalizedAnswers).size) / normalizedAnswers.length;
  const fallbackRatio =
    input.faqEntries.length === 0
      ? 1
      : input.faqEntries.filter((entry) => {
          const plain = entry.answer_plaintext.toLowerCase();
          return (
            entry.fact_confidence === "unknown" ||
            plain.includes("verify") ||
            plain.includes("confirm this with the host") ||
            plain.includes("not currently listed")
          );
        }).length / input.faqEntries.length;
  const normalizedSourceFacts = input.faqEntries.map((entry) =>
    entry.source_facts
      .map((fact) => fact.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(" | ")
  );
  const distinctGroundedFacts = new Set(
    input.faqEntries
      .flatMap((entry) => entry.source_facts)
      .map((fact) => fact.trim().toLowerCase())
      .filter(Boolean)
  ).size;
  const repeatedSourceFactRatio =
    normalizedSourceFacts.length <= 1
      ? 0
      : (normalizedSourceFacts.length - new Set(normalizedSourceFacts).size) / normalizedSourceFacts.length;
  const firstSentenceKeys = input.faqEntries
    .map((entry) => entry.answer_plaintext.split(".")[0] ?? "")
    .map((sentence) => normalizeAnswer(sentence))
    .filter(Boolean);
  const repeatedFirstSentenceRatio =
    firstSentenceKeys.length <= 1 ? 0 : (firstSentenceKeys.length - new Set(firstSentenceKeys).size) / firstSentenceKeys.length;
  const unsupportedQuestionCount = input.faqEntries.filter((entry) => {
    const plain = entry.answer_plaintext.toLowerCase();
    const looksAddressLike = ADDRESS_LIKE_PATTERN.test(entry.answer_plaintext);
    if (/amenit/i.test(entry.question) && /\bhotel(s)?\b/i.test(plain) && !/wifi|pool|parking|kitchen|pet|spa|gym|shuttle|breakfast/.test(plain)) {
      return true;
    }
    if (/trip goals?|arrival without a car|local transit|parking/i.test(entry.question) && looksAddressLike && entry.source_facts.length <= 1) {
      return true;
    }
    return false;
  }).length;

  const directnessScores = input.faqEntries.map((entry) => {
    const firstSentence = entry.answer_plaintext.split(".")[0] ?? "";
    const trimmed = firstSentence.trim();
    if (/^for\s+[a-z]/i.test(trimmed) || /^available listing signals/i.test(trimmed)) return 92;
    if (/^(yes|no|some|this|guests|the listing|it)/i.test(trimmed)) return 55;
    return 70;
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
  if (input.faqEntries.length >= 5 && duplicateRatio > 0.45) blockedReasons.push("answer repetition too high");
  if (repeatedSourceFactRatio > 0.45) blockedReasons.push("source fact repetition too high");
  if (repeatedFirstSentenceRatio > 0.45) blockedReasons.push("answer openings are too repetitive");
  if (fallbackRatio > 0.5) blockedReasons.push("fallback answer ratio too high");
  if (fallbackRatio > 0.5 && distinctGroundedFacts < 3) blockedReasons.push("grounded fact diversity too low");
  if (unsupportedQuestionCount > 0) blockedReasons.push("one or more FAQ answers are not credibly supported by the dossier");
  if (TITLE_JARGON_PATTERN.test(input.context.title)) blockedReasons.push("title contains internal jargon");

  return {
    quality,
    blockedReasons,
    metrics: {
      duplicate_ratio: duplicateRatio,
      fallback_ratio: fallbackRatio,
      distinct_grounded_facts: distinctGroundedFacts,
      repeated_source_fact_ratio: repeatedSourceFactRatio,
      repeated_first_sentence_ratio: repeatedFirstSentenceRatio,
      unsupported_question_count: unsupportedQuestionCount,
    },
  };
}
