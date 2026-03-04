export type PillarName = "structure" | "clarity" | "trust" | "authority" | "actionability";

export type PillarScores = Record<PillarName, number>;

export type Gap = {
  pillar: PillarName;
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
};

export type ListingFacts = {
  listingId: string;
  title: string;
  url: string | null;
  description: string;
  raw: Record<string, unknown>;
  allowedFacts: Record<string, unknown>;
};

export type UpgradeDraft = {
  id: string;
  listingId: string;
  originalText: string;
  proposedText: string;
  status: "draft" | "previewed" | "pushed";
  originalHash: string;
  createdAt: string;
  previewedAt: string | null;
  pushedAt: string | null;
  bdRef: string | null;
};

export type DiffRow = {
  left: string;
  right: string;
  type: "same" | "added" | "removed" | "changed";
};

export type ApiErrorShape = {
  error: {
    message: string;
    code: string;
    reqId: string;
    details?: string;
  };
};
