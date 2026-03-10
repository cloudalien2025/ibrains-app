export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { ListingSiteRequiredError, resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { getListingAuthorityGaps } from "@/src/directoryiq/services/listingGapsService";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const reqId = crypto.randomUUID();
  const userId = resolveUserId(req);

  try {
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(params);
    const resolvedListingId = decodeURIComponent(listingId);
    const siteId = req.nextUrl.searchParams.get("site_id");

    const resolved = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: siteId?.trim() || null,
    });

    if (!resolved?.listingEval.listing) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Listing not found.",
            code: "NOT_FOUND",
            reqId,
          },
        },
        { status: 404 }
      );
    }

    const listingRow = resolved.listingEval.listing;
    const listingRaw = (listingRow.raw_json ?? {}) as Record<string, unknown>;
    const listingExternalId =
      asString(listingRaw.listing_id) ||
      (resolvedListingId.includes(":") ? resolvedListingId.split(":").pop() ?? resolvedListingId : resolvedListingId);

    const gaps = await getListingAuthorityGaps({
      tenantId: "default",
      listingId: listingExternalId,
      listingTitle: listingRow.title ?? null,
      listingUrl: listingRow.url ?? null,
      siteId: resolved.siteId,
      listingRaw,
      authorityPosts: resolved.listingEval.authorityPosts.map((post) => ({
        post_type: post.post_type,
        status: post.status,
        title: post.title,
        focus_topic: post.focus_topic,
      })),
    });

    return NextResponse.json({
      ok: true,
      gaps,
      meta: {
        source: "first_party_authority_gaps_v1",
        evaluatedAt: gaps.summary.evaluatedAt,
        dataStatus: gaps.summary.dataStatus,
      },
    });
  } catch (error) {
    if (error instanceof ListingSiteRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Multiple sites contain this listing. Provide site_id.",
            code: "SITE_REQUIRED",
            reqId,
            candidates: error.candidates.map((candidate) => ({
              site_id: candidate.siteId,
              site_label: candidate.siteLabel,
            })),
          },
        },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to evaluate authority gaps.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          code: "GAPS_EVALUATION_FAILED",
          reqId,
        },
      },
      { status: 500 }
    );
  }
}
