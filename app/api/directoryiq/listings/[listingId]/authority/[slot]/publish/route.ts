export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { makeVersionLabel, normalizeSlot, verifyApprovalToken } from "@/app/api/directoryiq/_utils/authority";
import {
  addDirectoryIqVersion,
  getAuthorityPostBySlot,
  getListingEvaluation,
  markPostPublished,
} from "@/app/api/directoryiq/_utils/selectionData";
import {
  getDirectoryIqBdConnection,
  publishBlogPostToBd,
  pushListingUpdateToBd,
  resolveTruePostIdForListing,
} from "@/app/api/directoryiq/_utils/integrations";
import {
  AuthorityRouteError,
  authorityErrorResponse,
  authorityReqId,
  logAuthorityError,
  logAuthorityInfo,
} from "@/app/api/directoryiq/_utils/authorityErrors";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
  let resolvedListingId = "unknown";
  let slotIndex = 0;
  const reqId = authorityReqId();
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId, slot } = await Promise.resolve(context.params);
    resolvedListingId = decodeURIComponent(listingId);
    slotIndex = normalizeSlot(slot);
    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "publish",
      message: "request received",
    });

    const body = (await req.json().catch(() => ({}))) as {
      approve_publish?: boolean;
      approved?: boolean;
      approval_token?: string;
    };
    const approved = body.approved === true || body.approve_publish === true;
    if (!approved) {
      throw new AuthorityRouteError(
        400,
        "APPROVAL_REQUIRED",
        "Publish requires explicit approval.",
        "Open preview first, review changes, then submit with approved=true."
      );
    }
    const approvalToken = String(body.approval_token ?? "");
    const tokenResult = verifyApprovalToken(approvalToken, {
      userId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "blog_publish",
    });
    if (!tokenResult.ok) {
      throw new AuthorityRouteError(400, "TOKEN_INVALID", tokenResult.reason);
    }

    const listing = await getListingEvaluation(userId, resolvedListingId);
    if (!listing.listing || !listing.evaluation) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }

    const post = await getAuthorityPostBySlot(userId, resolvedListingId, slotIndex);
    if (!post || !post.draft_html || !post.title) {
      throw new AuthorityRouteError(400, "BAD_REQUEST", "Draft content is required before publish.");
    }

    if (post.blog_to_listing_link_status !== "linked") {
      throw new AuthorityRouteError(
        422,
        "DRAFT_VALIDATION_FAILED",
        "Draft is invalid: missing mandatory contextual blog-to-listing link.",
        "Generate a new draft with an in-body listing URL link, then preview again before publish."
      );
    }

    const bd = await getDirectoryIqBdConnection(userId);
    if (!bd) {
      throw new AuthorityRouteError(
        400,
        "BD_NOT_CONFIGURED",
        "Brilliant Directories API not configured. Go to DirectoryIQ -> Settings -> Integrations."
      );
    }

    const publishResult = await publishBlogPostToBd({
      baseUrl: bd.baseUrl,
      apiKey: bd.apiKey,
      dataPostsCreatePath: bd.dataPostsCreatePath,
      blogDataId: bd.blogPostsDataId,
      title: post.title,
      html: post.draft_html,
      featuredImageUrl: post.featured_image_url,
    });

    if (!publishResult.ok) {
      throw new AuthorityRouteError(
        502,
        "BD_PUBLISH_FAILED",
        "BD publish failed.",
        JSON.stringify({
          status: publishResult.status,
          detail: publishResult.body,
        })
      );
    }

    const publishedPostId = String(
      publishResult.body?.post_id ??
        (publishResult.body?.data as Record<string, unknown> | undefined)?.post_id ??
        publishResult.body?.id ??
        ""
    );
    const publishedUrl = String(
      publishResult.body?.url ??
        publishResult.body?.link ??
        (publishResult.body?.data as Record<string, unknown> | undefined)?.url ??
        ""
    );

    const listingRaw = listing.listing.raw_json ?? {};
    const resolvedTruePostId =
      typeof listingRaw.true_post_id === "string" && listingRaw.true_post_id.trim()
        ? listingRaw.true_post_id.trim()
        : null;
    const listingSlug =
      (typeof listingRaw.listing_slug === "string" && listingRaw.listing_slug) ||
      (typeof listingRaw.group_filename === "string" && listingRaw.group_filename) ||
      "";
    const listingTitle =
      (typeof listingRaw.group_name === "string" && listingRaw.group_name) ||
      (typeof listing.listing.title === "string" && listing.listing.title) ||
      "";

    const mapping = resolvedTruePostId
      ? { truePostId: resolvedTruePostId, mappingKey: "slug" as const }
      : await resolveTruePostIdForListing({
          baseUrl: bd.baseUrl,
          apiKey: bd.apiKey,
          dataPostsSearchPath: bd.dataPostsSearchPath,
          listingsDataId: bd.listingsDataId,
          listingId: resolvedListingId,
          listingSlug,
          listingTitle,
        });

    const relatedGuidesHtml = `<h3>Related Guides</h3><ul><li><a href=\"${publishedUrl}\">${post.title}</a></li></ul>`;

    const listingPush = mapping.truePostId
      ? await pushListingUpdateToBd({
          baseUrl: bd.baseUrl,
          apiKey: bd.apiKey,
          dataPostsUpdatePath: bd.dataPostsUpdatePath,
          postId: mapping.truePostId,
          changes: {
            group_desc: relatedGuidesHtml,
          },
        })
      : { ok: false, status: 422, body: { error: "Unable to resolve listing true post id for reciprocal link write." } };

    const listingToBlogStatus = listingPush.ok ? "linked" : "missing";
    if (!listingPush.ok) {
      throw new AuthorityRouteError(
        422,
        "BD_LINK_ENFORCEMENT_FAILED",
        "Unable to enforce Listing→Blog reciprocal link. Publish aborted.",
        `Retry after verifying listing write permissions. Expected to inject Related Guides backlink. status=${listingPush.status}`
      );
    }

    await markPostPublished(userId, resolvedListingId, slotIndex, {
      publishedPostId,
      publishedUrl,
      blogToListingStatus: "linked",
      listingToBlogStatus,
      metadata: {
        published_at: new Date().toISOString(),
        reciprocal_link_inserted: listingPush.ok,
        listing_true_post_id: mapping.truePostId,
      },
    });

    const updated = await getListingEvaluation(userId, resolvedListingId);

    const versionId = await addDirectoryIqVersion(userId, {
      listingId: resolvedListingId,
      authorityPostId: post.id,
      actionType: "blog_publish",
      versionLabel: makeVersionLabel("BLOG"),
      scoreSnapshot: {
        before: listing.evaluation.totalScore,
        after: updated.evaluation?.totalScore ?? listing.evaluation.totalScore,
        pillars_before: listing.evaluation.scores,
        pillars_after: updated.evaluation?.scores ?? listing.evaluation.scores,
      },
      contentDelta: {
        blog_title: post.title,
        blog_url: publishedUrl,
      },
      linkDelta: {
        blog_to_listing: "linked",
        listing_to_blog: listingToBlogStatus,
      },
    });

    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "publish",
      message: "publish completed",
    });

    return NextResponse.json({
      ok: true,
      reqId,
      published_url: publishedUrl,
      listing_to_blog_status: listingToBlogStatus,
      version_id: versionId,
      requires_manual_approval: true,
      auto_publish: false,
    });
  } catch (error) {
    logAuthorityError({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex || undefined,
      action: "publish",
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
    const message = error instanceof Error ? error.message : "Unknown publish error";
    return authorityErrorResponse({
      reqId,
      status: 500,
      message,
      code: "INTERNAL_ERROR",
    });
  }
}
