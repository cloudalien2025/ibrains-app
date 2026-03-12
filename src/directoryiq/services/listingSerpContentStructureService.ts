import type { SerpCacheEntry } from "@/lib/directoryiq/types";
import type { BlogReinforcementPlanItemId, ListingBlogReinforcementPlanModel } from "@/src/directoryiq/services/listingBlogReinforcementPlannerService";
import {
  resolveSerpBlueprintPatternSet,
  type SerpPatternSummary,
} from "@/src/directoryiq/services/contentStructureSerpPatternProvider";
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

export type ContentStructureItem = {
  id: ContentStructureItemId;
  key: ContentStructureItemId;
  title: string;
  priority: ContentStructurePriority;
  recommendedContentType: "comparison_page" | "faq_support_page" | "local_guide" | "support_post" | "cluster_hub";
  recommendedTitlePattern: string;
  suggestedH1: string;
  suggestedH2Structure: string[];
  comparisonCriteria: string[];
  faqThemes: string[];
  localModifiers: string[];
  entityCoverageTargets: string[];
  internalLinkOpportunities: string[];
  whyThisStructureMatters: string;
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
    serpPatternSource: "serp_cache" | "intent_fixture" | "none";
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

function toTitleCase(value: string): string {
  return value
    .split("_")
    .map((part) => (part.length ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function normalizePhrase(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildBlueprintCommon(input: {
  support: ListingSupportModel;
  intentClusters: ListingSelectionIntentClustersModel;
  fallbackTitlePattern: string;
  fallbackH2: string[];
  fallbackCriteria: string[];
  fallbackFaqThemes: string[];
  why: string;
  internalLinkPattern: string[];
  contentType: ContentStructureItem["recommendedContentType"];
}): Pick<
  ContentStructureItem,
  | "recommendedContentType"
  | "recommendedTitlePattern"
  | "suggestedH1"
  | "suggestedH2Structure"
  | "comparisonCriteria"
  | "faqThemes"
  | "localModifiers"
  | "entityCoverageTargets"
  | "internalLinkOpportunities"
  | "whyThisStructureMatters"
> {
  const intentProfile = input.intentClusters.intentProfile;
  const listingTitle = input.support.listing.title;
  const localModifiers = normalizePhrase(intentProfile?.localModifiers ?? []);
  const entityCoverageTargets = normalizePhrase([
    ...(intentProfile?.targetEntities ?? []),
    ...(intentProfile?.missingEntities ?? []).slice(0, 4),
  ]);
  const recommendedTitlePattern = input.fallbackTitlePattern
    .replace("[Listing]", listingTitle)
    .replace("[Listing Category]", listingTitle)
    .replace("[Local Modifier]", localModifiers[0] ?? "this area");
  const suggestedH1 = `${listingTitle}: ${toTitleCase(intentProfile?.primaryIntent ?? "selection guide")}`;

  return {
    recommendedContentType: input.contentType,
    recommendedTitlePattern,
    suggestedH1,
    suggestedH2Structure: normalizePhrase(input.fallbackH2),
    comparisonCriteria: normalizePhrase(input.fallbackCriteria),
    faqThemes: normalizePhrase(input.fallbackFaqThemes),
    localModifiers,
    entityCoverageTargets,
    internalLinkOpportunities: normalizePhrase(input.internalLinkPattern),
    whyThisStructureMatters: input.why,
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
  const patternSet = resolveSerpBlueprintPatternSet({
    intentProfile: intentClusters.intentProfile,
    serpCacheEntries,
  });
  const serpPatternSummary = patternSet.summary;

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
      ...buildBlueprintCommon({
        support,
        intentClusters,
        fallbackTitlePattern:
          patternSet.suggestedTitlePattern ?? "Best [Listing] in [Local Modifier]: Comparison and Selection Guide",
        fallbackH2: patternSet.suggestedH2Sections.length
          ? patternSet.suggestedH2Sections
          : ["Who this listing is best for", "Comparison criteria matrix", "When to choose alternatives"],
        fallbackCriteria: patternSet.comparisonCriteria.length
          ? patternSet.comparisonCriteria
          : ["fit", "proof depth", "local relevance", "overall value"],
        fallbackFaqThemes: patternSet.faqThemes.length
          ? patternSet.faqThemes
          : ["best fit scenarios", "pricing expectations", "booking and policy details"],
        internalLinkPattern: [
          `comparison-page -> ${support.listing.canonicalUrl ?? `listing:${support.listing.id}`}`,
          `listing -> decision support module -> comparison-page`,
        ],
        contentType: "comparison_page",
        why: "This blueprint aligns comparison-intent searchers with a clear structure that improves decision confidence.",
      }),
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
      ...buildBlueprintCommon({
        support,
        intentClusters,
        fallbackTitlePattern:
          patternSet.suggestedTitlePattern ?? "[Listing] FAQ Guide for [Local Modifier]: Selection Questions Answered",
        fallbackH2: patternSet.suggestedH2Sections.length
          ? patternSet.suggestedH2Sections
          : ["Top selection questions", "Eligibility and fit", "Booking expectations"],
        fallbackCriteria: patternSet.comparisonCriteria,
        fallbackFaqThemes: patternSet.faqThemes.length
          ? patternSet.faqThemes
          : ["pricing and eligibility", "timing and availability", "next steps before selection"],
        internalLinkPattern: [
          `faq-support-page -> ${support.listing.canonicalUrl ?? `listing:${support.listing.id}`}`,
          `listing -> support answers module -> faq-support-page`,
        ],
        contentType: "faq_support_page",
        why: "FAQ-first structure reduces uncertainty and captures practical questions that block selection.",
      }),
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
      ...buildBlueprintCommon({
        support,
        intentClusters,
        fallbackTitlePattern:
          patternSet.suggestedTitlePattern ?? "[Listing] in [Local Modifier]: Local Fit, Logistics, and Planning",
        fallbackH2: patternSet.suggestedH2Sections.length
          ? patternSet.suggestedH2Sections
          : ["Local area fit guidance", "Timing and logistics", "Context-specific recommendations"],
        fallbackCriteria: patternSet.comparisonCriteria,
        fallbackFaqThemes: patternSet.faqThemes,
        internalLinkPattern: [
          `local-guide -> ${support.listing.canonicalUrl ?? `listing:${support.listing.id}`}`,
          `listing -> local context module -> local-guide`,
        ],
        contentType: "local_guide",
        why: "Local modifiers and context blocks make the listing's location fit explicit for intent-matching users.",
      }),
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
      ...buildBlueprintCommon({
        support,
        intentClusters,
        fallbackTitlePattern:
          patternSet.suggestedTitlePattern ?? "[Listing] Proof and Support Resources: What to Review Before Choosing",
        fallbackH2: patternSet.suggestedH2Sections.length
          ? patternSet.suggestedH2Sections
          : ["Related support resources", "Proof and references", "Next-step links"],
        fallbackCriteria: patternSet.comparisonCriteria,
        fallbackFaqThemes: patternSet.faqThemes,
        internalLinkPattern: [
          `support-post -> ${support.listing.canonicalUrl ?? `listing:${support.listing.id}`}`,
          `listing -> proof resources module -> support-post`,
        ],
        contentType: "support_post",
        why: "Internal link pathways between support content and listing improve trust signal depth and selection evidence.",
      }),
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
      ...buildBlueprintCommon({
        support,
        intentClusters,
        fallbackTitlePattern:
          patternSet.suggestedTitlePattern ?? "[Listing] Decision Hub: Comparison, FAQ, and Local Guidance",
        fallbackH2: patternSet.suggestedH2Sections.length
          ? patternSet.suggestedH2Sections
          : ["Cluster overview", "Decision assets", "Support path map"],
        fallbackCriteria: patternSet.comparisonCriteria,
        fallbackFaqThemes: patternSet.faqThemes,
        internalLinkPattern: [
          `cluster-hub -> ${support.listing.canonicalUrl ?? `listing:${support.listing.id}`}`,
          `listing -> decision resources module -> cluster-hub`,
        ],
        contentType: "cluster_hub",
        why: "A cluster hub blueprint consolidates reinforcement assets into a coherent selection pathway.",
      }),
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
      ...buildBlueprintCommon({
        support,
        intentClusters,
        fallbackTitlePattern:
          patternSet.suggestedTitlePattern ?? "[Listing] Intent Guide: Scenarios, Proof, and Next Steps",
        fallbackH2: patternSet.suggestedH2Sections.length
          ? patternSet.suggestedH2Sections
          : ["Intent-driven headings", "Service-specific scenarios", "Anchor-linked quick jumps"],
        fallbackCriteria: patternSet.comparisonCriteria,
        fallbackFaqThemes: patternSet.faqThemes,
        internalLinkPattern: [
          `support-post -> ${support.listing.canonicalUrl ?? `listing:${support.listing.id}`}`,
          `listing -> anchor-intent module -> support-post`,
        ],
        contentType: "support_post",
        why: "Intent-specific heading and anchor structure improves match clarity for selection-oriented searches.",
      }),
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
      serpPatternStatus: patternSet.source === "none" ? "patterns_unavailable" : "patterns_available",
      serpPatternSource: patternSet.source,
    },
    serpPatternSummary,
    items,
  };
}
