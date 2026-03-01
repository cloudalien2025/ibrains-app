export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getDirectoryIqBdConnection,
  pushListingUpdateToBd,
  resolveTruePostIdForListing,
} from "@/app/api/directoryiq/_utils/integrations";
import { addDirectoryIqVersion, getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";
import { makeVersionLabel, verifyApprovalToken } from "@/app/api/directoryiq/_utils/authority";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(context.params);
    const resolvedListingId = decodeURIComponent(listingId);

    const body = (await req.json().catch(() => ({}))) as {
      approve_push?: boolean;
      proposed_description?: string;
      approval_token?: string;
    };

    if (!body.approve_push) {
      return NextResponse.json({ error: "Push requires explicit approval." }, { status: 400 });
    }

    const proposedDescription = (body.proposed_description ?? "").trim();
    if (!proposedDescription) {
      return NextResponse.json({ error: "proposed_description is required" }, { status: 400 });
    }
    const tokenResult = verifyApprovalToken(body.approval_token ?? "", {
      userId,
      listingId: resolvedListingId,
      action: "listing_push",
    });
    if (!tokenResult.ok) {
      return NextResponse.json({ error: tokenResult.reason }, { status: 400 });
    }

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing || !detail.evaluation) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const bd = await getDirectoryIqBdConnection(userId);
    if (!bd) {
      return NextResponse.json(
        { error: "Brilliant Directories API not configured. Go to DirectoryIQ -> Settings -> Integrations." },
        { status: 400 }
      );
    }

    const listingRaw = detail.listing.raw_json ?? {};
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
      (typeof detail.listing.title === "string" && detail.listing.title) ||
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

    if (!mapping.truePostId) {
      return NextResponse.json(
        { error: "Unable to resolve true BD post_id for listing update. Run refresh analysis to rebuild ID mapping." },
        { status: 422 }
      );
    }

    const push = await pushListingUpdateToBd({
      baseUrl: bd.baseUrl,
      apiKey: bd.apiKey,
      dataPostsUpdatePath: bd.dataPostsUpdatePath,
      postId: mapping.truePostId,
      changes: {
        short_description: proposedDescription,
        group_desc: proposedDescription,
      },
    });

    if (!push.ok) {
      return NextResponse.json(
        { error: "Listing push failed.", status: push.status, detail: push.body },
        { status: 502 }
      );
    }

    const versionId = await addDirectoryIqVersion(userId, {
      listingId: resolvedListingId,
      actionType: "listing_push",
      versionLabel: makeVersionLabel("LISTING"),
      scoreSnapshot: {
        before: detail.evaluation.totalScore,
        after: Math.min(100, detail.evaluation.totalScore + 6),
        pillars_before: detail.evaluation.scores,
      },
      contentDelta: {
        description_after: proposedDescription,
        resolved_true_post_id: mapping.truePostId,
        mapping_key: mapping.mappingKey,
      },
      linkDelta: {},
    });

    return NextResponse.json({ ok: true, version_id: versionId, auto_push: false, requires_manual_approval: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown listing push error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
