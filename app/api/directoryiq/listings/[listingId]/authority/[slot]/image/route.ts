export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import { saveAuthorityImage } from "@/app/api/directoryiq/_utils/selectionData";
import { normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import { AuthorityRouteError, authorityReqId } from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildImagePrompt } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityImage, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";
import { resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { createDirectoryIqJob, runDirectoryIqJob } from "@/app/api/directoryiq/_utils/jobs";
import { requireDirectoryIqWriteUser } from "@/app/api/directoryiq/_utils/writeAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
  const reqId = authorityReqId();
  const { listingId, slot } = await Promise.resolve(params);
  const resolvedListingId = decodeURIComponent(listingId);
  let slotIndex: number;
  try {
    slotIndex = normalizeSlot(slot);
  } catch (error) {
    if (error instanceof AuthorityRouteError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: error.code,
            reqId,
            details: error.details,
          },
        },
        { status: error.status }
      );
    }
    throw error;
  }
  const userId = await requireDirectoryIqWriteUser(req);
  const siteId = req.nextUrl.searchParams.get("site_id")?.trim() || null;

  const body = (await req.json().catch(() => ({}))) as { focus_topic?: string };
  const focusTopic = (body.focus_topic ?? "").trim();
  if (!focusTopic) {
    return NextResponse.json(
      {
        error: {
          message: "Focus topic is required.",
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
    kind: "step2.image",
    listingId: resolvedListingId,
    siteId,
    slot: slotIndex,
  });

  runDirectoryIqJob(job, {
    routeOrigin: "directoryiq.authority.step2.image",
    runtimeOwner: "directoryiq-api.ibrains.ai",
    startedStage: "generating",
    processor: async ({ setStage }) => {
      const apiKey = validateOpenAiKeyPresent(await getDirectoryIqOpenAiKey(userId));
      const resolved = await resolveListingEvaluation({
        userId,
        listingId: resolvedListingId,
        siteId,
      });

      if (!resolved || !resolved.listingEval.listing) {
        throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
      }

      const detail = resolved.listingEval;
      const listing = detail.listing;
      if (!listing) {
        throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
      }

      const listingSourceId = listing.source_id;
      const prompt = buildImagePrompt({
        focusTopic,
        imageStylePreference: detail.settings.imageStylePreference,
      });

      const imageUrl = await generateAuthorityImage({ apiKey, prompt });

      await setStage("persisting");
      await saveAuthorityImage(userId, listingSourceId, slotIndex, {
        imagePrompt: prompt,
        imageUrl,
      });

      return {
        ok: true,
        reqId,
        featured_image_url: imageUrl,
        prompt,
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
