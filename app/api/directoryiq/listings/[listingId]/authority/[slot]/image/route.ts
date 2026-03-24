export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import {
  getAuthorityPostBySlot,
  markAuthorityImageFailure,
  markAuthorityReviewReady,
  patchAuthorityStep2State,
  readPersistedStep2State,
  saveAuthorityImage,
} from "@/app/api/directoryiq/_utils/selectionData";
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

      let imageUrl = "";
      try {
        imageUrl = await generateAuthorityImage({ apiKey, prompt });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate featured image.";
        const code = error instanceof AuthorityRouteError ? error.code : "IMAGE_GENERATION_FAILED";
        await markAuthorityImageFailure(userId, listingSourceId, slotIndex, { code, message });
        throw error;
      }

      await setStage("persisting");
      const existing = await getAuthorityPostBySlot(userId, listingSourceId, slotIndex);
      const previousStep2 = readPersistedStep2State(existing?.metadata_json);
      const nextImageVersion = previousStep2.image_version + 1;
      const invalidateApproval = previousStep2.review_status === "approved";
      await saveAuthorityImage(userId, listingSourceId, slotIndex, {
        imagePrompt: prompt,
        imageUrl,
      });
      await patchAuthorityStep2State(userId, listingSourceId, slotIndex, {
        image_status: "ready",
        image_version: nextImageVersion,
        image_generated_at: new Date().toISOString(),
        image_last_error_code: null,
        image_last_error_message: null,
        review_status: previousStep2.draft_status === "ready" ? "ready" : "not_ready",
        approved_at: invalidateApproval ? null : previousStep2.approved_at,
        approved_snapshot_draft_version: invalidateApproval ? null : previousStep2.approved_snapshot_draft_version,
        approved_snapshot_image_version: invalidateApproval ? null : previousStep2.approved_snapshot_image_version,
        publish_status: "not_started",
        publish_last_error_code: null,
        publish_last_error_message: null,
        publish_last_req_id: null,
        publish_attempted_at: null,
        publish_completed_at: null,
        published_post_id: null,
        published_url: null,
        listing_to_blog_link_status: "not_started",
      });
      await markAuthorityReviewReady(userId, listingSourceId, slotIndex);

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
