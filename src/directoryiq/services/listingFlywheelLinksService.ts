import type { AuthorityGapType, ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type {
  ListingSupportInbound,
  ListingSupportMention,
  ListingSupportModel,
} from "@/src/directoryiq/services/listingSupportService";

export type FlywheelRecommendationType =
  | "blog_posts_should_link_to_listing"
  | "strengthen_anchor_text"
  | "listing_should_link_back_to_support_post"
  | "category_or_guide_page_should_join_cluster"
  | "missing_reciprocal_link";

export type FlywheelRecommendationPriority = "high" | "medium" | "low";

export type FlywheelEntity = {
  id: string;
  type: "listing" | "blog_post" | "guide_page" | "category_page" | "support_page";
  title: string;
  url?: string | null;
};

export type FlywheelAnchorGuidance = {
  suggestedAnchorText?: string;
  guidance?: string;
};

export type FlywheelRecommendationItem = {
  key: string;
  type: FlywheelRecommendationType;
  priority: FlywheelRecommendationPriority;
  title: string;
  rationale: string;
  evidenceSummary: string;
  sourceEntity: FlywheelEntity;
  targetEntity: FlywheelEntity;
  linkedGapTypes?: AuthorityGapType[];
  suggestedSurface?: "listing" | "blog" | "guide_page" | "category_page";
  anchorGuidance?: FlywheelAnchorGuidance;
};

export type ListingFlywheelLinksModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: {
    totalRecommendations: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    evaluatedAt: string;
    dataStatus: "flywheel_opportunities_found" | "no_major_flywheel_opportunities";
  };
  items: FlywheelRecommendationItem[];
};

const PRIORITY_ORDER: Record<FlywheelRecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const TYPE_ORDER: Record<FlywheelRecommendationType, number> = {
  blog_posts_should_link_to_listing: 0,
  missing_reciprocal_link: 1,
  listing_should_link_back_to_support_post: 2,
  strengthen_anchor_text: 3,
  category_or_guide_page_should_join_cluster: 4,
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function deriveListingAnchor(listingTitle: string): string {
  const normalized = normalizeText(listingTitle);
  return normalized
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
}

function hasGap(gaps: ListingAuthorityGapsModel, type: AuthorityGapType): boolean {
  return gaps.items.some((item) => item.type === type);
}

function hasOutboundMatch(support: ListingSupportModel, inbound: ListingSupportInbound): boolean {
  const inboundUrl = normalizeText(inbound.url ?? "");
  const inboundTitle = normalizeText(inbound.title ?? inbound.sourceId);
  return support.outboundSupportLinks.some((outbound) => {
    const outboundUrl = normalizeText(outbound.url ?? "");
    const outboundTitle = normalizeText(outbound.title ?? outbound.targetId ?? "");
    return (inboundUrl && outboundUrl && inboundUrl === outboundUrl) || (inboundTitle && outboundTitle && inboundTitle === outboundTitle);
  });
}

function findWeakAnchorRows(input: {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
}): Array<{ sourceId: string; sourceTitle: string; sourceUrl: string | null; weakAnchors: string[] }> {
  const weakFromGap = new Set(
    input.gaps.items
      .filter((item) => item.type === "weak_anchor_text")
      .flatMap((item) => item.evidence?.anchors ?? [])
      .map((anchor) => normalizeText(anchor))
      .filter(Boolean)
  );
  const genericAnchors = new Set(["click here", "learn more", "read more", "more", "here"]);

  return input.support.inboundLinkedSupport
    .map((row) => {
      const weakAnchors = row.anchors.filter((anchor) => {
        const cleaned = normalizeText(anchor);
        return weakFromGap.has(cleaned) || genericAnchors.has(cleaned);
      });
      return {
        sourceId: row.sourceId,
        sourceTitle: row.title ?? row.sourceId,
        sourceUrl: row.url ?? null,
        weakAnchors,
      };
    })
    .filter((row) => row.weakAnchors.length > 0);
}

function mapMentionToLinkRec(params: {
  listing: FlywheelEntity;
  mention: ListingSupportMention;
}): FlywheelRecommendationItem {
  const sourceTitle = params.mention.title ?? params.mention.sourceId;
  const suggestedAnchor = deriveListingAnchor(params.listing.title);
  return {
    key: `blog_posts_should_link_to_listing:${params.mention.sourceId}->${params.listing.id}`,
    type: "blog_posts_should_link_to_listing",
    priority: "high",
    title: "Blog post should link directly to the listing",
    rationale: "This support post mentions the listing but does not pass authority with a direct link.",
    evidenceSummary: params.mention.mentionSnippet
      ? `Detected unlinked mention: "${params.mention.mentionSnippet}".`
      : "Detected mention without link in support content.",
    sourceEntity: {
      id: params.mention.sourceId,
      type: "blog_post",
      title: sourceTitle,
      url: params.mention.url ?? null,
    },
    targetEntity: params.listing,
    linkedGapTypes: ["mentions_without_links"],
    suggestedSurface: "blog",
    anchorGuidance: {
      suggestedAnchorText: suggestedAnchor || params.listing.title,
      guidance: "Use intent-rich anchor text that references the listing by name and core service.",
    },
  };
}

export function buildListingFlywheelLinks(input: {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  evaluatedAt?: string;
}): ListingFlywheelLinksModel {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const listing: FlywheelEntity = {
    id: input.support.listing.id,
    type: "listing",
    title: input.support.listing.title,
    url: input.support.listing.canonicalUrl ?? null,
  };
  const items: FlywheelRecommendationItem[] = [];

  for (const mention of input.support.mentionsWithoutLinks) {
    items.push(mapMentionToLinkRec({ listing, mention }));
    items.push({
      key: `missing_reciprocal_link:${listing.id}<->${mention.sourceId}`,
      type: "missing_reciprocal_link",
      priority: "high",
      title: "Missing reciprocal link pair between listing and support post",
      rationale: "Authority flywheel requires the support post to link in and the listing to link back where relevant.",
      evidenceSummary: `No verified reciprocal pair for ${mention.title ?? mention.sourceId}.`,
      sourceEntity: listing,
      targetEntity: {
        id: mention.sourceId,
        type: "blog_post",
        title: mention.title ?? mention.sourceId,
        url: mention.url ?? null,
      },
      linkedGapTypes: ["mentions_without_links", "no_listing_to_support_links"],
      suggestedSurface: "listing",
      anchorGuidance: {
        guidance: "Add a short 'Related guide' module on the listing and ensure the support post links back to this listing.",
      },
    });
  }

  for (const inbound of input.support.inboundLinkedSupport) {
    if (hasOutboundMatch(input.support, inbound)) continue;
    items.push({
      key: `listing_should_link_back_to_support_post:${listing.id}->${inbound.sourceId}`,
      type: "listing_should_link_back_to_support_post",
      priority: "medium",
      title: "Listing should link back to a supporting post",
      rationale: "Inbound authority exists, but listing-side reinforcement is missing for this support post.",
      evidenceSummary: `${inbound.title ?? inbound.sourceId} links to this listing but no reciprocal listing link was found.`,
      sourceEntity: listing,
      targetEntity: {
        id: inbound.sourceId,
        type: "blog_post",
        title: inbound.title ?? inbound.sourceId,
        url: inbound.url ?? null,
      },
      linkedGapTypes: ["no_listing_to_support_links"],
      suggestedSurface: "listing",
      anchorGuidance: {
        guidance: "Add a contextual support link block in the listing body or FAQ section.",
      },
    });
  }

  for (const row of findWeakAnchorRows(input)) {
    items.push({
      key: `strengthen_anchor_text:${row.sourceId}->${listing.id}`,
      type: "strengthen_anchor_text",
      priority: "medium",
      title: "Strengthen weak anchor text in support links",
      rationale: "Generic or weak anchors reduce topical relevance transfer.",
      evidenceSummary: `Weak anchors detected: ${row.weakAnchors.join(", ")}.`,
      sourceEntity: {
        id: row.sourceId,
        type: "blog_post",
        title: row.sourceTitle,
        url: row.sourceUrl,
      },
      targetEntity: listing,
      linkedGapTypes: ["weak_anchor_text"],
      suggestedSurface: "blog",
      anchorGuidance: {
        suggestedAnchorText: deriveListingAnchor(listing.title) || listing.title,
        guidance: "Prefer descriptive anchors including listing brand and service intent.",
      },
    });
  }

  if (
    hasGap(input.gaps, "weak_category_support") ||
    hasGap(input.gaps, "missing_comparison_content") ||
    hasGap(input.gaps, "missing_faq_support_coverage") ||
    input.support.summary.connectedSupportPageCount === 0
  ) {
    const guideType: FlywheelEntity["type"] = hasGap(input.gaps, "weak_category_support") ? "category_page" : "guide_page";
    items.push({
      key: `category_or_guide_page_should_join_cluster:${listing.id}`,
      type: "category_or_guide_page_should_join_cluster",
      priority: hasGap(input.gaps, "weak_category_support") ? "medium" : "low",
      title: "Add a category or guide page into the link cluster",
      rationale: "Cluster-level support pages improve authority circulation between listing and supporting posts.",
      evidenceSummary: `Connected support pages: ${input.support.summary.connectedSupportPageCount}; gaps: ${input.gaps.summary.totalGaps}.`,
      sourceEntity: listing,
      targetEntity: {
        id: `${listing.id}:cluster`,
        type: guideType,
        title: "Category/Guide cluster node",
        url: null,
      },
      linkedGapTypes: input.gaps.items
        .map((item) => item.type)
        .filter((type) =>
          ["weak_category_support", "missing_comparison_content", "missing_faq_support_coverage"].includes(type)
        ),
      suggestedSurface: guideType === "category_page" ? "category_page" : "guide_page",
      anchorGuidance: {
        guidance: "Connect this listing and its top 2-3 supporting posts from the same category/guide hub.",
      },
    });
  }

  const deduped = Array.from(
    new Map(
      items.map((item) => [
        item.key,
        {
          ...item,
          linkedGapTypes: item.linkedGapTypes?.length ? Array.from(new Set(item.linkedGapTypes)) : undefined,
        },
      ])
    ).values()
  );

  const sorted = deduped.sort((left, right) => {
    const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const typeDelta = TYPE_ORDER[left.type] - TYPE_ORDER[right.type];
    if (typeDelta !== 0) return typeDelta;
    const sourceDelta = left.sourceEntity.id.localeCompare(right.sourceEntity.id);
    if (sourceDelta !== 0) return sourceDelta;
    return left.targetEntity.id.localeCompare(right.targetEntity.id);
  });

  const highPriorityCount = sorted.filter((item) => item.priority === "high").length;
  const mediumPriorityCount = sorted.filter((item) => item.priority === "medium").length;
  const lowPriorityCount = sorted.filter((item) => item.priority === "low").length;

  return {
    listing: input.support.listing,
    summary: {
      totalRecommendations: sorted.length,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      evaluatedAt,
      dataStatus: sorted.length > 0 ? "flywheel_opportunities_found" : "no_major_flywheel_opportunities",
    },
    items: sorted,
  };
}
