import { ListingFacts, PillarScores } from "@/src/directoryiq/domain/types";

export type ListingScoreResult = {
  totalScore: number;
  scores: PillarScores;
};

export function scoreListingSelection(_facts: ListingFacts): ListingScoreResult {
  const scores: PillarScores = {
    structure: 75,
    clarity: 75,
    trust: 75,
    authority: 75,
    actionability: 75,
  };
  return {
    totalScore: 75,
    scores,
  };
}
