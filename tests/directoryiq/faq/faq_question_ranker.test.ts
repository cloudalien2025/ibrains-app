import { describe, expect, it } from "vitest";
import { rankFaqQuestions } from "@/lib/directoryiq/faq/faqQuestionRanker";
import type { FaqQuestionCandidate } from "@/lib/directoryiq/faq/types";

function candidate(partial: Partial<FaqQuestionCandidate> & Pick<FaqQuestionCandidate, "question_text" | "cluster">): FaqQuestionCandidate {
  return {
    question_text: partial.question_text,
    cluster: partial.cluster,
    listing_specificity_score: partial.listing_specificity_score ?? 0.7,
    fact_coverage_score: partial.fact_coverage_score ?? 0.7,
    selection_intent_score: partial.selection_intent_score ?? 0.7,
    hallucination_risk_score: partial.hallucination_risk_score ?? 0.2,
    drop_reason: partial.drop_reason ?? null,
  };
}

describe("faq question ranker", () => {
  it("selects high-score questions and enforces max count", () => {
    const ranked = rankFaqQuestions({
      candidates: [
        candidate({ question_text: "Q1", cluster: "location", selection_intent_score: 0.9 }),
        candidate({ question_text: "Q2", cluster: "amenities", selection_intent_score: 0.85 }),
        candidate({ question_text: "Q3", cluster: "parking", selection_intent_score: 0.8 }),
        candidate({ question_text: "Q4", cluster: "rules", selection_intent_score: 0.75 }),
        candidate({ question_text: "Q5", cluster: "fit", selection_intent_score: 0.7 }),
        candidate({ question_text: "Q6", cluster: "pets", selection_intent_score: 0.65 }),
        candidate({ question_text: "Q7", cluster: "extras", selection_intent_score: 0.6 }),
      ],
      minFinal: 6,
      maxFinal: 6,
    });

    expect(ranked.selected).toHaveLength(6);
    expect(ranked.all.some((item) => item.drop_reason === "ranked_below_threshold")).toBe(true);
  });
});
