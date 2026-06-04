#!/usr/bin/env npx
// FileIQ background extraction worker.
//
// Polls fileiq_extraction_jobs for pending jobs, claims each as 'running',
// runs the extraction strategy (deterministic local parse or Claude Agent SDK),
// then updates the job to 'completed' or 'failed' and writes the raw extraction.
//
// Usage (dev):
//   npx --yes tsx scripts/fileiq-worker.ts
//
// Usage (production systemd service):
//   See fileiq-worker.service in the repo root.

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  claimFileIqPendingJob,
  updateFileIqExtractionJob,
  insertFileIqRawExtraction,
} from "@/lib/fileiq/fileiq-db-core";
import { runFileIqExtractionAgent } from "@/lib/fileiq/agent/fileiq-agent-core";
import {
  extractJsonFromAgentResult,
  detectProductCatalogSummary,
} from "@/lib/fileiq/result-parser";
import { parseRocktomicInventoryCsv } from "@/lib/fileiq/csv/rocktomic-inventory-parser";

const LOG = "[fileiq:worker]";
const POLL_INTERVAL_MS = 5_000;

function normalizeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface WorkerContext {
  agentPrompt: string;
  cwd: string | null;
  additionalDirectories: string[];
  maxTurns: number;
  route?: string;
  routeRationale?: string;
  filePaths?: Array<{ path: string; type: string }>;
  urls?: string[];
}

function extractWorkerContext(
  summary: Record<string, unknown>,
): WorkerContext | null {
  const workerCtx = summary["_worker"];
  if (
    !workerCtx ||
    typeof workerCtx !== "object" ||
    typeof (workerCtx as Record<string, unknown>)["agentPrompt"] !== "string"
  ) {
    return null;
  }
  const ctx = workerCtx as Record<string, unknown>;
  return {
    agentPrompt: ctx["agentPrompt"] as string,
    cwd: typeof ctx["cwd"] === "string" ? ctx["cwd"] : null,
    additionalDirectories: Array.isArray(ctx["additionalDirectories"])
      ? (ctx["additionalDirectories"] as string[])
      : [],
    maxTurns: typeof ctx["maxTurns"] === "number" ? ctx["maxTurns"] : 40,
    route: typeof ctx["route"] === "string" ? ctx["route"] : undefined,
    routeRationale:
      typeof ctx["routeRationale"] === "string" ? ctx["routeRationale"] : undefined,
    filePaths: Array.isArray(ctx["filePaths"])
      ? (ctx["filePaths"] as Array<{ path: string; type: string }>)
      : undefined,
    urls: Array.isArray(ctx["urls"]) ? (ctx["urls"] as string[]) : undefined,
  };
}

/**
 * Attempt deterministic CSV extraction for the Rocktomic inventory format.
 * Returns the parsed payload if confidence is high, or null to fall back.
 */
async function tryDeterministicCsvExtraction(
  ctx: WorkerContext,
  jobId: string,
): Promise<Record<string, unknown> | null> {
  if (!ctx.filePaths || ctx.filePaths.length === 0) return null;

  const csvFiles = ctx.filePaths.filter(
    (f) =>
      f.type === "csv" ||
      f.path.toLowerCase().endsWith(".csv"),
  );
  if (csvFiles.length === 0) return null;

  // Read and parse the first CSV file deterministically
  const csvFile = csvFiles[0];
  let content: string;
  try {
    content = await fs.readFile(csvFile.path, "utf8");
  } catch (err) {
    console.warn(
      `${LOG} jobId=${jobId} | CSV read failed | path=${csvFile.path} error=${normalizeError(err)}`,
    );
    return null;
  }

  // Extract a report date from the file name if present (e.g. "inventory-2026-06-04.csv")
  const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(path.basename(csvFile.path));
  const reportDate = dateMatch ? dateMatch[1] : undefined;

  const result = parseRocktomicInventoryCsv(content, reportDate);
  console.log(
    `${LOG} jobId=${jobId} | deterministic CSV parse | confidence=${result.confidence} productCount=${result.productCount}`,
  );

  if (result.confidence === "low") {
    if (result.parseNotes.length > 0) {
      console.warn(
        `${LOG} jobId=${jobId} | CSV parse low confidence | notes=${result.parseNotes.join("; ")}`,
      );
    }
    return null; // fall back to agent
  }

  return result.payload;
}

export async function processFileIqJob(
  jobId: string,
  bundleId: string,
  ctx: WorkerContext,
): Promise<void> {
  const jobStartMs = Date.now();

  console.log(
    `${LOG} jobId=${jobId} | starting | route=${ctx.route ?? "agent_unstructured"} maxTurns=${ctx.maxTurns} cwd=${ctx.cwd ?? "none"}`,
  );

  // ── Deterministic fast path ────────────────────────────────────────────────
  if (ctx.route === "deterministic_structured") {
    const prepStartMs = Date.now();
    const deterministicPayload = await tryDeterministicCsvExtraction(ctx, jobId);
    const prepMs = Date.now() - prepStartMs;

    if (deterministicPayload !== null) {
      const catalogSummary = detectProductCatalogSummary(deterministicPayload);
      const totalProductsFound = catalogSummary?.totalProductsFound ?? 0;

      const insertStartMs = Date.now();
      try {
        await insertFileIqRawExtraction({
          id: randomUUID(),
          extractionJobId: jobId,
          sourceFileId: null,
          artifactType: "deterministic_result",
          storageUri: "inline:payload",
          payload: deterministicPayload,
        });
      } catch (err) {
        console.error(
          `${LOG} jobId=${jobId} | raw extraction insert failed | error=${normalizeError(err)}`,
        );
      }
      const insertMs = Date.now() - insertStartMs;

      const totalMs = Date.now() - jobStartMs;
      console.log(
        `${LOG} jobId=${jobId} | done (deterministic) | totalProductsFound=${totalProductsFound} prepMs=${prepMs} insertMs=${insertMs} totalMs=${totalMs}`,
      );

      try {
        await updateFileIqExtractionJob(jobId, {
          status: "completed",
          agentSessionId: null,
          errorCode: null,
          errorMessage: null,
          summary: {
            totalProductsFound,
            agentStatus: "not_required",
            numTurns: 0,
            ...(catalogSummary !== null && {
              schemaType: catalogSummary.schemaType,
              schemaVersion: catalogSummary.schemaVersion,
            }),
            _timing: {
              prepMs,
              insertMs,
              totalMs,
              route: ctx.route,
            },
          },
        });
      } catch (err) {
        console.error(
          `${LOG} jobId=${jobId} | DB update failed (deterministic) | error=${normalizeError(err)}`,
        );
      }
      return;
    }

    // Low confidence — fall through to agent path
    console.log(
      `${LOG} jobId=${jobId} | deterministic CSV low confidence — falling back to agent`,
    );
  }

  // ── Agent path ────────────────────────────────────────────────────────────
  const agentStartMs = Date.now();
  console.log(
    `${LOG} jobId=${jobId} | starting agent | schemaType=product_catalog route=${ctx.route ?? "agent_unstructured"} maxTurns=${ctx.maxTurns}`,
  );

  let agentResult;
  try {
    agentResult = await runFileIqExtractionAgent({
      jobId,
      bundleId,
      prompt: ctx.agentPrompt,
      cwd: ctx.cwd ?? undefined,
      additionalDirectories:
        ctx.additionalDirectories.length > 0 ? ctx.additionalDirectories : undefined,
      maxTurns: ctx.maxTurns,
    });
  } catch (err) {
    const msg = normalizeError(err);
    const totalMs = Date.now() - jobStartMs;
    console.error(
      `${LOG} jobId=${jobId} | agent threw | error=${msg} totalMs=${totalMs}`,
    );
    await updateFileIqExtractionJob(jobId, {
      status: "failed",
      agentSessionId: null,
      errorCode: "agent_exception",
      errorMessage: msg,
      summary: { _timing: { agentDurationMs: Date.now() - agentStartMs, totalMs } },
    }).catch((dbErr: unknown) => {
      console.error(
        `${LOG} jobId=${jobId} | DB update failed after agent throw | error=${normalizeError(dbErr)}`,
      );
    });
    return;
  }

  const agentDurationMs = Date.now() - agentStartMs;
  console.log(
    `${LOG} jobId=${jobId} | agent returned | status=${agentResult.status} numTurns=${agentResult.numTurns} totalCostUsd=${agentResult.totalCostUsd ?? "n/a"} durationMs=${agentDurationMs}`,
  );

  // ── Parse result ──────────────────────────────────────────────────────────
  const parseStartMs = Date.now();
  let extractedPayload: Record<string, unknown> = {};
  let catalogSummary: ReturnType<typeof detectProductCatalogSummary> = null;
  let parseMode = "none";

  if (agentResult.status === "completed" && agentResult.resultText) {
    const parsed = extractJsonFromAgentResult(agentResult.resultText);
    parseMode = parsed.parseMode;
    extractedPayload = parsed.payload;

    if (parsed.parseMode !== "raw") {
      // Attach parse diagnostics as _meta when a fallback strategy was used
      if (parsed.parseMode !== "json") {
        extractedPayload = {
          ...extractedPayload,
          _meta: {
            parseMode: parsed.parseMode,
            parseDiagnostics: parsed.parseDiagnostics,
            rawResultTextPreview: parsed.rawResultTextPreview,
          },
        };
      }
      catalogSummary = detectProductCatalogSummary(extractedPayload);
    }
  }

  const parseDurationMs = Date.now() - parseStartMs;
  console.log(
    `${LOG} jobId=${jobId} | parsed result | parseMode=${parseMode} durationMs=${parseDurationMs}`,
  );

  // ── Insert raw extraction ─────────────────────────────────────────────────
  const insertStartMs = Date.now();
  try {
    await insertFileIqRawExtraction({
      id: randomUUID(),
      extractionJobId: jobId,
      sourceFileId: null,
      artifactType: "agent_result",
      storageUri: "inline:payload",
      payload: {
        ...extractedPayload,
        _meta: {
          ...(typeof (extractedPayload._meta) === "object" && extractedPayload._meta !== null
            ? (extractedPayload._meta as Record<string, unknown>)
            : {}),
          agentSessionId: agentResult.agentSessionId,
          numTurns: agentResult.numTurns,
          totalCostUsd: agentResult.totalCostUsd,
          agentStatus: agentResult.status,
        },
      },
    });
  } catch (err) {
    console.error(
      `${LOG} jobId=${jobId} | raw extraction insert failed | error=${normalizeError(err)}`,
    );
  }
  const insertDurationMs = Date.now() - insertStartMs;
  console.log(
    `${LOG} jobId=${jobId} | inserted raw extraction | durationMs=${insertDurationMs}`,
  );

  // ── Update job ────────────────────────────────────────────────────────────
  const totalMs = Date.now() - jobStartMs;
  const dbStatus = agentResult.status === "completed" ? "completed" : "failed";
  const totalProductsFound =
    catalogSummary?.totalProductsFound ??
    (typeof extractedPayload.totalProductsFound === "number"
      ? extractedPayload.totalProductsFound
      : 0);

  console.log(
    `${LOG} jobId=${jobId} | done | status=${dbStatus} totalProductsFound=${totalProductsFound} totalMs=${totalMs}`,
  );

  try {
    await updateFileIqExtractionJob(jobId, {
      status: dbStatus,
      agentSessionId: agentResult.agentSessionId,
      errorCode: agentResult.errorCode,
      errorMessage: agentResult.errorMessage,
      summary: {
        totalProductsFound,
        agentStatus: agentResult.status,
        numTurns: agentResult.numTurns,
        ...(catalogSummary !== null && {
          schemaType: catalogSummary.schemaType,
          schemaVersion: catalogSummary.schemaVersion,
        }),
        _timing: {
          agentDurationMs,
          parseDurationMs,
          insertDurationMs,
          totalMs,
          route: ctx.route ?? "agent_unstructured",
        },
      },
    });
  } catch (err) {
    console.error(
      `${LOG} jobId=${jobId} | DB job update failed | status=${dbStatus} error=${normalizeError(err)}`,
    );
  }
}

async function runWorkerLoop(): Promise<void> {
  console.log(`${LOG} started | poll_interval_ms=${POLL_INTERVAL_MS}`);

  for (;;) {
    let job;
    try {
      job = await claimFileIqPendingJob();
    } catch (err) {
      console.error(`${LOG} poll error | error=${normalizeError(err)}`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    const claimedMs = Date.now();
    console.log(`${LOG} claimed jobId=${job.id} bundleId=${job.bundleId}`);

    const ctx = extractWorkerContext(job.summary);
    if (!ctx) {
      console.error(
        `${LOG} jobId=${job.id} | missing _worker context in summary — marking failed`,
      );
      await updateFileIqExtractionJob(job.id, {
        status: "failed",
        agentSessionId: null,
        errorCode: "missing_worker_context",
        errorMessage:
          "Job summary is missing _worker.agentPrompt — job was created before worker support was added.",
        summary: {},
      }).catch((err: unknown) => {
        console.error(
          `${LOG} jobId=${job.id} | DB update failed | error=${normalizeError(err)}`,
        );
      });
      continue;
    }

    const waitMs = Date.now() - claimedMs;
    console.log(
      `${LOG} claimed jobId=${job.id} bundleId=${job.bundleId} waitMs=${waitMs}`,
    );

    await processFileIqJob(job.id, job.bundleId, ctx);
  }
}

async function main(): Promise<void> {
  await runWorkerLoop();
}

main().catch((err: unknown) => {
  console.error(`${LOG} fatal | error=${normalizeError(err)}`);
  process.exit(1);
});
