export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDirectoryIqJobForUser } from "@/app/api/directoryiq/_utils/jobs";
import { requireDirectoryIqWriteUser } from "@/app/api/directoryiq/_utils/writeAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  const userId = await requireDirectoryIqWriteUser(req);
  const { jobId } = await Promise.resolve(params);
  const resolvedJobId = decodeURIComponent(jobId);

  const job = await getDirectoryIqJobForUser(resolvedJobId, userId);
  if (!job) {
    return NextResponse.json(
      {
        error: {
          message: "Job not found.",
          code: "NOT_FOUND",
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    reqId: job.reqId,
    acceptedAt: job.acceptedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    listingId: job.listingId,
    site_id: job.siteId,
    slot: job.slot,
    result: job.result,
    error: job.error,
  });
}
