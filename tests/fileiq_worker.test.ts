/**
 * FileIQ worker job lifecycle tests.
 *
 * Tests the DB-layer contract (claimFileIqPendingJob) and the full
 * processFileIqJob path (agent success / fenced JSON / raw fallback /
 * unavailable / exception). Uses the result-parser helpers as real pure
 * functions (no mock needed); only DB/agent calls are mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Module mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  claimFileIqPendingJob: vi.fn(),
  updateFileIqExtractionJob: vi.fn(),
  insertFileIqRawExtraction: vi.fn(),
  runFileIqExtractionAgent: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@/lib/fileiq/fileiq-db-core", () => ({
  claimFileIqPendingJob: mocks.claimFileIqPendingJob,
  updateFileIqExtractionJob: mocks.updateFileIqExtractionJob,
  insertFileIqRawExtraction: mocks.insertFileIqRawExtraction,
}));

vi.mock("@/lib/fileiq/agent/fileiq-agent-core", () => ({
  runFileIqExtractionAgent: mocks.runFileIqExtractionAgent,
}));

vi.mock("node:fs/promises", () => ({
  default: { readFile: mocks.readFile },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkerContext(
  overrides: Partial<{
    agentPrompt: string;
    route: string;
    maxTurns: number;
    filePaths: Array<{ path: string; type: string }>;
  }> = {},
) {
  return {
    agentPrompt: overrides.agentPrompt ?? "Extract products from this supplier catalog.",
    cwd: null,
    additionalDirectories: [],
    maxTurns: overrides.maxTurns ?? 40,
    route: overrides.route ?? "agent_unstructured",
    routeRationale: "test",
    filePaths: overrides.filePaths ?? [],
    urls: [],
  };
}

function makeClaimedJob(
  overrides: Partial<{ id: string; bundleId: string; agentPrompt: string }> = {},
) {
  return {
    id: overrides.id ?? "job_worker_1",
    bundleId: overrides.bundleId ?? "bundle_worker_1",
    summary: {
      _worker: {
        agentPrompt: overrides.agentPrompt ?? "Extract products from this supplier catalog.",
        cwd: null,
        additionalDirectories: [],
        maxTurns: 40,
        route: "agent_unstructured",
      },
    },
  };
}

function agentSuccess(
  resultText = '{"products":[{"sku":"ACM-001","productName":"Test"}],"totalProductsFound":1,"sourcesProcessed":1,"extractionNotes":"ok"}',
) {
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

// Import the processFileIqJob function under test after mocks are in place.
import { processFileIqJob } from "@/scripts/fileiq-worker";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateFileIqExtractionJob.mockResolvedValue(undefined);
  mocks.insertFileIqRawExtraction.mockResolvedValue(undefined);
  mocks.readFile.mockResolvedValue("");
});

// ─── Node importability regression ───────────────────────────────────────────

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

  it("_worker context stores numeric maxTurns", async () => {
    const job = makeClaimedJob();
    mocks.claimFileIqPendingJob.mockResolvedValue(job);
    const { claimFileIqPendingJob } = await import("@/lib/fileiq/fileiq-db-core");
    const result = await claimFileIqPendingJob();
    const workerCtx = result!.summary["_worker"] as Record<string, unknown>;
    expect(typeof workerCtx["maxTurns"]).toBe("number");
  });
});

// ─── Worker processFileIqJob — success path ───────────────────────────────────

describe("processFileIqJob — agent success (pure JSON result)", () => {
  it("calls runFileIqExtractionAgent with jobId, bundleId, prompt, maxTurns", async () => {
    agentSuccess();
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext({ agentPrompt: "Extract products.", maxTurns: 40 }));

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
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    expect(mocks.insertFileIqRawExtraction).toHaveBeenCalledTimes(1);
    const rawCall = (mocks.insertFileIqRawExtraction.mock.calls[0] as [
      { artifactType: string; sourceFileId: null }
    ])[0];
    expect(rawCall.artifactType).toBe("agent_result");
    expect(rawCall.sourceFileId).toBeNull();
  });

  it("updates job to status=completed on agent success", async () => {
    agentSuccess();
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
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
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { summary: { totalProductsFound: number } }
    ])[1];
    expect(updateCall.summary.totalProductsFound).toBe(1);
  });

  it("stamps schemaType and schemaVersion for product_catalog result", async () => {
    agentSuccess(JSON.stringify({
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      products: [{ sku: "X1" }],
      totalProductsFound: 1,
      sourcesProcessed: 1,
      extractionNotes: "ok",
    }));
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { summary: { schemaType?: string; schemaVersion?: string } }
    ])[1];
    expect(updateCall.summary.schemaType).toBe("product_catalog");
    expect(updateCall.summary.schemaVersion).toBe("1.1");
  });

  it("job summary includes _timing object with totalMs", async () => {
    agentSuccess();
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { summary: { _timing?: Record<string, unknown> } }
    ])[1];
    expect(updateCall.summary._timing).toBeDefined();
    expect(typeof updateCall.summary._timing!.totalMs).toBe("number");
  });
});

// ─── Fenced JSON result (Task A key scenario) ─────────────────────────────────

describe("processFileIqJob — fenced JSON result parsing", () => {
  it("extracts payload from ```json fence when agent wraps output in markdown", async () => {
    const fencedResult = [
      "I've read the full inventory report. Here is the FileIQ product_catalog v1.1 extraction:",
      "",
      "```json",
      JSON.stringify({
        schemaType: "product_catalog",
        schemaVersion: "1.1",
        products: Array.from({ length: 154 }, (_, i) => ({ sku: `ROC${i}` })),
        totalProductsFound: 154,
        sourcesProcessed: 1,
        extractionNotes: "ok",
      }),
      "```",
    ].join("\n");

    mocks.runFileIqExtractionAgent.mockResolvedValue({
      jobId: "job_1",
      bundleId: "bundle_1",
      agentSessionId: "sess_fenced",
      status: "completed",
      resultText: fencedResult,
      errorCode: null,
      errorMessage: null,
      numTurns: 2,
      totalCostUsd: 0.05,
    });

    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());

    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; summary: { totalProductsFound: number; schemaType?: string; schemaVersion?: string } }
    ])[1];
    expect(updateCall.status).toBe("completed");
    expect(updateCall.summary.totalProductsFound).toBe(154);
    expect(updateCall.summary.schemaType).toBe("product_catalog");
    expect(updateCall.summary.schemaVersion).toBe("1.1");
  });

  it("stores fenced JSON payload directly (not as { raw: ... })", async () => {
    const fencedResult = '```json\n{"schemaType":"product_catalog","schemaVersion":"1.1","products":[{"sku":"X1"}],"totalProductsFound":1}\n```';
    mocks.runFileIqExtractionAgent.mockResolvedValue({
      jobId: "job_1",
      bundleId: "bundle_1",
      agentSessionId: null,
      status: "completed",
      resultText: fencedResult,
      errorCode: null,
      errorMessage: null,
      numTurns: 1,
      totalCostUsd: 0.01,
    });

    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());

    const rawCall = (mocks.insertFileIqRawExtraction.mock.calls[0] as [
      { payload: Record<string, unknown> }
    ])[0];
    expect(rawCall.payload).not.toHaveProperty("raw");
    expect(rawCall.payload.schemaType).toBe("product_catalog");
  });
});

// ─── Raw fallback ─────────────────────────────────────────────────────────────

describe("processFileIqJob — raw text fallback", () => {
  it("stores raw text under payload.raw when result is unparseable prose", async () => {
    mocks.runFileIqExtractionAgent.mockResolvedValue({
      jobId: "job_1",
      bundleId: "bundle_1",
      agentSessionId: null,
      status: "completed",
      resultText: "I could not find any structured data in this file.",
      errorCode: null,
      errorMessage: null,
      numTurns: 2,
      totalCostUsd: 0.01,
    });

    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());

    const rawCall = (mocks.insertFileIqRawExtraction.mock.calls[0] as [
      { payload: Record<string, unknown> }
    ])[0];
    expect(rawCall.payload).toHaveProperty("raw");
    expect(typeof rawCall.payload.raw).toBe("string");
  });
});

// ─── Agent unavailable (missing API key) ─────────────────────────────────────

describe("processFileIqJob — agent unavailable", () => {
  it("inserts a raw_extraction record even when agent is unavailable", async () => {
    agentUnavailable();
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    expect(mocks.insertFileIqRawExtraction).toHaveBeenCalledTimes(1);
  });

  it("updates job to status=failed when agent returns unavailable", async () => {
    agentUnavailable();
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; errorCode: string; errorMessage: string }
    ])[1];
    expect(updateCall.status).toBe("failed");
    expect(updateCall.errorCode).toBe("agent_credentials_missing");
    expect(typeof updateCall.errorMessage).toBe("string");
  });
});

// ─── Agent failed ─────────────────────────────────────────────────────────────

describe("processFileIqJob — agent failed", () => {
  it("updates job to status=failed when agent returns failed", async () => {
    agentFailed();
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; errorCode: string }
    ])[1];
    expect(updateCall.status).toBe("failed");
    expect(updateCall.errorCode).toBe("agent_no_result");
  });
});

// ─── Agent throws ─────────────────────────────────────────────────────────────

describe("processFileIqJob — agent throws exception", () => {
  it("updates job to status=failed with errorCode=agent_exception", async () => {
    mocks.runFileIqExtractionAgent.mockRejectedValue(
      new Error("Subprocess spawn failed: ENOENT"),
    );
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
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
    await processFileIqJob("job_1", "bundle_1", makeWorkerContext());
    expect(mocks.insertFileIqRawExtraction).not.toHaveBeenCalled();
  });
});

// ─── Deterministic CSV fast path ──────────────────────────────────────────────

describe("processFileIqJob — deterministic CSV fast path", () => {
  it("skips agent when route=deterministic_structured and CSV parses with high confidence", async () => {
    const csvContent = [
      "SKU,Product Name,Status,Access Level,MSRP,Comments/ETA",
      "ROC001,Omega-3,IN STOCK,All Memberships,$29.99,",
      "ROC002,Vitamin C,LOW STOCK,Scale Plan Only,$19.99,Back in stock Q3",
    ].join("\n");
    mocks.readFile.mockResolvedValue(csvContent);

    await processFileIqJob(
      "job_csv",
      "bundle_csv",
      makeWorkerContext({
        route: "deterministic_structured",
        maxTurns: 0,
        filePaths: [{ path: "/tmp/inventory.csv", type: "csv" }],
      }),
    );

    expect(mocks.runFileIqExtractionAgent).not.toHaveBeenCalled();
    expect(mocks.insertFileIqRawExtraction).toHaveBeenCalledTimes(1);
    expect(mocks.updateFileIqExtractionJob).toHaveBeenCalledTimes(1);

    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [
      string,
      { status: string; summary: { totalProductsFound: number } }
    ])[1];
    expect(updateCall.status).toBe("completed");
    expect(updateCall.summary.totalProductsFound).toBe(2);
  });

  it("falls back to agent when deterministic CSV parse returns low confidence", async () => {
    // Empty CSV → low confidence
    mocks.readFile.mockResolvedValue("");
    agentSuccess();

    await processFileIqJob(
      "job_csv_fallback",
      "bundle_csv_fallback",
      makeWorkerContext({
        route: "deterministic_structured",
        maxTurns: 8,
        filePaths: [{ path: "/tmp/empty.csv", type: "csv" }],
      }),
    );

    // Agent should have been called as fallback
    expect(mocks.runFileIqExtractionAgent).toHaveBeenCalledTimes(1);
  });
});
