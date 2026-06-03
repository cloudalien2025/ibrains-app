import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Module mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  insertFileIqSourceBundle: vi.fn(),
  insertFileIqSourceFile: vi.fn(),
  insertFileIqExtractionJob: vi.fn(),
  updateFileIqExtractionJob: vi.fn(),
  insertFileIqRawExtraction: vi.fn(),
  listRecentFileIqJobs: vi.fn(),
  runFileIqExtractionAgent: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/fileiq/fileiq-db", () => ({
  insertFileIqSourceBundle: mocks.insertFileIqSourceBundle,
  insertFileIqSourceFile: mocks.insertFileIqSourceFile,
  insertFileIqExtractionJob: mocks.insertFileIqExtractionJob,
  updateFileIqExtractionJob: mocks.updateFileIqExtractionJob,
  insertFileIqRawExtraction: mocks.insertFileIqRawExtraction,
  listRecentFileIqJobs: mocks.listRecentFileIqJobs,
}));

vi.mock("@/lib/fileiq/agent/fileiq-agent", () => ({
  runFileIqExtractionAgent: mocks.runFileIqExtractionAgent,
}));

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
  },
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: mocks.query,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>, files: Array<{ name: string; content: string }> = []): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    fd.append(key, val);
  }
  for (const f of files) {
    fd.append("file", new File([f.content], f.name, { type: "application/octet-stream" }));
  }
  return fd;
}

function signedIn(userId = "user_test") {
  mocks.requireSignedInUser.mockResolvedValue({ userId, unauthorizedResponse: null });
}

function signedOut() {
  mocks.requireSignedInUser.mockResolvedValue({
    userId: null,
    unauthorizedResponse: new Response("Unauthorized", { status: 401 }),
  });
}

function agentSuccess(resultText = '{"products":[],"totalProductsFound":0,"sourcesProcessed":1,"extractionNotes":"test"}') {
  mocks.runFileIqExtractionAgent.mockResolvedValue({
    jobId: "job_1",
    bundleId: "bundle_1",
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
    jobId: "job_1",
    bundleId: "bundle_1",
    agentSessionId: null,
    status: "unavailable",
    resultText: null,
    errorCode: "agent_credentials_missing",
    errorMessage: "Set ANTHROPIC_API_KEY to run FileIQ extraction sessions.",
    numTurns: 0,
    totalCostUsd: null,
  });
}

// ─── Import routes after mocks are in place ───────────────────────────────────

import { POST as ingestPost } from "@/app/api/fileiq/ingest/route";
import { GET as jobsGet } from "@/app/api/fileiq/jobs/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.insertFileIqSourceBundle.mockResolvedValue(undefined);
  mocks.insertFileIqSourceFile.mockResolvedValue(undefined);
  mocks.insertFileIqExtractionJob.mockResolvedValue(undefined);
  mocks.updateFileIqExtractionJob.mockResolvedValue(undefined);
  mocks.insertFileIqRawExtraction.mockResolvedValue(undefined);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.writeFile.mockResolvedValue(undefined);
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("POST /api/fileiq/ingest — auth guard", () => {
  it("returns 401 when signed out", async () => {
    signedOut();
    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", {
      method: "POST",
      body: fd,
    });
    const res = await ingestPost(req);
    expect(res.status).toBe(401);
    expect(mocks.insertFileIqSourceBundle).not.toHaveBeenCalled();
  });
});

// ─── URL-only ingestion ───────────────────────────────────────────────────────

describe("POST /api/fileiq/ingest — URL path", () => {
  it("registers bundle + source files + job, runs agent, writes raw extraction, and returns job summary", async () => {
    signedIn();
    agentSuccess('{"products":[{"sku":"ABC-001","productName":"Test Product"}],"totalProductsFound":1,"sourcesProcessed":1,"extractionNotes":"found 1 product"}');

    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/catalog.pdf", "https://example.com/specs.xlsx"]),
      supplier_name: "Acme Supplier",
    });

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", {
      method: "POST",
      body: fd,
    });

    const res = await ingestPost(req);
    const data = (await res.json()) as {
      bundleId: string;
      jobId: string;
      status: string;
      totalProductsFound: number;
      urlCount: number;
      fileCount: number;
    };

    expect(res.status).toBe(200);
    expect(data.status).toBe("completed");
    expect(data.totalProductsFound).toBe(1);
    expect(data.urlCount).toBe(2);
    expect(data.fileCount).toBe(0);
    expect(typeof data.bundleId).toBe("string");
    expect(typeof data.jobId).toBe("string");
  });

  it("creates exactly one source_file record per URL", async () => {
    signedIn();
    agentSuccess();
    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/a.pdf", "https://example.com/b.pdf", "https://example.com/c.pdf"]),
    });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);
    expect(mocks.insertFileIqSourceFile).toHaveBeenCalledTimes(3);
    // Each call should use the URL as storage_uri
    const calls = mocks.insertFileIqSourceFile.mock.calls as Array<[{ storageUri: string; fileType: string }]>;
    expect(calls.every((c) => c[0].fileType === "url")).toBe(true);
  });

  it("creates one extraction job (status=running) before the agent runs", async () => {
    signedIn();
    let capturedJobStatus: string | undefined;
    mocks.insertFileIqExtractionJob.mockImplementation((row: { status: string }) => {
      capturedJobStatus = row.status;
      return Promise.resolve();
    });
    agentSuccess();

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/cat.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(capturedJobStatus).toBe("running");
    expect(mocks.insertFileIqExtractionJob).toHaveBeenCalledTimes(1);
  });

  it("writes a raw_extraction record and updates job to completed when agent succeeds", async () => {
    signedIn();
    agentSuccess();

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(mocks.insertFileIqRawExtraction).toHaveBeenCalledTimes(1);
    const rawCall = (mocks.insertFileIqRawExtraction.mock.calls[0] as [{ artifactType: string; sourceFileId: null }])[0];
    expect(rawCall.artifactType).toBe("agent_result");
    expect(rawCall.sourceFileId).toBeNull();

    expect(mocks.updateFileIqExtractionJob).toHaveBeenCalledTimes(1);
    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [string, { status: string }])[1];
    expect(updateCall.status).toBe("completed");
  });

  it("updates job to failed when agent is unavailable", async () => {
    signedIn();
    agentUnavailable();

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    const res = await ingestPost(req);
    const data = (await res.json()) as { status: string; errorCode: string };

    expect(res.status).toBe(200);
    expect(data.status).toBe("unavailable");
    expect(data.errorCode).toBe("agent_credentials_missing");

    const updateCall = (mocks.updateFileIqExtractionJob.mock.calls[0] as [string, { status: string }])[1];
    expect(updateCall.status).toBe("failed");
  });
});

// ─── File upload path ─────────────────────────────────────────────────────────

describe("POST /api/fileiq/ingest — file upload path", () => {
  it("writes uploaded files to /tmp and registers them with correct file type", async () => {
    signedIn();
    agentSuccess();

    const fd = makeFormData({}, [
      { name: "catalog.pdf", content: "%PDF-1.4 content" },
      { name: "inventory.xlsx", content: "XLSX content" },
    ]);

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    const res = await ingestPost(req);
    const data = (await res.json()) as { fileCount: number; status: string };

    expect(res.status).toBe(200);
    expect(data.fileCount).toBe(2);
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);

    const fileCalls = (mocks.insertFileIqSourceFile.mock.calls as Array<[{ fileType: string }]>);
    const types = fileCalls.map((c) => c[0].fileType);
    expect(types).toContain("pdf");
    expect(types).toContain("xlsx");
  });

  it("can mix files and URLs in the same ingest request", async () => {
    signedIn();
    agentSuccess();

    const fd = makeFormData(
      { urls: JSON.stringify(["https://example.com/spec.pdf"]) },
      [{ name: "labels.png", content: "PNG data" }],
    );

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    const res = await ingestPost(req);
    const data = (await res.json()) as { fileCount: number; urlCount: number };

    expect(res.status).toBe(200);
    expect(data.fileCount).toBe(1);
    expect(data.urlCount).toBe(1);
    expect(mocks.insertFileIqSourceFile).toHaveBeenCalledTimes(2);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("POST /api/fileiq/ingest — validation", () => {
  it("returns 400 when neither files nor URLs are provided", async () => {
    signedIn();
    const fd = makeFormData({});
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    const res = await ingestPost(req);
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toBe("nothing_to_ingest");
    expect(mocks.insertFileIqSourceBundle).not.toHaveBeenCalled();
  });

  it("returns 503 with migration_required when DB table is absent", async () => {
    signedIn();
    mocks.insertFileIqSourceBundle.mockRejectedValue(
      new Error('relation "fileiq_source_bundles" does not exist'),
    );

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    const res = await ingestPost(req);
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(503);
    expect(data.error).toBe("migration_required");
  });
});

// ─── Jobs listing ─────────────────────────────────────────────────────────────

describe("GET /api/fileiq/jobs", () => {
  it("returns 401 when signed out", async () => {
    signedOut();
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs");
    const res = await jobsGet(req);
    expect(res.status).toBe(401);
  });

  it("returns empty jobs array when table is not migrated yet", async () => {
    signedIn();
    mocks.listRecentFileIqJobs.mockRejectedValue(
      new Error('relation "fileiq_extraction_jobs" does not exist'),
    );
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs");
    const res = await jobsGet(req);
    const data = (await res.json()) as { jobs: unknown[] };
    expect(res.status).toBe(200);
    expect(data.jobs).toEqual([]);
  });

  it("returns jobs from DB with default limit of 20", async () => {
    signedIn();
    const mockJobs = [
      {
        id: "job_1",
        bundleId: "bundle_1",
        bundleName: "Acme – 2026-06-04",
        status: "completed",
        agentSessionId: "sess_abc",
        summary: { totalProductsFound: 5 },
        errorCode: null,
        createdAt: "2026-06-04T10:00:00Z",
        completedAt: "2026-06-04T10:02:00Z",
      },
    ];
    mocks.listRecentFileIqJobs.mockResolvedValue(mockJobs);
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs");
    const res = await jobsGet(req);
    const data = (await res.json()) as { jobs: typeof mockJobs };
    expect(res.status).toBe(200);
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].bundleName).toBe("Acme – 2026-06-04");
    expect(mocks.listRecentFileIqJobs).toHaveBeenCalledWith(20);
  });

  it("caps limit at 100", async () => {
    signedIn();
    mocks.listRecentFileIqJobs.mockResolvedValue([]);
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs?limit=999");
    await jobsGet(req);
    expect(mocks.listRecentFileIqJobs).toHaveBeenCalledWith(100);
  });
});

// ─── DB helpers contract ─────────────────────────────────────────────────────

describe("fileiq-db helper call contract", () => {
  it("ingest route calls DB helpers in order: bundle → file(s) → job → raw_extraction → update", async () => {
    signedIn();
    agentSuccess();

    const callOrder: string[] = [];
    mocks.insertFileIqSourceBundle.mockImplementation(() => { callOrder.push("bundle"); return Promise.resolve(); });
    mocks.insertFileIqSourceFile.mockImplementation(() => { callOrder.push("file"); return Promise.resolve(); });
    mocks.insertFileIqExtractionJob.mockImplementation(() => { callOrder.push("job"); return Promise.resolve(); });
    mocks.insertFileIqRawExtraction.mockImplementation(() => { callOrder.push("raw"); return Promise.resolve(); });
    mocks.updateFileIqExtractionJob.mockImplementation(() => { callOrder.push("update"); return Promise.resolve(); });

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(callOrder[0]).toBe("bundle");
    expect(callOrder[1]).toBe("file");
    expect(callOrder.indexOf("job")).toBeGreaterThan(callOrder.indexOf("file"));
    expect(callOrder.indexOf("raw")).toBeGreaterThan(callOrder.indexOf("job"));
    expect(callOrder[callOrder.length - 1]).toBe("update");
  });

  it("bundle record includes correct supplier_id derived from supplier_name", async () => {
    signedIn();
    agentSuccess();

    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/catalog.pdf"]),
      supplier_name: "Acme Nutrition Co.",
    });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    const bundleCall = (mocks.insertFileIqSourceBundle.mock.calls[0] as [{ supplierId: string }])[0];
    expect(bundleCall.supplierId).toBe("acme-nutrition-co");
  });
});

// ─── Nav + schema state ────────────────────────────────────────────────────────

describe("Phase 1.2 nav and schema state", () => {
  it("fileiq-nav marks exactly 3 items as ready (Command Center, Source Bundles, Extraction Jobs)", async () => {
    const { fileIqNavItems } = await import("@/lib/fileiq/fileiq-nav");
    const ready = fileIqNavItems.filter((i) => i.ready);
    expect(ready).toHaveLength(3);
    expect(ready.map((i) => i.label)).toEqual([
      "Command Center",
      "Source Bundles",
      "Extraction Jobs",
    ]);
  });

  it("schema migration state is extraction_jobs", async () => {
    const { fileIqDatabaseBoundary } = await import("@/lib/fileiq/fileiq-schema");
    expect(fileIqDatabaseBoundary.migrationState).toBe("extraction_jobs");
  });
});

// ─── Proxy route protection ───────────────────────────────────────────────────

describe("proxy.ts — /api/fileiq auth protection", () => {
  it("isProtectedRoute matcher source covers /api/fileiq(.*)", () => {
    // Verify the protection pattern is present in the proxy source — a
    // structural assertion that does not require running the full Clerk middleware.
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const proxySource = readFileSync(
      new URL("../proxy.ts", import.meta.url).pathname,
      "utf8",
    );
    expect(proxySource).toContain('"/api/fileiq(.*)"');
  });
});
