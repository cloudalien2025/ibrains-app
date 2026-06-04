import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

// ─── Module mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  insertFileIqSourceBundle: vi.fn(),
  insertFileIqSourceFile: vi.fn(),
  insertFileIqExtractionJob: vi.fn(),
  updateFileIqExtractionJob: vi.fn(),
  insertFileIqRawExtraction: vi.fn(),
  listRecentFileIqJobs: vi.fn(),
  claimFileIqPendingJob: vi.fn(),
  runFileIqExtractionAgent: vi.fn(),
  fetchUrl: vi.fn(),
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
  claimFileIqPendingJob: mocks.claimFileIqPendingJob,
}));

vi.mock("@/lib/fileiq/agent/fileiq-agent", () => ({
  runFileIqExtractionAgent: mocks.runFileIqExtractionAgent,
}));

vi.mock("@/lib/fileiq/sources/url-source", () => ({
  fetchUrl: mocks.fetchUrl,
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
  mocks.fetchUrl.mockImplementation(async (url: string) => ({
    markdown: `${"# Catalog\n\n"}${"Readable supplier catalog content. ".repeat(40)}`,
    title: "Catalog",
    sourceUrl: url,
    scrapedAt: "2026-06-04T00:00:00.000Z",
    method: "sdk",
  }));
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

// ─── Ingest returns pending immediately ──────────────────────────────────────
// The ingest route is now fire-and-return: it registers the job as pending and
// returns immediately.  The agent runs in the separate fileiq-worker process.

describe("POST /api/fileiq/ingest — job registration and pending response", () => {
  it("returns { jobId, bundleId, status: 'pending' } immediately for a URL-only request", async () => {
    signedIn();
    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/catalog.pdf"]),
      supplier_name: "Acme Supplier",
    });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", {
      method: "POST",
      body: fd,
    });

    const res = await ingestPost(req);
    const data = (await res.json()) as { bundleId: string; jobId: string; status: string };

    expect(res.status).toBe(200);
    expect(data.status).toBe("pending");
    expect(typeof data.bundleId).toBe("string");
    expect(typeof data.jobId).toBe("string");
  });

  it("inserts job with status='pending' (not 'running')", async () => {
    signedIn();
    let capturedStatus: string | undefined;
    mocks.insertFileIqExtractionJob.mockImplementation((row: { status: string }) => {
      capturedStatus = row.status;
      return Promise.resolve();
    });

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/cat.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(capturedStatus).toBe("pending");
    expect(mocks.insertFileIqExtractionJob).toHaveBeenCalledTimes(1);
  });

  it("stores _worker.agentPrompt in job summary so the worker can reconstruct the agent session", async () => {
    signedIn();
    let capturedSummary: Record<string, unknown> | undefined;
    mocks.insertFileIqExtractionJob.mockImplementation(
      (row: { summary: Record<string, unknown> }) => {
        capturedSummary = row.summary;
        return Promise.resolve();
      },
    );

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(capturedSummary).toBeDefined();
    const worker = capturedSummary!["_worker"] as Record<string, unknown>;
    expect(typeof worker["agentPrompt"]).toBe("string");
    expect((worker["agentPrompt"] as string).length).toBeGreaterThan(20);
    expect(typeof worker["maxTurns"]).toBe("number");
  });

  it("does NOT call runFileIqExtractionAgent (that is the worker's responsibility)", async () => {
    signedIn();
    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(mocks.runFileIqExtractionAgent).not.toHaveBeenCalled();
    expect(mocks.updateFileIqExtractionJob).not.toHaveBeenCalled();
    expect(mocks.insertFileIqRawExtraction).not.toHaveBeenCalled();
  });

  it("creates exactly one markdown source_file record per URL after fetching URL content", async () => {
    signedIn();
    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/a.pdf", "https://example.com/b.pdf", "https://example.com/c.pdf"]),
    });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);
    expect(mocks.insertFileIqSourceFile).toHaveBeenCalledTimes(3);
    const calls = mocks.insertFileIqSourceFile.mock.calls as Array<[{ storageUri: string; fileType: string }]>;
    expect(calls.every((c) => c[0].fileType === "markdown")).toBe(true);
    expect(calls.every((c) => c[0].storageUri.endsWith(".md"))).toBe(true);
    expect(mocks.fetchUrl).toHaveBeenCalledTimes(3);
  });

  it("URL job triggers url-source path before job creation", async () => {
    signedIn();
    const callOrder: string[] = [];
    mocks.fetchUrl.mockImplementation(async (url: string) => {
      callOrder.push("fetchUrl");
      return {
        markdown: "Readable supplier catalog content. ".repeat(40),
        title: "Catalog",
        sourceUrl: url,
        scrapedAt: "2026-06-04T00:00:00.000Z",
        method: "sdk",
      };
    });
    mocks.insertFileIqExtractionJob.mockImplementation(() => {
      callOrder.push("job");
      return Promise.resolve();
    });

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(mocks.fetchUrl).toHaveBeenCalledWith("https://example.com/catalog");
    expect(callOrder).toEqual(["fetchUrl", "job"]);
  });

  it("stores fetchMethod and sourceRef on the job summary for URL sources", async () => {
    signedIn();
    let capturedSummary: Record<string, unknown> | undefined;
    mocks.insertFileIqExtractionJob.mockImplementation(
      (row: { summary: Record<string, unknown> }) => {
        capturedSummary = row.summary;
        return Promise.resolve();
      },
    );

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(capturedSummary?.fetchMethod).toBe("sdk");
    expect(capturedSummary?.sourceRef).toBe(
      "https://example.com/catalog scrapedAt=2026-06-04T00:00:00.000Z fetchMethod=sdk",
    );
  });
});

// ─── File upload path ─────────────────────────────────────────────────────────

describe("POST /api/fileiq/ingest — file upload path", () => {
  it("writes uploaded files to /tmp and registers them with correct file type", async () => {
    signedIn();

    const fd = makeFormData({}, [
      { name: "catalog.pdf", content: "%PDF-1.4 content" },
      { name: "inventory.xlsx", content: "XLSX content" },
    ]);

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    const res = await ingestPost(req);
    const data = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(data.status).toBe("pending");
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);

    const fileCalls = mocks.insertFileIqSourceFile.mock.calls as Array<[{ fileType: string }]>;
    const types = fileCalls.map((c) => c[0].fileType);
    expect(types).toContain("pdf");
    expect(types).toContain("xlsx");
  });

  it("can mix files and URLs in the same ingest request", async () => {
    signedIn();

    const fd = makeFormData(
      { urls: JSON.stringify(["https://example.com/spec.pdf"]) },
      [{ name: "labels.png", content: "PNG data" }],
    );

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    const res = await ingestPost(req);
    const data = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(data.status).toBe("pending");
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

// ─── DB helpers call contract ─────────────────────────────────────────────────

describe("fileiq-db helper call contract", () => {
  it("ingest route calls DB helpers in order: bundle → file(s) → job", async () => {
    signedIn();

    const callOrder: string[] = [];
    mocks.insertFileIqSourceBundle.mockImplementation(() => { callOrder.push("bundle"); return Promise.resolve(); });
    mocks.insertFileIqSourceFile.mockImplementation(() => { callOrder.push("file"); return Promise.resolve(); });
    mocks.insertFileIqExtractionJob.mockImplementation(() => { callOrder.push("job"); return Promise.resolve(); });

    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    expect(callOrder[0]).toBe("bundle");
    expect(callOrder[1]).toBe("file");
    expect(callOrder.indexOf("job")).toBeGreaterThan(callOrder.indexOf("file"));
  });

  it("bundle record includes correct supplier_id derived from supplier_name", async () => {
    signedIn();

    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/catalog.pdf"]),
      supplier_name: "Acme Nutrition Co.",
    });
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    const bundleCall = (mocks.insertFileIqSourceBundle.mock.calls[0] as [{ supplierId: string }])[0];
    expect(bundleCall.supplierId).toBe("acme-nutrition-co");
  });

  it("detects Rocktomic supplier from CSV filename and ROC SKU prefix when supplier name is absent", async () => {
    signedIn();

    const fd = makeFormData(
      {},
      [{ name: "rocktomic-inventory.csv", content: "SKU,Product Name\nROC001,Omega-3" }],
    );
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);

    const bundleCall = (mocks.insertFileIqSourceBundle.mock.calls[0] as [
      { supplierId: string; name: string }
    ])[0];
    const jobCall = (mocks.insertFileIqExtractionJob.mock.calls[0] as [
      { summary: Record<string, unknown> }
    ])[0];
    expect(bundleCall.supplierId).toBe("rocktomic-labs-llc");
    expect(bundleCall.name).toContain("Rocktomic Labs LLC");
    expect(jobCall.summary.supplierName).toBe("Rocktomic Labs LLC");
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

// ─── Prompt schema version contract ──────────────────────────────────────────

describe("POST /api/fileiq/ingest — product catalog prompt schema version", () => {
  async function captureAgentPrompt(fd: FormData): Promise<string> {
    let capturedSummary: Record<string, unknown> | undefined;
    mocks.insertFileIqExtractionJob.mockImplementation(
      (row: { summary: Record<string, unknown> }) => {
        capturedSummary = row.summary;
        return Promise.resolve();
      },
    );
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/ingest", { method: "POST", body: fd });
    await ingestPost(req);
    return (capturedSummary!["_worker"] as Record<string, unknown>)["agentPrompt"] as string;
  }

  it("agentPrompt instructs agent to output schemaVersion 1.1 for catalog intent", async () => {
    signedIn();
    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/catalog.pdf"]),
      intent: "Return a valid FileIQ product_catalog v1.1 JSON envelope",
    });
    const agentPrompt = await captureAgentPrompt(fd);
    expect(agentPrompt).toContain('"schemaVersion": "1.1"');
  });

  it("agentPrompt does not reference schema v1.0 or schemaVersion 1.0", async () => {
    signedIn();
    const fd = makeFormData({ urls: JSON.stringify(["https://example.com/catalog.pdf"]) });
    const agentPrompt = await captureAgentPrompt(fd);
    expect(agentPrompt).not.toContain("schema v1.0");
    expect(agentPrompt).not.toContain('"schemaVersion": "1.0"');
  });

  it("agentPrompt schema example includes coaExpiryDate (v1.1 assets field)", async () => {
    signedIn();
    const fd = makeFormData({
      urls: JSON.stringify(["https://example.com/catalog.pdf"]),
      intent: "extract product catalog",
    });
    const agentPrompt = await captureAgentPrompt(fd);
    expect(agentPrompt).toContain("coaExpiryDate");
  });
});

// ─── Proxy route protection ───────────────────────────────────────────────────

describe("proxy.ts — /api/fileiq auth protection", () => {
  it("isProtectedRoute matcher source covers /api/fileiq(.*)", () => {
    const proxySource = readFileSync(
      new URL("../proxy.ts", import.meta.url).pathname,
      "utf8",
    );
    expect(proxySource).toContain('"/api/fileiq(.*)"');
  });
});
