export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { issueApprovalToken, normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import { getAuthorityPostBySlot, getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";
import {
  AuthorityRouteError,
  authorityErrorResponse,
  authorityReqId,
  logAuthorityError,
  logAuthorityInfo,
} from "@/app/api/directoryiq/_utils/authorityErrors";

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
      action: "preview",
      message: "request received",
    });

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing || !detail.evaluation) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }

    const post = await getAuthorityPostBySlot(userId, resolvedListingId, slotIndex);
    if (!post || !post.draft_html) {
      throw new AuthorityRouteError(400, "BAD_REQUEST", "Draft not found for this slot.");
    }

    const beforeScore = detail.evaluation.totalScore;
    const optimisticAfter = Math.min(
      100,
      beforeScore +
        (post.blog_to_listing_link_status === "linked" ? 3 : 0) +
        (post.listing_to_blog_link_status === "linked" ? 3 : 0) +
        (post.status === "published" ? 2 : 4)
    );

    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "preview",
      message: "preview generated",
    });

    return NextResponse.json({
      preview: {
        listing_changes: [
          {
            section: "Related Guides",
            before: post.listing_to_blog_link_status === "linked" ? "Existing related guide link present." : "No related guide link to this authority post.",
            after: "Related guide link will be present after approval.",
          },
        ],
        blog_changes: [
          {
            section: "Authority Draft",
            before: "Not Published",
            after: post.draft_html,
          },
        ],
        featured_image_preview: post.featured_image_url,
        inserted_links: {
          blog_to_listing: {
            status: post.blog_to_listing_link_status,
            anchor_text: "Contextual listing reference",
            location: "In-body paragraph",
          },
          listing_to_blog: {
            status: post.listing_to_blog_link_status,
            placement: "Related Guides section",
          },
        },
        score_delta: {
          before: beforeScore,
          after: optimisticAfter,
          cap_changes: detail.evaluation.caps,
        },
      },
      approval_token: issueApprovalToken({
        userId,
        listingId: resolvedListingId,
        slot: slotIndex,
        action: "blog_publish",
      }),
      guardrails: {
        never_auto_publish: true,
        requires_manual_approval: true,
      },
      reqId,
    });
  } catch (error) {
    logAuthorityError({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex || undefined,
      action: "preview",
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
    const message = error instanceof Error ? error.message : "Unknown preview error";
    return authorityErrorResponse({
      reqId,
      status: 500,
      message,
      code: "INTERNAL_ERROR",
    });
  }
}
