type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function pickNumber(record: AnyRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function mergeCounterValue(
  report: AnyRecord | null,
  run: AnyRecord | null,
  start: AnyRecord | null,
  keys: string[],
  fallback: number | null = null
): number | null {
  return (
    pickNumber(report, keys) ??
    pickNumber(run, keys) ??
    pickNumber(start, keys) ??
    fallback
  );
}

export function hasIngestCounters(payload: unknown): boolean {
  const root = asRecord(payload);
  if (!root) return false;
  const summary = asRecord(root.summary);
  const counters = asRecord(root.counters);
  return Boolean(
    pickNumber(root, ["candidates_found", "selected_new", "new_items_added"]) != null ||
      pickNumber(summary, ["candidates_found", "selected_new", "new_items_added"]) != null ||
      pickNumber(counters, ["candidates_found", "selected_new", "new_items_added"]) != null
  );
}

export function buildWorkerKeywordIngestPayload(input: {
  startPayload: unknown;
  runPayload?: unknown;
  reportPayload?: unknown;
}): Record<string, unknown> {
  const start = asRecord(input.startPayload) ?? {};
  const run = asRecord(input.runPayload);
  const report = asRecord(input.reportPayload);

  const candidatesFound = mergeCounterValue(report, run, start, ["candidates_found", "candidatesFound"]);
  const selectedNew = mergeCounterValue(report, run, start, ["selected_new", "selectedNew"]);
  const newItemsAdded = mergeCounterValue(
    report,
    run,
    start,
    ["new_items_added", "newItemsAdded", "ingested_new", "completed"]
  );
  const failedItems = mergeCounterValue(report, run, start, ["failed_items", "failedItems", "failed"], 0);
  const duplicatesSkipped =
    mergeCounterValue(report, run, start, ["duplicates_skipped", "duplicatesSkipped"]) ??
    (candidatesFound != null && selectedNew != null
      ? Math.max(0, candidatesFound - selectedNew)
      : null);
  const eligibleForProcessing =
    mergeCounterValue(report, run, start, ["eligible_for_processing", "eligibleForProcessing", "eligible_count"]) ??
    selectedNew;

  const mergedSummary: AnyRecord = {
    ...asRecord(start.summary),
    ...run,
    ...report,
    candidates_found: candidatesFound,
    selected_new: selectedNew,
    new_items_added: newItemsAdded,
    duplicates_skipped: duplicatesSkipped,
    eligible_for_processing: eligibleForProcessing,
    failed_items: failedItems,
  };

  return {
    ...start,
    ...run,
    ...report,
    summary: mergedSummary,
    counters: {
      ...asRecord(start.counters),
      candidates_found: candidatesFound,
      selected_new: selectedNew,
      new_items_added: newItemsAdded,
      duplicates_skipped: duplicatesSkipped,
      eligible_for_processing: eligibleForProcessing,
      failed_items: failedItems,
      completed: mergeCounterValue(report, run, start, ["completed", "ingested_new"], 0),
      failed: failedItems,
    },
  };
}
