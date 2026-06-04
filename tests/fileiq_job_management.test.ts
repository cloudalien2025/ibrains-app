import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getFileIqJobDeletionContextForUser: vi.fn(),
  deleteFileIqSourceBundleForUser: vi.fn(),
  getFileIqJobForUser: vi.fn(),
  getLatestFileIqArtifactForUser: vi.fn(),
  insertFileIqRawExtraction: vi.fn(),
  buildFileIqPdfReport: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/fileiq/fileiq-db", () => ({
  getFileIqJobDeletionContextForUser: mocks.getFileIqJobDeletionContextForUser,
  deleteFileIqSourceBundleForUser: mocks.deleteFileIqSourceBundleForUser,
  getFileIqJobForUser: mocks.getFileIqJobForUser,
  getLatestFileIqArtifactForUser: mocks.getLatestFileIqArtifactForUser,
  insertFileIqRawExtraction: mocks.insertFileIqRawExtraction,
}));

vi.mock("@/lib/fileiq/fileiq-report", () => ({
  buildFileIqPdfReport: mocks.buildFileIqPdfReport,
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
    mkdir: mocks.mkdir,
    stat: mocks.stat,
    unlink: mocks.unlink,
    rm: mocks.rm,
  },
}));

import { DELETE as deleteJob } from "@/app/api/fileiq/jobs/[jobId]/route";
import { GET as downloadJob } from "@/app/api/fileiq/jobs/[jobId]/download/route";

function signedIn(userId = "user_test") {
  mocks.requireSignedInUser.mockResolvedValue({ userId, unauthorizedResponse: null });
}

function signedOut() {
  mocks.requireSignedInUser.mockResolvedValue({
    userId: null,
    unauthorizedResponse: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.deleteFileIqSourceBundleForUser.mockResolvedValue(true);
  mocks.insertFileIqRawExtraction.mockResolvedValue(undefined);
  mocks.readFile.mockResolvedValue(Buffer.from("%PDF-1.4 existing", "utf8"));
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.unlink.mockResolvedValue(undefined);
  mocks.rm.mockResolvedValue(undefined);
  mocks.stat.mockResolvedValue({
    isDirectory: () => false,
  });
});

describe("DELETE /api/fileiq/jobs/[jobId]", () => {
  it("returns 401 when signed out", async () => {
    signedOut();
    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs/job_1", { method: "DELETE" });
    const res = await deleteJob(req, { params: { jobId: "job_1" } });
    expect(res.status).toBe(401);
  });

  it("blocks deletion for processing jobs", async () => {
    signedIn();
    mocks.getFileIqJobDeletionContextForUser.mockResolvedValue({
      job: {
        id: "job_1",
        bundleId: "bundle_1",
        bundleName: "Demo Bundle",
        status: "running",
        agentSessionId: null,
        summary: {},
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-06-04T12:00:00.000Z",
        completedAt: null,
      },
      cleanupStorageUris: [],
    });

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs/job_1", { method: "DELETE" });
    const res = await deleteJob(req, { params: { jobId: "job_1" } });
    const payload = (await res.json()) as { error: string };
    expect(res.status).toBe(409);
    expect(payload.error).toBe("job_processing");
    expect(mocks.deleteFileIqSourceBundleForUser).not.toHaveBeenCalled();
  });

  it("deletes completed jobs and their bundle", async () => {
    signedIn();
    mocks.getFileIqJobDeletionContextForUser.mockResolvedValue({
      job: {
        id: "job_1",
        bundleId: "bundle_1",
        bundleName: "Demo Bundle",
        status: "completed",
        agentSessionId: "sess_1",
        summary: {},
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-06-04T12:00:00.000Z",
        completedAt: "2026-06-04T12:03:00.000Z",
      },
      cleanupStorageUris: ["/tmp/fileiq-demo/result.pdf"],
    });

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs/job_1", { method: "DELETE" });
    const res = await deleteJob(req, { params: { jobId: "job_1" } });
    const payload = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.deleteFileIqSourceBundleForUser).toHaveBeenCalledWith("user_test", "bundle_1");
  });
});

describe("GET /api/fileiq/jobs/[jobId]/download", () => {
  it("returns 409 for non-completed jobs", async () => {
    signedIn();
    mocks.getFileIqJobForUser.mockResolvedValue({
      id: "job_1",
      bundleId: "bundle_1",
      bundleName: "Demo Bundle",
      status: "failed",
      agentSessionId: null,
      summary: {},
      errorCode: "failed",
      errorMessage: "Boom",
      createdAt: "2026-06-04T12:00:00.000Z",
      completedAt: null,
    });

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs/job_1/download");
    const res = await downloadJob(req, { params: { jobId: "job_1" } });
    expect(res.status).toBe(409);
  });

  it("streams an existing PDF artifact when available", async () => {
    signedIn();
    mocks.getFileIqJobForUser.mockResolvedValue({
      id: "job_1",
      bundleId: "bundle_1",
      bundleName: "Demo Bundle",
      status: "completed",
      agentSessionId: "sess_1",
      summary: { schemaType: "product_catalog" },
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-06-04T12:00:00.000Z",
      completedAt: "2026-06-04T12:03:00.000Z",
    });
    mocks.getLatestFileIqArtifactForUser.mockResolvedValueOnce({
      id: "artifact_pdf",
      extractionJobId: "job_1",
      artifactType: "pdf_report",
      storageUri: "/tmp/fileiq-artifacts/job_1/report.pdf",
      payload: { fileName: "report.pdf" },
      createdAt: "2026-06-04T12:05:00.000Z",
    });

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs/job_1/download");
    const res = await downloadJob(req, { params: { jobId: "job_1" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("report.pdf");
    expect(mocks.buildFileIqPdfReport).not.toHaveBeenCalled();
  });

  it("generates and stores a PDF report when no artifact exists yet", async () => {
    signedIn();
    mocks.getFileIqJobForUser.mockResolvedValue({
      id: "job_1",
      bundleId: "bundle_1",
      bundleName: "Bank Statements",
      status: "completed",
      agentSessionId: "sess_1",
      summary: { schemaType: "financial_statement" },
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-06-04T12:00:00.000Z",
      completedAt: "2026-06-04T12:03:00.000Z",
    });
    mocks.getLatestFileIqArtifactForUser
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "artifact_raw",
        extractionJobId: "job_1",
        artifactType: "agent_result",
        storageUri: "inline:payload",
        payload: {
          schemaType: "financial_statement",
          schemaVersion: "1.0",
          transactions: [{ id: "t1" }],
        },
        createdAt: "2026-06-04T12:03:00.000Z",
      });
    mocks.buildFileIqPdfReport.mockReturnValue({
      buffer: Buffer.from("%PDF-1.4 generated", "utf8"),
      fileName: "spending-report.pdf",
      title: "FileIQ Spending Summary Report",
      schemaType: "financial_statement",
      schemaVersion: "1.0",
    });

    const req = new NextRequest("https://app.ibrains.ai/api/fileiq/jobs/job_1/download");
    const res = await downloadJob(req, { params: { jobId: "job_1" } });
    expect(res.status).toBe(200);
    expect(mocks.buildFileIqPdfReport).toHaveBeenCalledTimes(1);
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.insertFileIqRawExtraction).toHaveBeenCalledTimes(1);
  });
});
