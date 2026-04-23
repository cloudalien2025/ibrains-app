import type { FlywheelRecommendationType, ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { AuthorityGapType, ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { RecommendedActionType, ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";
import type {
  ListingSelectionIntentContext,
  ListingSelectionIntentProfile,
} from "@/src/directoryiq/services/listingSelectionIntentResolverService";
import { resolveListingSelectionIntent } from "@/src/directoryiq/services/listingSelectionIntentResolverService";

export type SelectionIntentClusterPriority = "high" | "medium" | "low";

export type SelectionIntentClusterId =
  | "close_unlinked_support_mentions"
  | "repair_bidirectional_flywheel_links"
  | "reinforce_decision_stage_content"
  | "strengthen_local_selection_confidence"
  | "improve_anchor_intent_specificity";

export type SelectionIntentClusterItem = {
  id: SelectionIntentClusterId;
  title: string;
  priority: SelectionIntentClusterPriority;
  rationale: string;
  evidenceSummary: string;
  linkedGapTypes?: AuthorityGapType[];
  linkedActionKeys?: RecommendedActionType[];
  linkedFlywheelTypes?: FlywheelRecommendationType[];
  suggestedReinforcementDirection?: {
    surface: "listing" | "blog" | "support_page" | "cluster";
    direction: string;
  };
};

export type ListingSelectionIntentClustersModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: {
    totalClusters: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    evaluatedAt: string;
    dataStatus: "clusters_identified" | "no_major_reinforcement_intent_clusters_identified";
  };
  intentProfile?: ListingSelectionIntentProfile;
  items: SelectionIntentClusterItem[];
};

const PRIORITY_ORDER: Record<SelectionIntentClusterPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CLUSTER_ORDER: Record<SelectionIntentClusterId, number> = {
  close_unlinked_support_mentions: 0,
  repair_bidirectional_flywheel_links: 1,
  reinforce_decision_stage_content: 2,
  strengthen_local_selection_confidence: 3,
  improve_anchor_intent_specificity: 4,
};

function hasGap(gaps: ListingAuthorityGapsModel, type: AuthorityGapType): boolean {
  return gaps.items.some((item) => item.type === type);
}

function hasAction(actions: ListingRecommendedActionsModel, key: RecommendedActionType): boolean {
  return actions.items.some((item) => item.key === key);
}

function countFlywheelTypes(flywheel: ListingFlywheelLinksModel, types: FlywheelRecommendationType[]): number {
  const set = new Set(types);
  return flywheel.items.filter((item) => set.has(item.type)).length;
}

function mergePriority(left: SelectionIntentClusterPriority, right: SelectionIntentClusterPriority): SelectionIntentClusterPriority {
  return PRIORITY_ORDER[left] <= PRIORITY_ORDER[right] ? left : right;
}

function upsertCluster(
  map: Map<SelectionIntentClusterId, SelectionIntentClusterItem>,
  next: SelectionIntentClusterItem
): void {
  const existing = map.get(next.id);
  if (!existing) {
    map.set(next.id, next);
    return;
  }

  map.set(next.id, {
    ...existing,
    priority: mergePriority(existing.priority, next.priority),
    linkedGapTypes: Array.from(new Set([...(existing.linkedGapTypes ?? []), ...(next.linkedGapTypes ?? [])])),
    linkedActionKeys: Array.from(new Set([...(existing.linkedActionKeys ?? []), ...(next.linkedActionKeys ?? [])])),
    linkedFlywheelTypes: Array.from(new Set([...(existing.linkedFlywheelTypes ?? []), ...(next.linkedFlywheelTypes ?? [])])),
  });
}

export function buildListingSelectionIntentClusters(input: {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  actions: ListingRecommendedActionsModel;
  flywheel: ListingFlywheelLinksModel;
  listingContext?: ListingSelectionIntentContext;
  evaluatedAt?: string;
}): ListingSelectionIntentClustersModel {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const clusters = new Map<SelectionIntentClusterId, SelectionIntentClusterItem>();
  const { support, gaps, actions, flywheel } = input;

  const mentionSignals =
    support.summary.mentionWithoutLinkCount +
    countFlywheelTypes(flywheel, ["blog_posts_should_link_to_listing"]);
  if (mentionSignals > 0 || hasGap(gaps, "mentions_without_links")) {
    upsertCluster(clusters, {
      id: "close_unlinked_support_mentions",
      title: "Close unlinked support mentions",
      priority: mentionSignals >= 2 ? "high" : "medium",
      rationale: "Selection-stage confidence drops when support posts mention the listing but do not link directly.",
      evidenceSummary: `Mentions without links: ${support.summary.mentionWithoutLinkCount}; flywheel mention-link opportunities: ${countFlywheelTypes(flywheel, ["blog_posts_should_link_to_listing"])}.`,
      linkedGapTypes: ["mentions_without_links"],
      linkedActionKeys: ["add_flywheel_links", "generate_reinforcement_post"],
      linkedFlywheelTypes: ["blog_posts_should_link_to_listing"],
      suggestedReinforcementDirection: {
        surface: "blog",
        direction: "Convert the strongest unlinked mentions into descriptive in-content links to the listing.",
      },
    });
  }

  const reciprocalSignals =
    countFlywheelTypes(flywheel, ["missing_reciprocal_link", "listing_should_link_back_to_support_post"]) +
    (support.summary.outboundSupportLinkCount === 0 ? 1 : 0);
  if (
    reciprocalSignals > 0 ||
    hasGap(gaps, "no_listing_to_support_links") ||
    hasAction(actions, "add_flywheel_links")
  ) {
    upsertCluster(clusters, {
      id: "repair_bidirectional_flywheel_links",
      title: "Repair bidirectional flywheel links",
      priority: support.summary.outboundSupportLinkCount === 0 ? "high" : "medium",
      rationale: "Bidirectional support flow is required so users can validate options from listing and support pages.",
      evidenceSummary: `Outbound support links: ${support.summary.outboundSupportLinkCount}; reciprocal flywheel issues: ${countFlywheelTypes(flywheel, ["missing_reciprocal_link", "listing_should_link_back_to_support_post"])}.`,
      linkedGapTypes: ["no_listing_to_support_links"],
      linkedActionKeys: ["add_flywheel_links", "optimize_listing"],
      linkedFlywheelTypes: ["missing_reciprocal_link", "listing_should_link_back_to_support_post"],
      suggestedReinforcementDirection: {
        surface: "listing",
        direction: "Add a contextual support-links module that links back to top supporting blog posts.",
      },
    });
  }

  if (
    hasGap(gaps, "missing_comparison_content") ||
    hasGap(gaps, "missing_faq_support_coverage") ||
    hasAction(actions, "create_comparison_support_content") ||
    hasAction(actions, "generate_reinforcement_cluster") ||
    countFlywheelTypes(flywheel, ["category_or_guide_page_should_join_cluster"]) > 0
  ) {
    upsertCluster(clusters, {
      id: "reinforce_decision_stage_content",
      title: "Reinforce decision-stage support content",
      priority: hasGap(gaps, "missing_comparison_content") ? "high" : "medium",
      rationale: "Selection intent requires comparison and guide coverage so users can evaluate alternatives confidently.",
      evidenceSummary: `Comparison gap: ${hasGap(gaps, "missing_comparison_content") ? "yes" : "no"}; FAQ/support gap: ${hasGap(gaps, "missing_faq_support_coverage") ? "yes" : "no"}; cluster-page opportunities: ${countFlywheelTypes(flywheel, ["category_or_guide_page_should_join_cluster"])}.`,
      linkedGapTypes: ["missing_comparison_content", "missing_faq_support_coverage"],
      linkedActionKeys: ["create_comparison_support_content", "generate_reinforcement_cluster", "generate_reinforcement_post"],
      linkedFlywheelTypes: ["category_or_guide_page_should_join_cluster"],
      suggestedReinforcementDirection: {
        surface: "cluster",
        direction: "Prioritize one comparison asset plus one FAQ-style support asset and connect both into the listing cluster.",
      },
    });
  }

  if (hasGap(gaps, "weak_local_context_support") || hasAction(actions, "add_local_context_support")) {
    upsertCluster(clusters, {
      id: "strengthen_local_selection_confidence",
      title: "Strengthen local selection confidence",
      priority: hasGap(gaps, "weak_local_context_support") ? "medium" : "low",
      rationale: "Local context signals help users confirm that this listing fits their place-specific intent.",
      evidenceSummary:
        gaps.items.find((item) => item.type === "weak_local_context_support")?.evidenceSummary ??
        "Local/context support requires reinforcement.",
      linkedGapTypes: ["weak_local_context_support"],
      linkedActionKeys: ["add_local_context_support"],
      suggestedReinforcementDirection: {
        surface: "support_page",
        direction: "Add localized support content that references the listing and nearby context terms.",
      },
    });
  }

  if (
    hasGap(gaps, "weak_anchor_text") ||
    hasAction(actions, "strengthen_anchor_text") ||
    countFlywheelTypes(flywheel, ["strengthen_anchor_text"]) > 0
  ) {
    upsertCluster(clusters, {
      id: "improve_anchor_intent_specificity",
      title: "Improve anchor intent specificity",
      priority: "medium",
      rationale: "Anchor quality shapes how clearly reinforcement content maps to user selection intent.",
      evidenceSummary:
        gaps.items.find((item) => item.type === "weak_anchor_text")?.evidenceSummary ??
        `Flywheel anchor improvements: ${countFlywheelTypes(flywheel, ["strengthen_anchor_text"])}.`,
      linkedGapTypes: ["weak_anchor_text"],
      linkedActionKeys: ["strengthen_anchor_text"],
      linkedFlywheelTypes: ["strengthen_anchor_text"],
      suggestedReinforcementDirection: {
        surface: "blog",
        direction: "Replace generic anchors with listing-specific service and category phrases.",
      },
    });
  }

  const items = Array.from(clusters.values())
    .map((item) => ({
      ...item,
      linkedGapTypes: item.linkedGapTypes?.length ? item.linkedGapTypes : undefined,
      linkedActionKeys: item.linkedActionKeys?.length ? item.linkedActionKeys : undefined,
      linkedFlywheelTypes: item.linkedFlywheelTypes?.length ? item.linkedFlywheelTypes : undefined,
    }))
    .sort((left, right) => {
      const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return CLUSTER_ORDER[left.id] - CLUSTER_ORDER[right.id];
    });

  const highPriorityCount = items.filter((item) => item.priority === "high").length;
  const mediumPriorityCount = items.filter((item) => item.priority === "medium").length;
  const lowPriorityCount = items.filter((item) => item.priority === "low").length;
  const intentProfile = resolveListingSelectionIntent({
    listing: support.listing,
    listingContext: input.listingContext,
    support,
    gaps,
    actions,
    flywheel,
  });

  return {
    listing: {
      id: support.listing.id,
      title: support.listing.title,
      canonicalUrl: support.listing.canonicalUrl ?? null,
      siteId: support.listing.siteId ?? null,
    },
    summary: {
      totalClusters: items.length,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      evaluatedAt,
      dataStatus: items.length > 0 ? "clusters_identified" : "no_major_reinforcement_intent_clusters_identified",
    },
    intentProfile,
    items,
  };
}
