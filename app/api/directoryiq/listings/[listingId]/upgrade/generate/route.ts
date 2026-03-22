export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateUpgrade } from "@/src/directoryiq/services/upgradeService";
import { resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { createDirectoryIqJob, runDirectoryIqJob } from "@/app/api/directoryiq/_utils/jobs";
import { requireDirectoryIqWriteUser } from "@/app/api/directoryiq/_utils/writeAuth";
import { authorityReqId } from "@/app/api/directoryiq/_utils/authorityErrors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const userId = await requireDirectoryIqWriteUser(req);
  const reqId = authorityReqId();
  const { listingId } = await Promise.resolve(params);
  const resolvedListingId = decodeURIComponent(listingId);
  const siteId = req.nextUrl.searchParams.get("site_id")?.trim() || null;

  const job = await createDirectoryIqJob({
    reqId,
    userId,
    kind: "step3.generate",
    listingId: resolvedListingId,
    siteId,
  });

  runDirectoryIqJob(job, {
    routeOrigin: "directoryiq.upgrade.step3.generate",
    runtimeOwner: "directoryiq-api.ibrains.ai",
    startedStage: "generating",
    processor: async () => {
      const resolved = await resolveListingEvaluation({
        userId,
        listingId: resolvedListingId,
        siteId,
      });
      const sourceId = resolved?.listingEval.listing?.source_id ?? resolvedListingId;

      const result = await generateUpgrade({
        userId,
        listingId: sourceId,
        mode: "default",
      });

      return {
        draftId: result.draft.id,
        proposedDescription: result.draft.proposedText,
        reqId: result.reqId,
      };
    },
  });

  return NextResponse.json(
    {
      jobId: job.id,
      reqId: job.reqId,
      acceptedAt: job.acceptedAt,
      status: job.status,
      statusEndpoint: `/api/directoryiq/jobs/${encodeURIComponent(job.id)}`,
    },
    { status: 202 }
  );
}
