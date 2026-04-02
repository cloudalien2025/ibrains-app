import { CoBrainContextPacket, runCoBrainContextAssembly } from "@/lib/brain-learning/contextAssembly";

const ADVISOR_RESPONSE_VERSION = "advisor_response_v1";

export type AdvisorResponse = {
  responseVersion: "advisor_response_v1";
  brainId: string;
  query: string;
  contextPacketVersion: string;
  answer: string;
  answerSummary: string;
  recommendations: string[];
  cautions: string[];
  uncertaintyNotes: string[];
  nextSteps: string[];
  groundingSummary: {
    evidenceSelected: number;
    strongestCurrentGuidanceCount: number;
    themesUsed: string[];
    conflictsCount: number;
    freshnessBias: "current_preferred";
    supportingContextItemIds: string[];
  };
  supportingContextItemIds: string[];
  generationNotes: {
    generationMode: "deterministic_context_compose_v1";
    contextSource: "provided_packet" | "assembled_packet";
    staleSuppressionActive: boolean;
    duplicateSuppressionActive: boolean;
    guardrailsApplied: string[];
  };
  responseStyle: {
    persona: "expert_advisor";
    tone: "practical_natural";
    verbosity: "concise";
  };
};

export type BrainAnswerOrchestrationResult = {
  brainId: string;
  query: string;
  contextPacket: CoBrainContextPacket;
  advisorResponse: AdvisorResponse;
  summary: {
    contextPacketVersion: string;
    evidenceSelected: number;
    strongestCurrentGuidanceCount: number;
    conflictsCount: number;
    recommendationsCount: number;
  };
};

function compactSentence(text: string, maxChars = 180): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trim()}.`;
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function buildRecommendations(packet: CoBrainContextPacket): string[] {
  const fromGuidance = packet.strongestCurrentGuidance
    .slice(0, 3)
    .map((g, idx) => `Priority ${idx + 1}: ${compactSentence(g.guidanceText, 170)}`);

  const fromThemes = packet.themes
    .slice(0, 2)
    .map((theme) => `Reinforce "${theme.themeLabel}" because it is strongly represented across current evidence.`);

  const recommendations = uniqStrings([...fromGuidance, ...fromThemes]);
  return recommendations.slice(0, 5);
}

function buildCautions(packet: CoBrainContextPacket): string[] {
  const cautions: string[] = [];

  if (packet.conflicts.length > 0) {
    cautions.push("Evidence includes conflict signals; prefer the most current guidance and clarify assumptions.");
  }
  if (packet.retrieval.candidatesSuppressed.staleSuperseded > 0) {
    cautions.push("Older superseded guidance was detected and suppressed to avoid outdated recommendations.");
  }
  if (packet.evidence.selectedCount < 2) {
    cautions.push("Evidence base is narrow; treat recommendations as directional until more sources are ingested.");
  }

  return uniqStrings(cautions).slice(0, 4);
}

function buildUncertaintyNotes(packet: CoBrainContextPacket): string[] {
  const notes: string[] = [];

  if (packet.conflicts.some((c) => c.conflictType === "supersession_tension")) {
    notes.push("A superseded but still-relevant viewpoint exists; recommendation confidence is medium until validated.");
  }
  if (packet.conflicts.some((c) => c.conflictType === "taxonomy_ambiguity")) {
    notes.push("Multiple top themes have similar weight; scope should be clarified before deep execution.");
  }
  if (packet.retrieval.candidatesSuppressed.lowRelevance > 0) {
    notes.push("Low-relevance candidates were excluded to keep the answer focused on stronger evidence.");
  }

  return uniqStrings(notes).slice(0, 4);
}

function buildNextSteps(query: string, recommendations: string[], cautions: string[]): string[] {
  const steps: string[] = [];
  steps.push(`Align on success criteria for "${compactSentence(query, 120)}".`);
  if (recommendations[0]) steps.push(`Execute: ${recommendations[0]}`);
  if (recommendations[1]) steps.push(`Then execute: ${recommendations[1]}`);
  if (cautions[0]) steps.push(`Risk control: ${cautions[0]}`);
  return uniqStrings(steps).slice(0, 4);
}

function buildDirectAnswer(packet: CoBrainContextPacket, recommendations: string[], cautions: string[]): string {
  const primary = packet.strongestCurrentGuidance[0]?.guidanceText;
  const themeLabel = packet.themes[0]?.themeLabel || "the strongest current evidence";
  const rec1 = recommendations[0] || "Prioritize the highest-confidence current guidance first.";
  const cautionClause = cautions[0] ? ` ${cautions[0]}` : "";
  const primaryClause = primary ? `Start with this guidance: ${compactSentence(primary, 170)}` : rec1;

  return `Based on current grounded evidence, focus on ${themeLabel}. ${primaryClause} Then execute the next priorities in order of impact while keeping the plan practical and measurable.${cautionClause}`.trim();
}

function buildAnswerSummary(packet: CoBrainContextPacket): string {
  const topThemes = packet.themes.slice(0, 2).map((theme) => theme.themeLabel);
  const themeText = topThemes.length ? topThemes.join(" + ") : "current evidence themes";
  return `Expert draft prioritized around ${themeText}, weighted toward current documents and deduped evidence.`;
}

function normalizeProvidedPacket(packet: CoBrainContextPacket, brainId: string, query: string): CoBrainContextPacket {
  if (!packet || typeof packet !== "object") throw new Error("Invalid context packet");
  if ((packet.brainId || "").trim() !== brainId) throw new Error("Context packet brainId does not match request brainId");
  if ((packet.query || "").trim() !== query) throw new Error("Context packet query does not match request query");
  if ((packet.packetVersion || "").trim() !== "co_brain_context_packet_v1") {
    throw new Error("Unsupported context packet version");
  }
  return packet;
}

export async function runCoBrainAnswerOrchestration(input: {
  brainId: string;
  query: string;
  limit?: number;
  taxonomyNodeIds?: string[] | null;
  taxonomyNodeKeys?: string[] | null;
  contextPacket?: CoBrainContextPacket | null;
}): Promise<BrainAnswerOrchestrationResult> {
  const brainId = (input.brainId || "").trim();
  const query = (input.query || "").trim();
  if (!brainId) throw new Error("Missing required field: brainId");
  if (!query) throw new Error("Missing required field: query");

  const contextSource = input.contextPacket ? "provided_packet" : "assembled_packet";
  const contextPacket = input.contextPacket
    ? normalizeProvidedPacket(input.contextPacket, brainId, query)
    : await runCoBrainContextAssembly({
        brainId,
        query,
        limit: input.limit,
        taxonomyNodeIds: input.taxonomyNodeIds,
        taxonomyNodeKeys: input.taxonomyNodeKeys,
      });

  const recommendations = buildRecommendations(contextPacket);
  const cautions = buildCautions(contextPacket);
  const uncertaintyNotes = buildUncertaintyNotes(contextPacket);
  const nextSteps = buildNextSteps(query, recommendations, cautions);
  const supportingContextItemIds = contextPacket.evidence.selected.map((item) => item.chunkId);

  const advisorResponse: AdvisorResponse = {
    responseVersion: ADVISOR_RESPONSE_VERSION,
    brainId,
    query,
    contextPacketVersion: contextPacket.packetVersion,
    answer: buildDirectAnswer(contextPacket, recommendations, cautions),
    answerSummary: buildAnswerSummary(contextPacket),
    recommendations,
    cautions,
    uncertaintyNotes,
    nextSteps,
    groundingSummary: {
      evidenceSelected: contextPacket.evidence.selectedCount,
      strongestCurrentGuidanceCount: contextPacket.strongestCurrentGuidance.length,
      themesUsed: contextPacket.themes.map((theme) => theme.themeKey),
      conflictsCount: contextPacket.conflicts.length,
      freshnessBias: "current_preferred",
      supportingContextItemIds,
    },
    supportingContextItemIds,
    generationNotes: {
      generationMode: "deterministic_context_compose_v1",
      contextSource,
      staleSuppressionActive: contextPacket.retrieval.candidatesSuppressed.staleSuperseded > 0,
      duplicateSuppressionActive: contextPacket.retrieval.candidatesSuppressed.duplicateText > 0,
      guardrailsApplied: [...contextPacket.answeringNotes.guardrails],
    },
    responseStyle: {
      persona: "expert_advisor",
      tone: "practical_natural",
      verbosity: "concise",
    },
  };

  return {
    brainId,
    query,
    contextPacket,
    advisorResponse,
    summary: {
      contextPacketVersion: contextPacket.packetVersion,
      evidenceSelected: contextPacket.evidence.selectedCount,
      strongestCurrentGuidanceCount: contextPacket.strongestCurrentGuidance.length,
      conflictsCount: contextPacket.conflicts.length,
      recommendationsCount: advisorResponse.recommendations.length,
    },
  };
}
