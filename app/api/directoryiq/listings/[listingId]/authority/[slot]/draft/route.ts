export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import { upsertAuthorityPostDraft } from "@/app/api/directoryiq/_utils/selectionData";
import { normalizePostType, normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import { AuthorityRouteError, authorityReqId } from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildGovernedPrompt, ensureContextualListingLink, validateDraftHtml } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityDraft, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";
import { resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { createDirectoryIqJob, runDirectoryIqJob } from "@/app/api/directoryiq/_utils/jobs";
import { requireDirectoryIqWriteUser } from "@/app/api/directoryiq/_utils/writeAuth";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveCanonicalListingUrl(raw: Record<string, unknown>, fallback: unknown): string {
  return (
    asString(raw.url) ||
    asString(raw.listing_url) ||
    asString(raw.profile_url) ||
    asString(raw.link) ||
    asString(raw.permalink) ||
    asString(raw.source_url) ||
    asString(fallback)
  );
}

function resolveStep2ContractListingUrl(step2Contract: unknown): string {
  if (!step2Contract || typeof step2Contract !== "object" || Array.isArray(step2Contract)) return "";
  const missionPlanSlot = (step2Contract as { mission_plan_slot?: unknown }).mission_plan_slot;
  if (!missionPlanSlot || typeof missionPlanSlot !== "object" || Array.isArray(missionPlanSlot)) return "";
  return asString((missionPlanSlot as { listing_url?: unknown }).listing_url);
}

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

  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    focus_topic?: string;
    title?: string;
    step2_contract?: {
      mission_plan_slot?: Record<string, unknown>;
      support_brief?: Record<string, unknown>;
      seo_package?: Record<string, unknown>;
    };
  };

  const job = await createDirectoryIqJob({
    reqId,
    userId,
    kind: "step2.draft",
    listingId: resolvedListingId,
    siteId,
    slot: slotIndex,
  });

  runDirectoryIqJob(job, {
    routeOrigin: "directoryiq.authority.step2.draft",
    runtimeOwner: "directoryiq-api.ibrains.ai",
    startedStage: "generating",
    processor: async ({ setStage }) => {
      const postType = normalizePostType((body.type ?? "").trim());
      const focusTopic = (body.focus_topic ?? "").trim();
      const title = (body.title ?? "").trim();

      if (!focusTopic) {
        throw new AuthorityRouteError(400, "BAD_REQUEST", "Focus topic is required.");
      }

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

      const raw = (listing.raw_json ?? {}) as Record<string, unknown>;
      const listingSourceId = listing.source_id;
      const listingName = listing.title ?? listingSourceId;
      const listingUrl =
        resolveCanonicalListingUrl(raw, listing.url) || resolveStep2ContractListingUrl(body.step2_contract);

      if (!listingUrl) {
        throw new AuthorityRouteError(
          400,
          "BAD_REQUEST",
          "Listing URL is required to enforce contextual blog-to-listing links."
        );
      }
      const listingDescription =
        (typeof raw.description === "string" && raw.description) ||
        (typeof raw.content === "string" && raw.content) ||
        "";

      const prompt = buildGovernedPrompt({
        postType,
        listingTitle: listingName,
        listingUrl,
        listingDescription,
        focusTopic,
      });

      const generatedHtml = await generateAuthorityDraft({ apiKey, prompt });
      await setStage("validating");
      const html = ensureContextualListingLink({
        html: generatedHtml,
        listingUrl,
        listingTitle: listingName,
        focusTopic,
      });
      const validation = validateDraftHtml({ html, listingUrl });

      if (!validation.valid) {
        throw new AuthorityRouteError(
          422,
          "DRAFT_VALIDATION_FAILED",
          "Draft failed governance validation.",
          validation.errors.join(" ")
        );
      }

      await setStage("persisting");
      await upsertAuthorityPostDraft(userId, listingSourceId, slotIndex, {
        type: postType,
        title: title || `${listingName}: ${focusTopic}`,
        focusTopic,
        draftMarkdown: html,
        draftHtml: html,
        blogToListingStatus: validation.hasContextualListingLink ? "linked" : "missing",
        metadata: {
          quality_score: 72,
          generated_at: new Date().toISOString(),
          governance_passed: true,
          step2_contract: body.step2_contract ?? null,
        },
      });

      return {
        ok: true,
        reqId,
        slot: slotIndex,
        status: "draft",
        draft_html: html,
        blog_to_listing_status: validation.hasContextualListingLink ? "linked" : "missing",
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
