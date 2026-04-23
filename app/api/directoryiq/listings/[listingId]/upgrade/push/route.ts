export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pushUpgrade } from "@/src/directoryiq/services/upgradeService";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import { recomputeIntegrityDelta } from "@/src/directoryiq/services/graphIntegrity/integrityRunner";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
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

  const body = (await req.json().catch(() => ({}))) as {
    draftId?: string;
    approved?: boolean;
    approvalToken?: string;
  };

  const draftId = (body.draftId ?? "").trim();
  if (!draftId) {
    return NextResponse.json(
      {
        error: {
          message: "draftId is required.",
          code: "BAD_REQUEST",
          reqId,
        },
      },
      { status: 400 }
    );
  }

  const job = await createDirectoryIqJob({
    reqId,
    userId,
    kind: "step3.push",
    listingId: resolvedListingId,
    siteId,
  });

  runDirectoryIqJob(job, {
    routeOrigin: "directoryiq.upgrade.step3.push",
    runtimeOwner: "directoryiq-api.ibrains.ai",
    startedStage: "validating",
    processor: async ({ setStage }) => {
      const resolved = await resolveListingEvaluation({
        userId,
        listingId: resolvedListingId,
        siteId,
      });
      const sourceId = resolved?.listingEval.listing?.source_id ?? resolvedListingId;

      await setStage("publishing");
      const result = await pushUpgrade(
        userId,
        sourceId,
        draftId,
        body.approved === true,
        String(body.approvalToken ?? "")
      );

      const user = resolveUserFromHeaders(req.headers);
      const gate = resolveGraphIntegrityGate({ tenantId: "default", userFeatures: user.features as string[] | undefined });
      if (gate.enabled) {
        await setStage("recomputing_integrity");
        await recomputeIntegrityDelta({ tenantId: "default", userId });
      }

      return {
        ok: true,
        reqId: result.reqId,
        draftId: result.draftId,
        bdResult: {
          reference: result.bdRef,
        },
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
