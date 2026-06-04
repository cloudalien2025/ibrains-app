#!/usr/bin/env npx
// FileIQ background extraction worker.
//
// Polls fileiq_extraction_jobs for pending jobs, claims each as 'running',
// runs the Claude Agent SDK extraction session, then updates the job to
// 'completed' or 'failed' and writes the raw extraction payload.
//
// Usage (dev):
//   npx --yes tsx scripts/fileiq-worker.ts
//
// Usage (production systemd service):
//   See fileiq-worker.service in the repo root.
//
// The worker must be able to find the 'claude' CLI.  Ensure the PATH in the
// systemd unit includes the directory where claude is installed before
// running this script.

import { randomUUID } from "node:crypto";

// Dynamic imports let tsx load these without bundler complications.
const { claimFileIqPendingJob, updateFileIqExtractionJob, insertFileIqRawExtraction } =
  await import("@/lib/fileiq/fileiq-db");
const { runFileIqExtractionAgent } = await import("@/lib/fileiq/agent/fileiq-agent");

const LOG = "[fileiq:worker]";
const POLL_INTERVAL_MS = 5_000;

function normalizeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function processJob(
  jobId: string,
  bundleId: string,
  agentPrompt: string,
  cwd: string | null,
  additionalDirectories: string[],
  maxTurns: number,
): Promise<void> {
  console.log(`${LOG} jobId=${jobId} | starting agent | cwd=${cwd ?? "none"} maxTurns=${maxTurns}`);

  let agentResult;
  try {
    agentResult = await runFileIqExtractionAgent({
      jobId,
      bundleId,
      prompt: agentPrompt,
      cwd: cwd ?? undefined,
      additionalDirectories: additionalDirectories.length > 0 ? additionalDirectories : undefined,
      maxTurns,
    });
  } catch (err) {
    const msg = normalizeError(err);
    console.error(`${LOG} jobId=${jobId} | agent threw | error=${msg}`);
    await updateFileIqExtractionJob(jobId, {
      status: "failed",
      agentSessionId: null,
      errorCode: "agent_exception",
      errorMessage: msg,
      summary: {},
    }).catch((dbErr: unknown) => {
      console.error(`${LOG} jobId=${jobId} | DB update failed after agent throw | error=${normalizeError(dbErr)}`);
    });
    return;
  }

  console.log(`${LOG} jobId=${jobId} | agent returned | status=${agentResult.status} numTurns=${agentResult.numTurns}`);

  let extractedPayload: Record<string, unknown> = {};
  let totalProductsFound = 0;
  let detectedSchemaType: string | null = null;
  let detectedSchemaVersion: string | null = null;

  if (agentResult.status === "completed" && agentResult.resultText) {
    try {
      const parsed: unknown = JSON.parse(agentResult.resultText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        extractedPayload = parsed as Record<string, unknown>;
        const count = extractedPayload.totalProductsFound;
        if (typeof count === "number") totalProductsFound = count;

        if (
          extractedPayload.schemaType === "product_catalog" &&
          typeof extractedPayload.schemaVersion === "string" &&
          Array.isArray(extractedPayload.products)
        ) {
          detectedSchemaType = "product_catalog";
          detectedSchemaVersion = extractedPayload.schemaVersion as string;
        }
      }
    } catch {
      extractedPayload = { raw: agentResult.resultText };
    }
  }

  console.log(`${LOG} jobId=${jobId} | inserting raw extraction`);
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
          agentSessionId: agentResult.agentSessionId,
          numTurns: agentResult.numTurns,
          totalCostUsd: agentResult.totalCostUsd,
          agentStatus: agentResult.status,
        },
      },
    });
  } catch (err) {
    console.error(`${LOG} jobId=${jobId} | raw extraction insert failed | error=${normalizeError(err)}`);
  }

  const dbStatus = agentResult.status === "completed" ? "completed" : "failed";
  console.log(`${LOG} jobId=${jobId} | updating job | status=${dbStatus} totalProductsFound=${totalProductsFound}`);

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
        ...(detectedSchemaType !== null && {
          schemaType: detectedSchemaType,
          schemaVersion: detectedSchemaVersion,
        }),
      },
    });
  } catch (err) {
    console.error(`${LOG} jobId=${jobId} | DB job update failed | status=${dbStatus} error=${normalizeError(err)}`);
  }

  console.log(`${LOG} jobId=${jobId} | done | status=${dbStatus}`);
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

    console.log(`${LOG} claimed jobId=${job.id} bundleId=${job.bundleId}`);

    const workerCtx = job.summary["_worker"];
    if (
      !workerCtx ||
      typeof workerCtx !== "object" ||
      typeof (workerCtx as Record<string, unknown>)["agentPrompt"] !== "string"
    ) {
      console.error(`${LOG} jobId=${job.id} | missing _worker context in summary — marking failed`);
      await updateFileIqExtractionJob(job.id, {
        status: "failed",
        agentSessionId: null,
        errorCode: "missing_worker_context",
        errorMessage: "Job summary is missing _worker.agentPrompt — job was created before worker support was added.",
        summary: {},
      }).catch((err: unknown) => {
        console.error(`${LOG} jobId=${job.id} | DB update failed | error=${normalizeError(err)}`);
      });
      continue;
    }

    const ctx = workerCtx as Record<string, unknown>;
    const agentPrompt = ctx["agentPrompt"] as string;
    const cwd = typeof ctx["cwd"] === "string" ? ctx["cwd"] : null;
    const additionalDirectories = Array.isArray(ctx["additionalDirectories"])
      ? (ctx["additionalDirectories"] as string[])
      : [];
    const maxTurns = typeof ctx["maxTurns"] === "number" ? ctx["maxTurns"] : 12;

    await processJob(job.id, job.bundleId, agentPrompt, cwd, additionalDirectories, maxTurns);
  }
}

runWorkerLoop().catch((err: unknown) => {
  console.error(`${LOG} fatal | error=${normalizeError(err)}`);
  process.exit(1);
});
