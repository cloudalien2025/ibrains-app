export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getDirectoryIqBdConnection,
  pushListingUpdateToBd,
  resolveTruePostIdForListing,
} from "@/app/api/directoryiq/_utils/integrations";
import { addDirectoryIqVersion } from "@/app/api/directoryiq/_utils/selectionData";
import { makeVersionLabel, verifyApprovalToken } from "@/app/api/directoryiq/_utils/authority";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import { recomputeIntegrityDelta } from "@/src/directoryiq/services/graphIntegrity/integrityRunner";
import { ListingSiteRequiredError, resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(params);
    const resolvedListingId = decodeURIComponent(listingId);
    const siteId = req.nextUrl.searchParams.get("site_id");

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

    const resolved = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: siteId?.trim() || null,
    });
    if (!resolved || !resolved.listingEval.listing || !resolved.listingEval.evaluation) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const detail = resolved.listingEval;
    const listing = detail.listing;
    const evaluation = detail.evaluation;
    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    if (!evaluation) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    const listingSourceId = listing.source_id;

    const bd = await getDirectoryIqBdConnection(userId, resolved.siteId);
    if (!bd) {
      return NextResponse.json(
        { error: "Brilliant Directories API not configured. Go to DirectoryIQ -> Signal Sources." },
        { status: 400 }
      );
    }

    const listingRaw = listing.raw_json ?? {};
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
      (typeof listing.title === "string" && listing.title) ||
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
      listingId: listingSourceId,
      actionType: "listing_push",
      versionLabel: makeVersionLabel("LISTING"),
      scoreSnapshot: {
        before: evaluation.totalScore,
        after: Math.min(100, evaluation.totalScore + 6),
        pillars_before: evaluation.scores,
      },
      contentDelta: {
        description_after: proposedDescription,
        resolved_true_post_id: mapping.truePostId,
        mapping_key: mapping.mappingKey,
      },
      linkDelta: {},
    });

    const user = resolveUserFromHeaders(req.headers);
    const gate = resolveGraphIntegrityGate({ tenantId: "default", userFeatures: user.features as string[] | undefined });
    if (gate.enabled) {
      await recomputeIntegrityDelta({ tenantId: "default", userId });
    }

    return NextResponse.json({ ok: true, version_id: versionId, auto_push: false, requires_manual_approval: true });
  } catch (error) {
    if (error instanceof ListingSiteRequiredError) {
      return NextResponse.json(
        {
          error: "site_required",
          candidates: error.candidates.map((candidate) => ({
            site_id: candidate.siteId,
            site_label: candidate.siteLabel,
          })),
        },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown listing push error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
