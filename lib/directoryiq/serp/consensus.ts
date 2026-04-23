import type { ConsensusOutline, ExtractedOutlineItem } from "../types";

const STOPWORDS = new Set(["the", "a", "an", "and", "for", "to", "in", "of", "near"]);

const normalizeHeading = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token))
    .join(" ")
    .trim();

const median = (nums: number[]): number => {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

export const buildConsensusOutline = (outlines: ExtractedOutlineItem[]): ConsensusOutline => {
  const h2Map = new Map<string, { heading: string; count: number; positions: number[]; h3: Map<string, number> }>();
  const questions = new Map<string, number>();

  outlines.forEach((outline) => {
    outline.h2.forEach((heading, index) => {
      const key = normalizeHeading(heading);
      if (!key) return;
      const current: { heading: string; count: number; positions: number[]; h3: Map<string, number> } =
        h2Map.get(key) ?? { heading, count: 0, positions: [], h3: new Map<string, number>() };
      current.count += 1;
      current.positions.push(index + 1);
      h2Map.set(key, current);
    });

    [...outline.h2, ...outline.h3].forEach((heading) => {
      const trimmed = heading.trim();
      if (!/(\?|^what\b|^how\b|^best\b)/i.test(trimmed)) return;
      const key = normalizeHeading(trimmed);
      questions.set(key, (questions.get(key) ?? 0) + 1);
    });

    outline.h3.forEach((h3) => {
      const h3Key = normalizeHeading(h3);
      if (!h3Key) return;
      const firstH2 = outline.h2[0];
      if (!firstH2) return;
      const h2Key = normalizeHeading(firstH2);
      const h2Bucket = h2Map.get(h2Key);
      if (!h2Bucket) return;
      h2Bucket.h3.set(h3, (h2Bucket.h3.get(h3) ?? 0) + 1);
    });
  });

  const wordCounts = outlines.map((item) => item.wordCount).sort((a, b) => a - b);
  const trimmed = wordCounts.length > 4 ? wordCounts.slice(1, -1) : wordCounts;

  const h2Sections = [...h2Map.values()]
    .filter((item) => item.count > 1)
    .map((item) => ({
      heading: item.heading,
      score: item.count,
      avgPosition: item.positions.reduce((sum, n) => sum + n, 0) / item.positions.length,
      h3: [...item.h3.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([heading]) => heading),
    }))
    .sort((a, b) => (b.score === a.score ? a.avgPosition - b.avgPosition : b.score - a.score));

  return {
    h2Sections,
    mustCoverQuestions: [...questions.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([question]) => question),
    targetLengthBand: {
      min: trimmed[0] ?? 900,
      median: median(trimmed.length ? trimmed : [1200]),
      max: trimmed[trimmed.length - 1] ?? 1800,
    },
  };
};

export const buildContentDeltas = (): string[] => [
  "Add local-area logistics readers should check before booking.",
  "Include seasonality or timing considerations without claiming unavailable data.",
  "Add practical pricing-range guidance framed as typical factors, not fixed quotes.",
  "Provide a quick checklist on how to choose the right provider.",
];
