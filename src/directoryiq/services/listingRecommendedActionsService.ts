import type { AuthorityGapItem, AuthorityGapType, ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

export type RecommendedActionType =
  | "optimize_listing"
  | "add_flywheel_links"
  | "generate_reinforcement_post"
  | "generate_reinforcement_cluster"
  | "strengthen_anchor_text"
  | "add_local_context_support"
  | "create_comparison_support_content";

export type RecommendedActionPriority = "high" | "medium" | "low";

export type RecommendedActionItem = {
  key: RecommendedActionType;
  priority: RecommendedActionPriority;
  title: string;
  rationale: string;
  evidenceSummary: string;
  linkedGapTypes?: AuthorityGapType[];
  dependsOn?: RecommendedActionType[];
  targetSurface?: "listing" | "blog" | "support_page" | "cluster";
};

export type ListingRecommendedActionsModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: {
    totalActions: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    evaluatedAt: string;
    dataStatus: "actions_recommended" | "no_major_actions_recommended";
  };
  items: RecommendedActionItem[];
};

const PRIORITY_ORDER: Record<RecommendedActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const ACTION_ORDER: Record<RecommendedActionType, number> = {
  optimize_listing: 0,
  add_flywheel_links: 1,
  generate_reinforcement_post: 2,
  generate_reinforcement_cluster: 3,
  strengthen_anchor_text: 4,
  add_local_context_support: 5,
  create_comparison_support_content: 6,
};

function hasGap(gaps: ListingAuthorityGapsModel, type: AuthorityGapType): AuthorityGapItem | null {
  return gaps.items.find((item) => item.type === type) ?? null;
}

function upsertAction(map: Map<RecommendedActionType, RecommendedActionItem>, next: RecommendedActionItem): void {
  const existing = map.get(next.key);
  if (!existing) {
    map.set(next.key, next);
    return;
  }

  const pick =
    PRIORITY_ORDER[next.priority] < PRIORITY_ORDER[existing.priority]
      ? next.priority
      : existing.priority;
  const linkedGapTypes = Array.from(
    new Set([...(existing.linkedGapTypes ?? []), ...(next.linkedGapTypes ?? [])])
  );
  const dependsOn = Array.from(new Set([...(existing.dependsOn ?? []), ...(next.dependsOn ?? [])]));

  map.set(next.key, {
    ...existing,
    priority: pick,
    rationale: existing.rationale,
    evidenceSummary: existing.evidenceSummary,
    linkedGapTypes: linkedGapTypes.length ? linkedGapTypes : undefined,
    dependsOn: dependsOn.length ? dependsOn : undefined,
    targetSurface: existing.targetSurface ?? next.targetSurface,
  });
}

export function buildListingRecommendedActions(input: {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  evaluatedAt?: string;
}): ListingRecommendedActionsModel {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const { support, gaps } = input;
  const actions = new Map<RecommendedActionType, RecommendedActionItem>();
  const supportSummary = support.summary;
  const gapSummary = gaps.summary;

  if (gapSummary.totalGaps >= 2 || supportSummary.inboundLinkedSupportCount === 0 || supportSummary.outboundSupportLinkCount === 0) {
    upsertAction(actions, {
      key: "optimize_listing",
      priority: gapSummary.highCount > 0 ? "high" : "medium",
      title: "Optimize listing authority structure",
      rationale: "The listing should be tuned before reinforcement so support authority can flow predictably.",
      evidenceSummary: `Gaps: ${gapSummary.totalGaps}; inbound links: ${supportSummary.inboundLinkedSupportCount}; outbound support links: ${supportSummary.outboundSupportLinkCount}.`,
      linkedGapTypes: gaps.items.slice(0, 3).map((item) => item.type),
      targetSurface: "listing",
    });
  }

  if (supportSummary.mentionWithoutLinkCount > 0 || supportSummary.outboundSupportLinkCount === 0 || hasGap(gaps, "no_listing_to_support_links")) {
    upsertAction(actions, {
      key: "add_flywheel_links",
      priority: supportSummary.outboundSupportLinkCount === 0 ? "high" : "medium",
      title: "Add flywheel links between listing and support assets",
      rationale: "Bidirectional links are required for stable authority circulation.",
      evidenceSummary: `Mentions without links: ${supportSummary.mentionWithoutLinkCount}; outbound support links: ${supportSummary.outboundSupportLinkCount}.`,
      linkedGapTypes: ["mentions_without_links", "no_listing_to_support_links"],
      dependsOn: ["optimize_listing"],
      targetSurface: "listing",
    });
  }

  if (hasGap(gaps, "no_linked_support_posts")) {
    upsertAction(actions, {
      key: "generate_reinforcement_cluster",
      priority: "high",
      title: "Generate a reinforcement cluster",
      rationale: "No inbound support links indicates this listing needs multiple coordinated support assets.",
      evidenceSummary: `Inbound linked support count is ${supportSummary.inboundLinkedSupportCount}.`,
      linkedGapTypes: ["no_linked_support_posts"],
      dependsOn: ["optimize_listing", "add_flywheel_links"],
      targetSurface: "cluster",
    });
  }

  if (hasGap(gaps, "missing_faq_support_coverage") || (supportSummary.inboundLinkedSupportCount <= 1 && gapSummary.totalGaps > 0)) {
    upsertAction(actions, {
      key: "generate_reinforcement_post",
      priority: hasGap(gaps, "missing_faq_support_coverage") ? "medium" : "low",
      title: "Generate one reinforcement post",
      rationale: "A focused support post can close immediate authority coverage gaps.",
      evidenceSummary: `Inbound linked support count is ${supportSummary.inboundLinkedSupportCount}.`,
      linkedGapTypes: ["missing_faq_support_coverage"],
      dependsOn: ["optimize_listing"],
      targetSurface: "blog",
    });
  }

  if (hasGap(gaps, "weak_anchor_text")) {
    upsertAction(actions, {
      key: "strengthen_anchor_text",
      priority: "medium",
      title: "Strengthen anchor text quality",
      rationale: "Generic anchors reduce intent specificity and weaken authority transfer.",
      evidenceSummary:
        hasGap(gaps, "weak_anchor_text")?.evidenceSummary ??
        "Weak anchor text signals were detected.",
      linkedGapTypes: ["weak_anchor_text"],
      targetSurface: "blog",
    });
  }

  if (hasGap(gaps, "weak_local_context_support")) {
    upsertAction(actions, {
      key: "add_local_context_support",
      priority: "low",
      title: "Add local/context support content",
      rationale: "Location/context signals need stronger representation across support assets.",
      evidenceSummary:
        hasGap(gaps, "weak_local_context_support")?.evidenceSummary ??
        "Local context support is weak.",
      linkedGapTypes: ["weak_local_context_support"],
      targetSurface: "support_page",
    });
  }

  if (hasGap(gaps, "missing_comparison_content")) {
    upsertAction(actions, {
      key: "create_comparison_support_content",
      priority: "medium",
      title: "Create comparison/support content",
      rationale: "Comparison-style support content is missing and limits decision-stage authority.",
      evidenceSummary:
        hasGap(gaps, "missing_comparison_content")?.evidenceSummary ??
        "Comparison coverage was not found.",
      linkedGapTypes: ["missing_comparison_content"],
      dependsOn: ["generate_reinforcement_post"],
      targetSurface: "blog",
    });
  }

  const items = Array.from(actions.values()).sort((left, right) => {
    const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return ACTION_ORDER[left.key] - ACTION_ORDER[right.key];
  });

  const highPriorityCount = items.filter((item) => item.priority === "high").length;
  const mediumPriorityCount = items.filter((item) => item.priority === "medium").length;
  const lowPriorityCount = items.filter((item) => item.priority === "low").length;

  return {
    listing: {
      id: support.listing.id,
      title: support.listing.title,
      canonicalUrl: support.listing.canonicalUrl ?? null,
      siteId: support.listing.siteId ?? null,
    },
    summary: {
      totalActions: items.length,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      evaluatedAt,
      dataStatus: items.length > 0 ? "actions_recommended" : "no_major_actions_recommended",
    },
    items,
  };
}
