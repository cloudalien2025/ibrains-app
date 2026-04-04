export type DirectoryIQPostIngestStage =
  | "COLLECTED"
  | "NORMALIZED"
  | "CLASSIFIED"
  | "SUMMARIZED"
  | "ACTIVATED";

export const DIRECTORYIQ_POST_INGEST_STAGES: DirectoryIQPostIngestStage[] = [
  "COLLECTED",
  "NORMALIZED",
  "CLASSIFIED",
  "SUMMARIZED",
  "ACTIVATED",
];

export type PostIngestProcessingCounts = {
  collected: number | null;
  normalized: number | null;
  classified: number | null;
  summarized: number | null;
  activated: number | null;
  deduped: number | null;
};

export type PostIngestProcessingSummary = {
  currentStage: DirectoryIQPostIngestStage;
  processingStatus: "idle" | "processing" | "completed" | "failed";
  blockingState:
    | "Needs Collection"
    | "Needs Processing"
    | "Needs Activation"
    | "Ready for Use"
    | "Awaiting Processing Signal";
  blockingReason: string;
  nextStep: string;
  counts: PostIngestProcessingCounts;
  readinessPct: number | null;
  readinessSource: "stage_based" | "upstream_fill_pct";
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function pickCount(candidate: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = toNumber(candidate[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function normalizeItem(metrics: Record<string, unknown>): number | null {
  return pickCount(metrics, [
    "normalized",
    "normalized_count",
    "items_normalized",
  ]);
}

function dedupeItem(metrics: Record<string, unknown>): number | null {
  return pickCount(metrics, [
    "deduped",
    "deduped_count",
    "duplicates_skipped",
    "duplicate_count",
  ]);
}

function classifyItem(metrics: Record<string, unknown>): number | null {
  return pickCount(metrics, [
    "classified",
    "classified_count",
    "items_classified",
    "taxonomy_chunks_classified",
  ]);
}

function summarizeItem(metrics: Record<string, unknown>): number | null {
  return pickCount(metrics, [
    "summarized",
    "summarized_count",
    "items_summarized",
    "summaries_generated",
  ]);
}

function activateItem(metrics: Record<string, unknown>): number | null {
  return pickCount(metrics, [
    "activated",
    "activated_count",
    "items_activated",
    "retrieval_ready",
    "ready_items",
    "usable_items",
  ]);
}

function mapCurrentStage(rawStage: string | null): DirectoryIQPostIngestStage {
  const stage = (rawStage || "").toLowerCase();
  if (stage.includes("activat") || stage.includes("ready")) return "ACTIVATED";
  if (stage.includes("summar")) return "SUMMARIZED";
  if (stage.includes("classif") || stage.includes("taxonomy")) return "CLASSIFIED";
  if (stage.includes("normaliz")) return "NORMALIZED";
  return "COLLECTED";
}

function computeStageBasedReadiness(counts: PostIngestProcessingCounts): number | null {
  const collected = counts.collected;
  if (collected == null || collected <= 0) return null;

  if (counts.activated != null && counts.activated > 0) {
    return Math.max(0, Math.min(100, Math.round((counts.activated / collected) * 100)));
  }
  if (counts.summarized != null && counts.summarized > 0) {
    return Math.max(0, Math.min(75, Math.round((counts.summarized / collected) * 75)));
  }
  if (counts.classified != null && counts.classified > 0) {
    return Math.max(0, Math.min(55, Math.round((counts.classified / collected) * 55)));
  }
  if (counts.normalized != null && counts.normalized > 0) {
    return Math.max(0, Math.min(35, Math.round((counts.normalized / collected) * 35)));
  }
  return 10;
}

function inferBlockingState(summary: {
  processingStatus: "idle" | "processing" | "completed" | "failed";
  counts: PostIngestProcessingCounts;
}): PostIngestProcessingSummary["blockingState"] {
  const collected = summary.counts.collected;
  const activated = summary.counts.activated;
  const processedCount = Math.max(
    summary.counts.normalized ?? 0,
    summary.counts.classified ?? 0,
    summary.counts.summarized ?? 0
  );
  const hasProcessingTelemetry =
    summary.counts.normalized != null ||
    summary.counts.classified != null ||
    summary.counts.summarized != null ||
    summary.counts.activated != null;

  if (collected == null) return "Awaiting Processing Signal";
  if (collected <= 0) return "Needs Collection";
  if ((activated ?? 0) > 0) return "Ready for Use";
  if (processedCount > 0) return "Needs Activation";
  if (summary.processingStatus === "processing") return "Needs Processing";
  if (!hasProcessingTelemetry) return "Awaiting Processing Signal";
  return "Needs Processing";
}

function inferBlockingReason(summary: {
  processingStatus: "idle" | "processing" | "completed" | "failed";
  counts: PostIngestProcessingCounts;
  blockingState: PostIngestProcessingSummary["blockingState"];
}): string {
  if (summary.processingStatus === "failed") {
    return "Recent processing failed, so readiness cannot advance.";
  }

  switch (summary.blockingState) {
    case "Needs Collection":
      return "No collected items are available yet.";
    case "Needs Processing":
      return "Items are collected but not yet processed into usable knowledge.";
    case "Needs Activation":
      return "Items are processed, but activation for retrieval is not complete.";
    case "Ready for Use":
      return "Activated knowledge is available for retrieval and answer workflows.";
    case "Awaiting Processing Signal":
      return "Readiness is waiting for upstream processing telemetry.";
    default:
      return "Readiness is waiting for updated processing state.";
  }
}

function inferNextStep(summary: {
  processingStatus: "idle" | "processing" | "completed" | "failed";
  blockingState: PostIngestProcessingSummary["blockingState"];
}): string {
  if (summary.processingStatus === "failed") {
    return "Review failed runs and retry processing.";
  }

  switch (summary.blockingState) {
    case "Needs Collection":
      return "Run discovery to collect new knowledge.";
    case "Needs Processing":
      return "Run processing to normalize and classify collected items.";
    case "Needs Activation":
      return "Complete activation so processed items become usable.";
    case "Ready for Use":
      return "Run retrieval or answer tests on activated knowledge.";
    case "Awaiting Processing Signal":
      return "Run a fresh ingest or processing cycle to refresh readiness telemetry.";
    default:
      return "Continue the next ingest cycle.";
  }
}

export function summarizePostIngestProcessing(input: {
  runPayload: unknown;
  fallbackReadinessPct: number | null;
  fallbackCollectedCount?: number | null;
}): PostIngestProcessingSummary {
  const run = asRecord(input.runPayload);
  const counters = asRecord(run.counters);
  const metrics = asRecord(run.metrics);
  const metadata = asRecord(run.metadata);
  const combined = { ...run, ...counters, ...metrics, ...metadata };

  const statusText = String(
    run.status ?? run.state ?? run.phase ?? "idle"
  ).toLowerCase();
  const currentStage = mapCurrentStage(
    String(run.stage ?? run.current_stage ?? run.step ?? run.current_step ?? "collected")
  );

  const counts: PostIngestProcessingCounts = {
    collected: pickCount(combined, [
      "collected",
      "collected_count",
      "items_collected",
      "discovered",
      "discovered_count",
      "new_items",
      "items_added",
      "ingested",
      "ingested_count",
      "total_ingested",
    ]) ?? (input.fallbackCollectedCount == null ? null : Math.max(0, Math.round(input.fallbackCollectedCount))),
    normalized: normalizeItem(combined),
    classified: classifyItem(combined),
    summarized: summarizeItem(combined),
    activated: activateItem(combined),
    deduped: dedupeItem(combined),
  };

  const processingStatus: PostIngestProcessingSummary["processingStatus"] = statusText.includes("fail")
    ? "failed"
    : statusText.includes("process") || statusText.includes("queue") || statusText.includes("running")
      ? "processing"
      : statusText.includes("complete") || statusText.includes("success")
        ? "completed"
        : "idle";

  const stageBasedReadiness = computeStageBasedReadiness(counts);
  const blockingState = inferBlockingState({ processingStatus, counts });
  const blockingReason = inferBlockingReason({ processingStatus, counts, blockingState });

  const summary: PostIngestProcessingSummary = {
    currentStage,
    processingStatus,
    blockingState,
    blockingReason,
    counts,
    readinessPct:
      stageBasedReadiness ?? (input.fallbackReadinessPct == null ? null : Math.round(input.fallbackReadinessPct)),
    readinessSource: stageBasedReadiness == null ? "upstream_fill_pct" : "stage_based",
    nextStep: "",
  };
  summary.nextStep = inferNextStep(summary);
  return summary;
}
