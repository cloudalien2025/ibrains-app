import type { FlywheelRecommendationType, ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { AuthorityGapType, ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { RecommendedActionType, ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type {
  ListingSelectionIntentClustersModel,
  SelectionIntentClusterId,
} from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

export type BlogReinforcementPlanPriority = "high" | "medium" | "low";

export type BlogReinforcementPlanItemId =
  | "publish_comparison_decision_post"
  | "publish_faq_support_post"
  | "publish_local_context_guide"
  | "publish_reciprocal_support_post"
  | "publish_cluster_hub_support_page"
  | "refresh_anchor_intent_post";

export type BlogReinforcementPlanItem = {
  id: BlogReinforcementPlanItemId;
  title: string;
  priority: BlogReinforcementPlanPriority;
  rationale: string;
  evidenceSummary: string;
  suggestedContentPurpose: string;
  suggestedTargetSurface: "blog" | "support_page" | "comparison" | "faq" | "local_guide" | "cluster_hub";
  suggestedAngle?: string;
  linkedGapTypes?: AuthorityGapType[];
  linkedIntentClusterIds?: SelectionIntentClusterId[];
  linkedActionKeys?: RecommendedActionType[];
  linkedFlywheelTypes?: FlywheelRecommendationType[];
};

export type ListingBlogReinforcementPlanModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: {
    totalPlanItems: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    evaluatedAt: string;
    dataStatus: "plan_items_identified" | "no_major_reinforcement_plan_items_identified";
  };
  items: BlogReinforcementPlanItem[];
};

const PRIORITY_ORDER: Record<BlogReinforcementPlanPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const ITEM_ORDER: Record<BlogReinforcementPlanItemId, number> = {
  publish_comparison_decision_post: 0,
  publish_faq_support_post: 1,
  publish_local_context_guide: 2,
  publish_reciprocal_support_post: 3,
  publish_cluster_hub_support_page: 4,
  refresh_anchor_intent_post: 5,
};

function hasGap(gaps: ListingAuthorityGapsModel, type: AuthorityGapType): boolean {
  return gaps.items.some((item) => item.type === type);
}

function hasAction(actions: ListingRecommendedActionsModel, key: RecommendedActionType): boolean {
  return actions.items.some((item) => item.key === key);
}

function hasIntentCluster(intentClusters: ListingSelectionIntentClustersModel, id: SelectionIntentClusterId): boolean {
  return intentClusters.items.some((item) => item.id === id);
}

function countFlywheelTypes(flywheel: ListingFlywheelLinksModel, types: FlywheelRecommendationType[]): number {
  const set = new Set(types);
  return flywheel.items.filter((item) => set.has(item.type)).length;
}

function upsertPlanItem(
  map: Map<BlogReinforcementPlanItemId, BlogReinforcementPlanItem>,
  next: BlogReinforcementPlanItem
): void {
  const existing = map.get(next.id);
  if (!existing) {
    map.set(next.id, next);
    return;
  }

  const priority = PRIORITY_ORDER[next.priority] < PRIORITY_ORDER[existing.priority] ? next.priority : existing.priority;
  map.set(next.id, {
    ...existing,
    priority,
    linkedGapTypes: Array.from(new Set([...(existing.linkedGapTypes ?? []), ...(next.linkedGapTypes ?? [])])),
    linkedIntentClusterIds: Array.from(
      new Set([...(existing.linkedIntentClusterIds ?? []), ...(next.linkedIntentClusterIds ?? [])])
    ),
    linkedActionKeys: Array.from(new Set([...(existing.linkedActionKeys ?? []), ...(next.linkedActionKeys ?? [])])),
    linkedFlywheelTypes: Array.from(new Set([...(existing.linkedFlywheelTypes ?? []), ...(next.linkedFlywheelTypes ?? [])])),
  });
}

export function buildListingBlogReinforcementPlan(input: {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  actions: ListingRecommendedActionsModel;
  flywheel: ListingFlywheelLinksModel;
  intentClusters: ListingSelectionIntentClustersModel;
  evaluatedAt?: string;
}): ListingBlogReinforcementPlanModel {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const { support, gaps, actions, flywheel, intentClusters } = input;
  const plan = new Map<BlogReinforcementPlanItemId, BlogReinforcementPlanItem>();

  if (
    hasGap(gaps, "missing_comparison_content") ||
    hasAction(actions, "create_comparison_support_content") ||
    hasIntentCluster(intentClusters, "reinforce_decision_stage_content")
  ) {
    upsertPlanItem(plan, {
      id: "publish_comparison_decision_post",
      title: "Publish a comparison decision-stage post",
      priority: "high",
      rationale: "Selection-stage users need comparison context to choose this listing over alternatives.",
      evidenceSummary: `Comparison gap: ${hasGap(gaps, "missing_comparison_content") ? "yes" : "no"}; decision-stage cluster: ${hasIntentCluster(intentClusters, "reinforce_decision_stage_content") ? "yes" : "no"}.`,
      suggestedContentPurpose: "Help users evaluate alternatives and why this listing is preferred.",
      suggestedTargetSurface: "comparison",
      suggestedAngle: `Best fit scenarios for ${support.listing.title} vs nearby alternatives`,
      linkedGapTypes: ["missing_comparison_content"],
      linkedIntentClusterIds: ["reinforce_decision_stage_content"],
      linkedActionKeys: ["create_comparison_support_content", "generate_reinforcement_cluster"],
      linkedFlywheelTypes: ["category_or_guide_page_should_join_cluster"],
    });
  }

  if (
    hasGap(gaps, "missing_faq_support_coverage") ||
    hasAction(actions, "generate_reinforcement_post") ||
    hasIntentCluster(intentClusters, "reinforce_decision_stage_content")
  ) {
    upsertPlanItem(plan, {
      id: "publish_faq_support_post",
      title: "Publish an FAQ-style reinforcement post",
      priority: hasGap(gaps, "missing_faq_support_coverage") ? "high" : "medium",
      rationale: "FAQ coverage reduces decision friction and captures practical selection intent.",
      evidenceSummary: `FAQ/support gap: ${hasGap(gaps, "missing_faq_support_coverage") ? "yes" : "no"}; inbound support links: ${support.summary.inboundLinkedSupportCount}.`,
      suggestedContentPurpose: "Answer top pre-selection questions and route readers to the listing.",
      suggestedTargetSurface: "faq",
      suggestedAngle: `Top questions to answer before booking ${support.listing.title}`,
      linkedGapTypes: ["missing_faq_support_coverage"],
      linkedIntentClusterIds: ["reinforce_decision_stage_content"],
      linkedActionKeys: ["generate_reinforcement_post"],
    });
  }

  if (
    hasGap(gaps, "weak_local_context_support") ||
    hasAction(actions, "add_local_context_support") ||
    hasIntentCluster(intentClusters, "strengthen_local_selection_confidence")
  ) {
    upsertPlanItem(plan, {
      id: "publish_local_context_guide",
      title: "Publish a local-context selection guide",
      priority: "medium",
      rationale: "Local context signals help users confirm this listing matches their trip intent.",
      evidenceSummary:
        gaps.items.find((item) => item.type === "weak_local_context_support")?.evidenceSummary ??
        "Local context reinforcement signal detected.",
      suggestedContentPurpose: "Connect listing value to local context and nearby decision factors.",
      suggestedTargetSurface: "local_guide",
      suggestedAngle: `${support.listing.title} in local context: when this area/location is the right fit`,
      linkedGapTypes: ["weak_local_context_support"],
      linkedIntentClusterIds: ["strengthen_local_selection_confidence"],
      linkedActionKeys: ["add_local_context_support"],
    });
  }

  const reciprocalCount = countFlywheelTypes(flywheel, [
    "blog_posts_should_link_to_listing",
    "missing_reciprocal_link",
    "listing_should_link_back_to_support_post",
  ]);
  if (
    reciprocalCount > 0 ||
    hasGap(gaps, "mentions_without_links") ||
    hasIntentCluster(intentClusters, "close_unlinked_support_mentions") ||
    hasIntentCluster(intentClusters, "repair_bidirectional_flywheel_links")
  ) {
    upsertPlanItem(plan, {
      id: "publish_reciprocal_support_post",
      title: "Publish a reciprocal support post for inbound authority flow",
      priority: support.summary.mentionWithoutLinkCount > 0 ? "high" : "medium",
      rationale: "Unlinked mentions and reciprocal gaps reduce authority transfer into the listing.",
      evidenceSummary: `Mentions without links: ${support.summary.mentionWithoutLinkCount}; reciprocal flywheel signals: ${reciprocalCount}.`,
      suggestedContentPurpose: "Create a support post designed to link to listing and receive a listing-side reciprocal link.",
      suggestedTargetSurface: "blog",
      suggestedAngle: `Practical scenario guide that naturally references ${support.listing.title}`,
      linkedGapTypes: ["mentions_without_links", "no_listing_to_support_links"],
      linkedIntentClusterIds: ["close_unlinked_support_mentions", "repair_bidirectional_flywheel_links"],
      linkedActionKeys: ["add_flywheel_links", "generate_reinforcement_post"],
      linkedFlywheelTypes: ["blog_posts_should_link_to_listing", "missing_reciprocal_link", "listing_should_link_back_to_support_post"],
    });
  }

  if (
    countFlywheelTypes(flywheel, ["category_or_guide_page_should_join_cluster"]) > 0 ||
    hasAction(actions, "generate_reinforcement_cluster") ||
    hasIntentCluster(intentClusters, "reinforce_decision_stage_content")
  ) {
    upsertPlanItem(plan, {
      id: "publish_cluster_hub_support_page",
      title: "Publish a cluster hub support page",
      priority: "medium",
      rationale: "A cluster hub consolidates supporting posts and strengthens reinforcement pathways around the listing.",
      evidenceSummary: `Cluster flywheel opportunities: ${countFlywheelTypes(flywheel, ["category_or_guide_page_should_join_cluster"])}; connected support pages: ${support.summary.connectedSupportPageCount}.`,
      suggestedContentPurpose: "Establish a central support page linking listing, comparison post, and FAQ/local guides.",
      suggestedTargetSurface: "cluster_hub",
      suggestedAngle: `${support.listing.title} planning hub with supporting decision resources`,
      linkedIntentClusterIds: ["reinforce_decision_stage_content"],
      linkedActionKeys: ["generate_reinforcement_cluster"],
      linkedFlywheelTypes: ["category_or_guide_page_should_join_cluster"],
    });
  }

  if (
    hasGap(gaps, "weak_anchor_text") ||
    hasAction(actions, "strengthen_anchor_text") ||
    hasIntentCluster(intentClusters, "improve_anchor_intent_specificity") ||
    countFlywheelTypes(flywheel, ["strengthen_anchor_text"]) > 0
  ) {
    upsertPlanItem(plan, {
      id: "refresh_anchor_intent_post",
      title: "Publish or refresh an anchor-intent reinforcement post",
      priority: "low",
      rationale: "Anchor improvements increase topical clarity for users and strengthen support-to-listing relevance.",
      evidenceSummary:
        gaps.items.find((item) => item.type === "weak_anchor_text")?.evidenceSummary ??
        `Flywheel anchor improvements: ${countFlywheelTypes(flywheel, ["strengthen_anchor_text"])}.`,
      suggestedContentPurpose: "Reinforce listing intent with stronger descriptive anchor language and contextual references.",
      suggestedTargetSurface: "support_page",
      suggestedAngle: `Intent-rich supporting content referencing ${support.listing.title} with descriptive anchors`,
      linkedGapTypes: ["weak_anchor_text"],
      linkedIntentClusterIds: ["improve_anchor_intent_specificity"],
      linkedActionKeys: ["strengthen_anchor_text"],
      linkedFlywheelTypes: ["strengthen_anchor_text"],
    });
  }

  const items = Array.from(plan.values())
    .map((item) => ({
      ...item,
      linkedGapTypes: item.linkedGapTypes?.length ? item.linkedGapTypes : undefined,
      linkedIntentClusterIds: item.linkedIntentClusterIds?.length ? item.linkedIntentClusterIds : undefined,
      linkedActionKeys: item.linkedActionKeys?.length ? item.linkedActionKeys : undefined,
      linkedFlywheelTypes: item.linkedFlywheelTypes?.length ? item.linkedFlywheelTypes : undefined,
    }))
    .sort((left, right) => {
      const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return ITEM_ORDER[left.id] - ITEM_ORDER[right.id];
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
      totalPlanItems: items.length,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      evaluatedAt,
      dataStatus: items.length > 0 ? "plan_items_identified" : "no_major_reinforcement_plan_items_identified",
    },
    items,
  };
}
