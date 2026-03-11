import type { ContentStructureItemId, ListingSerpContentStructureModel } from "@/src/directoryiq/services/listingSerpContentStructureService";
import type { BlogReinforcementPlanItemId, ListingBlogReinforcementPlanModel } from "@/src/directoryiq/services/listingBlogReinforcementPlannerService";
import type { FlywheelRecommendationType, ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { AuthorityGapType, ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { RecommendedActionPriority, RecommendedActionType, ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type {
  ListingSelectionIntentClustersModel,
  SelectionIntentClusterId,
} from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

export type MultiActionPriority = "high" | "medium" | "low";

export type MultiActionStatus = "available" | "blocked" | "not_recommended";

export type MultiActionDataStatus = "upgrade_actions_available" | "no_major_upgrade_actions_available";

export type MultiActionKey =
  | "optimize_listing_description"
  | "repair_flywheel_links"
  | "publish_reinforcement_post"
  | "build_reinforcement_cluster"
  | "publish_local_context_support"
  | "strengthen_anchor_intent"
  | "implement_serp_structure_recommendations";

export type MultiActionTargetSurface = "listing" | "blog" | "support_page" | "cluster";

export type MultiActionItem = {
  key: MultiActionKey;
  title: string;
  priority: MultiActionPriority;
  status: MultiActionStatus;
  rationale: string;
  evidenceSummary: string;
  targetSurface: MultiActionTargetSurface;
  linkedGapTypes?: AuthorityGapType[];
  linkedRecommendedActionKeys?: RecommendedActionType[];
  linkedIntentClusterIds?: SelectionIntentClusterId[];
  linkedReinforcementItemIds?: BlogReinforcementPlanItemId[];
  linkedStructureItemIds?: ContentStructureItemId[];
  linkedFlywheelTypes?: FlywheelRecommendationType[];
  blockingReasons?: string[];
  previewCapability?: {
    supported: boolean;
    generateEndpoint?: string;
    previewEndpoint?: string;
    pushEndpoint?: string;
    requiresApprovalToken?: boolean;
    requiresBdForPush?: boolean;
    note?: string;
  };
};

export type ListingMultiActionUpgradeModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: {
    totalActions: number;
    availableCount: number;
    blockedCount: number;
    notRecommendedCount: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    evaluatedAt: string;
    dataStatus: MultiActionDataStatus;
  };
  items: MultiActionItem[];
};

const PRIORITY_ORDER: Record<MultiActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const STATUS_ORDER: Record<MultiActionStatus, number> = {
  available: 0,
  blocked: 1,
  not_recommended: 2,
};

const ACTION_ORDER: Record<MultiActionKey, number> = {
  optimize_listing_description: 0,
  repair_flywheel_links: 1,
  publish_reinforcement_post: 2,
  build_reinforcement_cluster: 3,
  publish_local_context_support: 4,
  strengthen_anchor_intent: 5,
  implement_serp_structure_recommendations: 6,
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function hasRecommendedAction(model: ListingRecommendedActionsModel, key: RecommendedActionType): boolean {
  return model.items.some((item) => item.key === key);
}

function hasIntentCluster(model: ListingSelectionIntentClustersModel, id: SelectionIntentClusterId): boolean {
  return model.items.some((item) => item.id === id);
}

function hasPlanItem(model: ListingBlogReinforcementPlanModel, id: BlogReinforcementPlanItemId): boolean {
  return model.items.some((item) => item.id === id);
}

function hasStructureItem(model: ListingSerpContentStructureModel, id: ContentStructureItemId): boolean {
  return model.items.some((item) => item.id === id);
}

function hasGap(model: ListingAuthorityGapsModel, type: AuthorityGapType): boolean {
  return model.items.some((item) => item.type === type);
}

function recommendedPriority(model: ListingRecommendedActionsModel, key: RecommendedActionType, fallback: MultiActionPriority): MultiActionPriority {
  const match = model.items.find((item) => item.key === key);
  if (!match) return fallback;
  const map: Record<RecommendedActionPriority, MultiActionPriority> = {
    high: "high",
    medium: "medium",
    low: "low",
  };
  return map[match.priority];
}

function compactItem(item: MultiActionItem): MultiActionItem {
  return {
    ...item,
    linkedGapTypes: item.linkedGapTypes?.length ? unique(item.linkedGapTypes) : undefined,
    linkedRecommendedActionKeys: item.linkedRecommendedActionKeys?.length ? unique(item.linkedRecommendedActionKeys) : undefined,
    linkedIntentClusterIds: item.linkedIntentClusterIds?.length ? unique(item.linkedIntentClusterIds) : undefined,
    linkedReinforcementItemIds: item.linkedReinforcementItemIds?.length ? unique(item.linkedReinforcementItemIds) : undefined,
    linkedStructureItemIds: item.linkedStructureItemIds?.length ? unique(item.linkedStructureItemIds) : undefined,
    linkedFlywheelTypes: item.linkedFlywheelTypes?.length ? unique(item.linkedFlywheelTypes) : undefined,
    blockingReasons: item.blockingReasons?.length ? unique(item.blockingReasons) : undefined,
  };
}

export function buildListingMultiActionUpgrade(input: {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  actions: ListingRecommendedActionsModel;
  flywheel: ListingFlywheelLinksModel;
  intentClusters: ListingSelectionIntentClustersModel;
  reinforcementPlan: ListingBlogReinforcementPlanModel;
  contentStructure: ListingSerpContentStructureModel;
  integrations: {
    openaiConfigured: boolean;
    bdConfigured: boolean;
  };
  evaluatedAt?: string;
}): ListingMultiActionUpgradeModel {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const { support, gaps, actions, flywheel, intentClusters, reinforcementPlan, contentStructure, integrations } = input;

  const items: MultiActionItem[] = [];

  const listingExecutionRecommended =
    hasRecommendedAction(actions, "optimize_listing") ||
    contentStructure.summary.highPriorityCount > 0 ||
    gaps.summary.totalGaps > 0;
  const listingExecutionBlockedReasons: string[] = [];
  if (!integrations.openaiConfigured) listingExecutionBlockedReasons.push("OpenAI connection is required for generation.");

  items.push(
    compactItem({
      key: "optimize_listing_description",
      title: "Generate and review listing description upgrade",
      priority: recommendedPriority(actions, "optimize_listing", "high"),
      status: listingExecutionRecommended
        ? listingExecutionBlockedReasons.length
          ? "blocked"
          : "available"
        : "not_recommended",
      rationale: "Keep listing copy optimization as the execution entrypoint, informed by current diagnostics and planning outputs.",
      evidenceSummary: `Authority gaps: ${gaps.summary.totalGaps}; content-structure recommendations: ${contentStructure.summary.totalRecommendations}; inbound support links: ${support.summary.inboundLinkedSupportCount}.`,
      targetSurface: "listing",
      linkedGapTypes: gaps.items.slice(0, 3).map((item) => item.type),
      linkedRecommendedActionKeys: ["optimize_listing"],
      linkedStructureItemIds: contentStructure.items.slice(0, 2).map((item) => item.id),
      blockingReasons: listingExecutionBlockedReasons,
      previewCapability: {
        supported: true,
        generateEndpoint: "/api/directoryiq/listings/{listingId}/upgrade/generate",
        previewEndpoint: "/api/directoryiq/listings/{listingId}/upgrade/preview",
        pushEndpoint: "/api/directoryiq/listings/{listingId}/upgrade/push",
        requiresApprovalToken: true,
        requiresBdForPush: true,
      },
    })
  );

  const flywheelRecommended =
    hasRecommendedAction(actions, "add_flywheel_links") ||
    hasIntentCluster(intentClusters, "repair_bidirectional_flywheel_links") ||
    support.summary.outboundSupportLinkCount === 0;

  items.push(
    compactItem({
      key: "repair_flywheel_links",
      title: "Repair listing-to-support flywheel links",
      priority: recommendedPriority(actions, "add_flywheel_links", "high"),
      status: flywheelRecommended ? "available" : "not_recommended",
      rationale: "Bidirectional listing/support links should be established before scaling reinforcement content.",
      evidenceSummary: `Outbound support links: ${support.summary.outboundSupportLinkCount}; reciprocal flywheel issues: ${flywheel.items.filter((item) => item.type === "missing_reciprocal_link" || item.type === "listing_should_link_back_to_support_post").length}.`,
      targetSurface: "listing",
      linkedGapTypes: ["mentions_without_links", "no_listing_to_support_links"],
      linkedRecommendedActionKeys: ["add_flywheel_links"],
      linkedIntentClusterIds: ["repair_bidirectional_flywheel_links", "close_unlinked_support_mentions"],
      linkedFlywheelTypes: ["missing_reciprocal_link", "listing_should_link_back_to_support_post", "blog_posts_should_link_to_listing"],
      previewCapability: {
        supported: false,
        note: "No dedicated preview route yet; execute via manual link/module updates.",
      },
    })
  );

  const reinforcementPostRecommended =
    hasRecommendedAction(actions, "generate_reinforcement_post") ||
    hasPlanItem(reinforcementPlan, "publish_faq_support_post") ||
    hasPlanItem(reinforcementPlan, "publish_reciprocal_support_post");
  const reinforcementPostBlockedReasons: string[] = [];
  if (!integrations.openaiConfigured) reinforcementPostBlockedReasons.push("OpenAI connection is required for generation actions.");

  items.push(
    compactItem({
      key: "publish_reinforcement_post",
      title: "Generate one reinforcement post",
      priority: recommendedPriority(actions, "generate_reinforcement_post", "medium"),
      status: reinforcementPostRecommended
        ? reinforcementPostBlockedReasons.length
          ? "blocked"
          : "available"
        : "not_recommended",
      rationale: "A targeted reinforcement post can close immediate authority/support gaps tied to decision intent.",
      evidenceSummary: `Reinforcement plan items: ${reinforcementPlan.summary.totalPlanItems}; FAQ gap: ${hasGap(gaps, "missing_faq_support_coverage") ? "yes" : "no"}.`,
      targetSurface: "blog",
      linkedGapTypes: ["missing_faq_support_coverage", "mentions_without_links"],
      linkedRecommendedActionKeys: ["generate_reinforcement_post"],
      linkedReinforcementItemIds: ["publish_faq_support_post", "publish_reciprocal_support_post"],
      blockingReasons: reinforcementPostBlockedReasons,
      previewCapability: {
        supported: false,
        note: "Execution remains planning-only in Wave 2 Task 8.",
      },
    })
  );

  const clusterRecommended =
    hasRecommendedAction(actions, "generate_reinforcement_cluster") ||
    hasPlanItem(reinforcementPlan, "publish_cluster_hub_support_page") ||
    hasStructureItem(contentStructure, "structure_cluster_hub");
  const clusterBlockedReasons: string[] = [];
  if (!integrations.openaiConfigured) clusterBlockedReasons.push("OpenAI connection is required for generation actions.");

  items.push(
    compactItem({
      key: "build_reinforcement_cluster",
      title: "Build reinforcement cluster around listing",
      priority: recommendedPriority(actions, "generate_reinforcement_cluster", "medium"),
      status: clusterRecommended
        ? clusterBlockedReasons.length
          ? "blocked"
          : "available"
        : "not_recommended",
      rationale: "Cluster-level reinforcement coordinates comparison/FAQ/local assets into one authority pathway.",
      evidenceSummary: `Cluster opportunities: ${flywheel.items.filter((item) => item.type === "category_or_guide_page_should_join_cluster").length}; structure-cluster recommendations: ${contentStructure.items.filter((item) => item.id === "structure_cluster_hub").length}.`,
      targetSurface: "cluster",
      linkedRecommendedActionKeys: ["generate_reinforcement_cluster"],
      linkedReinforcementItemIds: ["publish_cluster_hub_support_page"],
      linkedStructureItemIds: ["structure_cluster_hub"],
      linkedFlywheelTypes: ["category_or_guide_page_should_join_cluster"],
      blockingReasons: clusterBlockedReasons,
      previewCapability: {
        supported: false,
        note: "Execution remains planning-only in Wave 2 Task 8.",
      },
    })
  );

  const localContextRecommended =
    hasRecommendedAction(actions, "add_local_context_support") ||
    hasPlanItem(reinforcementPlan, "publish_local_context_guide") ||
    hasStructureItem(contentStructure, "structure_local_context");

  items.push(
    compactItem({
      key: "publish_local_context_support",
      title: "Add local-context support coverage",
      priority: recommendedPriority(actions, "add_local_context_support", "low"),
      status: localContextRecommended ? "available" : "not_recommended",
      rationale: "Local-context reinforcement improves selection confidence for location-sensitive intent.",
      evidenceSummary: `Local-context gap: ${hasGap(gaps, "weak_local_context_support") ? "yes" : "no"}; local plan item: ${hasPlanItem(reinforcementPlan, "publish_local_context_guide") ? "present" : "absent"}.`,
      targetSurface: "support_page",
      linkedGapTypes: ["weak_local_context_support"],
      linkedRecommendedActionKeys: ["add_local_context_support"],
      linkedReinforcementItemIds: ["publish_local_context_guide"],
      linkedStructureItemIds: ["structure_local_context"],
      previewCapability: {
        supported: false,
        note: "No dedicated preview route yet.",
      },
    })
  );

  const anchorRecommended =
    hasRecommendedAction(actions, "strengthen_anchor_text") ||
    hasPlanItem(reinforcementPlan, "refresh_anchor_intent_post") ||
    hasStructureItem(contentStructure, "structure_anchor_intent");

  items.push(
    compactItem({
      key: "strengthen_anchor_intent",
      title: "Strengthen anchor-intent specificity",
      priority: recommendedPriority(actions, "strengthen_anchor_text", "low"),
      status: anchorRecommended ? "available" : "not_recommended",
      rationale: "Anchor-intent updates improve semantic alignment between support content and listing selection queries.",
      evidenceSummary: `Weak anchor gap: ${hasGap(gaps, "weak_anchor_text") ? "yes" : "no"}; anchor flywheel signals: ${flywheel.items.filter((item) => item.type === "strengthen_anchor_text").length}.`,
      targetSurface: "blog",
      linkedGapTypes: ["weak_anchor_text"],
      linkedRecommendedActionKeys: ["strengthen_anchor_text"],
      linkedIntentClusterIds: ["improve_anchor_intent_specificity"],
      linkedReinforcementItemIds: ["refresh_anchor_intent_post"],
      linkedStructureItemIds: ["structure_anchor_intent"],
      linkedFlywheelTypes: ["strengthen_anchor_text"],
      previewCapability: {
        supported: false,
        note: "No dedicated preview route yet.",
      },
    })
  );

  const structureRecommended = contentStructure.summary.totalRecommendations > 0;
  items.push(
    compactItem({
      key: "implement_serp_structure_recommendations",
      title: "Apply SERP-informed content structure plan",
      priority: contentStructure.summary.highPriorityCount > 0 ? "high" : contentStructure.summary.mediumPriorityCount > 0 ? "medium" : "low",
      status: structureRecommended ? "available" : "not_recommended",
      rationale: "Use the canonical SERP-informed structure plan to shape section/component layout before deeper generation workflows.",
      evidenceSummary: `SERP-structure recommendations: ${contentStructure.summary.totalRecommendations}; SERP pattern status: ${contentStructure.summary.serpPatternStatus}.`,
      targetSurface: "listing",
      linkedStructureItemIds: contentStructure.items.slice(0, 4).map((item) => item.id),
      previewCapability: {
        supported: false,
        note: "This action applies structural guidance from the planning layer.",
      },
    })
  );

  const sortedItems = items.sort((left, right) => {
    const statusDelta = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusDelta !== 0) return statusDelta;

    const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDelta !== 0) return priorityDelta;

    return ACTION_ORDER[left.key] - ACTION_ORDER[right.key];
  });

  const availableCount = sortedItems.filter((item) => item.status === "available").length;
  const blockedCount = sortedItems.filter((item) => item.status === "blocked").length;
  const notRecommendedCount = sortedItems.filter((item) => item.status === "not_recommended").length;
  const highPriorityCount = sortedItems.filter((item) => item.priority === "high").length;
  const mediumPriorityCount = sortedItems.filter((item) => item.priority === "medium").length;
  const lowPriorityCount = sortedItems.filter((item) => item.priority === "low").length;

  return {
    listing: {
      id: support.listing.id,
      title: support.listing.title,
      canonicalUrl: support.listing.canonicalUrl ?? null,
      siteId: support.listing.siteId ?? null,
    },
    summary: {
      totalActions: sortedItems.length,
      availableCount,
      blockedCount,
      notRecommendedCount,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      evaluatedAt,
      dataStatus: availableCount > 0 || blockedCount > 0 ? "upgrade_actions_available" : "no_major_upgrade_actions_available",
    },
    items: sortedItems,
  };
}
