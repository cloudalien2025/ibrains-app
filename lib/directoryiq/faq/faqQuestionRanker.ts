import type { FaqQuestionCandidate } from "@/lib/directoryiq/faq/types";

function score(candidate: FaqQuestionCandidate): number {
  return (
    candidate.listing_specificity_score * 0.3 +
    candidate.fact_coverage_score * 0.25 +
    candidate.selection_intent_score * 0.3 +
    (1 - candidate.hallucination_risk_score) * 0.15
  );
}

export function rankFaqQuestions(input: {
  candidates: FaqQuestionCandidate[];
  minFinal?: number;
  maxFinal?: number;
}): { selected: FaqQuestionCandidate[]; all: FaqQuestionCandidate[] } {
  const minFinal = input.minFinal ?? 6;
  const maxFinal = input.maxFinal ?? 10;
  const seenClusters = new Set<string>();

  const sorted = [...input.candidates]
    .map((candidate) => ({
      ...candidate,
      drop_reason: candidate.drop_reason,
    }))
    .sort((a, b) => score(b) - score(a));

  const selected: FaqQuestionCandidate[] = [];
  for (const candidate of sorted) {
    if (candidate.drop_reason) continue;
    if (selected.length >= maxFinal) {
      candidate.drop_reason = "ranked_below_threshold";
      continue;
    }

    const hasClusterCoverage = seenClusters.has(candidate.cluster);
    if (hasClusterCoverage && selected.length < minFinal) {
      // keep filling toward minimum count
    } else if (hasClusterCoverage && selected.some((item) => item.question_text === candidate.question_text)) {
      candidate.drop_reason = "duplicate";
      continue;
    }

    selected.push(candidate);
    seenClusters.add(candidate.cluster);
  }

  return {
    selected,
    all: sorted,
  };
}
