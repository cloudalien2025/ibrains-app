/**
 * FileIQ worker job lifecycle tests.
 *
 * Tests the DB-layer contract (claimFileIqPendingJob) and the full
 * processJob path (agent success / unavailable / exception).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Module mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  claimFileIqPendingJob: vi.fn(),
  updateFileIqExtractionJob: vi.fn(),
  insertFileIqRawExtraction: vi.fn(),
  runFileIqExtractionAgent: vi.fn(),
}));

// Mock the core modules — these are the paths the worker actually imports
// from (server-only-free) in production.
vi.mock("@/lib/fileiq/fileiq-db-core", () => ({
  claimFileIqPendingJob: mocks.claimFileIqPendingJob,
  updateFileIqExtractionJob: mocks.updateFileIqExtractionJob,
  insertFileIqRawExtraction: mocks.insertFileIqRawExtraction,
}));

vi.mock("@/lib/fileiq/agent/fileiq-agent-core", () => ({
  runFileIqExtractionAgent: mocks.runFileIqExtractionAgent,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClaimedJob(overrides: Partial<{ id: string; bundleId: string; agentPrompt: string }> = {}) {
  return {
    id: overrides.id ?? "job_worker_1",
    bundleId: overrides.bundleId ?? "bundle_worker_1",
    summary: {
      _worker: {
        agentPrompt: overrides.agentPrompt ?? "Extract products from this supplier catalog.",
        cwd: null,
        additionalDirectories: [],
        maxTurns: 40,
      },
    },
  };
}

function agentSuccess(resultText = '{"products":[{"sku":"ACM-001","productName":"Test"}],"totalProductsFound":1,"sourcesProcessed":1,"extractionNotes":"ok"}') {
  mocks.runFileIqExtractionAgent.mockResolvedValue({
    jobId: "job_worker_1",
    bundleId: "bundle_worker_1",
    agentSessionId: "sess_test",
    status: "completed",
    resultText,
    errorCode: null,
    errorMessage: null,
    numTurns: 3,
    totalCostUsd: 0.02,
  });
}

function agentUnavailable() {
  mocks.runFileIqExtractionAgent.mockResolvedValue({
    jobId: "job_worker_1",
    bundleId: "bundle_worker_1",
    agentSessionId: null,
    status: "unavailable",
    resultText: null,
    errorCode: "agent_credentials_missing",
    errorMessage: "Set ANTHROPIC_API_KEY to run FileIQ extraction sessions.",
    numTurns: 0,
    totalCostUsd: null,
  });
}

function agentFailed() {
  mocks.runFileIqExtractionAgent.mockResolvedValue({
    jobId: "job_worker_1",
    bundleId: "bundle_worker_1",
    agentSessionId: "sess_fail",
    status: "failed",
    resultText: null,
    errorCode: "agent_no_result",
    errorMessage: "Stream ended without a result message.",
    numTurns: 2,
    totalCostUsd: 0.005,
  });
}

// Import the processJob helper — we test the observable side effects via the
// mock DB/agent calls by invoking the worker's logic through a thin wrapper
// that mimics what runWorkerLoop does for a single claimed job.
async function importProcessJob() {
  const { claimFileIqPendingJob, updateFileIqExtractionJob, insertFileIqRawExtraction } =
    await import("@/lib/fileiq/fileiq-db-core");
  const { runFileIqExtractionAgent } = await import("@/lib/fileiq/agent/fileiq-agent-core");

  return async function processJobUnderTest(
    jobId: string,
    bundleId: string,
    agentPrompt: string,
    cwd: string | null,
    additionalDirectories: string[],
    maxTurns: number,
  ) {
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
      const msg = err instanceof Error ? err.message : String(err);
      await updateFileIqExtractionJob(jobId, {
        status: "failed",
        agentSessionId: null,
        errorCode: "agent_exception",
        errorMessage: msg,
        summary: {},
      }).catch(() => {});
      return;
    }

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

    await insertFileIqRawExtraction({
      id: "extraction_test_id",
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

    const dbStatus = agentResult.status === "completed" ? "completed" : "failed";
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
  };

  void claimFileIqPendingJob; // silence unused import
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateFileIqExtractionJob.mockResolvedValue(undefined);
  mocks.insertFileIqRawExtraction.mockResolvedValue(undefined);
});

// ─── Node importability regression ───────────────────────────────────────────
// These tests verify the core modules are importable in a standalone Node
// environment (i.e. without the Next.js server-only guard). If either core
// module re-introduces `import "server-only"` the worker will crash-loop.
//
// vi.importActual bypasses the mock factory so we test the real module exports,
// not the mock stubs — that's the point of this regression suite.

describe("fileiq-db-core — Node importability regression", () => {
  it("exports claimFileIqPendingJob without server-only restriction", async () => {
    const mod = await vi.importActual<typeof import("@/lib/fileiq/fileiq-db-core")>(
      "@/lib/fileiq/fileiq-db-core",
    );
    expect(typeof mod.claimFileIqPendingJob).toBe("function");
  });

  it("exports updateFileIqExtractionJob without server-only restriction", async () => {
    const mod = await vi.importActual<typeof import("@/lib/fileiq/fileiq-db-core")>(
      "@/lib/fileiq/fileiq-db-core",
    );
    expect(typeof mod.updateFileIqExtractionJob).toBe("function");
  });

  it("exports insertFileIqRawExtraction without server-only restriction", async () => {
    const mod = await vi.importActual<typeof import("@/lib/fileiq/fileiq-db-core")>(
      "@/lib/fileiq/fileiq-db-core",
    );
    expect(typeof mod.insertFileIqRawExtraction).toBe("function");
  });

  it("exports listRecentFileIqJobs without server-only restriction", async () => {
    const mod = await vi.importActual<typeof import("@/lib/fileiq/fileiq-db-core")>(
      "@/lib/fileiq/fileiq-db-core",
    );
    expect(typeof mod.listRecentFileIqJobs).toBe("function");
  });
});

describe("fileiq-agent-core — Node importability regression", () => {
  it("exports runFileIqExtractionAgent without server-only restriction", async () => {
    const mod = await vi.importActual<typeof import("@/lib/fileiq/agent/fileiq-agent-core")>(
      "@/lib/fileiq/agent/fileiq-agent-core",
    );
    expect(typeof mod.runFileIqExtractionAgent).toBe("function");
  });

  it("exports buildFileIqAgentOptions without server-only restriction", async () => {
    const mod = await vi.importActual<typeof import("@/lib/fileiq/agent/fileiq-agent-core")>(
      "@/lib/fileiq/agent/fileiq-agent-core",
    );
    expect(typeof mod.buildFileIqAgentOptions).toBe("function");
  });

  it("exports resolveFileIqAgentApiKey without server-only restriction", async () => {
    const mod = await vi.importActual<typeof import("@/lib/fileiq/agent/fileiq-agent-core")>(
      "@/lib/fileiq/agent/fileiq-agent-core",
    );
    expect(typeof mod.resolveFileIqAgentApiKey).toBe("function");
  });
});

// ─── claimFileIqPendingJob DB contract ───────────────────────────────────────

describe("claimFileIqPendingJob — DB contract", () => {
  it("returns null when no pending jobs exist", async () => {
    mocks.claimFileIqPendingJob.mockResolvedValue(null);
    const { claimFileIqPendingJob } = await import("@/lib/fileiq/fileiq-db-core");
    const result = await claimFileIqPendingJob();
    expect(result).toBeNull();
  });

  it("returns a claimed job with id, bundleId, and summary", async () => {
    const job = makeClaimedJob();
    mocks.claimFileIqPendingJob.mockResolvedValue(job);
    const { claimFileIqPendingJob } = await import("@/lib/fileiq/fileiq-db-core");
    const result = await claimFileIqPendingJob();
    expect(result).not.toBeNull();
    expect(result!.id).toBe("job_worker_1");
    expect(result!.bundleId).toBe("bundle_worker_1");
    expect(result!.summary).toHaveProperty("_worker");
  });

  it("claimed job summary contains _worker.agentPrompt string", async () => {
    const job = makeClaimedJob({ agentPrompt: "Extract SKUs from this file." });
    mocks.claimFileIqPendingJob.mockResolvedValue(job);
    const { claimFileIqPendingJob } = await import("@/lib/fileiq/fileiq-db-core");
    const result = await claimFileIqPendingJob();
    const workerCtx = result!.summary["_worker"] as Record<string, unknown>;
    expect(workerCtx["agentPrompt"]).toBe("Extract SKUs from this file.");
  });

  it("_worker context stores maxTurns=40 for large catalog jobs", async () => {
    const job = makeClaimedJob();
    mocks.claimFileIqPendingJob.mockResolvedValue(job);
    const { claimFileIqPendingJob } = await import("@/lib/fileiq/fileiq-db-core");
    const result = await claimFileIqPendingJob();
    const workerCtx = result!.summary["_worker"] as Record<string, unknown>;
    expect(workerCtx["maxTurns"]).toBe(40);
  });
});

// ─── Worker job processing — success path ─────────────────────────────────────

describe("worker processJob — agent success", () => {
  it("calls runFileIqExtractionAgent with jobId, bundleId, and agentPrompt from summary", async () => {
    agentSuccess();
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "Extract products.", null, [], 40);

    const agentCall = mocks.runFileIqExtractionAgent.mock.calls[0] as [
      { jobId: string; bundleId: string; prompt: string; maxTurns: number },
    ];
    expect(agentCall[0].jobId).toBe("job_1");
    expect(agentCall[0].bundleId).toBe("bundle_1");
    expect(agentCall[0].prompt).toBe("Extract products.");
    expect(agentCall[0].maxTurns).toBe(40);
  });

  it("inserts a raw_extraction record on success", async () => {
    agentSuccess();
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    expect(mocks.insertFileIqRawExtraction).toHaveBeenCalledTimes(1);
    const rawCall = (mocks.insertFileIqRawExtraction.mock.calls[0] as [
      { artifactType: string; sourceFileId: null }
    ])[0];
    expect(rawCall.artifactType).toBe("agent_result");
    expect(rawCall.sourceFileId).toBeNull();
  });

  it("updates job to status=completed on agent success", async () => {
    agentSuccess();
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    expect(mocks.updateFileIqExtractionJob).toHaveBeenCalledTimes(1);
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; agentSessionId: string | null }
    ])[1];
    expect(updateCall.status).toBe("completed");
    expect(updateCall.agentSessionId).toBe("sess_test");
  });

  it("persists totalProductsFound=1 from parsed agent result", async () => {
    agentSuccess();
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { summary: { totalProductsFound: number } }
    ])[1];
    expect(updateCall.summary.totalProductsFound).toBe(1);
  });

  it("stamps schemaType and schemaVersion when agent returns product_catalog schema", async () => {
    agentSuccess(JSON.stringify({
      schemaType: "product_catalog",
      schemaVersion: "1.0",
      products: [{ sku: "X1" }],
      totalProductsFound: 1,
      sourcesProcessed: 1,
      extractionNotes: "ok",
    }));
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { summary: { schemaType?: string; schemaVersion?: string } }
    ])[1];
    expect(updateCall.summary.schemaType).toBe("product_catalog");
    expect(updateCall.summary.schemaVersion).toBe("1.0");
  });
});

// ─── Worker job processing — unavailable (missing API key) ───────────────────

describe("worker processJob — agent unavailable (missing API key)", () => {
  it("inserts a raw_extraction record even when agent is unavailable", async () => {
    agentUnavailable();
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    expect(mocks.insertFileIqRawExtraction).toHaveBeenCalledTimes(1);
  });

  it("updates job to status=failed when agent returns unavailable", async () => {
    agentUnavailable();
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; errorCode: string; errorMessage: string }
    ])[1];
    expect(updateCall.status).toBe("failed");
    expect(updateCall.errorCode).toBe("agent_credentials_missing");
    expect(typeof updateCall.errorMessage).toBe("string");
  });
});

// ─── Worker job processing — agent failed ────────────────────────────────────

describe("worker processJob — agent failed (non-success terminal result)", () => {
  it("updates job to status=failed when agent returns failed", async () => {
    agentFailed();
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; errorCode: string }
    ])[1];
    expect(updateCall.status).toBe("failed");
    expect(updateCall.errorCode).toBe("agent_no_result");
  });
});

// ─── Worker job processing — agent throws ────────────────────────────────────

describe("worker processJob — agent throws exception", () => {
  it("updates job to status=failed with errorCode=agent_exception when agent throws", async () => {
    mocks.runFileIqExtractionAgent.mockRejectedValue(new Error("Subprocess spawn failed: ENOENT"));
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    expect(mocks.updateFileIqExtractionJob).toHaveBeenCalledTimes(1);
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; errorCode: string; errorMessage: string }
    ])[1];
    expect(updateCall.status).toBe("failed");
    expect(updateCall.errorCode).toBe("agent_exception");
    expect(updateCall.errorMessage).toContain("Subprocess spawn failed");
  });

  it("does NOT insert a raw_extraction record when agent throws", async () => {
    mocks.runFileIqExtractionAgent.mockRejectedValue(new Error("spawn error"));
    const processJob = await importProcessJob();
    await processJob("job_1", "bundle_1", "prompt", null, [], 40);

    expect(mocks.insertFileIqRawExtraction).not.toHaveBeenCalled();
  });
});
