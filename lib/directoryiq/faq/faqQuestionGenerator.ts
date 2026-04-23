import type { FaqQuestionCandidate, ListingFaqContext, ResolvedIntentCluster } from "@/lib/directoryiq/faq/types";

const GENERIC_BLOCK_PATTERNS = [
  /what should guests consider before booking\??/i,
  /what are some things to know\??/i,
  /why is location important\??/i,
  /how can this help you make an informed decision\??/i,
];

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hasGenericPattern(question: string): boolean {
  return GENERIC_BLOCK_PATTERNS.some((pattern) => pattern.test(question));
}

type SerpSummaryInput = {
  faq_patterns?: string[];
  common_topics?: string[];
};

type SerpEntitiesInput = {
  amenities?: string[];
  location?: string[];
  intent?: string[];
};

function normalizeQuestion(value: string): string {
  const compact = value
    .replace(/^[\s\-*0-9.()]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return "";
  return compact.endsWith("?") ? compact : compact + "?";
}

function inferCluster(question: string, fallbackCluster: string): string {
  const value = question.toLowerCase();
  if (/amenit|pool|hot tub|wifi|kitchen/.test(value)) return "amenities";
  if (/walk|close|distance|near|lift|attraction|landmark/.test(value)) return "attraction proximity";
  if (/parking|transit|shuttle|car/.test(value)) return "parking / transit";
  if (/check[- ]?in|check[- ]?out|arrival|departure/.test(value)) return "check-in logistics";
  if (/cancel|refund|booking|policy|fee/.test(value)) return "cancellation / booking rules";
  if (/family|kids|child/.test(value)) return "family suitability";
  if (/pet|dog|cat/.test(value)) return "pet suitability";
  if (/season|snow|winter|summer|weather/.test(value)) return "seasonal access";
  if (/location|area|neighborhood|city/.test(value)) return "location";
  if (/sleep|occupancy|bedroom|bathroom/.test(value)) return "occupancy";
  return fallbackCluster;
}

function serpSeedQuestions(input: {
  context: ListingFaqContext;
  clusters: ResolvedIntentCluster[];
  serpSummary?: SerpSummaryInput;
  entities?: SerpEntitiesInput;
  evidenceGaps?: string[];
}): Array<{ question: string; clusterHint: string | null }> {
  const fromPatterns = (input.serpSummary?.faq_patterns ?? [])
    .map((item) => normalizeQuestion(item))
    .filter(Boolean)
    .map((question) => ({ question, clusterHint: null }));
  const fromGaps = (input.evidenceGaps ?? [])
    .map((gap) => normalizeQuestion(`Can guests verify ${gap} before booking`))
    .filter(Boolean)
    .map((question) => ({ question, clusterHint: null }));
  const amenityQuestions = (input.entities?.amenities ?? [])
    .slice(0, 4)
    .map((amenity) => normalizeQuestion(`Does this listing include ${amenity}`))
    .map((question) => ({ question, clusterHint: "amenities" }));
  const locationQuestions = (input.entities?.location ?? [])
    .slice(0, 3)
    .map((place) => normalizeQuestion(`How close is this listing to ${place}`))
    .map((question) => ({ question, clusterHint: "attraction proximity" }));

  const fallbackClusterPrompts = input.clusters.flatMap((cluster) => {
    const topic = cluster.cluster_name;
    const listingName = input.context.listing_name || "this listing";
    return [
      { question: normalizeQuestion(`What should guests know about ${topic} at ${listingName}`), clusterHint: topic },
      { question: normalizeQuestion(`How does ${topic} affect a stay at ${listingName}`), clusterHint: topic },
    ];
  });

  const cityHint = input.context.city
    ? [{ question: `What do guests mention most about staying in ${input.context.city}?`, clusterHint: "location" }]
    : [];

  const deduped = new Map<string, { question: string; clusterHint: string | null }>();
  for (const row of [...fromPatterns, ...fromGaps, ...amenityQuestions, ...locationQuestions, ...cityHint, ...fallbackClusterPrompts]) {
    if (!row.question) continue;
    const key = row.question.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, row);
  }
  return Array.from(deduped.values());
}

export function generateFaqQuestionCandidates(input: {
  context: ListingFaqContext;
  clusters: ResolvedIntentCluster[];
  serpSummary?: SerpSummaryInput;
  entities?: SerpEntitiesInput;
  evidenceGaps?: string[];
  minCandidates?: number;
  maxCandidates?: number;
}): FaqQuestionCandidate[] {
  const minCandidates = input.minCandidates ?? 10;
  const maxCandidates = input.maxCandidates ?? 20;
  const candidates: FaqQuestionCandidate[] = [];
  const clusterByName = new Map(input.clusters.map((cluster) => [cluster.cluster_name, cluster]));
  const seedQuestions = serpSeedQuestions({
    context: input.context,
    clusters: input.clusters,
    serpSummary: input.serpSummary,
    entities: input.entities,
    evidenceGaps: input.evidenceGaps,
  });

  for (const seed of seedQuestions) {
    const generic = hasGenericPattern(seed.question);
    const clusterName = inferCluster(seed.question, seed.clusterHint ?? input.clusters[0]?.cluster_name ?? "location");
    const cluster = clusterByName.get(clusterName) ?? input.clusters[0];
    if (!cluster) continue;

    const listingSpecificity = clamp(
      (cluster.relevance_score + (input.context.city ? 0.1 : 0) + (input.context.listing_name ? 0.1 : 0)) / 1.2
    );
    const coverage = clamp(cluster.facts_available_score);
    const intent = clamp(0.45 + cluster.relevance_score * 0.55);
    const hallucinationRisk = clamp(1 - coverage + (generic ? 0.25 : 0));

    candidates.push({
      question_text: seed.question,
      cluster: clusterName,
      listing_specificity_score: listingSpecificity,
      fact_coverage_score: coverage,
      selection_intent_score: intent,
      hallucination_risk_score: hallucinationRisk,
      drop_reason: generic ? "blocked_generic_pattern" : null,
    });
  }

  const filtered = candidates.filter((candidate) => candidate.drop_reason === null);
  const deduped = Array.from(new Map(filtered.map((candidate) => [candidate.question_text.toLowerCase(), candidate])).values());

  return deduped.slice(0, Math.max(maxCandidates, minCandidates));
}
