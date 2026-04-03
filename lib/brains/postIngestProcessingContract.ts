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

function inferNextStep(summary: {
  processingStatus: "idle" | "processing" | "completed" | "failed";
  counts: PostIngestProcessingCounts;
}): string {
  if (summary.processingStatus === "failed") {
    return "Review failed runs and retry processing.";
  }
  if (summary.processingStatus === "processing") {
    return "Continue processing to move items toward activation.";
  }
  if ((summary.counts.activated ?? 0) > 0) {
    return "Run retrieval or answer tests on activated knowledge.";
  }
  if ((summary.counts.collected ?? 0) > 0) {
    return "Advance normalized/classified items to activation.";
  }
  return "Run discovery to collect new knowledge.";
}

export function summarizePostIngestProcessing(input: {
  runPayload: unknown;
  fallbackReadinessPct: number | null;
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
    ]),
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

  const summary: PostIngestProcessingSummary = {
    currentStage,
    processingStatus,
    counts,
    readinessPct:
      stageBasedReadiness ?? (input.fallbackReadinessPct == null ? null : Math.round(input.fallbackReadinessPct)),
    readinessSource: stageBasedReadiness == null ? "upstream_fill_pct" : "stage_based",
    nextStep: "",
  };
  summary.nextStep = inferNextStep(summary);
  return summary;
}
