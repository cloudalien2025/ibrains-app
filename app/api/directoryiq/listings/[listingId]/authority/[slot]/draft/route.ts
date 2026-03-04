export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import { getListingEvaluation, upsertAuthorityPostDraft } from "@/app/api/directoryiq/_utils/selectionData";
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

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }

    const listingName = detail.listing.title ?? detail.listing.source_id;
    const listingUrl = detail.listing.url ?? "";

    if (!listingUrl) {
      throw new AuthorityRouteError(
        400,
        "BAD_REQUEST",
        "Listing URL is required to enforce contextual blog-to-listing links."
      );
    }

    const raw = (detail.listing.raw_json ?? {}) as Record<string, unknown>;
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

    await upsertAuthorityPostDraft(userId, resolvedListingId, slotIndex, {
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
      listingId: resolvedListingId,
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
