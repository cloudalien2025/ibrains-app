import type { FaqQuestionCandidate, ListingFaqContext, ResolvedIntentCluster } from "@/lib/directoryiq/faq/types";

const GENERIC_BLOCK_PATTERNS = [
  /what should guests consider before booking\??/i,
  /what are some things to know\??/i,
  /why is location important\??/i,
  /how can this help you make an informed decision\??/i,
];

const CLUSTER_QUESTION_MAP: Record<string, string[]> = {
  location: [
    "Where is this property located?",
    "How does this location fit different trip goals?",
  ],
  "attraction proximity": [
    "How convenient is this property for nearby attractions?",
    "Which landmarks are closest to this listing?",
  ],
  "seasonal access": [
    "How does seasonality affect staying here?",
    "What seasonal conditions should travelers plan for?",
  ],
  amenities: [
    "What amenities are available at this property?",
    "Which amenities should guests confirm before booking?",
  ],
  occupancy: [
    "How many guests does this property fit comfortably?",
    "Is this property better for couples, families, or groups?",
  ],
  "family suitability": [
    "Is this property a good fit for families?",
    "What child-friendly signals does this listing have?",
  ],
  "pet suitability": [
    "Are pets allowed at this property?",
    "What should pet owners confirm before booking?",
  ],
  "parking / transit": [
    "What should guests know about parking and local transit?",
    "How convenient is arrival without a car?",
  ],
  "check-in logistics": [
    "What are the check-in and checkout logistics?",
    "How should guests plan arrival and departure timing?",
  ],
  "cancellation / booking rules": [
    "What should guests know about cancellation and booking rules?",
    "Are there booking restrictions travelers should confirm?",
  ],
  "ideal traveler type": [
    "Who is this listing best for?",
    "What travel style is this property best aligned with?",
  ],
  differentiators: [
    "What makes this listing stand out from nearby alternatives?",
    "Why might travelers choose this property over similar options?",
  ],
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hasGenericPattern(question: string): boolean {
  return GENERIC_BLOCK_PATTERNS.some((pattern) => pattern.test(question));
}

export function generateFaqQuestionCandidates(input: {
  context: ListingFaqContext;
  clusters: ResolvedIntentCluster[];
  minCandidates?: number;
  maxCandidates?: number;
}): FaqQuestionCandidate[] {
  const minCandidates = input.minCandidates ?? 10;
  const maxCandidates = input.maxCandidates ?? 20;
  const candidates: FaqQuestionCandidate[] = [];

  for (const cluster of input.clusters) {
    const templates = CLUSTER_QUESTION_MAP[cluster.cluster_name] ?? [
      `What should travelers know about ${cluster.cluster_name} for this listing?`,
    ];

    for (const questionText of templates) {
      const generic = hasGenericPattern(questionText);
      const listingSpecificity = clamp(
        (cluster.relevance_score + (input.context.city ? 0.1 : 0) + (input.context.listing_name ? 0.1 : 0)) /
          1.2
      );
      const coverage = clamp(cluster.facts_available_score);
      const intent = clamp(0.45 + cluster.relevance_score * 0.55);
      const hallucinationRisk = clamp(1 - coverage + (generic ? 0.25 : 0));

      candidates.push({
        question_text: questionText,
        cluster: cluster.cluster_name,
        listing_specificity_score: listingSpecificity,
        fact_coverage_score: coverage,
        selection_intent_score: intent,
        hallucination_risk_score: hallucinationRisk,
        drop_reason: generic ? "blocked_generic_pattern" : null,
      });
    }
  }

  const filtered = candidates.filter((candidate) => candidate.drop_reason === null);
  const deduped = Array.from(new Map(filtered.map((candidate) => [candidate.question_text.toLowerCase(), candidate])).values());

  if (deduped.length < minCandidates) {
    const extras = candidates
      .filter((candidate) => candidate.drop_reason !== "blocked_generic_pattern")
      .slice(0, minCandidates - deduped.length);
    deduped.push(...extras);
  }

  return deduped.slice(0, maxCandidates);
}
