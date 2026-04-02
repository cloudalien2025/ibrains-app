export type BrainSourceWatchKind =
  | "youtube_channel"
  | "youtube_playlist"
  | "youtube_keyword"
  | "web_domain"
  | "web_feed";

export type BrainSourceItemKind =
  | "youtube_video"
  | "web_doc"
  | "podcast_episode"
  | "other";

export type BrainIngestRunStatus =
  | "discovered"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "skipped_duplicate"
  | "superseded"
  | "reingest_requested";

export type BrainIngestTriggerType =
  | "watch_poll"
  | "manual"
  | "backfill"
  | "reingest"
  | "system";

export type BrainDocumentKind =
  | "transcript"
  | "source_text"
  | "normalized_markdown"
  | "extraction_json"
  | "other";

export type BrainEmbeddingStatus = "pending" | "ready" | "failed" | "skipped";

export type BrainTaxonomyAssignmentOrigin = "rule" | "llm" | "human" | "import";

export type BrainRecord = {
  id: string;
  slug: string;
  name: string;
  brainType: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BrainSourceWatchRecord = {
  id: string;
  brainId: string;
  sourceKind: BrainSourceWatchKind;
  externalRef: string;
  canonicalRef: string;
  discoveryQuery: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrainSourceItemRecord = {
  id: string;
  brainId: string;
  sourceWatchId: string | null;
  sourceKind: BrainSourceItemKind;
  sourceItemId: string;
  canonicalIdentity: string;
  sourceUrl: string | null;
  title: string | null;
  publisherName: string | null;
  languageCode: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  sourcePayload: Record<string, unknown>;
  sourcePayloadHash: string | null;
  transcriptHash: string | null;
  latestIngestRunId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrainIngestRunRecord = {
  id: string;
  brainId: string;
  sourceItemId: string;
  status: BrainIngestRunStatus;
  triggerType: BrainIngestTriggerType;
  ingestReason: string | null;
  attemptNo: number;
  workerRunId: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  reingestOfRunId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrainDocumentRecord = {
  id: string;
  brainId: string;
  sourceItemId: string;
  ingestRunId: string;
  documentKind: BrainDocumentKind;
  languageCode: string | null;
  contentText: string | null;
  contentJson: Record<string, unknown>;
  tokenCount: number | null;
  contentSha256: string | null;
  versionNo: number;
  freshnessScore: number;
  isCurrent: boolean;
  supersedesDocumentId: string | null;
  supersededByDocumentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type BrainChunkRecord = {
  id: string;
  brainId: string;
  documentId: string;
  sourceItemId: string;
  ingestRunId: string;
  chunkIndex: number;
  startMs: number | null;
  endMs: number | null;
  startToken: number | null;
  endToken: number | null;
  contentText: string;
  contentSha256: string | null;
  taxonomyHint: string | null;
  embeddingModel: string | null;
  embeddingStatus: BrainEmbeddingStatus;
  embeddingGeneratedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type BrainTaxonomyNodeRecord = {
  id: string;
  brainId: string;
  key: string;
  label: string;
  description: string | null;
  parentNodeId: string | null;
  nodePath: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BrainChunkTaxonomyAssignmentRecord = {
  id: string;
  brainId: string;
  chunkId: string;
  taxonomyNodeId: string;
  ingestRunId: string | null;
  confidence: number | null;
  assignedBy: BrainTaxonomyAssignmentOrigin;
  assignmentMethod: string;
  rationale: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
