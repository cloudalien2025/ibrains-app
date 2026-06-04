export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getFileIqJobForUser,
  getLatestFileIqArtifactForUser,
  insertFileIqRawExtraction,
} from "@/lib/fileiq/fileiq-db";
import { buildFileIqPdfReport } from "@/lib/fileiq/fileiq-report";

async function readStoredArtifact(storageUri: string): Promise<Buffer | null> {
  if (!storageUri || storageUri.startsWith("inline:")) return null;
  return fs.readFile(storageUri).catch(() => null);
}

function pdfResponse(buffer: Buffer, fileName: string): NextResponse {
  const body = new Uint8Array(buffer);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> | { jobId: string } },
): Promise<NextResponse> {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign-in required." },
      { status: 401 },
    );
  }

  const { jobId } = await Promise.resolve(params);
  const job = await getFileIqJobForUser(userId, jobId);
  if (!job) {
    return NextResponse.json(
      { error: "not_found", message: "FileIQ job not found." },
      { status: 404 },
    );
  }

  if (job.status !== "completed") {
    return NextResponse.json(
      {
        error: "download_unavailable",
        message: "Only completed jobs have downloadable reports.",
      },
      { status: 409 },
    );
  }

  const existingPdf = await getLatestFileIqArtifactForUser(userId, jobId, ["pdf_report"]);
  if (existingPdf) {
    const storedBuffer = await readStoredArtifact(existingPdf.storageUri);
    const storedFileName =
      typeof existingPdf.payload.fileName === "string" && existingPdf.payload.fileName.trim().length > 0
        ? existingPdf.payload.fileName.trim()
        : `${job.id}-report.pdf`;
    if (storedBuffer) {
      return pdfResponse(storedBuffer, storedFileName);
    }
  }

  const latestExtraction = await getLatestFileIqArtifactForUser(userId, jobId, [
    "agent_result",
    "deterministic_result",
  ]);
  if (!latestExtraction) {
    return NextResponse.json(
      {
        error: "missing_output",
        message: "This job completed without a stored extraction result, so a download is not available yet.",
      },
      { status: 409 },
    );
  }

  let report;
  try {
    report = buildFileIqPdfReport(job, latestExtraction);
  } catch (error) {
    return NextResponse.json(
      {
        error: "unsupported_report",
        message:
          error instanceof Error
            ? error.message
            : "This FileIQ job does not have a supported downloadable report yet.",
      },
      { status: 409 },
    );
  }

  const artifactDir = path.join(os.tmpdir(), "fileiq-artifacts", job.id);
  await fs.mkdir(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, report.fileName);
  await fs.writeFile(artifactPath, report.buffer);

  await insertFileIqRawExtraction({
    id: randomUUID(),
    extractionJobId: job.id,
    sourceFileId: null,
    artifactType: "pdf_report",
    storageUri: artifactPath,
    payload: {
      fileName: report.fileName,
      title: report.title,
      mimeType: "application/pdf",
      schemaType: report.schemaType,
      schemaVersion: report.schemaVersion,
      generatedAt: new Date().toISOString(),
    },
  });

  return pdfResponse(report.buffer, report.fileName);
}
