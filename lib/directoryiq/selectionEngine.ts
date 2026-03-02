export function evaluateSelection(): {
  totalScore: number;
  scores: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
} {
  return {
    totalScore: 75,
    scores: {
      structure: 75,
      clarity: 75,
      trust: 75,
      authority: 75,
      actionability: 75,
    },
  };
}
