export type NodeType = "listing" | "blog_post" | "hub";

export type EdgeType =
  | "internal_link"
  | "mention_without_link"
  | "hub_relation"
  | "weak_anchor";

export type IssueType = "orphan_listing" | "mention_without_link" | "weak_anchor";

export type GraphEvidence = {
  sourceUrl: string;
  targetUrl?: string | null;
  anchorText?: string | null;
  contextSnippet?: string | null;
  domPath?: string | null;
  locationHint?: "body" | "sidebar" | "footer" | "unknown" | null;
};

export type GraphNodeRef = {
  nodeId?: string;
  nodeType: NodeType;
  externalId?: string;
  title?: string | null;
  canonicalUrl?: string | null;
};

export type GraphIssue = {
  type: IssueType;
  severity: "low" | "medium" | "high";
  from?: GraphNodeRef;
  to?: GraphNodeRef;
  evidence?: GraphEvidence | null;
  details: {
    summary: string;
    suggestedFix: string;
    [key: string]: unknown;
  };
};

export type GraphIssuesRun = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  stats: Record<string, unknown>;
};

export type GraphIssuesPayload = {
  orphans: GraphIssue[];
  mentions_without_links: GraphIssue[];
  weak_anchors: GraphIssue[];
  lastRun: GraphIssuesRun | null;
};

const WEAK_ANCHOR_TERMS = new Set([
  "click here",
  "here",
  "learn more",
  "read more",
  "view more",
  "more",
  "this link",
  "link",
  "website",
  "visit",
]);

export function weakAnchorDetector(anchorText: string): boolean {
  const normalized = anchorText.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return true;
  if (normalized.length <= 2) return true;
  return WEAK_ANCHOR_TERMS.has(normalized);
}
