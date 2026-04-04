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
  processedCount: number | null;
  telemetryCompleteness: "complete" | "partial";
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
    "ingested_new",
    "items_succeeded_total",
    "completed",
  ]);
}

function processItem(metrics: Record<string, unknown>): number | null {
  return pickCount(metrics, [
    "processed",
    "processed_count",
    "items_processed",
    "items_succeeded_total",
    "completed",
    "transcripts_succeeded",
    "ingested_new",
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

function computeStageBasedReadiness(
  counts: PostIngestProcessingCounts,
  processedCount: number | null
): number | null {
  const collected = counts.collected;
  if (collected == null || collected <= 0) return null;

  // Weighted readiness that advances conservatively with real stage evidence.
  // Collected alone contributes baseline progress; processed and activated increase confidence.
  const normalizedProcessed = Math.max(
    0,
    Math.min(1, (processedCount ?? 0) / collected)
  );
  const normalizedActivated = Math.max(
    0,
    Math.min(1, (counts.activated ?? 0) / collected)
  );

  const readiness = Math.round(20 + normalizedProcessed * 40 + normalizedActivated * 40);
  return Math.max(0, Math.min(100, readiness));
}

function inferBlockingState(summary: {
  processingStatus: "idle" | "processing" | "completed" | "failed";
  counts: PostIngestProcessingCounts;
  processedCount: number | null;
}): PostIngestProcessingSummary["blockingState"] {
  const collected = summary.counts.collected;
  const activated = summary.counts.activated;
  const processedCount = summary.processedCount ?? 0;
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
  processedCount: number | null;
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
  reportPayload?: unknown;
  statsPayload?: unknown;
  fallbackReadinessPct: number | null;
  fallbackCollectedCount?: number | null;
}): PostIngestProcessingSummary {
  const stats = asRecord(input.statsPayload);
  const run = asRecord(input.runPayload);
  const report = asRecord(input.reportPayload);
  const counters = asRecord(run.counters);
  const metrics = asRecord(run.metrics);
  const metadata = asRecord(run.metadata);
  const combined = { ...stats, ...run, ...counters, ...metrics, ...metadata, ...report };

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
      "candidates_found",
      "selected_new",
    ]) ?? (input.fallbackCollectedCount == null ? null : Math.max(0, Math.round(input.fallbackCollectedCount))),
    normalized: normalizeItem(combined),
    classified: classifyItem(combined),
    summarized: summarizeItem(combined),
    activated: activateItem(combined),
    deduped: dedupeItem(combined),
  };
  const processedCount =
    processItem(combined) ??
    counts.summarized ??
    counts.classified ??
    counts.normalized;

  const processingStatus: PostIngestProcessingSummary["processingStatus"] = statusText.includes("fail")
    ? "failed"
    : statusText.includes("process") || statusText.includes("queue") || statusText.includes("running")
      ? "processing"
      : statusText.includes("complete") || statusText.includes("success")
        ? "completed"
        : "idle";

  const stageBasedReadiness = computeStageBasedReadiness(counts, processedCount);
  const blockingState = inferBlockingState({ processingStatus, counts, processedCount });
  const blockingReason = inferBlockingReason({
    processingStatus,
    counts,
    processedCount,
    blockingState,
  });
  const telemetryCompleteness: PostIngestProcessingSummary["telemetryCompleteness"] =
    counts.collected != null && processedCount != null && counts.activated != null
      ? "complete"
      : "partial";

  const summary: PostIngestProcessingSummary = {
    currentStage,
    processingStatus,
    blockingState,
    blockingReason,
    counts,
    processedCount,
    telemetryCompleteness,
    readinessPct:
      stageBasedReadiness ?? (input.fallbackReadinessPct == null ? null : Math.round(input.fallbackReadinessPct)),
    readinessSource: stageBasedReadiness == null ? "upstream_fill_pct" : "stage_based",
    nextStep: "",
  };
  summary.nextStep = inferNextStep(summary);
  return summary;
}
