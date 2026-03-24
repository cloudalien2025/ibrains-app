import type { FactConfidence, FaqEntry, FaqQuestionCandidate, ListingFaqContext } from "@/lib/directoryiq/faq/types";

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstNonEmpty(values: string[]): string {
  return values.map((value) => value.trim()).find(Boolean) ?? "";
}

function clusterLabel(cluster: string): string {
  return cluster.replace(/\s*\/\s*/g, " or ");
}

type SerpSummaryInput = {
  faq_patterns?: string[];
  common_topics?: string[];
  common_phrases?: string[];
};

type SerpEntitiesInput = {
  amenities?: string[];
  location?: string[];
  intent?: string[];
};

type SerpResultInput = {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
};

function clusterFacts(cluster: string, context: ListingFaqContext): { values: string[]; confidence: FactConfidence } {
  const map: Record<string, string[]> = {
    location: [context.neighborhood, context.city, context.region],
    "attraction proximity": context.nearby_landmarks,
    "seasonal access": context.seasonal_relevance,
    amenities: context.amenities,
    occupancy: [context.occupancy, context.bedrooms, context.bathrooms],
    "family suitability": [context.family_friendly, ...context.child_friendly_signals],
    "pet suitability": [context.pet_policy],
    "parking / transit": [context.parking],
    "check-in logistics": [context.checkin_info, context.checkout_info],
    "cancellation / booking rules": [context.cancellation_policy, ...context.booking_rules],
    "ideal traveler type": context.differentiators,
    differentiators: context.differentiators,
    "service area": [context.city, context.region],
    "response times": context.differentiators,
    "pricing model": context.booking_rules,
    scheduling: [context.checkin_info],
    qualifications: context.differentiators,
    fit: [context.category, context.subcategory],
    policies: [context.cancellation_policy, ...context.booking_rules],
    availability: [context.checkin_info, context.checkout_info],
    "reservation logistics": [context.checkin_info],
    "menu fit": context.amenities,
    "peak-time access": context.seasonal_relevance,
  };

  const values = (map[cluster] ?? []).map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) return { values: [], confidence: "unknown" };

  if (["family suitability"].includes(cluster) && context.fact_confidence_map.family_friendly === "inferred") {
    return { values, confidence: "inferred" };
  }

  return { values, confidence: "confirmed" };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function pickEntity(input: {
  entities?: SerpEntitiesInput;
  serpSummary?: SerpSummaryInput;
  index: number;
}): string {
  const pool = [
    ...(input.entities?.amenities ?? []),
    ...(input.entities?.location ?? []),
    ...(input.entities?.intent ?? []),
    ...(input.serpSummary?.common_topics ?? []),
  ].filter(Boolean);
  if (pool.length === 0) return "";
  return pool[input.index % pool.length] ?? "";
}

function findSerpEvidence(question: string, cluster: string, serpResults: SerpResultInput[]): SerpResultInput | null {
  const questionTokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
  const clusterTokens = cluster.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

  let best: { row: SerpResultInput; score: number } | null = null;
  for (const row of serpResults) {
    const body = `${row.title ?? ""} ${row.snippet ?? ""}`.toLowerCase();
    if (!body.trim()) continue;
    const overlap = [...questionTokens, ...clusterTokens].reduce((count, token) => count + (body.includes(token) ? 1 : 0), 0);
    const score = overlap + (typeof row.position === "number" ? Math.max(0, 10 - row.position) / 10 : 0);
    if (!best || score > best.score) best = { row, score };
  }
  return best?.score ? best.row : null;
}

function buildFactAnswer(input: {
  cluster: string;
  facts: string[];
  confidence: FactConfidence;
  context: ListingFaqContext;
  entity: string;
  index: number;
}): string {
  const topic = clusterLabel(input.cluster).toLowerCase();
  const direct = firstNonEmpty(input.facts) || input.context.listing_name;
  const local = firstNonEmpty([input.context.neighborhood, input.context.city, input.context.region]);
  const leadIn = ["For", "On", "Regarding"][input.index % 3];
  const entitySuffix = input.entity ? ` Travelers often compare this with ${input.entity}.` : "";

  if (input.confidence === "inferred") {
    return (
      `${leadIn} ${topic}, current listing signals point to ${direct}. ` +
      "This detail is inferred, so verify it directly with the host before booking." +
      entitySuffix
    );
  }

  const localSentence = local
    ? `That context matters for trips planned around ${local}.`
    : "This comes directly from the current listing details.";
  return `${leadIn} ${topic}, the listing specifies ${direct}. ${localSentence}${entitySuffix}`;
}

function buildSerpAnswer(input: {
  cluster: string;
  context: ListingFaqContext;
  evidence: SerpResultInput;
  entity: string;
  index: number;
}): string {
  const topic = clusterLabel(input.cluster).toLowerCase();
  const snippet = (input.evidence.snippet ?? "").trim();
  const title = (input.evidence.title ?? "").trim();
  const anchor = snippet || title || "nearby traveler discussions";
  const sourceLabel = title ? ` SERP sources such as "${title}" mention this.` : " SERP evidence supports this summary.";
  const varied = ["External search evidence indicates", "Search snippets suggest", "Recent SERP coverage highlights"][input.index % 3];
  const entitySuffix = input.entity ? ` This aligns with mentions of ${input.entity}.` : "";
  return `${varied} ${anchor} for ${input.context.listing_name} on ${topic}.${sourceLabel}${entitySuffix}`;
}

function buildFallbackAnswer(input: {
  cluster: string;
  context: ListingFaqContext;
  evidenceGaps: string[];
  entity: string;
  index: number;
}): string {
  const topic = clusterLabel(input.cluster).toLowerCase();
  const gap = input.evidenceGaps[input.index % Math.max(1, input.evidenceGaps.length)] ?? `the latest ${topic} details`;
  const verifyLead = ["Please verify", "Confirm with the host", "Check directly with the property for"][input.index % 3];
  const entitySuffix = input.entity ? ` and ask specifically about ${input.entity}` : "";
  return `${verifyLead} ${gap} for ${input.context.listing_name}${entitySuffix}. The listing does not currently provide a reliable public answer yet.`;
}

export function composeFaqAnswers(input: {
  context: ListingFaqContext;
  selectedQuestions: FaqQuestionCandidate[];
  serpSummary?: SerpSummaryInput;
  entities?: SerpEntitiesInput;
  evidenceGaps?: string[];
  serpResults?: SerpResultInput[];
}): FaqEntry[] {
  const entries: FaqEntry[] = [];
  const internalLinks = [input.context.canonical_url, ...input.context.support_links].filter(Boolean).slice(0, 3);
  const seenAnswers = new Set<string>();
  const serpResults = input.serpResults ?? [];
  const evidenceGaps = input.evidenceGaps ?? [];
  const hasSerpSignals =
    serpResults.length > 0 ||
    evidenceGaps.length > 0 ||
    (input.serpSummary?.faq_patterns?.length ?? 0) > 0 ||
    (input.entities?.amenities?.length ?? 0) > 0 ||
    (input.entities?.location?.length ?? 0) > 0 ||
    (input.entities?.intent?.length ?? 0) > 0;

  for (const [index, question] of input.selectedQuestions.entries()) {
    const { values, confidence } = clusterFacts(question.cluster, input.context);
    const entity = pickEntity({ entities: input.entities, serpSummary: input.serpSummary, index });

    let answerPlain = "";
    let factConfidence: FactConfidence = confidence;
    let sourceFacts: string[] = values;

    if (confidence !== "unknown") {
      answerPlain = buildFactAnswer({
        cluster: question.cluster,
        facts: values,
        confidence,
        context: input.context,
        entity,
        index,
      });
    } else {
      const serpEvidence = findSerpEvidence(question.question_text, question.cluster, serpResults);
      if (serpEvidence) {
        answerPlain = buildSerpAnswer({
          cluster: question.cluster,
          context: input.context,
          evidence: serpEvidence,
          entity,
          index,
        });
        sourceFacts = [serpEvidence.title ?? "", serpEvidence.snippet ?? "", serpEvidence.link ?? ""].filter(Boolean);
        factConfidence = "inferred";
      } else {
        if (!hasSerpSignals) {
          continue;
        }
        answerPlain = buildFallbackAnswer({
          cluster: question.cluster,
          context: input.context,
          evidenceGaps,
          entity,
          index,
        });
        sourceFacts = evidenceGaps.length > 0 ? [evidenceGaps[index % evidenceGaps.length] ?? ""] : [];
        factConfidence = "unknown";
      }
    }

    const normalizedAnswer = normalizeText(answerPlain);
    if (seenAnswers.has(normalizedAnswer)) {
      continue;
    }
    seenAnswers.add(normalizedAnswer);
    const answerHtml = "<p>" + htmlEscape(answerPlain) + "</p>";

    entries.push({
      question: question.question_text,
      answer_html: answerHtml,
      answer_plaintext: answerPlain,
      source_facts: sourceFacts,
      fact_confidence: factConfidence,
      intent_cluster: question.cluster,
      listing_anchor_terms: [input.context.listing_name, input.context.category].filter(Boolean),
      local_anchor_terms: [input.context.neighborhood, input.context.city, input.context.region].filter(Boolean),
      internal_links: internalLinks,
      quality_score: Math.round((question.listing_specificity_score + question.fact_coverage_score + question.selection_intent_score) * 33),
    });
  }

  return entries;
}
