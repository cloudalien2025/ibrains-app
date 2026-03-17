export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { makeVersionLabel, normalizeSlot, verifyApprovalToken } from "@/app/api/directoryiq/_utils/authority";
import {
  addDirectoryIqVersion,
  getAuthorityPostBySlot,
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
      action: "publish",
      message: "request received",
    });

    const body = (await req.json().catch(() => ({}))) as { approve_publish?: boolean; approval_token?: string };
    if (!body.approve_publish) {
      throw new AuthorityRouteError(400, "APPROVAL_REQUIRED", "Publish requires explicit approval.");
    }
    const approvalToken = String(body.approval_token ?? "");
    const resolved = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: siteId?.trim() || null,
    });
    if (!resolved || !resolved.listingEval.listing || !resolved.listingEval.evaluation) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }

    const listing = resolved.listingEval;
    const listingRow = listing.listing;
    const listingEval = listing.evaluation;
    if (!listingRow) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }
    if (!listingEval) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }
    const listingSourceId = listingRow.source_id;

    const tokenResult = verifyApprovalToken(approvalToken, {
      userId,
      listingId: listingSourceId,
      slot: slotIndex,
      action: "blog_publish",
    });
    if (!tokenResult.ok) {
      throw new AuthorityRouteError(400, "TOKEN_INVALID", tokenResult.reason);
    }

    const post = await getAuthorityPostBySlot(userId, listingSourceId, slotIndex);
    if (!post || !post.draft_html || !post.title) {
      throw new AuthorityRouteError(400, "BAD_REQUEST", "Draft content is required before publish.");
    }
    const postMetadata = (post.metadata_json ?? {}) as Record<string, unknown>;
    const step2Contract = (postMetadata.step2_contract ?? null) as
      | {
          seo_package?: {
            primary_focus_keyword?: string;
            post_title?: string;
            seo_title?: string;
            meta_description?: string;
            slug?: string;
            featured_image_filename?: string;
            featured_image_alt_text?: string;
          };
        }
      | null;
    const seoPackage = step2Contract?.seo_package;
    const metadataReady = Boolean(
      seoPackage?.primary_focus_keyword &&
        seoPackage?.seo_title &&
        seoPackage?.meta_description &&
        seoPackage?.slug &&
        seoPackage?.featured_image_filename &&
        seoPackage?.featured_image_alt_text
    );

    if (post.blog_to_listing_link_status !== "linked") {
      throw new AuthorityRouteError(
        422,
        "DRAFT_VALIDATION_FAILED",
        "Draft is invalid: missing mandatory contextual blog-to-listing link.",
        "Generate a new draft that includes a contextual in-body link to the listing."
      );
    }

    const bd = await getDirectoryIqBdConnection(userId, resolved.siteId);
    if (!bd) {
      throw new AuthorityRouteError(
        400,
        "BD_NOT_CONFIGURED",
        "Brilliant Directories API not configured. Go to DirectoryIQ -> Signal Sources."
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
      seoPackage: {
        primaryFocusKeyword: seoPackage?.primary_focus_keyword,
        seoTitle: seoPackage?.seo_title,
        metaDescription: seoPackage?.meta_description,
        slug: seoPackage?.slug,
        featuredImageFilename: seoPackage?.featured_image_filename,
        featuredImageAltText: seoPackage?.featured_image_alt_text,
      },
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

    const listingRaw = listingRow.raw_json ?? {};
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
      (typeof listingRow.title === "string" && listingRow.title) ||
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
        JSON.stringify({ status: listingPush.status, detail: listingPush.body })
      );
    }

    await markPostPublished(userId, listingSourceId, slotIndex, {
      publishedPostId,
      publishedUrl,
      blogToListingStatus: "linked",
      listingToBlogStatus,
      metadata: {
        ...postMetadata,
        published_at: new Date().toISOString(),
        reciprocal_link_inserted: listingPush.ok,
        listing_true_post_id: mapping.truePostId,
        step2_publish_truth: {
          published: true,
          linked: true,
          metadata_ready: metadataReady,
          featured_image_attached: Boolean(post.featured_image_url),
          featured_image_fallback_recorded: !post.featured_image_url,
          step3_consumable: listingPush.ok && post.blog_to_listing_link_status === "linked",
        },
      },
    });

    const updated = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: resolved.siteId,
    });

    const versionId = await addDirectoryIqVersion(userId, {
      listingId: listingSourceId,
      authorityPostId: post.id,
      actionType: "blog_publish",
      versionLabel: makeVersionLabel("BLOG"),
      scoreSnapshot: {
        before: listingEval.totalScore,
        after: updated?.listingEval.evaluation?.totalScore ?? listingEval.totalScore,
        pillars_before: listingEval.scores,
        pillars_after: updated?.listingEval.evaluation?.scores ?? listingEval.scores,
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
      metadata_ready: metadataReady,
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
