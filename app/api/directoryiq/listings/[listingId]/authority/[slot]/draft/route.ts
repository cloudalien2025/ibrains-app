export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import { upsertAuthorityPostDraft } from "@/app/api/directoryiq/_utils/selectionData";
import { normalizePostType, normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import {
  AuthorityRouteError,
  authorityErrorResponse,
  authorityReqId,
  logAuthorityError,
  logAuthorityInfo,
} from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildGovernedPrompt, validateDraftHtml } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityDraft, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";
import { ListingSiteRequiredError, resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
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
    const listingSourceId = listing.source_id;
    const listingName = listing.title ?? listingSourceId;
    const listingUrl = listing.url ?? "";

    if (!listingUrl) {
      throw new AuthorityRouteError(
        400,
        "BAD_REQUEST",
        "Listing URL is required to enforce contextual blog-to-listing links."
      );
    }

    const raw = (listing.raw_json ?? {}) as Record<string, unknown>;
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

    const html = await generateAuthorityDraft({ apiKey, prompt });
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
