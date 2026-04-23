import { directoryIqConfig } from "../config";
import type { EnqueueInput } from "../types";
import { updateSerpCacheById, findSerpCache } from "../storage/serpCacheStore";
import { buildConsensusOutline, buildContentDeltas } from "./consensus";
import { fetchOutlineForResult, fetchSerpTopResults } from "./fetch";

type QueueItem = { cacheId: string; input: EnqueueInput };

const queue: QueueItem[] = [];
let active = 0;

const isTransientError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return !/SERPAPI|4\d\d/.test(error.message);
};

const runJob = async (job: QueueItem): Promise<void> => {
  const attempts = 3;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const serpQueryUsed = `${job.input.focus_keyword}${job.input.location_modifier ? ` ${job.input.location_modifier}` : ""}`.trim();
      await updateSerpCacheById(job.cacheId, { status: "RUNNING", serp_query_used: serpQueryUsed, error_message: null });

      const results = await fetchSerpTopResults(serpQueryUsed);
      const extracted = [];
      for (const result of results) {
        try {
          extracted.push(await fetchOutlineForResult(result));
        } catch {
          extracted.push({ url: result.link, pageTitle: result.title, h1: "", h2: [], h3: [], wordCount: 0 });
        }
      }

      const consensus = buildConsensusOutline(extracted);
      await updateSerpCacheById(job.cacheId, {
        status: "READY",
        top_results: results,
        extracted_outline: extracted,
        consensus_outline: consensus,
        content_deltas: buildContentDeltas(),
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const statusCode = (error as Error & { code?: number }).code;
      const authFailure = statusCode ? statusCode >= 400 && statusCode < 500 : false;
      const retryable = i < attempts - 1 && isTransientError(error) && !authFailure;
      if (retryable) continue;
      await updateSerpCacheById(job.cacheId, { status: "FAILED", error_message: message });
      return;
    }
  }
};

const pump = () => {
  while (active < directoryIqConfig.serpMaxConcurrency && queue.length > 0) {
    const next = queue.shift();
    if (!next) return;
    active += 1;
    runJob(next)
      .catch(() => undefined)
      .finally(() => {
        active -= 1;
        pump();
      });
  }
};

export const enqueueSerpBuild = async (cacheId: string, input: EnqueueInput): Promise<void> => {
  const existing = await findSerpCache(input);
  if (existing?.status === "RUNNING") return;
  queue.push({ cacheId, input });
  pump();
};
