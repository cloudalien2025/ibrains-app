export const LEAK_TYPES = ["mention_without_link", "weak_anchor_text", "orphan_listing"] as const;

export type LeakType = (typeof LEAK_TYPES)[number];
export type LeakStatus = "open" | "ignored" | "resolved";

export const LEAK_SEVERITY: Record<LeakType, number> = {
  mention_without_link: 5,
  orphan_listing: 4,
  weak_anchor_text: 2,
};

export type LeakEvidence = {
  mentionText?: string | null;
  anchorText?: string | null;
  href?: string | null;
  snippet?: string | null;
};

export type LeakCandidate = {
  leakType: LeakType;
  severity: number;
  blogNodeId: string | null;
  listingNodeId: string | null;
  evidence: LeakEvidence;
  dedupeKey: string;
};
