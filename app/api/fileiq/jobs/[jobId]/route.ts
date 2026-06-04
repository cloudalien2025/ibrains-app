export const runtime = "nodejs";

import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  deleteFileIqSourceBundleForUser,
  getFileIqJobDeletionContextForUser,
} from "@/lib/fileiq/fileiq-db";

function isFileIqManagedDirectory(targetPath: string): boolean {
  const base = path.basename(targetPath).toLowerCase();
  return base.startsWith("fileiq-") || targetPath.toLowerCase().includes("fileiq-artifacts");
}

async function removeFileIqArtifacts(storageUris: string[]): Promise<void> {
  const cleanupDirs = new Set<string>();

  for (const storageUri of storageUris) {
    if (!storageUri || storageUri.startsWith("inline:")) continue;

    const resolved = path.resolve(storageUri);
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat) continue;

    if (stat.isDirectory()) {
      if (isFileIqManagedDirectory(resolved)) {
        await fs.rm(resolved, { recursive: true, force: true }).catch(() => undefined);
      }
      continue;
    }

    await fs.unlink(resolved).catch(() => undefined);

    const parentDir = path.dirname(resolved);
    if (isFileIqManagedDirectory(parentDir)) {
      cleanupDirs.add(parentDir);
    }
  }

  for (const dir of [...cleanupDirs].sort((a, b) => b.length - a.length)) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function DELETE(
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
  const context = await getFileIqJobDeletionContextForUser(userId, jobId);
  if (!context) {
    return NextResponse.json(
      { error: "not_found", message: "FileIQ job not found." },
      { status: 404 },
    );
  }

  if (context.job.status === "pending" || context.job.status === "running") {
    return NextResponse.json(
      {
        error: "job_processing",
        message: "This job is still processing and cannot be deleted until extraction finishes.",
      },
      { status: 409 },
    );
  }

  await removeFileIqArtifacts(context.cleanupStorageUris);

  const deleted = await deleteFileIqSourceBundleForUser(userId, context.job.bundleId);
  if (!deleted) {
    return NextResponse.json(
      { error: "delete_failed", message: "FileIQ job could not be deleted." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    jobId: context.job.id,
    bundleId: context.job.bundleId,
  });
}
