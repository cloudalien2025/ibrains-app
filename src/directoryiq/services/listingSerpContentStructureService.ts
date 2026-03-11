import type { SerpCacheEntry } from "@/lib/directoryiq/types";
import type { BlogReinforcementPlanItemId, ListingBlogReinforcementPlanModel } from "@/src/directoryiq/services/listingBlogReinforcementPlannerService";
import type { FlywheelRecommendationType, ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { AuthorityGapType, ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { RecommendedActionType, ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type {
  ListingSelectionIntentClustersModel,
  SelectionIntentClusterId,
} from "@/src/directoryiq/services/listingSelectionIntentClustersService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

export type ContentStructurePriority = "high" | "medium" | "low";

export type ContentStructureStatus =
  | "structure_recommendations_identified"
  | "no_major_structure_recommendations_identified";

export type ContentStructureType =
  | "comparison_matrix"
  | "faq_cluster"
  | "local_context_block"
  | "reciprocal_authority_block"
  | "cluster_hub_layout"
  | "anchor_intent_module";

export type ContentStructureItemId =
  | "structure_decision_comparison"
  | "structure_faq_framework"
  | "structure_local_context"
  | "structure_reciprocal_links"
  | "structure_cluster_hub"
  | "structure_anchor_intent";

export type SerpPatternSummary = {
  readySlotCount: number;
  totalSlotCount: number;
  commonHeadings: string[];
  commonQuestions: string[];
  targetLengthBand?: {
    min: number;
    median: number;
    max: number;
  };
};

export type ContentStructureItem = {
  id: ContentStructureItemId;
  key: ContentStructureItemId;
  title: string;
  priority: ContentStructurePriority;
  rationale: string;
  evidenceSummary: string;
  suggestedStructureType: ContentStructureType;
  suggestedSections: string[];
  suggestedComponents: string[];
  linkedReinforcementItemIds?: BlogReinforcementPlanItemId[];
  linkedIntentClusterIds?: SelectionIntentClusterId[];
  linkedActionKeys?: RecommendedActionType[];
  linkedGapTypes?: AuthorityGapType[];
  linkedFlywheelTypes?: FlywheelRecommendationType[];
  serpPatternSummary?: {
    commonHeadings: string[];
    commonQuestions: string[];
  };
};

export type ListingSerpContentStructureModel = {
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
    dataStatus: ContentStructureStatus;
    serpPatternStatus: "patterns_available" | "patterns_unavailable";
  };
  serpPatternSummary?: SerpPatternSummary;
  items: ContentStructureItem[];
};

type BuildInput = {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  actions: ListingRecommendedActionsModel;
  flywheel: ListingFlywheelLinksModel;
  intentClusters: ListingSelectionIntentClustersModel;
  reinforcementPlan: ListingBlogReinforcementPlanModel;
  serpCacheEntries: SerpCacheEntry[];
  evaluatedAt?: string;
};

type RecommendationDraft = Omit<ContentStructureItem, "id" | "key" | "priority"> & {
  id: ContentStructureItemId;
  score: number;
};

const PRIORITY_ORDER: Record<ContentStructurePriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const ITEM_ORDER: Record<ContentStructureItemId, number> = {
  structure_decision_comparison: 0,
  structure_faq_framework: 1,
  structure_local_context: 2,
  structure_reciprocal_links: 3,
  structure_cluster_hub: 4,
  structure_anchor_intent: 5,
};

const toPriority = (score: number): ContentStructurePriority => {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
};

function hasIntentCluster(model: ListingSelectionIntentClustersModel, id: SelectionIntentClusterId): boolean {
  return model.items.some((item) => item.id === id);
}

function hasPlanItem(model: ListingBlogReinforcementPlanModel, id: BlogReinforcementPlanItemId): boolean {
  return model.items.some((item) => item.id === id);
}

function hasGap(model: ListingAuthorityGapsModel, type: AuthorityGapType): boolean {
  return model.items.some((item) => item.type === type);
}

function hasAction(model: ListingRecommendedActionsModel, key: RecommendedActionType): boolean {
  return model.items.some((item) => item.key === key);
}

function aggregateSerpPatternSummary(entries: SerpCacheEntry[]): SerpPatternSummary | undefined {
  const totalSlotCount = entries.length;
  const readyEntries = entries
    .filter((entry) => entry.status === "READY" && entry.consensus_outline)
    .sort((left, right) => left.slot_id.localeCompare(right.slot_id));

  if (!readyEntries.length) return undefined;

  const headingCounts = new Map<string, number>();
  const questionCounts = new Map<string, number>();
  const mins: number[] = [];
  const medians: number[] = [];
  const maxes: number[] = [];

  for (const entry of readyEntries) {
    const outline = entry.consensus_outline;
    if (!outline) continue;

    for (const section of outline.h2Sections) {
      headingCounts.set(section.heading, (headingCounts.get(section.heading) ?? 0) + section.score);
    }

    for (const question of outline.mustCoverQuestions) {
      questionCounts.set(question, (questionCounts.get(question) ?? 0) + 1);
    }

    mins.push(outline.targetLengthBand.min);
    medians.push(outline.targetLengthBand.median);
    maxes.push(outline.targetLengthBand.max);
  }

  const sortCounts = (map: Map<string, number>): string[] =>
    Array.from(map.entries())
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 6)
      .map(([key]) => key);

  const average = (values: number[]): number =>
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

  return {
    readySlotCount: readyEntries.length,
    totalSlotCount,
    commonHeadings: sortCounts(headingCounts),
    commonQuestions: sortCounts(questionCounts),
    targetLengthBand:
      mins.length && medians.length && maxes.length
        ? {
            min: average(mins),
            median: average(medians),
            max: average(maxes),
          }
        : undefined,
  };
}

function trimOptionalArrays(item: ContentStructureItem): ContentStructureItem {
  return {
    ...item,
    linkedReinforcementItemIds: item.linkedReinforcementItemIds?.length ? item.linkedReinforcementItemIds : undefined,
    linkedIntentClusterIds: item.linkedIntentClusterIds?.length ? item.linkedIntentClusterIds : undefined,
    linkedActionKeys: item.linkedActionKeys?.length ? item.linkedActionKeys : undefined,
    linkedGapTypes: item.linkedGapTypes?.length ? item.linkedGapTypes : undefined,
    linkedFlywheelTypes: item.linkedFlywheelTypes?.length ? item.linkedFlywheelTypes : undefined,
  };
}

export function buildListingSerpContentStructure(input: BuildInput): ListingSerpContentStructureModel {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const { support, gaps, actions, intentClusters, reinforcementPlan, flywheel, serpCacheEntries } = input;
  const serpPatternSummary = aggregateSerpPatternSummary(serpCacheEntries);

  const drafts: RecommendationDraft[] = [];

  if (
    hasPlanItem(reinforcementPlan, "publish_comparison_decision_post") ||
    hasIntentCluster(intentClusters, "reinforce_decision_stage_content") ||
    hasGap(gaps, "missing_comparison_content")
  ) {
    drafts.push({
      id: "structure_decision_comparison",
      title: "Decision comparison structure",
      score:
        (hasPlanItem(reinforcementPlan, "publish_comparison_decision_post") ? 4 : 0) +
        (hasIntentCluster(intentClusters, "reinforce_decision_stage_content") ? 2 : 0) +
        (hasGap(gaps, "missing_comparison_content") ? 2 : 0),
      rationale: "SERP and reinforcement signals indicate users need explicit side-by-side decision framing.",
      evidenceSummary: `Comparison gap: ${hasGap(gaps, "missing_comparison_content") ? "yes" : "no"}; decision cluster: ${hasIntentCluster(intentClusters, "reinforce_decision_stage_content") ? "yes" : "no"}; reinforcement item: ${hasPlanItem(reinforcementPlan, "publish_comparison_decision_post") ? "present" : "absent"}.`,
      suggestedStructureType: "comparison_matrix",
      suggestedSections: [
        "Who this listing is best for",
        "Comparison criteria matrix",
        "When to choose alternatives",
      ],
      suggestedComponents: ["comparison-table", "decision-checklist", "cta-strip"],
      linkedReinforcementItemIds: ["publish_comparison_decision_post"],
      linkedIntentClusterIds: ["reinforce_decision_stage_content"],
      linkedActionKeys: ["create_comparison_support_content"],
      linkedGapTypes: ["missing_comparison_content"],
      serpPatternSummary: {
        commonHeadings: serpPatternSummary?.commonHeadings.slice(0, 3) ?? [],
        commonQuestions: serpPatternSummary?.commonQuestions.slice(0, 2) ?? [],
      },
    });
  }

  if (
    hasPlanItem(reinforcementPlan, "publish_faq_support_post") ||
    hasGap(gaps, "missing_faq_support_coverage") ||
    hasAction(actions, "generate_reinforcement_post")
  ) {
    drafts.push({
      id: "structure_faq_framework",
      title: "FAQ reinforcement framework",
      score:
        (hasPlanItem(reinforcementPlan, "publish_faq_support_post") ? 3 : 0) +
        (hasGap(gaps, "missing_faq_support_coverage") ? 3 : 0) +
        (hasAction(actions, "generate_reinforcement_post") ? 1 : 0),
      rationale: "Coverage patterns show selection friction is reduced by direct FAQ blocks tied to listing decisions.",
      evidenceSummary: `FAQ gap: ${hasGap(gaps, "missing_faq_support_coverage") ? "yes" : "no"}; reinforcement FAQ item: ${hasPlanItem(reinforcementPlan, "publish_faq_support_post") ? "present" : "absent"}.`,
      suggestedStructureType: "faq_cluster",
      suggestedSections: ["Top selection questions", "Eligibility and fit", "Booking expectations"],
      suggestedComponents: ["accordion-faq", "quick-answer-cards"],
      linkedReinforcementItemIds: ["publish_faq_support_post"],
      linkedIntentClusterIds: ["reinforce_decision_stage_content"],
      linkedActionKeys: ["generate_reinforcement_post"],
      linkedGapTypes: ["missing_faq_support_coverage"],
      serpPatternSummary: {
        commonHeadings: serpPatternSummary?.commonHeadings.slice(0, 2) ?? [],
        commonQuestions: serpPatternSummary?.commonQuestions.slice(0, 4) ?? [],
      },
    });
  }

  if (
    hasPlanItem(reinforcementPlan, "publish_local_context_guide") ||
    hasIntentCluster(intentClusters, "strengthen_local_selection_confidence") ||
    hasGap(gaps, "weak_local_context_support")
  ) {
    drafts.push({
      id: "structure_local_context",
      title: "Local context credibility block",
      score:
        (hasPlanItem(reinforcementPlan, "publish_local_context_guide") ? 2 : 0) +
        (hasIntentCluster(intentClusters, "strengthen_local_selection_confidence") ? 2 : 0) +
        (hasGap(gaps, "weak_local_context_support") ? 2 : 0),
      rationale: "Selection confidence improves when the listing page shows localized context and practical fit guidance.",
      evidenceSummary: `Local-context gap: ${hasGap(gaps, "weak_local_context_support") ? "yes" : "no"}; connected support pages: ${support.summary.connectedSupportPageCount}.`,
      suggestedStructureType: "local_context_block",
      suggestedSections: ["Local area fit guidance", "Timing and logistics", "Context-specific recommendations"],
      suggestedComponents: ["local-context-highlights", "map-context-panel"],
      linkedReinforcementItemIds: ["publish_local_context_guide"],
      linkedIntentClusterIds: ["strengthen_local_selection_confidence"],
      linkedActionKeys: ["add_local_context_support"],
      linkedGapTypes: ["weak_local_context_support"],
    });
  }

  if (
    hasPlanItem(reinforcementPlan, "publish_reciprocal_support_post") ||
    hasIntentCluster(intentClusters, "repair_bidirectional_flywheel_links") ||
    hasIntentCluster(intentClusters, "close_unlinked_support_mentions") ||
    support.summary.outboundSupportLinkCount === 0
  ) {
    drafts.push({
      id: "structure_reciprocal_links",
      title: "Reciprocal authority support module",
      score:
        (hasPlanItem(reinforcementPlan, "publish_reciprocal_support_post") ? 3 : 0) +
        (hasIntentCluster(intentClusters, "repair_bidirectional_flywheel_links") ? 2 : 0) +
        (support.summary.outboundSupportLinkCount === 0 ? 2 : 0) +
        (support.summary.mentionWithoutLinkCount > 0 ? 1 : 0),
      rationale: "SERP-informed authority structures consistently include internal pathways between listing and support evidence.",
      evidenceSummary: `Outbound support links: ${support.summary.outboundSupportLinkCount}; mentions without links: ${support.summary.mentionWithoutLinkCount}; reciprocal opportunities: ${flywheel.items.filter((item) => item.type === "missing_reciprocal_link" || item.type === "listing_should_link_back_to_support_post").length}.`,
      suggestedStructureType: "reciprocal_authority_block",
      suggestedSections: ["Related support resources", "Proof and references", "Next-step links"],
      suggestedComponents: ["support-links-rail", "evidence-reference-list"],
      linkedReinforcementItemIds: ["publish_reciprocal_support_post"],
      linkedIntentClusterIds: ["repair_bidirectional_flywheel_links", "close_unlinked_support_mentions"],
      linkedActionKeys: ["add_flywheel_links"],
      linkedGapTypes: ["mentions_without_links", "no_listing_to_support_links"],
      linkedFlywheelTypes: ["missing_reciprocal_link", "listing_should_link_back_to_support_post", "blog_posts_should_link_to_listing"],
    });
  }

  if (
    hasPlanItem(reinforcementPlan, "publish_cluster_hub_support_page") ||
    hasAction(actions, "generate_reinforcement_cluster")
  ) {
    drafts.push({
      id: "structure_cluster_hub",
      title: "Cluster hub layout",
      score:
        (hasPlanItem(reinforcementPlan, "publish_cluster_hub_support_page") ? 3 : 0) +
        (hasAction(actions, "generate_reinforcement_cluster") ? 2 : 0) +
        (support.summary.connectedSupportPageCount === 0 ? 1 : 0),
      rationale: "A cluster hub structure organizes reinforcement assets and mirrors top SERP content ecosystems.",
      evidenceSummary: `Cluster hub reinforcement item: ${hasPlanItem(reinforcementPlan, "publish_cluster_hub_support_page") ? "present" : "absent"}; connected support pages: ${support.summary.connectedSupportPageCount}.`,
      suggestedStructureType: "cluster_hub_layout",
      suggestedSections: ["Cluster overview", "Decision assets", "Support path map"],
      suggestedComponents: ["cluster-hub-nav", "resource-grid"],
      linkedReinforcementItemIds: ["publish_cluster_hub_support_page"],
      linkedIntentClusterIds: ["reinforce_decision_stage_content"],
      linkedActionKeys: ["generate_reinforcement_cluster"],
      linkedFlywheelTypes: ["category_or_guide_page_should_join_cluster"],
    });
  }

  if (
    hasPlanItem(reinforcementPlan, "refresh_anchor_intent_post") ||
    hasIntentCluster(intentClusters, "improve_anchor_intent_specificity") ||
    hasGap(gaps, "weak_anchor_text")
  ) {
    drafts.push({
      id: "structure_anchor_intent",
      title: "Anchor-intent specificity module",
      score:
        (hasPlanItem(reinforcementPlan, "refresh_anchor_intent_post") ? 1 : 0) +
        (hasIntentCluster(intentClusters, "improve_anchor_intent_specificity") ? 2 : 0) +
        (hasGap(gaps, "weak_anchor_text") ? 2 : 0),
      rationale: "Intent-specific anchor and heading language helps searchers map content sections to their exact need.",
      evidenceSummary: `Weak anchor gap: ${hasGap(gaps, "weak_anchor_text") ? "yes" : "no"}; anchor flywheel opportunities: ${flywheel.items.filter((item) => item.type === "strengthen_anchor_text").length}.`,
      suggestedStructureType: "anchor_intent_module",
      suggestedSections: ["Intent-driven headings", "Service-specific scenarios", "Anchor-linked quick jumps"],
      suggestedComponents: ["toc-anchor-jumps", "intent-scenario-cards"],
      linkedReinforcementItemIds: ["refresh_anchor_intent_post"],
      linkedIntentClusterIds: ["improve_anchor_intent_specificity"],
      linkedActionKeys: ["strengthen_anchor_text"],
      linkedGapTypes: ["weak_anchor_text"],
      linkedFlywheelTypes: ["strengthen_anchor_text"],
    });
  }

  const items = drafts
    .filter((item) => item.score >= 3)
    .map((item) =>
      trimOptionalArrays({
        ...item,
        key: item.id,
        priority: toPriority(item.score),
      })
    )
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
      totalRecommendations: items.length,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      evaluatedAt,
      dataStatus: items.length ? "structure_recommendations_identified" : "no_major_structure_recommendations_identified",
      serpPatternStatus: serpPatternSummary ? "patterns_available" : "patterns_unavailable",
    },
    serpPatternSummary,
    items,
  };
}
