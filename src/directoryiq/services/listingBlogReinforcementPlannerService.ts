import type { FlywheelRecommendationType, ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { AuthorityGapType, ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { RecommendedActionType, ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type {
  ListingSelectionIntentClustersModel,
  SelectionIntentClusterId,
} from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

export type BlogReinforcementPlanPriority = "high" | "medium" | "low";
export type BlogReinforcementRecommendationType =
  | "blog_idea"
  | "local_guide"
  | "comparison_page"
  | "faq_support_page"
  | "category_reinforcement_asset";

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
  recommendationType?: BlogReinforcementRecommendationType;
  targetIntent?: string;
  whyItMatters?: string;
  reinforcesListingId?: string;
  expectedSelectionImpact?: string;
  suggestedInternalLinkPattern?: string;
  rankingContext?: string;
  rationale: string;
  evidenceSummary: string;
  suggestedContentPurpose: string;
  suggestedTargetSurface: "blog" | "support_page" | "comparison" | "faq" | "local_guide" | "cluster_hub";
  suggestedAngle?: string;
  missingSupportEntities?: string[];
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

function priorityImpact(priority: BlogReinforcementPlanPriority): string {
  if (priority === "high") {
    return "High expected impact on listing selection confidence and conversion intent.";
  }
  if (priority === "medium") {
    return "Medium expected impact on listing selection confidence with stronger support coverage.";
  }
  return "Low expected impact; useful as a compounding relevance and trust layer.";
}

function cleanIntentLabel(intent: string): string {
  return intent.replace(/_/g, " ");
}

function listingLinkLabel(support: ListingSupportModel): string {
  return support.listing.canonicalUrl ?? `listing:${support.listing.id}`;
}

function defaultLinkPattern(input: { support: ListingSupportModel; surface: BlogReinforcementPlanItem["suggestedTargetSurface"] }): string {
  const listingLink = listingLinkLabel(input.support);
  if (input.surface === "comparison") {
    return `${input.surface}-asset -> ${listingLink}; listing -> comparison block -> ${input.surface}-asset`;
  }
  if (input.surface === "cluster_hub") {
    return `${input.surface} -> ${listingLink}; listing -> support resources module -> ${input.surface}`;
  }
  if (input.surface === "faq") {
    return `${input.surface} -> ${listingLink}; listing -> FAQs and support module -> ${input.surface}`;
  }
  if (input.surface === "local_guide") {
    return `${input.surface} -> ${listingLink}; listing -> local context module -> ${input.surface}`;
  }
  if (input.surface === "support_page") {
    return `${input.surface} -> ${listingLink}; listing -> in-depth support section -> ${input.surface}`;
  }
  return `${input.surface} -> ${listingLink}; listing -> related resources -> ${input.surface}`;
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
  const intentProfile = intentClusters.intentProfile;
  const primaryIntent = intentProfile?.primaryIntent ?? "select_best_local_option";
  const localModifier = intentProfile?.localModifiers[0] ?? "this area";
  const topRanking = intentProfile?.clusterPriorityRanking[0];
  const rankingContext = topRanking
    ? `${topRanking.title} (${topRanking.score}/100, ${topRanking.priority} urgency)`
    : "Ranking context unavailable from current intent profile.";
  const comparisonFrame = intentProfile?.comparisonFrames[0];
  const comparisonIntent = intentProfile?.secondaryIntents.find((intent) =>
    ["compare_alternatives", "close_comparison_coverage_gap"].includes(intent)
  );
  const faqIntent = intentProfile?.secondaryIntents.find((intent) =>
    ["validate_trust_signals", "check_availability_and_policies", "verify_service_scope_and_credentials"].includes(intent)
  );
  const localIntent = intentProfile?.secondaryIntents.find((intent) =>
    ["confirm_local_fit", "check_activity_fit_and_access"].includes(intent)
  );
  const missingSupportEntities = intentProfile?.missingEntities ?? [];
  const plan = new Map<BlogReinforcementPlanItemId, BlogReinforcementPlanItem>();

  if (
    hasGap(gaps, "missing_comparison_content") ||
    hasAction(actions, "create_comparison_support_content") ||
    hasIntentCluster(intentClusters, "reinforce_decision_stage_content")
  ) {
    const targetIntent = comparisonIntent ?? primaryIntent;
    const priority: BlogReinforcementPlanPriority = "high";
    upsertPlanItem(plan, {
      id: "publish_comparison_decision_post",
      title: "Publish a comparison page to improve selection confidence",
      priority,
      recommendationType: "comparison_page",
      targetIntent,
      whyItMatters:
        "Comparison-stage searchers need proof and alternatives context before selecting this listing.",
      reinforcesListingId: support.listing.id,
      expectedSelectionImpact: priorityImpact(priority),
      suggestedInternalLinkPattern: defaultLinkPattern({ support, surface: "comparison" }),
      rankingContext,
      rationale: "Selection-stage users need comparison context to choose this listing over alternatives.",
      evidenceSummary: `Comparison gap: ${hasGap(gaps, "missing_comparison_content") ? "yes" : "no"}; decision-stage cluster: ${hasIntentCluster(intentClusters, "reinforce_decision_stage_content") ? "yes" : "no"}; comparison frame: ${comparisonFrame ?? "not available"}.`,
      suggestedContentPurpose: "Help users evaluate alternatives and why this listing is preferred.",
      suggestedTargetSurface: "comparison",
      suggestedAngle: comparisonFrame ?? `Best fit scenarios for ${support.listing.title} vs nearby alternatives in ${localModifier}`,
      missingSupportEntities: missingSupportEntities.length ? missingSupportEntities.slice(0, 4) : undefined,
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
    const targetIntent = faqIntent ?? primaryIntent;
    const priority: BlogReinforcementPlanPriority = hasGap(gaps, "missing_faq_support_coverage") ? "high" : "medium";
    upsertPlanItem(plan, {
      id: "publish_faq_support_post",
      title: "Publish an FAQ support page for pre-selection friction",
      priority,
      recommendationType: "faq_support_page",
      targetIntent,
      whyItMatters: "FAQ support closes practical decision blockers and reinforces trust before selection.",
      reinforcesListingId: support.listing.id,
      expectedSelectionImpact: priorityImpact(priority),
      suggestedInternalLinkPattern: defaultLinkPattern({ support, surface: "faq" }),
      rankingContext,
      rationale: "FAQ coverage reduces decision friction and captures practical selection intent.",
      evidenceSummary: `FAQ/support gap: ${hasGap(gaps, "missing_faq_support_coverage") ? "yes" : "no"}; inbound support links: ${support.summary.inboundLinkedSupportCount}; missing entities: ${missingSupportEntities.slice(0, 3).join(", ") || "none"}.`,
      suggestedContentPurpose: "Answer top pre-selection questions and route readers to the listing.",
      suggestedTargetSurface: "faq",
      suggestedAngle: `Top questions to answer before booking ${support.listing.title}`,
      missingSupportEntities: missingSupportEntities.length ? missingSupportEntities.slice(0, 5) : undefined,
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
    const targetIntent = localIntent ?? primaryIntent;
    const priority: BlogReinforcementPlanPriority = "medium";
    upsertPlanItem(plan, {
      id: "publish_local_context_guide",
      title: "Publish a local guide tied to listing selection intent",
      priority,
      recommendationType: "local_guide",
      targetIntent,
      whyItMatters: "Location-aware support helps users decide if this listing is the right local fit.",
      reinforcesListingId: support.listing.id,
      expectedSelectionImpact: priorityImpact(priority),
      suggestedInternalLinkPattern: defaultLinkPattern({ support, surface: "local_guide" }),
      rankingContext,
      rationale: "Local context signals help users confirm this listing matches their trip intent.",
      evidenceSummary:
        gaps.items.find((item) => item.type === "weak_local_context_support")?.evidenceSummary ??
        `Local context reinforcement signal detected; local modifier: ${localModifier}.`,
      suggestedContentPurpose: "Connect listing value to local context and nearby decision factors.",
      suggestedTargetSurface: "local_guide",
      suggestedAngle: `${support.listing.title} in ${localModifier}: when this location is the right fit`,
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
    const priority: BlogReinforcementPlanPriority = support.summary.mentionWithoutLinkCount > 0 ? "high" : "medium";
    upsertPlanItem(plan, {
      id: "publish_reciprocal_support_post",
      title: "Publish a reinforcement blog post with reciprocal linking",
      priority,
      recommendationType: "blog_idea",
      targetIntent: primaryIntent,
      whyItMatters: "Reciprocal links and explicit listing references increase trust transfer and selection proof depth.",
      reinforcesListingId: support.listing.id,
      expectedSelectionImpact: priorityImpact(priority),
      suggestedInternalLinkPattern: defaultLinkPattern({ support, surface: "blog" }),
      rankingContext,
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
    const priority: BlogReinforcementPlanPriority = "medium";
    upsertPlanItem(plan, {
      id: "publish_cluster_hub_support_page",
      title: "Publish a category reinforcement hub page",
      priority,
      recommendationType: "category_reinforcement_asset",
      targetIntent: primaryIntent,
      whyItMatters: "A category hub consolidates support assets and keeps selection-stage navigation structured.",
      reinforcesListingId: support.listing.id,
      expectedSelectionImpact: priorityImpact(priority),
      suggestedInternalLinkPattern: defaultLinkPattern({ support, surface: "cluster_hub" }),
      rankingContext,
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
    const priority: BlogReinforcementPlanPriority = "low";
    upsertPlanItem(plan, {
      id: "refresh_anchor_intent_post",
      title: "Publish or refresh an anchor-intent reinforcement post",
      priority,
      recommendationType: "blog_idea",
      targetIntent: primaryIntent,
      whyItMatters: "Intent-specific anchors strengthen semantic alignment between support pages and listing selection intent.",
      reinforcesListingId: support.listing.id,
      expectedSelectionImpact: priorityImpact(priority),
      suggestedInternalLinkPattern: defaultLinkPattern({ support, surface: "support_page" }),
      rankingContext,
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
