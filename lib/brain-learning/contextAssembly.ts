import { createHash } from "crypto";
import { BrainRetrievalItem, runBrainRetrieval } from "@/lib/brain-learning/retrieval";

const PACKET_VERSION = "co_brain_context_packet_v1";
const MAX_LIMIT = 12;
const MIN_LIMIT = 3;

export type CoBrainEvidenceItem = {
  chunkId: string;
  documentId: string;
  sourceItemId: string;
  ingestRunId: string;
  chunkText: string;
  relevanceScore: number;
  selectionReason: string[];
  freshness: BrainRetrievalItem["freshness"];
  taxonomyMatches: BrainRetrievalItem["taxonomyMatches"];
  provenance: BrainRetrievalItem["provenance"];
};

export type CoBrainTheme = {
  themeKey: string;
  themeLabel: string;
  weight: number;
  supportCount: number;
  supportingChunkIds: string[];
};

export type CoBrainConflict = {
  conflictType: "supersession_tension" | "taxonomy_ambiguity";
  severity: "low" | "medium";
  summary: string;
  involvedChunkIds: string[];
};

export type CoBrainContextPacket = {
  packetVersion: string;
  brainId: string;
  query: string;
  generatedAt: string;
  queryInterpretation: {
    normalizedQuery: string;
    queryTerms: string[];
    inferredIntents: string[];
    preferredTaxonomyNodeIds: string[];
    preferredTaxonomyNodeKeys: string[];
  };
  retrieval: {
    rankingStrategy: string;
    candidatesConsidered: number;
    candidatesReturned: number;
    candidatesSuppressed: {
      duplicateText: number;
      staleSuperseded: number;
      lowRelevance: number;
    };
  };
  evidence: {
    selectedCount: number;
    selected: CoBrainEvidenceItem[];
  };
  themes: CoBrainTheme[];
  strongestCurrentGuidance: Array<{
    chunkId: string;
    documentId: string;
    sourceItemId: string;
    guidanceText: string;
    relevanceScore: number;
    freshnessScore: number;
  }>;
  conflicts: CoBrainConflict[];
  answeringNotes: {
    responseStyle: "expert_advisor_grounded";
    guardrails: string[];
    recommendedStructure: string[];
    practicalNotes: string[];
  };
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const tokens = new Set<string>();
  for (const token of normalized.split(" ")) {
    if (token.length >= 2) tokens.add(token);
    if (token.endsWith("s") && token.length > 4) tokens.add(token.slice(0, -1));
  }
  return [...tokens];
}

function compactText(text: string, maxChars = 260): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function inferIntents(query: string): string[] {
  const q = normalizeText(query);
  const intents = new Set<string>();
  if (/\b(how|why|what|explain|understand)\b/.test(q)) intents.add("explanation");
  if (/\b(improve|optimize|increase|grow|boost|fix|reduce)\b/.test(q)) intents.add("optimization");
  if (/\b(plan|roadmap|steps|next|sequence|priorit)\b/.test(q)) intents.add("planning");
  if (/\b(compare|versus|vs|difference|tradeoff)\b/.test(q)) intents.add("comparison");
  if (/\b(risk|issue|problem|blocker)\b/.test(q)) intents.add("risk_review");
  if (intents.size === 0) intents.add("general_advisory");
  return [...intents];
}

function textSignature(text: string): string {
  const normalized = normalizeText(text).slice(0, 600);
  return createHash("sha1").update(normalized).digest("hex");
}

function selectEvidence(
  ranked: BrainRetrievalItem[],
  requestedLimit: number
): {
  selected: CoBrainEvidenceItem[];
  suppressed: { duplicateText: number; staleSuperseded: number; lowRelevance: number };
} {
  const selected: CoBrainEvidenceItem[] = [];
  const signatures = new Set<string>();
  const currentBySource = new Set<string>();
  const topScore = ranked[0]?.relevanceScore || 0;
  const minScore = Math.max(0.35, Number((topScore * 0.32).toFixed(6)));
  const suppressed = { duplicateText: 0, staleSuperseded: 0, lowRelevance: 0 };

  for (const item of ranked) {
    if (selected.length >= requestedLimit) break;

    if (item.relevanceScore < minScore) {
      suppressed.lowRelevance += 1;
      continue;
    }

    const signature = textSignature(item.chunkText);
    if (signatures.has(signature)) {
      suppressed.duplicateText += 1;
      continue;
    }

    const hasCurrentSibling = currentBySource.has(item.sourceItemId);
    const isExplicitlySuperseded = Boolean(item.freshness.supersededByDocumentId);
    if ((!item.freshness.isCurrent && hasCurrentSibling) || isExplicitlySuperseded) {
      suppressed.staleSuperseded += 1;
      continue;
    }

    signatures.add(signature);
    if (item.freshness.isCurrent) currentBySource.add(item.sourceItemId);

    const reasons: string[] = [];
    if (item.scoreBreakdown.lexical > 0.6) reasons.push("strong_lexical_match");
    if (item.scoreBreakdown.taxonomy > 0.15) reasons.push("taxonomy_alignment");
    if (item.freshness.isCurrent) reasons.push("current_document");
    if (item.freshness.freshnessScore >= 0.9) reasons.push("fresh_source");
    if (reasons.length === 0) reasons.push("ranked_relevance");

    selected.push({
      chunkId: item.chunkId,
      documentId: item.documentId,
      sourceItemId: item.sourceItemId,
      ingestRunId: item.ingestRunId,
      chunkText: item.chunkText,
      relevanceScore: item.relevanceScore,
      selectionReason: reasons,
      freshness: item.freshness,
      taxonomyMatches: item.taxonomyMatches,
      provenance: item.provenance,
    });
  }

  return { selected, suppressed };
}

function buildThemes(evidence: CoBrainEvidenceItem[]): CoBrainTheme[] {
  const byTheme = new Map<
    string,
    {
      themeLabel: string;
      weight: number;
      chunkIds: Set<string>;
    }
  >();

  for (const item of evidence) {
    for (const match of item.taxonomyMatches) {
      const key = match.taxonomyNodeKey;
      if (!key) continue;
      const weight = item.relevanceScore * (match.confidence ?? 0.4);
      const row = byTheme.get(key) || {
        themeLabel: match.taxonomyNodeLabel || key,
        weight: 0,
        chunkIds: new Set<string>(),
      };
      row.weight += weight;
      row.chunkIds.add(item.chunkId);
      byTheme.set(key, row);
    }
  }

  return [...byTheme.entries()]
    .map(([themeKey, row]) => ({
      themeKey,
      themeLabel: row.themeLabel,
      weight: Number(row.weight.toFixed(6)),
      supportCount: row.chunkIds.size,
      supportingChunkIds: [...row.chunkIds].sort(),
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.themeKey.localeCompare(b.themeKey);
    })
    .slice(0, 8);
}

function buildConflicts(allRanked: BrainRetrievalItem[], selected: CoBrainEvidenceItem[]): CoBrainConflict[] {
  const conflicts: CoBrainConflict[] = [];
  const bySource = new Map<string, BrainRetrievalItem[]>();
  for (const item of allRanked) {
    const list = bySource.get(item.sourceItemId) || [];
    list.push(item);
    bySource.set(item.sourceItemId, list);
  }

  for (const items of bySource.values()) {
    const current = items.filter((item) => item.freshness.isCurrent);
    const nonCurrent = items.filter((item) => !item.freshness.isCurrent);
    if (!current.length || !nonCurrent.length) continue;
    const bestCurrent = current[0];
    const bestOlder = nonCurrent[0];
    if (bestOlder.relevanceScore >= bestCurrent.relevanceScore - 0.25) {
      conflicts.push({
        conflictType: "supersession_tension",
        severity: "medium",
        summary: "Older guidance remains highly relevant but is superseded by a newer current document.",
        involvedChunkIds: [bestCurrent.chunkId, bestOlder.chunkId].sort(),
      });
    }
  }

  const selectedThemes = new Map<string, number>();
  for (const item of selected) {
    for (const match of item.taxonomyMatches) {
      selectedThemes.set(match.taxonomyNodeKey, (selectedThemes.get(match.taxonomyNodeKey) || 0) + 1);
    }
  }
  const topThemes = [...selectedThemes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (topThemes.length === 2 && topThemes[0][1] === topThemes[1][1]) {
    conflicts.push({
      conflictType: "taxonomy_ambiguity",
      severity: "low",
      summary: "Top evidence spans multiple equally weighted taxonomy themes; downstream answer should clarify scope.",
      involvedChunkIds: selected.slice(0, 4).map((item) => item.chunkId),
    });
  }

  return conflicts.slice(0, 6);
}

export async function runCoBrainContextAssembly(input: {
  brainId: string;
  query: string;
  limit?: number;
  taxonomyNodeIds?: string[] | null;
  taxonomyNodeKeys?: string[] | null;
}): Promise<CoBrainContextPacket> {
  const query = (input.query || "").trim();
  if (!query) throw new Error("Missing required field: query");

  const limit = Math.max(MIN_LIMIT, Math.min(Number(input.limit || 8), MAX_LIMIT));
  const taxonomyNodeIds = [...new Set((input.taxonomyNodeIds || []).map((id) => id.trim()).filter(Boolean))];
  const taxonomyNodeKeys = [...new Set((input.taxonomyNodeKeys || []).map((key) => key.trim()).filter(Boolean))];
  const queryTerms = tokenize(query);
  const inferredIntents = inferIntents(query);

  const retrievalLimit = Math.max(20, limit * 4);
  const retrieval = await runBrainRetrieval({
    brainId: input.brainId,
    query,
    limit: retrievalLimit,
    taxonomyNodeIds,
    taxonomyNodeKeys,
  });

  const { selected, suppressed } = selectEvidence(retrieval.items, limit);
  const themes = buildThemes(selected);
  const conflicts = buildConflicts(retrieval.items, selected);

  const strongestCurrentGuidance = selected
    .filter((item) => item.freshness.isCurrent)
    .slice(0, 4)
    .map((item) => ({
      chunkId: item.chunkId,
      documentId: item.documentId,
      sourceItemId: item.sourceItemId,
      guidanceText: compactText(item.chunkText, 220),
      relevanceScore: item.relevanceScore,
      freshnessScore: item.freshness.freshnessScore,
    }));

  return {
    packetVersion: PACKET_VERSION,
    brainId: input.brainId,
    query,
    generatedAt: new Date().toISOString(),
    queryInterpretation: {
      normalizedQuery: normalizeText(query),
      queryTerms,
      inferredIntents,
      preferredTaxonomyNodeIds: taxonomyNodeIds,
      preferredTaxonomyNodeKeys: taxonomyNodeKeys,
    },
    retrieval: {
      rankingStrategy: retrieval.rankingStrategy,
      candidatesConsidered: retrieval.candidatesConsidered,
      candidatesReturned: retrieval.returned,
      candidatesSuppressed: suppressed,
    },
    evidence: {
      selectedCount: selected.length,
      selected,
    },
    themes,
    strongestCurrentGuidance,
    conflicts,
    answeringNotes: {
      responseStyle: "expert_advisor_grounded",
      guardrails: [
        "Prioritize current/fresh guidance over superseded historical guidance.",
        "Stay grounded in selected evidence and do not invent unsupported claims.",
        "If conflicts are present, acknowledge ambiguity and provide best-current recommendation.",
      ],
      recommendedStructure: [
        "Brief direct answer to the user request.",
        "Explain rationale using top evidence themes.",
        "Provide practical next actions ordered by impact.",
        "Call out confidence and any unresolved ambiguity.",
      ],
      practicalNotes: [
        `Use ${selected.length} selected evidence chunks as the primary grounding corpus.`,
        "Prefer taxonomy-aligned evidence when framing recommendations.",
        "Avoid repeating near-duplicate transcript phrasing; synthesize as advisor guidance.",
      ],
    },
  };
}
