import type {
  WalmartDraftRecord,
  WalmartOptimizationProposalRecord,
  WalmartOptimizationProposalStatus,
} from "@/lib/ecomviper/walmart/walmart-types";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const mapped: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const text = asString(raw);
    if (text) mapped[key] = text;
  }
  return mapped;
}

function asProposalStatus(value: unknown): WalmartOptimizationProposalStatus {
  return value === "draft" || value === "staged" || value === "approved" || value === "submitted"
    ? value
    : "staged";
}

export function toOptimizerDraftPayload(proposal: WalmartOptimizationProposalRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: proposal.proposedTitle,
    longDescription: proposal.proposedDescription,
    bulletPoints: proposal.proposedBullets,
    attributes: proposal.proposedKeyAttributes,
    optimizerProposal: {
      id: proposal.id,
      source: proposal.source,
      proposedTitle: proposal.proposedTitle,
      proposedDescription: proposal.proposedDescription,
      proposedBullets: proposal.proposedBullets,
      proposedKeyAttributes: proposal.proposedKeyAttributes,
      proposedImageUrl: proposal.proposedImageUrl,
      proposedImageAction: proposal.proposedImageAction,
      recommendationReason: proposal.recommendationReason,
      status: proposal.status,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    },
  };

  if (proposal.proposedImageUrl.trim()) {
    payload.imageUrl = proposal.proposedImageUrl;
  }

  return payload;
}

export function readOptimizerProposalFromDraft(
  draft: WalmartDraftRecord
): WalmartOptimizationProposalRecord | null {
  const payload = draft.draftPayload as Record<string, unknown>;
  const envelope =
    payload.optimizerProposal && typeof payload.optimizerProposal === "object" && !Array.isArray(payload.optimizerProposal)
      ? (payload.optimizerProposal as Record<string, unknown>)
      : payload;

  const proposedTitle = asString(envelope.proposedTitle ?? payload.title);
  const proposedDescription = asString(envelope.proposedDescription ?? payload.longDescription);
  const proposedBullets = asStringArray(envelope.proposedBullets ?? payload.bulletPoints);
  const proposedKeyAttributes = asRecord(envelope.proposedKeyAttributes ?? payload.attributes);
  const proposedImageUrl = asString(envelope.proposedImageUrl ?? payload.imageUrl);

  if (!proposedTitle && !proposedDescription && proposedBullets.length === 0 && Object.keys(proposedKeyAttributes).length === 0) {
    return null;
  }

  const proposedImageActionRaw = asString(envelope.proposedImageAction);
  const proposedImageAction =
    proposedImageActionRaw === "keep" ||
    proposedImageActionRaw === "request_enrichment" ||
    proposedImageActionRaw === "manual_image_required"
      ? proposedImageActionRaw
      : "keep";

  return {
    id: asString(envelope.id) || draft.id,
    sku: draft.sku,
    source: asString(envelope.source) === "ai" ? "ai" : "deterministic",
    proposedTitle,
    proposedDescription,
    proposedBullets,
    proposedKeyAttributes,
    proposedImageUrl,
    proposedImageAction,
    recommendationReason: asString(envelope.recommendationReason) || draft.changeSummary,
    status: asProposalStatus(envelope.status),
    createdAt: asString(envelope.createdAt) || draft.createdAt,
    updatedAt: asString(envelope.updatedAt) || draft.updatedAt,
  };
}
