export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";

type ListingSupportSummary = {
  inboundLinkedSupportCount: number;
  mentionWithoutLinkCount: number;
  outboundSupportLinkCount: number;
  connectedSupportPageCount: number;
  lastGraphRunAt: string | null;
};

type ListingSupportModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: ListingSupportSummary;
};

type ListingSupportResponse = {
  ok: boolean;
  support?: ListingSupportModel;
  error?: {
    message?: string;
  } | string;
};

type AuthorityGapSeverity = "high" | "medium" | "low";
type AuthorityGapType =
  | "no_linked_support_posts"
  | "mentions_without_links"
  | "no_listing_to_support_links"
  | "weak_category_support";

type AuthorityGapItem = {
  type: AuthorityGapType;
  severity: AuthorityGapSeverity;
  title: string;
  explanation: string;
  evidenceSummary: string;
};

function buildAuthorityGaps(support: ListingSupportModel, evaluatedAt: string) {
  const summary = support.summary;
  const items: AuthorityGapItem[] = [];

  if (summary.inboundLinkedSupportCount <= 0) {
    items.push({
      type: "no_linked_support_posts",
      severity: "high",
      title: "No support posts are linking to this listing",
      explanation: "Authority flow into this listing is missing.",
      evidenceSummary: "Inbound linked support count is 0.",
    });
  }

  if (summary.mentionWithoutLinkCount > 0) {
    items.push({
      type: "mentions_without_links",
      severity: "medium",
      title: "Mentions exist without links to this listing",
      explanation: "Unlinked mentions indicate support content is not passing authority.",
      evidenceSummary: `Mentions without links: ${summary.mentionWithoutLinkCount}.`,
    });
  }

  if (summary.outboundSupportLinkCount <= 0) {
    items.push({
      type: "no_listing_to_support_links",
      severity: "medium",
      title: "Listing is not linking out to support content",
      explanation: "Outbound links from the listing to support assets are missing.",
      evidenceSummary: "Outbound support link count is 0.",
    });
  }

  if (summary.connectedSupportPageCount <= 0) {
    items.push({
      type: "weak_category_support",
      severity: "low",
      title: "Connected support page coverage is weak",
      explanation: "No connected support pages were found for this listing.",
      evidenceSummary: "Connected support page count is 0.",
    });
  }

  const highCount = items.filter((item) => item.severity === "high").length;
  const mediumCount = items.filter((item) => item.severity === "medium").length;
  const lowCount = items.filter((item) => item.severity === "low").length;

  return {
    listing: {
      id: support.listing.id,
      title: support.listing.title,
      canonicalUrl: support.listing.canonicalUrl ?? null,
      siteId: support.listing.siteId ?? null,
    },
    summary: {
      totalGaps: items.length,
      highCount,
      mediumCount,
      lowCount,
      evaluatedAt,
      lastGraphRunAt: summary.lastGraphRunAt ?? null,
      dataStatus: items.length > 0 ? ("gaps_found" as const) : ("no_meaningful_gaps" as const),
    },
    items,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const reqId = crypto.randomUUID();

  try {
    const { listingId } = await Promise.resolve(params);
    const resolvedListingId = decodeURIComponent(listingId);
    const upstreamListingId = encodeURIComponent(resolvedListingId);
    const supportRes = await proxyDirectoryIqRead(req, `/api/directoryiq/listings/${upstreamListingId}/support`);
    const supportJson = (await supportRes.json().catch(() => ({}))) as ListingSupportResponse;

    if (!supportRes.ok || !supportJson.ok || !supportJson.support) {
      const message =
        typeof supportJson.error === "string"
          ? supportJson.error
          : supportJson.error?.message ?? "Failed to evaluate authority gaps.";
      return NextResponse.json(
        {
          ok: false,
          error: {
            message,
            code: "GAPS_EVALUATION_FAILED",
            reqId,
          },
        },
        { status: supportRes.status >= 400 ? supportRes.status : 502 }
      );
    }

    const evaluatedAt = new Date().toISOString();
    const gaps = buildAuthorityGaps(supportJson.support, evaluatedAt);

    return NextResponse.json({
      ok: true,
      gaps,
      meta: {
        source: "directoryiq_support_derived_gaps_v1",
        evaluatedAt,
        dataStatus: gaps.summary.dataStatus,
      },
    });
  } catch (error) {
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
