export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";

type ListingSupportSummary = {
  inboundLinkedSupportCount: number;
  mentionWithoutLinkCount: number;
  outboundSupportLinkCount: number;
  connectedSupportPageCount: number;
  lastGraphRunAt: string | null;
};

type ListingSupportInbound = {
  sourceId: string;
  sourceType: "blog_post";
  title: string | null;
  url?: string | null;
  anchors: string[];
  relationshipType: "links_to_listing";
};

type ListingSupportMention = {
  sourceId: string;
  sourceType: "blog_post";
  title: string | null;
  url?: string | null;
  mentionSnippet?: string | null;
  relationshipType: "mentions_without_link";
};

type ListingSupportModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: ListingSupportSummary;
  inboundLinkedSupport: ListingSupportInbound[];
  mentionsWithoutLinks: ListingSupportMention[];
  outboundSupportLinks: Array<Record<string, unknown>>;
  connectedSupportPages: Array<Record<string, unknown>>;
};

type ListingSupportResponse = {
  ok: boolean;
  support?: ListingSupportModel;
};

type AuthorityListingEvidence = {
  blogExternalId: string;
  blogTitle: string | null;
  blogUrl: string | null;
  edgeType: "links_to" | "mentions";
  evidenceSnippet: string | null;
  anchorText: string | null;
};

type AuthorityListingRow = {
  listingExternalId: string;
  listingTitle: string | null;
  listingUrl: string | null;
  inboundBlogLinksCount: number;
  mentionedInCount: number;
  inboundBlogs: AuthorityListingEvidence[];
};

type AuthorityListingsResponse = {
  ok: boolean;
  listings?: AuthorityListingRow[];
};

function isZeroSupportSummary(summary: ListingSupportSummary): boolean {
  return (
    summary.inboundLinkedSupportCount <= 0 &&
    summary.mentionWithoutLinkCount <= 0 &&
    summary.outboundSupportLinkCount <= 0 &&
    summary.connectedSupportPageCount <= 0
  );
}

function buildSupportFromAuthorityListing(input: {
  support: ListingSupportModel;
  authorityListing: AuthorityListingRow;
}): ListingSupportModel {
  const inboundMap = new Map<string, ListingSupportInbound>();
  const mentionMap = new Map<string, ListingSupportMention>();

  for (const row of input.authorityListing.inboundBlogs ?? []) {
    const sourceId = (row.blogExternalId ?? "").trim();
    if (!sourceId) continue;
    if (row.edgeType === "links_to") {
      const existing = inboundMap.get(sourceId) ?? {
        sourceId,
        sourceType: "blog_post",
        title: row.blogTitle ?? null,
        url: row.blogUrl ?? null,
        anchors: [],
        relationshipType: "links_to_listing",
      };
      const anchor = (row.anchorText ?? "").trim();
      if (anchor && !existing.anchors.includes(anchor)) {
        existing.anchors.push(anchor);
      }
      inboundMap.set(sourceId, existing);
      continue;
    }

    if (mentionMap.has(sourceId)) continue;
    mentionMap.set(sourceId, {
      sourceId,
      sourceType: "blog_post",
      title: row.blogTitle ?? null,
      url: row.blogUrl ?? null,
      mentionSnippet: row.evidenceSnippet ?? null,
      relationshipType: "mentions_without_link",
    });
  }

  const inboundLinkedSupport = Array.from(inboundMap.values()).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const linkedSourceIds = new Set(inboundLinkedSupport.map((row) => row.sourceId));
  const mentionsWithoutLinks = Array.from(mentionMap.values())
    .filter((row) => !linkedSourceIds.has(row.sourceId))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  const summary: ListingSupportSummary = {
    inboundLinkedSupportCount: Math.max(input.authorityListing.inboundBlogLinksCount ?? 0, inboundLinkedSupport.length),
    mentionWithoutLinkCount: Math.max(input.authorityListing.mentionedInCount ?? 0, mentionsWithoutLinks.length),
    outboundSupportLinkCount: input.support.summary.outboundSupportLinkCount,
    connectedSupportPageCount: input.support.summary.connectedSupportPageCount,
    lastGraphRunAt: input.support.summary.lastGraphRunAt ?? null,
  };

  return {
    listing: {
      id: input.support.listing.id,
      title: input.support.listing.title || input.authorityListing.listingTitle || input.support.listing.id,
      canonicalUrl: input.support.listing.canonicalUrl || input.authorityListing.listingUrl || null,
      siteId: input.support.listing.siteId ?? null,
    },
    summary,
    inboundLinkedSupport,
    mentionsWithoutLinks,
    outboundSupportLinks: input.support.outboundSupportLinks ?? [],
    connectedSupportPages: input.support.connectedSupportPages ?? [],
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const { listingId } = await Promise.resolve(params);
  const resolvedListingId = decodeURIComponent(listingId);
  const upstreamListingId = encodeURIComponent(resolvedListingId);
  const supportRes = await proxyDirectoryIqRead(req, `/api/directoryiq/listings/${upstreamListingId}/support`);
  const supportJson = (await supportRes.clone().json().catch(() => null)) as ListingSupportResponse | null;

  if (!supportRes.ok || !supportJson?.ok || !supportJson.support || !isZeroSupportSummary(supportJson.support.summary)) {
    return supportRes;
  }

  const authorityRes = await proxyDirectoryIqRead(req, "/api/directoryiq/authority/listings");
  const authorityJson = (await authorityRes.json().catch(() => null)) as AuthorityListingsResponse | null;
  if (!authorityRes.ok || !authorityJson?.ok || !Array.isArray(authorityJson.listings)) {
    return supportRes;
  }

  const authorityListing = authorityJson.listings.find((row) => row.listingExternalId === resolvedListingId);
  if (!authorityListing) {
    return supportRes;
  }

  const hasAuthorityEvidence =
    authorityListing.inboundBlogLinksCount > 0 ||
    authorityListing.mentionedInCount > 0 ||
    authorityListing.inboundBlogs.length > 0;
  if (!hasAuthorityEvidence) {
    return supportRes;
  }

  return NextResponse.json({
    ok: true,
    support: buildSupportFromAuthorityListing({
      support: supportJson.support,
      authorityListing,
    }),
    meta: {
      source: "directoryiq_support_authority_listing_fallback_v1",
      fallbackApplied: true,
    },
  });
}
