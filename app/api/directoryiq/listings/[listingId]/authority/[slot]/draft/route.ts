export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import { upsertAuthorityPostDraft } from "@/app/api/directoryiq/_utils/selectionData";
import { normalizePostType, normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import { shouldServeDirectoryIqLocally } from "@/app/api/directoryiq/_utils/runtimeParity";
import {
  AuthorityRouteError,
  authorityErrorResponse,
  authorityReqId,
  logAuthorityError,
  logAuthorityInfo,
} from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildGovernedPrompt, ensureContextualListingLink, validateDraftHtml } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityDraft, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";
import { ListingSiteRequiredError, resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";

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
  const forceStep2WriterLocal = req.nextUrl.searchParams.get("step2_writer") === "1";
  if (!forceStep2WriterLocal && !shouldServeDirectoryIqLocally(req)) {
    const { listingId, slot } = await Promise.resolve(params);
    return proxyDirectoryIqRequest(
      req,
      `/api/directoryiq/listings/${encodeURIComponent(decodeURIComponent(listingId))}/authority/${encodeURIComponent(
        decodeURIComponent(slot)
      )}/draft`,
      "POST"
    );
  }

  let resolvedListingId = "unknown";
  let slotIndex = 0;
  const reqId = authorityReqId();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId, slot } = await Promise.resolve(params);
    resolvedListingId = decodeURIComponent(listingId);
    slotIndex = normalizeSlot(slot);
    const siteId = req.nextUrl.searchParams.get("site_id");

    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "draft",
      message: "request received",
    });

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

    const postType = normalizePostType((body.type ?? "").trim());
    const focusTopic = (body.focus_topic ?? "").trim();
    const title = (body.title ?? "").trim();

    if (!focusTopic) throw new AuthorityRouteError(400, "BAD_REQUEST", "Focus topic is required.");

    const apiKey = validateOpenAiKeyPresent(await getDirectoryIqOpenAiKey(userId));

    const resolved = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: siteId?.trim() || null,
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

    logAuthorityInfo({
      reqId,
      listingId: listingSourceId,
      slot: slotIndex,
      action: "draft",
      message: "draft generated and persisted",
    });

    return NextResponse.json({
      ok: true,
      reqId,
      slot: slotIndex,
      status: "draft",
      draft_html: html,
      blog_to_listing_status: validation.hasContextualListingLink ? "linked" : "missing",
    });
  } catch (error) {
    if (error instanceof ListingSiteRequiredError) {
      return authorityErrorResponse({
        reqId,
        status: 409,
        message: "Multiple sites contain this listing. Provide site_id.",
        code: "BAD_REQUEST",
        details: JSON.stringify(
          error.candidates.map((candidate) => ({
            site_id: candidate.siteId,
            site_label: candidate.siteLabel,
          }))
        ),
      });
    }
    logAuthorityError({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex || undefined,
      action: "draft",
      error,
    });

    if (error instanceof AuthorityRouteError) {
      return authorityErrorResponse({
        reqId,
        status: error.status,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown draft generation error";
    return authorityErrorResponse({
      reqId,
      status: 500,
      message,
      code: "INTERNAL_ERROR",
    });
  }
}
