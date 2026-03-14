"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import ListingHero from "@/components/directoryiq/ListingHero";
import { fetchJsonWithTimeout, RequestTimeoutError } from "@/lib/directoryiq/fetchWithTimeout";
import { resolveDetailMetricDisplayValue } from "@/lib/directoryiq/detailMetricState";

type UiState = "idle" | "generating" | "generated" | "previewing" | "ready_to_push" | "pushing" | "done";

type ListingDetailResponse = {
  listing: {
    listing_id: string;
    listing_name: string;
    listing_url: string | null;
    mainImageUrl: string | null;
  };
  evaluation: {
    totalScore: number;
  };
};

type ListingDetailPayload = ListingDetailResponse | { data?: Partial<ListingDetailResponse> };

type IntegrationStatusResponse = {
  openaiConfigured: boolean | null;
  bdConfigured: boolean | null;
};

type SignalSourcesResponse = {
  connectors?: Array<{
    connector_id?: string;
    connected?: boolean;
  }>;
};

type ListingSupportSummary = {
  inboundLinkedSupportCount: number;
  mentionWithoutLinkCount: number;
  outboundSupportLinkCount: number;
  connectedSupportPageCount: number;
  lastGraphRunAt: string | null;
};

type ListingSupportInbound = {
  sourceId: string;
  sourceType: "blog_post" | "page" | "support";
  title: string | null;
  url?: string | null;
  anchors: string[];
  relationshipType: "links_to_listing";
};

type ListingSupportMention = {
  sourceId: string;
  sourceType: "blog_post" | "page" | "support";
  title: string | null;
  url?: string | null;
  mentionSnippet?: string | null;
  relationshipType: "mentions_without_link";
};

type ListingSupportOutbound = {
  targetId?: string | null;
  targetType?: "blog_post" | "page" | "support" | null;
  title?: string | null;
  url?: string | null;
  relationshipType: "listing_links_out";
};

type ListingSupportConnectedPage = {
  id?: string | null;
  type: "hub" | "category" | "location" | "support" | "page";
  title: string | null;
  url?: string | null;
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
  outboundSupportLinks: ListingSupportOutbound[];
  connectedSupportPages: ListingSupportConnectedPage[];
};

type ListingSupportResponse = {
  ok: boolean;
  support?: ListingSupportModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "supported" | "no_support_data";
    fallbackApplied?: boolean;
    upstreamStatus?: number | null;
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type AuthorityGapSeverity = "high" | "medium" | "low";

type AuthorityGapType =
  | "no_linked_support_posts"
  | "weak_anchor_text"
  | "mentions_without_links"
  | "no_listing_to_support_links"
  | "weak_category_support"
  | "weak_local_context_support"
  | "missing_comparison_content"
  | "missing_faq_support_coverage";

type AuthorityGapItem = {
  type: AuthorityGapType;
  severity: AuthorityGapSeverity;
  title: string;
  explanation: string;
  evidenceSummary: string;
  evidence?: {
    counts?: Record<string, number>;
    urls?: string[];
    anchors?: string[];
    entities?: string[];
  };
};

type ListingAuthorityGapsModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: {
    totalGaps: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    evaluatedAt: string;
    lastGraphRunAt: string | null;
    dataStatus: "gaps_found" | "no_meaningful_gaps" | "analysis_unavailable";
  };
  items: AuthorityGapItem[];
};

type ListingAuthorityGapsResponse = {
  ok: boolean;
  gaps?: ListingAuthorityGapsModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "gaps_found" | "no_meaningful_gaps" | "analysis_unavailable";
    supportDataStatus?: "supported" | "no_support_data";
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type RecommendedActionType =
  | "optimize_listing"
  | "add_flywheel_links"
  | "generate_reinforcement_post"
  | "generate_reinforcement_cluster"
  | "strengthen_anchor_text"
  | "add_local_context_support"
  | "create_comparison_support_content";

type RecommendedActionPriority = "high" | "medium" | "low";

type RecommendedActionItem = {
  key: RecommendedActionType;
  priority: RecommendedActionPriority;
  title: string;
  rationale: string;
  evidenceSummary: string;
  linkedGapTypes?: AuthorityGapType[];
  dependsOn?: RecommendedActionType[];
  targetSurface?: "listing" | "blog" | "support_page" | "cluster";
};

type ListingRecommendedActionsModel = {
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

type ListingRecommendedActionsResponse = {
  ok: boolean;
  actions?: ListingRecommendedActionsModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "actions_recommended" | "no_major_actions_recommended";
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type FlywheelRecommendationType =
  | "blog_posts_should_link_to_listing"
  | "strengthen_anchor_text"
  | "listing_should_link_back_to_support_post"
  | "category_or_guide_page_should_join_cluster"
  | "missing_reciprocal_link";

type FlywheelRecommendationPriority = "high" | "medium" | "low";

type FlywheelEntity = {
  id: string;
  type: "listing" | "blog_post" | "guide_page" | "category_page" | "support_page";
  title: string;
  url?: string | null;
};

type FlywheelRecommendationItem = {
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
  anchorGuidance?: {
    suggestedAnchorText?: string;
    guidance?: string;
  };
};

type ListingFlywheelLinksModel = {
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

type ListingFlywheelLinksResponse = {
  ok: boolean;
  flywheel?: ListingFlywheelLinksModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "flywheel_opportunities_found" | "no_major_flywheel_opportunities";
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type SelectionIntentClusterPriority = "high" | "medium" | "low";

type SelectionIntentClusterId =
  | "close_unlinked_support_mentions"
  | "repair_bidirectional_flywheel_links"
  | "reinforce_decision_stage_content"
  | "strengthen_local_selection_confidence"
  | "improve_anchor_intent_specificity";

type SelectionIntentClusterItem = {
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

type SelectionIntentPriorityRank = {
  clusterId: "intent_match" | "proof_depth" | "local_relevance" | "comparison_clarity";
  title: string;
  priority: "high" | "medium" | "low";
  score: number;
  rationale: string;
};

type ListingSelectionIntentProfile = {
  primaryIntent: string;
  secondaryIntents: string[];
  targetEntities: string[];
  supportingEntities: string[];
  localModifiers: string[];
  comparisonFrames: string[];
  supportedEntities: string[];
  missingEntities: string[];
  clusterPriorityRanking: SelectionIntentPriorityRank[];
  confidence: "high" | "medium" | "low";
  dataStatus: "intent_resolved" | "low_context";
};

type ListingSelectionIntentClustersModel = {
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

type ListingSelectionIntentClustersResponse = {
  ok: boolean;
  intentClusters?: ListingSelectionIntentClustersModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "clusters_identified" | "no_major_reinforcement_intent_clusters_identified";
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type BlogReinforcementPlanPriority = "high" | "medium" | "low";
type BlogReinforcementRecommendationType =
  | "blog_idea"
  | "local_guide"
  | "comparison_page"
  | "faq_support_page"
  | "category_reinforcement_asset";

type BlogReinforcementPlanItemId =
  | "publish_comparison_decision_post"
  | "publish_faq_support_post"
  | "publish_local_context_guide"
  | "publish_reciprocal_support_post"
  | "publish_cluster_hub_support_page"
  | "refresh_anchor_intent_post";

type BlogReinforcementPlanItem = {
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

type ListingBlogReinforcementPlanModel = {
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

type ListingBlogReinforcementPlanResponse = {
  ok: boolean;
  reinforcementPlan?: ListingBlogReinforcementPlanModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "plan_items_identified" | "no_major_reinforcement_plan_items_identified";
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type ContentStructurePriority = "high" | "medium" | "low";

type ContentStructureItemId =
  | "structure_decision_comparison"
  | "structure_faq_framework"
  | "structure_local_context"
  | "structure_reciprocal_links"
  | "structure_cluster_hub"
  | "structure_anchor_intent";

type ContentStructureType =
  | "comparison_matrix"
  | "faq_cluster"
  | "local_context_block"
  | "reciprocal_authority_block"
  | "cluster_hub_layout"
  | "anchor_intent_module";

type ListingSerpContentStructureItem = {
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

type ListingSerpContentStructureModel = {
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
    dataStatus: "structure_recommendations_identified" | "no_major_structure_recommendations_identified";
    serpPatternStatus: "patterns_available" | "patterns_unavailable";
    serpPatternSource: "serp_cache" | "intent_fixture" | "none";
  };
  serpPatternSummary?: {
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
  items: ListingSerpContentStructureItem[];
};

type ListingSerpContentStructureResponse = {
  ok: boolean;
  contentStructure?: ListingSerpContentStructureModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "structure_recommendations_identified" | "no_major_structure_recommendations_identified";
    serpPatternStatus: "patterns_available" | "patterns_unavailable";
    serpPatternSource: "serp_cache" | "intent_fixture" | "none";
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type MultiActionPriority = "high" | "medium" | "low";
type MultiActionStatus = "available" | "blocked" | "not_recommended";
type MultiActionReadinessState = "ready" | "blocked" | "abstained";
type MultiActionKey =
  | "optimize_listing_description"
  | "repair_flywheel_links"
  | "publish_reinforcement_post"
  | "build_reinforcement_cluster"
  | "publish_local_context_support"
  | "strengthen_anchor_intent"
  | "implement_serp_structure_recommendations";
type MultiActionType =
  | "listing_detail_improvement"
  | "content_reinforcement_asset"
  | "blueprint_driven_asset"
  | "internal_link_trust_signal"
  | "orchestration";

type ListingMultiActionUpgradeItem = {
  actionId: string;
  actionType: MultiActionType;
  key: MultiActionKey;
  title: string;
  description: string;
  whyItMatters: string;
  sourceSignals: {
    primaryIntent?: string;
    intentClusterIds?: SelectionIntentClusterId[];
    reinforcementItemIds?: BlogReinforcementPlanItemId[];
    blueprintItemIds?: ContentStructureItemId[];
    gapTypes?: AuthorityGapType[];
    recommendedActionKeys?: RecommendedActionType[];
    flywheelTypes?: FlywheelRecommendationType[];
  };
  expectedImpact: string;
  dependencies: string[];
  recommendedPriority: MultiActionPriority;
  readinessState: MultiActionReadinessState;
  priority: MultiActionPriority;
  status: MultiActionStatus;
  rationale: string;
  evidenceSummary: string;
  targetSurface: "listing" | "blog" | "support_page" | "cluster";
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
  previewPayload?: {
    mode: "live_preview" | "planning_only";
    detail: string;
  };
};

type ListingMultiActionUpgradeModel = {
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
    dataStatus: "upgrade_actions_available" | "no_major_upgrade_actions_available";
  };
  grouped: {
    byReadiness: Record<MultiActionReadinessState, string[]>;
    bySurface: Record<"listing" | "blog" | "support_page" | "cluster", string[]>;
  };
  items: ListingMultiActionUpgradeItem[];
};

type ListingMultiActionUpgradeResponse = {
  ok: boolean;
  multiAction?: ListingMultiActionUpgradeModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "upgrade_actions_available" | "no_major_upgrade_actions_available";
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type DiffRow = {
  left: string;
  right: string;
  type: "same" | "added" | "removed" | "changed";
};

type ApiErrorShape = {
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
    details?: string;
  };
};

type UiError = {
  message: string;
  reqId?: string;
  code?: string;
  status?: number;
  listingId?: string;
};

type MissionStepId =
  | "audit"
  | "connect-existing-pages"
  | "create-support-content"
  | "upgrade-the-listing"
  | "launch-and-measure";

type MissionStepStatus = "not_started" | "in_progress" | "ready" | "completed";

type MissionStepConfig = {
  id: MissionStepId;
  title: string;
  subtitle: string;
};

const MISSION_STEPS: MissionStepConfig[] = [
  { id: "audit", title: "Audit this listing", subtitle: "Review current support, top gaps, and the next best move." },
  {
    id: "connect-existing-pages",
    title: "Connect existing pages",
    subtitle: "Use opportunities you can execute now because the pages already exist.",
  },
  {
    id: "create-support-content",
    title: "Create support content",
    subtitle: "Generate the missing content assets that strengthen selection readiness.",
  },
  {
    id: "upgrade-the-listing",
    title: "Upgrade the listing",
    subtitle: "Improve listing-page copy and trust blocks before launch.",
  },
  {
    id: "launch-and-measure",
    title: "Launch and measure",
    subtitle: "Review what is ready, publish safely, and track impact.",
  },
];

function createMissionStepCompletionMap(initial = false): Record<MissionStepId, boolean> {
  return {
    audit: initial,
    "connect-existing-pages": initial,
    "create-support-content": initial,
    "upgrade-the-listing": initial,
    "launch-and-measure": initial,
  };
}

function parseMissionStep(value: string | null): MissionStepId | null {
  if (!value) return null;
  const parsed = value.trim().toLowerCase();
  if (
    parsed === "audit" ||
    parsed === "connect-existing-pages" ||
    parsed === "create-support-content" ||
    parsed === "upgrade-the-listing" ||
    parsed === "launch-and-measure"
  ) {
    return parsed;
  }
  return null;
}

function missionStepStatusLabel(status: MissionStepStatus): string {
  if (status === "in_progress") return "In progress";
  if (status === "ready") return "Ready";
  if (status === "completed") return "Completed";
  return "Not started";
}

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

function toPlainLabel(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value
    .replace(UUID_PATTERN, "this location")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleWords(value: string | null | undefined): string {
  const plain = toPlainLabel(value);
  if (!plain) return plain;
  return plain
    .split(" ")
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function toPlainIntent(value: string | null | undefined): string {
  if (!value) return "";
  const mapped: Record<string, string> = {
    choose_best_dining_option: "Why diners choose this listing nearby",
    book_best_place_to_stay: "Why guests book this stay over nearby options",
    select_best_local_activity: "Why this activity is the easiest local pick",
    hire_trusted_local_service: "Why this service is trusted locally",
    select_best_local_option: "Why this listing is the strongest local fit",
    compare_alternatives: "Help customers compare options quickly",
    confirm_local_fit: "Show why this listing fits local needs",
    validate_trust_signals: "Prove trust with clear evidence",
    close_comparison_coverage_gap: "Close the comparison information gap",
    check_availability_and_policies: "Make availability and policies easy to review",
    check_menu_and_reservation_fit: "Make menu and reservation fit easy to evaluate",
    check_activity_fit_and_access: "Clarify activity fit, timing, and access",
    verify_service_scope_and_credentials: "Clarify service scope and credentials",
    intent_not_resolved: "Not enough context yet",
  };
  return mapped[value] ?? toTitleWords(value);
}

function cleanCustomerText(value: string | null | undefined): string {
  return toPlainLabel(value)
    .replace(/\s*->\s*/g, " to ")
    .replace(/\b(?:listing|site)\s*:\s*[a-z0-9-]+\b/gi, "this listing");
}

function compactList(values: Array<string | null | undefined>, limit = 3): string[] {
  return values
    .map((value) => (value ? cleanCustomerText(value) : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function toPriorityLabel(value: string): string {
  if (value === "high") return "High priority";
  if (value === "medium") return "Medium priority";
  if (value === "low") return "Low priority";
  return toTitleWords(value);
}

type RecommendationDetailItem = {
  label: string;
  value: string | ReactNode | null | undefined;
};

type CompactRecommendationCardProps = {
  title: string;
  priority?: string | null;
  whyItMatters: string;
  nextStep?: string | null;
  includeItems?: string[];
  includeLabel?: string;
  primaryAction?: string | null;
  detailItems?: RecommendationDetailItem[];
};

function CompactRecommendationCard({
  title,
  priority,
  whyItMatters,
  nextStep,
  includeItems = [],
  includeLabel = "What to include",
  primaryAction,
  detailItems = [],
}: CompactRecommendationCardProps) {
  const detailRows = detailItems.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        {priority ? (
          <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
            {toPriorityLabel(priority)}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-xs uppercase tracking-[0.08em] text-slate-400">Why it matters</div>
      <div className="mt-1 text-sm text-slate-300">{whyItMatters}</div>
      {nextStep ? (
        <>
          <div className="mt-2 text-xs uppercase tracking-[0.08em] text-slate-400">What to do next</div>
          <div className="mt-1 text-sm text-slate-300">{nextStep}</div>
        </>
      ) : null}
      {includeItems.length ? (
        <>
          <div className="mt-2 text-xs uppercase tracking-[0.08em] text-slate-400">{includeLabel}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {includeItems.map((item) => (
              <span key={item} className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-slate-200">
                {item}
              </span>
            ))}
          </div>
        </>
      ) : null}
      {primaryAction ? (
        <>
          <div className="mt-2 text-xs uppercase tracking-[0.08em] text-slate-400">Primary action</div>
          <div className="mt-1 text-sm text-cyan-100">{primaryAction}</div>
        </>
      ) : null}
      {detailRows.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-400">Show details</summary>
          <div className="mt-2 space-y-1">
            {detailRows.map((item) => (
              <div key={item.label} className="text-xs text-slate-500">
                {item.label}: {item.value}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function parseError(json: ApiErrorShape, fallback: string, status?: number, listingId?: string): UiError {
  return {
    message: json.error?.message ?? fallback,
    reqId: json.error?.reqId,
    code: json.error?.code,
    status,
    listingId,
  };
}

type ListingOptimizationClientProps = {
  listingId: string;
  initialListing: ListingDetailResponse | null;
  initialIntegrations: IntegrationStatusResponse;
  initialError?: UiError | null;
};

export default function ListingOptimizationClient({
  listingId,
  initialListing,
  initialIntegrations,
  initialError = null,
}: ListingOptimizationClientProps) {
  const DETAIL_REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_DIRECTORYIQ_DETAIL_TIMEOUT_MS ?? "8000");
  const searchParams = useSearchParams();
  const siteIdParam = searchParams.get("site_id");
  const siteQuery = siteIdParam ? `?site_id=${encodeURIComponent(siteIdParam)}` : "";
  const hasValidListingId = Boolean(listingId) && listingId !== "undefined" && listingId !== "null";
  const effectiveListingId = hasValidListingId ? listingId : "";
  const [state, setState] = useState<UiState>("idle");
  const [listing, setListing] = useState<ListingDetailResponse | null>(initialListing);
  const [integrations, setIntegrations] = useState<IntegrationStatusResponse>(initialIntegrations);
  const [proposedDescription, setProposedDescription] = useState("");
  const [draftId, setDraftId] = useState("");
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [approvalToken, setApprovalToken] = useState("");
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(initialError);
  const [support, setSupport] = useState<ListingSupportModel | null>(null);
  const [supportMeta, setSupportMeta] = useState<ListingSupportResponse["meta"] | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportLoading, setSupportLoading] = useState(true);
  const [gaps, setGaps] = useState<ListingAuthorityGapsModel | null>(null);
  const [gapsMeta, setGapsMeta] = useState<ListingAuthorityGapsResponse["meta"] | null>(null);
  const [gapsError, setGapsError] = useState<string | null>(null);
  const [gapsLoading, setGapsLoading] = useState(true);
  const [actions, setActions] = useState<ListingRecommendedActionsModel | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [flywheel, setFlywheel] = useState<ListingFlywheelLinksModel | null>(null);
  const [flywheelError, setFlywheelError] = useState<string | null>(null);
  const [flywheelLoading, setFlywheelLoading] = useState(true);
  const [intentClusters, setIntentClusters] = useState<ListingSelectionIntentClustersModel | null>(null);
  const [intentClustersError, setIntentClustersError] = useState<string | null>(null);
  const [intentClustersLoading, setIntentClustersLoading] = useState(true);
  const [reinforcementPlan, setReinforcementPlan] = useState<ListingBlogReinforcementPlanModel | null>(null);
  const [reinforcementPlanError, setReinforcementPlanError] = useState<string | null>(null);
  const [reinforcementPlanLoading, setReinforcementPlanLoading] = useState(true);
  const [contentStructure, setContentStructure] = useState<ListingSerpContentStructureModel | null>(null);
  const [contentStructureError, setContentStructureError] = useState<string | null>(null);
  const [contentStructureLoading, setContentStructureLoading] = useState(true);
  const [multiAction, setMultiAction] = useState<ListingMultiActionUpgradeModel | null>(null);
  const [multiActionError, setMultiActionError] = useState<string | null>(null);
  const [multiActionLoading, setMultiActionLoading] = useState(true);
  const requestedStep = parseMissionStep(searchParams.get("step"));
  const [activeStepId, setActiveStepId] = useState<MissionStepId>(requestedStep ?? "audit");
  const [stepLockedByUser, setStepLockedByUser] = useState(Boolean(requestedStep));
  const [hasUserAction, setHasUserAction] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<MissionStepId, boolean>>(() => createMissionStepCompletionMap());

  const markStepCompleted = (stepId: MissionStepId) => {
    setCompletedSteps((previous) => (previous[stepId] ? previous : { ...previous, [stepId]: true }));
  };

  async function loadListingAndIntegrations() {
    if (!effectiveListingId) return;
    setError(null);

    const listingPath = `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}${siteQuery}`;
    const supportPath = `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/support${siteQuery}`;
    const gapsPath = `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/gaps${siteQuery}`;

    void (async () => {
      try {
        const { response: listingRes, json: listingJson } = await fetchJsonWithTimeout<ListingDetailPayload & ApiErrorShape>(
          listingPath,
          { cache: "no-store" },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        const listingPayload =
          (listingJson as ListingDetailResponse).listing ??
          (listingJson as { data?: ListingDetailResponse }).data?.listing;
        const evaluationPayload =
          (listingJson as ListingDetailResponse).evaluation ??
          (listingJson as { data?: ListingDetailResponse }).data?.evaluation;

        if (!listingRes.ok || !listingPayload) {
          setError(parseError(listingJson, "Failed to load listing details.", listingRes.status, effectiveListingId));
          setListing(null);
          return;
        }

        setListing({
          listing: listingPayload,
          evaluation: evaluationPayload ?? { totalScore: 0 },
        });
      } catch (err) {
        const message =
          err instanceof RequestTimeoutError
            ? "Listing details request timed out."
            : err instanceof Error
              ? err.message
              : "Failed to load listing details.";
        setError({ message, status: 0, listingId: effectiveListingId });
        setListing(null);
      }
    })();

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<SignalSourcesResponse & ApiErrorShape>(
          "/api/directoryiq/signal-sources",
          { cache: "no-store" },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!response.ok) {
          setIntegrations({
            openaiConfigured: null,
            bdConfigured: null,
          });
          return;
        }

        const connectors = Array.isArray(json.connectors) ? json.connectors : [];
        const openAiConnector = connectors.find((connector) => connector.connector_id === "openai");
        const bdConnector = connectors.find(
          (connector) => connector.connector_id === "brilliant_directories_api"
        );
        setIntegrations({
          openaiConfigured: typeof openAiConnector?.connected === "boolean" ? openAiConnector.connected : null,
          bdConfigured: typeof bdConnector?.connected === "boolean" ? bdConnector.connected : null,
        });
      } catch {
        setIntegrations({
          openaiConfigured: null,
          bdConfigured: null,
        });
      }
    })();

    void (async () => {
      try {
        setSupportLoading(true);
        const { response: supportRes, json: supportJson } = await fetchJsonWithTimeout<ListingSupportResponse>(
          supportPath,
          { cache: "no-store" },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!supportRes.ok || !supportJson.ok) {
          const supportMessage =
            typeof supportJson.error === "string"
              ? supportJson.error
              : supportJson.error?.message ?? "Failed to load support model.";
          setSupportError(supportMessage);
          setSupport(null);
          setSupportMeta(null);
          return;
        }

        setSupport(supportJson.support ?? null);
        setSupportMeta(supportJson.meta ?? null);
        setSupportError(null);
      } catch (supportErr) {
        const message =
          supportErr instanceof RequestTimeoutError
            ? "Support diagnostics request timed out."
            : supportErr instanceof Error
              ? supportErr.message
              : "Failed to load support model.";
        setSupportError(message);
        setSupport(null);
        setSupportMeta(null);
      } finally {
        setSupportLoading(false);
      }
    })();

    void (async () => {
      try {
        setGapsLoading(true);
        const { response: gapsRes, json: gapsJson } = await fetchJsonWithTimeout<ListingAuthorityGapsResponse>(
          gapsPath,
          { cache: "no-store" },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!gapsRes.ok || !gapsJson.ok) {
          const gapsMessage =
            typeof gapsJson.error === "string"
              ? gapsJson.error
              : gapsJson.error?.message ?? "Failed to evaluate authority gaps.";
          setGapsError(gapsMessage);
          setGaps(null);
          setGapsMeta(null);
          return;
        }

        setGaps(gapsJson.gaps ?? null);
        setGapsMeta(gapsJson.meta ?? null);
        setGapsError(null);
      } catch (gapsErr) {
        const message =
          gapsErr instanceof RequestTimeoutError
            ? "Gap analysis request timed out."
            : gapsErr instanceof Error
              ? gapsErr.message
              : "Failed to evaluate authority gaps.";
        setGapsError(message);
        setGaps(null);
        setGapsMeta(null);
      } finally {
        setGapsLoading(false);
      }
    })();
  }

  useEffect(() => {
    void loadListingAndIntegrations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveListingId, siteQuery]);

  useEffect(() => {
    if (!effectiveListingId) return;
    const supportReady = Boolean(support) && supportMeta?.dataStatus !== "no_support_data";
    const gapsReady = Boolean(gaps) && gaps?.summary.dataStatus !== "analysis_unavailable";

    if (supportError || gapsError) {
      setActions(null);
      setActionsLoading(false);
      setActionsError("Actions evaluation failed because support and gaps diagnostics are unavailable.");
      return;
    }

    if (!supportReady || !gapsReady) {
      if (!supportLoading && !gapsLoading) {
        setActions(null);
        setActionsLoading(false);
        setActionsError("Actions are not available until support and gap diagnostics finish.");
        return;
      }
      setActionsLoading(true);
      setActionsError(null);
      return;
    }

    let active = true;
    setActionsLoading(true);
    setActionsError(null);

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<ListingRecommendedActionsResponse>(
          `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/actions${siteQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ support, gaps }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;

        if (!response.ok || !json.ok || !json.actions) {
          const message =
            typeof json.error === "string"
              ? json.error
              : json.error?.message ?? "Failed to evaluate recommended actions.";
          setActions(null);
          setActionsError(message);
          setActionsLoading(false);
          return;
        }

        setActions(json.actions);
        setActionsError(null);
        setActionsLoading(false);
      } catch (actionsErr) {
        if (!active) return;
        const message =
          actionsErr instanceof RequestTimeoutError
            ? "Recommended actions request timed out."
            : actionsErr instanceof Error
              ? actionsErr.message
              : "Failed to evaluate recommended actions.";
        setActions(null);
        setActionsError(message);
        setActionsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    effectiveListingId,
    siteQuery,
    support,
    supportMeta,
    supportLoading,
    gaps,
    gapsLoading,
    supportError,
    gapsError,
  ]);

  useEffect(() => {
    if (!effectiveListingId) return;

    if (supportError || gapsError || actionsError || flywheelError) {
      setIntentClusters(null);
      setIntentClustersLoading(false);
      setIntentClustersError("Intent cluster evaluation failed because prerequisite diagnostics are unavailable.");
      return;
    }

    if (!support || !gaps || !actions || !flywheel) {
      setIntentClustersLoading(true);
      setIntentClustersError(null);
      return;
    }

    let active = true;
    setIntentClustersLoading(true);
    setIntentClustersError(null);

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<ListingSelectionIntentClustersResponse>(
          `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/intent-clusters${siteQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              support,
              gaps,
              actions,
              flywheel,
              listingContext: {
                title: listing?.listing.listing_name ?? support.listing.title ?? effectiveListingId,
                canonicalUrl: listing?.listing.listing_url ?? support.listing.canonicalUrl ?? null,
                siteLabel: siteIdParam,
              },
            }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;

        if (!response.ok || !json.ok || !json.intentClusters) {
          const message =
            typeof json.error === "string"
              ? json.error
              : json.error?.message ?? "Failed to evaluate selection intent clusters.";
          setIntentClusters(null);
          setIntentClustersError(message);
          setIntentClustersLoading(false);
          return;
        }

        setIntentClusters(json.intentClusters);
        setIntentClustersError(null);
        setIntentClustersLoading(false);
      } catch (intentClustersErr) {
        if (!active) return;
        const message =
          intentClustersErr instanceof RequestTimeoutError
            ? "Intent cluster evaluation timed out."
            : intentClustersErr instanceof Error
              ? intentClustersErr.message
              : "Failed to evaluate selection intent clusters.";
        setIntentClusters(null);
        setIntentClustersError(message);
        setIntentClustersLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, siteIdParam, listing, support, gaps, actions, flywheel, supportError, gapsError, actionsError, flywheelError]);

  useEffect(() => {
    if (!effectiveListingId) return;

    if (supportError || gapsError || actionsError || flywheelError || intentClustersError) {
      setReinforcementPlan(null);
      setReinforcementPlanLoading(false);
      setReinforcementPlanError("Reinforcement planning failed because prerequisite diagnostics are unavailable.");
      return;
    }

    if (!support || !gaps || !actions || !flywheel || !intentClusters) {
      setReinforcementPlanLoading(true);
      setReinforcementPlanError(null);
      return;
    }

    let active = true;
    setReinforcementPlanLoading(true);
    setReinforcementPlanError(null);

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<ListingBlogReinforcementPlanResponse>(
          `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/reinforcement-plan${siteQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ support, gaps, actions, flywheel, intentClusters }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;

        if (!response.ok || !json.ok || !json.reinforcementPlan) {
          const message =
            typeof json.error === "string"
              ? json.error
              : json.error?.message ?? "Failed to evaluate blog reinforcement plan.";
          setReinforcementPlan(null);
          setReinforcementPlanError(message);
          setReinforcementPlanLoading(false);
          return;
        }

        setReinforcementPlan(json.reinforcementPlan);
        setReinforcementPlanError(null);
        setReinforcementPlanLoading(false);
      } catch (reinforcementPlanErr) {
        if (!active) return;
        const message =
          reinforcementPlanErr instanceof RequestTimeoutError
            ? "Content plan evaluation timed out."
            : reinforcementPlanErr instanceof Error
              ? reinforcementPlanErr.message
              : "Failed to evaluate blog reinforcement plan.";
        setReinforcementPlan(null);
        setReinforcementPlanError(message);
        setReinforcementPlanLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    effectiveListingId,
    siteQuery,
    support,
    gaps,
    actions,
    flywheel,
    intentClusters,
    supportError,
    gapsError,
    actionsError,
    flywheelError,
    intentClustersError,
  ]);

  useEffect(() => {
    if (!effectiveListingId) return;

    if (
      supportError ||
      gapsError ||
      actionsError ||
      flywheelError ||
      intentClustersError ||
      reinforcementPlanError
    ) {
      setContentStructure(null);
      setContentStructureLoading(false);
      setContentStructureError("Content structure evaluation failed because prerequisite diagnostics are unavailable.");
      return;
    }

    if (!support || !gaps || !actions || !flywheel || !intentClusters || !reinforcementPlan) {
      setContentStructureLoading(true);
      setContentStructureError(null);
      return;
    }

    let active = true;
    setContentStructureLoading(true);
    setContentStructureError(null);

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<ListingSerpContentStructureResponse>(
          `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/content-structure${siteQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ support, gaps, actions, flywheel, intentClusters, reinforcementPlan }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;

        if (!response.ok || !json.ok || !json.contentStructure) {
          const message =
            typeof json.error === "string"
              ? json.error
              : json.error?.message ?? "Failed to evaluate SERP-informed content structure.";
          setContentStructure(null);
          setContentStructureError(message);
          setContentStructureLoading(false);
          return;
        }

        setContentStructure(json.contentStructure);
        setContentStructureError(null);
        setContentStructureLoading(false);
      } catch (contentStructureErr) {
        if (!active) return;
        const message =
          contentStructureErr instanceof RequestTimeoutError
            ? "Content structure evaluation timed out."
            : contentStructureErr instanceof Error
              ? contentStructureErr.message
              : "Failed to evaluate SERP-informed content structure.";
        setContentStructure(null);
        setContentStructureError(message);
        setContentStructureLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    effectiveListingId,
    siteQuery,
    support,
    gaps,
    actions,
    flywheel,
    intentClusters,
    reinforcementPlan,
    supportError,
    gapsError,
    actionsError,
    flywheelError,
    intentClustersError,
    reinforcementPlanError,
  ]);

  useEffect(() => {
    if (!effectiveListingId) return;

    if (
      supportError ||
      gapsError ||
      actionsError ||
      flywheelError ||
      intentClustersError ||
      reinforcementPlanError ||
      contentStructureError
    ) {
      setMultiAction(null);
      setMultiActionLoading(false);
      setMultiActionError("Multi-action upgrade evaluation failed because prerequisite diagnostics are unavailable.");
      return;
    }

    if (!support || !gaps || !actions || !flywheel || !intentClusters || !reinforcementPlan || !contentStructure) {
      setMultiActionLoading(true);
      setMultiActionError(null);
      return;
    }

    let active = true;
    setMultiActionLoading(true);
    setMultiActionError(null);

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<ListingMultiActionUpgradeResponse>(
          `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/multi-action${siteQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              support,
              gaps,
              actions,
              flywheel,
              intentClusters,
              reinforcementPlan,
              contentStructure,
              integrations: {
                openaiConfigured: Boolean(integrations.openaiConfigured),
                bdConfigured: Boolean(integrations.bdConfigured),
              },
            }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;

        if (!response.ok || !json.ok || !json.multiAction) {
          const message =
            typeof json.error === "string"
              ? json.error
              : json.error?.message ?? "Failed to evaluate multi-action upgrade system.";
          setMultiAction(null);
          setMultiActionError(message);
          setMultiActionLoading(false);
          return;
        }

        setMultiAction(json.multiAction);
        setMultiActionError(null);
        setMultiActionLoading(false);
      } catch (multiActionErr) {
        if (!active) return;
        const message =
          multiActionErr instanceof RequestTimeoutError
            ? "Improve-this-listing actions timed out."
            : multiActionErr instanceof Error
              ? multiActionErr.message
              : "Failed to evaluate multi-action upgrade system.";
        setMultiAction(null);
        setMultiActionError(message);
        setMultiActionLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    effectiveListingId,
    siteQuery,
    support,
    gaps,
    actions,
    flywheel,
    intentClusters,
    reinforcementPlan,
    contentStructure,
    integrations.openaiConfigured,
    integrations.bdConfigured,
    supportError,
    gapsError,
    actionsError,
    flywheelError,
    intentClustersError,
    reinforcementPlanError,
    contentStructureError,
  ]);

  useEffect(() => {
    if (!effectiveListingId) return;
    const supportReady = Boolean(support) && supportMeta?.dataStatus !== "no_support_data";
    const gapsReady = Boolean(gaps) && gaps?.summary.dataStatus !== "analysis_unavailable";

    if (supportError || gapsError) {
      setFlywheel(null);
      setFlywheelLoading(false);
      setFlywheelError("Flywheel evaluation failed because support and gaps diagnostics are unavailable.");
      return;
    }

    if (!supportReady || !gapsReady) {
      if (!supportLoading && !gapsLoading) {
        setFlywheel(null);
        setFlywheelLoading(false);
        setFlywheelError("Flywheel evaluation is not available until support and gap diagnostics finish.");
        return;
      }
      setFlywheelLoading(true);
      setFlywheelError(null);
      return;
    }

    let active = true;
    setFlywheelLoading(true);
    setFlywheelError(null);

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<ListingFlywheelLinksResponse>(
          `/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/flywheel-links${siteQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ support, gaps }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;

        if (!response.ok || !json.ok || !json.flywheel) {
          const message =
            typeof json.error === "string"
              ? json.error
              : json.error?.message ?? "Failed to evaluate flywheel links.";
          setFlywheel(null);
          setFlywheelError(message);
          setFlywheelLoading(false);
          return;
        }

        setFlywheel(json.flywheel);
        setFlywheelError(null);
        setFlywheelLoading(false);
      } catch (flywheelErr) {
        if (!active) return;
        const message =
          flywheelErr instanceof RequestTimeoutError
            ? "Proof and trust signal evaluation timed out."
            : flywheelErr instanceof Error
              ? flywheelErr.message
              : "Failed to evaluate flywheel links.";
        setFlywheel(null);
        setFlywheelError(message);
        setFlywheelLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    effectiveListingId,
    siteQuery,
    support,
    supportMeta,
    supportLoading,
    gaps,
    gapsLoading,
    supportError,
    gapsError,
  ]);

  async function generateUpgrade() {
    if (!effectiveListingId) return;

    setHasUserAction(true);
    setState("generating");
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/generate${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "default" }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      draftId?: string;
      proposedDescription?: string;
    } & ApiErrorShape;

    if (!res.ok) {
      setState("idle");
      setError(parseError(json, "Failed to generate upgrade."));
      return;
    }

    setDraftId(json.draftId ?? "");
    setProposedDescription(json.proposedDescription ?? "");
    setDiffRows([]);
    setApprovalToken("");
    setApproved(false);
    setState("generated");
    markStepCompleted("upgrade-the-listing");
    setNotice("Upgrade draft generated.");
  }

  async function previewChanges() {
    if (!effectiveListingId || !draftId) return;

    setHasUserAction(true);
    setState("previewing");
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/preview${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      diff?: DiffRow[];
      approvalToken?: string;
    } & ApiErrorShape;

    if (!res.ok) {
      setState("generated");
      setError(parseError(json, "Failed to preview changes."));
      return;
    }

    setDiffRows(json.diff ?? []);
    setApprovalToken(json.approvalToken ?? "");
    setApproved(false);
    setState("ready_to_push");
  }

  async function approveAndPush() {
    if (!effectiveListingId || !draftId) return;

    setHasUserAction(true);
    setState("pushing");
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/push${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        approved: true,
        approvalToken,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as ApiErrorShape;

    if (!res.ok) {
      setState("ready_to_push");
      setError(parseError(json, "Failed to push upgrade to BD."));
      return;
    }

    setState("done");
    markStepCompleted("launch-and-measure");
    setNotice("Listing upgrade pushed successfully.");
    await loadListingAndIntegrations();
  }

  const displayName =
    listing?.listing.listing_name?.trim() ||
    listing?.listing.listing_name ||
    "Listing";
  const displayUrl = listing?.listing.listing_url ?? null;
  const displayScore = listing?.evaluation.totalScore ?? 0;
  const supportSummary = support?.summary ?? null;
  const gapsSummary = gaps?.summary ?? null;
  const supportResolved = Boolean(supportSummary) && supportMeta?.dataStatus !== "no_support_data";
  const supportUnresolved = !supportLoading && (!supportResolved || Boolean(supportError));
  const gapsUnavailable =
    gapsSummary?.dataStatus === "analysis_unavailable" || gapsMeta?.dataStatus === "analysis_unavailable";
  const gapsResolved = Boolean(gapsSummary) && !gapsUnavailable;
  const gapsUnresolved = !gapsLoading && (!gapsResolved || Boolean(gapsError));
  const topMetricValue = (
    value: number | null | undefined,
    opts: {
      loading: boolean;
      unresolved: boolean;
    }
  ): string =>
    resolveDetailMetricDisplayValue({
      loading: opts.loading,
      unresolved: opts.unresolved,
      value,
    });
  const intentProfile = intentClusters?.intentProfile ?? {
    primaryIntent: "intent_not_resolved",
    secondaryIntents: [],
    targetEntities: [],
    supportingEntities: [],
    localModifiers: [],
    comparisonFrames: [],
    supportedEntities: [],
    missingEntities: [],
    clusterPriorityRanking: [],
    confidence: "low" as const,
    dataStatus: "low_context" as const,
  };
  const optimizeListingAction = multiAction?.items.find((item) => item.key === "optimize_listing_description");
  const optimizeActionExecutable =
    optimizeListingAction?.status === "available" && optimizeListingAction.previewCapability?.supported === true;
  const optimizeActionBlocked = optimizeListingAction?.status === "blocked";
  const largestGap = gaps?.items[0] ?? null;
  const fastestWinAction = actions?.items[0] ?? null;
  const fastestWinLinkOpportunity = support?.mentionsWithoutLinks[0] ?? null;
  const biggestBlocker = supportUnresolved
    ? "Support diagnostics are not available yet."
    : largestGap
      ? cleanCustomerText(largestGap.title)
      : "No major blockers detected right now.";
  const fastestWin = fastestWinLinkOpportunity
    ? `Add a direct listing link from ${cleanCustomerText(fastestWinLinkOpportunity.title ?? "an existing support page")}.`
    : fastestWinAction
      ? cleanCustomerText(fastestWinAction.title)
      : "Run the listing audit to identify the next fast win.";
  const connectNowFlywheelItems =
    flywheel?.items.filter((item) => item.type !== "category_or_guide_page_should_join_cluster") ?? [];
  const createFirstFlywheelItems = flywheel?.items.filter((item) => item.type === "category_or_guide_page_should_join_cluster") ?? [];
  const createQueue = reinforcementPlan?.items ?? [];
  const listingUpgradeItems =
    multiAction?.items.filter((item) => item.targetSurface === "listing" || item.key === "optimize_listing_description") ?? [];
  const launchReadyItems = multiAction?.items.filter((item) => item.readinessState === "ready") ?? [];
  const launchBlockedItems = multiAction?.items.filter((item) => item.readinessState === "blocked") ?? [];
  const stepCompletionSignals = [
    supportResolved && gapsResolved,
    !flywheelLoading && !flywheelError && Boolean(flywheel),
    !reinforcementPlanLoading && !reinforcementPlanError && !contentStructureLoading,
    !multiActionLoading && !multiActionError && Boolean(optimizeListingAction),
    state === "done" || launchReadyItems.length > 0,
  ];
  const unresolvedStepIndex = stepCompletionSignals.findIndex((value) => !value);
  const recommendedStepIndex = unresolvedStepIndex === -1 ? MISSION_STEPS.length - 1 : unresolvedStepIndex;
  const recommendedStepId = MISSION_STEPS[recommendedStepIndex].id;
  const activeStepIndex = Math.max(0, MISSION_STEPS.findIndex((step) => step.id === activeStepId));
  const activeStepConfig = MISSION_STEPS[activeStepIndex];
  const canGoBack = activeStepIndex > 0;
  const canGoNext = activeStepIndex < MISSION_STEPS.length - 1;
  const completedStepCount = MISSION_STEPS.filter((step) => completedSteps[step.id]).length;
  const missionProgress = Math.round((completedStepCount / MISSION_STEPS.length) * 100);
  const missionProgressLabel =
    missionProgress === 0 ? (hasUserAction ? "In progress" : "Not started") : missionProgress === 100 ? "Completed" : "In progress";
  const stepStatusMap = MISSION_STEPS.reduce<Record<MissionStepId, MissionStepStatus>>((acc, step, index) => {
    if (completedSteps[step.id]) {
      acc[step.id] = "completed";
      return acc;
    }

    const isReady = stepCompletionSignals[index];
    if (activeStepId === step.id && hasUserAction) {
      acc[step.id] = "in_progress";
      return acc;
    }

    acc[step.id] = isReady ? "ready" : "not_started";
    return acc;
  }, {
    audit: "not_started",
    "connect-existing-pages": "not_started",
    "create-support-content": "not_started",
    "upgrade-the-listing": "not_started",
    "launch-and-measure": "not_started",
  });

  useEffect(() => {
    if (requestedStep) {
      setActiveStepId(requestedStep);
      setStepLockedByUser(true);
    }
  }, [requestedStep]);

  useEffect(() => {
    if (stepLockedByUser || requestedStep) return;
    setActiveStepId(recommendedStepId);
  }, [recommendedStepId, requestedStep, stepLockedByUser]);

  const setMissionStep = (stepId: MissionStepId, options?: { lock?: boolean; persistInUrl?: boolean }) => {
    if (options?.lock) {
      setHasUserAction(true);
    }
    setActiveStepId(stepId);
    if (options?.lock) {
      setStepLockedByUser(true);
    }
    if (options?.persistInUrl && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("step", stepId);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
  };

  const goToNextStep = () => {
    if (!canGoNext) return;
    markStepCompleted(activeStepConfig.id);
    setHasUserAction(true);
    setMissionStep(MISSION_STEPS[activeStepIndex + 1].id, { lock: true, persistInUrl: true });
  };

  const stepPanels: Record<MissionStepId, ReactNode> = {
    audit: (
      <HudCard title="Step 1: Audit this listing" subtitle={MISSION_STEPS[0].subtitle}>
        {supportLoading ? <div className="text-sm text-slate-300">Loading support diagnostics...</div> : null}
        {supportError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {supportError}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Supporting links in</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(supportSummary?.inboundLinkedSupportCount, {
                loading: supportLoading,
                unresolved: supportUnresolved,
              })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mentions without links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(supportSummary?.mentionWithoutLinkCount, {
                loading: supportLoading,
                unresolved: supportUnresolved,
              })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Connected support pages</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(supportSummary?.connectedSupportPageCount, {
                loading: supportLoading,
                unresolved: supportUnresolved,
              })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total gaps</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(gapsSummary?.totalGaps, {
                loading: gapsLoading,
                unresolved: gapsUnresolved,
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {gaps?.items.slice(0, 3).map((item) => (
            <CompactRecommendationCard
              key={item.type}
              title={cleanCustomerText(item.title)}
              priority={item.severity}
              whyItMatters={cleanCustomerText(item.explanation)}
              nextStep="Close this gap before scaling new publishing work."
              includeItems={compactList(item.evidence?.anchors ?? [])}
              includeLabel="What to include"
              primaryAction="Fix this in the next optimization cycle."
              detailItems={[
                { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                { label: "URLs", value: item.evidence?.urls?.slice(0, 3).join(", ") ?? null },
                { label: "Entities", value: item.evidence?.entities?.slice(0, 4).join(", ") ?? null },
              ]}
            />
          ))}
        </div>
      </HudCard>
    ),
    "connect-existing-pages": (
      <HudCard title="Step 2: Connect existing pages" subtitle={MISSION_STEPS[1].subtitle}>
        {flywheelLoading ? <div className="text-sm text-slate-300">Evaluating link opportunities...</div> : null}
        {flywheelError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {flywheelError}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Pages that already exist</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{support?.connectedSupportPages.length ?? 0}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Links you can add now</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{connectNowFlywheelItems.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Missing pages moved to Step 3</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{createFirstFlywheelItems.length}</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {connectNowFlywheelItems.slice(0, 6).map((item) => (
            <CompactRecommendationCard
              key={item.key}
              title={cleanCustomerText(item.title)}
              priority={item.priority}
              whyItMatters={cleanCustomerText(item.rationale)}
              nextStep={`Add a direct link between ${cleanCustomerText(item.sourceEntity.title)} and ${cleanCustomerText(item.targetEntity.title)}.`}
              includeItems={compactList([
                item.anchorGuidance?.suggestedAnchorText ? `Suggested anchor: ${item.anchorGuidance.suggestedAnchorText}` : null,
              ])}
              includeLabel="What to include"
              primaryAction="Execute this link update now."
              detailItems={[
                { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                { label: "Source page", value: cleanCustomerText(item.sourceEntity.title) },
                { label: "Target page", value: cleanCustomerText(item.targetEntity.title) },
                {
                  label: "Anchor guidance",
                  value: item.anchorGuidance?.guidance ? cleanCustomerText(item.anchorGuidance.guidance) : null,
                },
              ]}
            />
          ))}
        </div>
        {createFirstFlywheelItems.length ? (
          <details className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-100">Pages missing (create first in Step 3)</summary>
            <div className="mt-3 space-y-2">
              {createFirstFlywheelItems.map((item) => (
                <div key={item.key} className="rounded-lg border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                  {cleanCustomerText(item.title)}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </HudCard>
    ),
    "create-support-content": (
      <HudCard title="Step 3: Create support content" subtitle={MISSION_STEPS[2].subtitle}>
        {reinforcementPlanLoading || contentStructureLoading ? (
          <div className="text-sm text-slate-300">Preparing content plan...</div>
        ) : null}
        {reinforcementPlanError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {reinforcementPlanError}
          </div>
        ) : null}
        {intentClusters ? (
          <CompactRecommendationCard
            title={toPlainIntent(intentProfile.primaryIntent)}
            priority={intentProfile.confidence}
            whyItMatters="This intent drives what support content should be created first."
            nextStep="Start with one high-priority asset mapped to this intent."
            includeItems={compactList(
              intentProfile.missingEntities.length ? intentProfile.missingEntities : intentProfile.targetEntities,
              5
            )}
            includeLabel="What to include"
            primaryAction="Create your first support asset from this intent."
            detailItems={[
              {
                label: "Secondary intents",
                value: intentProfile.secondaryIntents.length
                  ? intentProfile.secondaryIntents.map((intent) => toPlainIntent(intent)).join(", ")
                  : "None resolved",
              },
              {
                label: "Local modifiers",
                value: intentProfile.localModifiers.length
                  ? intentProfile.localModifiers.map((value) => cleanCustomerText(value)).join(", ")
                  : "None detected",
              },
            ]}
          />
        ) : null}
        <div className="mt-4 space-y-2">
          {createQueue.map((item) => (
            <CompactRecommendationCard
              key={item.id}
              title={cleanCustomerText(item.title)}
              priority={item.priority}
              whyItMatters={cleanCustomerText(item.whyItMatters ?? item.rationale)}
              nextStep={cleanCustomerText(item.suggestedContentPurpose)}
              includeItems={compactList(
                ["Generate title", "Generate outline", "Generate draft", "Generate featured image", "Generate internal link plan"],
                5
              )}
              includeLabel="What will be generated"
              primaryAction="Queue this content asset for generation."
              detailItems={[
                { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                {
                  label: "Expected impact",
                  value: item.expectedSelectionImpact ? cleanCustomerText(item.expectedSelectionImpact) : null,
                },
                { label: "Target intent", value: item.targetIntent ? toPlainIntent(item.targetIntent) : null },
                { label: "Suggested angle", value: item.suggestedAngle ? cleanCustomerText(item.suggestedAngle) : null },
                {
                  label: "Internal linking plan",
                  value: item.suggestedInternalLinkPattern ? cleanCustomerText(item.suggestedInternalLinkPattern) : null,
                },
              ]}
            />
          ))}
          {contentStructure?.items.slice(0, 2).map((item) => (
            <CompactRecommendationCard
              key={item.id}
              title={`Structure: ${cleanCustomerText(item.title)}`}
              priority={item.priority}
              whyItMatters={cleanCustomerText(item.whyThisStructureMatters)}
              nextStep={`Use "${cleanCustomerText(item.suggestedH1)}" and the suggested section order when drafting.`}
              includeItems={compactList(item.suggestedSections, 4)}
              includeLabel="Outline starter"
              primaryAction="Apply this structure in the draft."
              detailItems={[
                { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                { label: "Title pattern", value: cleanCustomerText(item.recommendedTitlePattern) },
                {
                  label: "Suggested components",
                  value: item.suggestedComponents.map((value) => cleanCustomerText(value)).join(", "),
                },
              ]}
            />
          ))}
        </div>
      </HudCard>
    ),
    "upgrade-the-listing": (
      <HudCard title="Step 4: Upgrade the listing" subtitle={MISSION_STEPS[3].subtitle}>
        {multiActionLoading ? <div className="text-sm text-slate-300">Preparing listing upgrade actions...</div> : null}
        {multiActionError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {multiActionError}
          </div>
        ) : null}
        <div className="mt-3 space-y-2">
          {listingUpgradeItems.map((item) => (
            <CompactRecommendationCard
              key={item.actionId}
              title={cleanCustomerText(item.title)}
              priority={item.recommendedPriority}
              whyItMatters={cleanCustomerText(item.whyItMatters)}
              nextStep={cleanCustomerText(item.description)}
              includeItems={compactList([item.expectedImpact])}
              includeLabel="Expected outcome"
              primaryAction={item.readinessState === "blocked" ? "Unblock dependencies, then run this." : "Run this listing upgrade now."}
              detailItems={[
                { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                {
                  label: "Dependencies",
                  value: item.dependencies.length ? item.dependencies.map((value) => cleanCustomerText(value)).join(", ") : "None",
                },
                {
                  label: "Blocking reasons",
                  value: item.blockingReasons?.length ? item.blockingReasons.map((value) => cleanCustomerText(value)).join(" ") : null,
                },
              ]}
            />
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-3">
          <h4 className="text-sm font-semibold text-cyan-100">Listing copy upgrade</h4>
          {optimizeActionBlocked ? (
            <div className="mt-2 text-sm text-amber-100">
              {optimizeListingAction?.blockingReasons?.join(" ") ?? "This action is currently blocked."}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <NeonButton onClick={() => void generateUpgrade()} disabled={state === "generating" || !optimizeActionExecutable}>
              {state === "generating" ? "Preparing..." : "Generate listing upgrade"}
            </NeonButton>
            {(state === "generated" || state === "previewing" || state === "ready_to_push" || state === "done") && draftId ? (
              <NeonButton variant="secondary" onClick={() => void previewChanges()} disabled={state === "previewing" || !optimizeActionExecutable}>
                {state === "previewing" ? "Preparing..." : "Preview upgrade"}
              </NeonButton>
            ) : null}
            {(state === "generated" || state === "ready_to_push" || state === "done") ? (
              <NeonButton variant="secondary" onClick={() => void generateUpgrade()} disabled={!optimizeActionExecutable}>
                Regenerate
              </NeonButton>
            ) : null}
          </div>
          {(state === "generated" || state === "ready_to_push" || state === "done") && proposedDescription ? (
            <details open className="mt-3 rounded-lg border border-white/10 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">Show details</summary>
              <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-900/80 p-3 text-sm text-slate-200">{proposedDescription}</pre>
            </details>
          ) : null}
        </div>
      </HudCard>
    ),
    "launch-and-measure": (
      <HudCard title="Step 5: Launch and measure" subtitle={MISSION_STEPS[4].subtitle}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Ready to launch</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-100">{launchReadyItems.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Blocked</div>
            <div className="mt-1 text-2xl font-semibold text-amber-100">{launchBlockedItems.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Score right now</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{displayScore}</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {launchReadyItems.slice(0, 4).map((item) => (
            <CompactRecommendationCard
              key={item.actionId}
              title={cleanCustomerText(item.title)}
              priority={item.recommendedPriority}
              whyItMatters={cleanCustomerText(item.whyItMatters)}
              nextStep="Review and publish this item in the current launch cycle."
              primaryAction="Publish this approved improvement."
              detailItems={[
                { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                {
                  label: "Dependencies",
                  value: item.dependencies.length ? item.dependencies.map((value) => cleanCustomerText(value)).join(", ") : "None",
                },
              ]}
            />
          ))}
        </div>
        {state === "ready_to_push" ? (
          <div className="mt-4 space-y-3 rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-3">
            <h4 className="text-sm font-semibold text-cyan-100">Final review before publish</h4>
            <div className="max-h-96 overflow-auto rounded border border-white/10">
              {diffRows.map((row, index) => (
                <div key={`${row.type}-${index}`} className="grid grid-cols-2 gap-2 border-b border-white/10 p-2 text-xs">
                  <div className="rounded bg-slate-900/80 p-2 text-slate-300">{row.left || " "}</div>
                  <div className="rounded bg-slate-900/80 p-2 text-cyan-100">{row.right || " "}</div>
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
                className="mt-0.5"
              />
              <span>I reviewed the changes and approve launch.</span>
            </label>
            <NeonButton onClick={() => void approveAndPush()} disabled={!approved || !integrations.bdConfigured}>
              Publish improvements
            </NeonButton>
          </div>
        ) : null}
      </HudCard>
    ),
  };

  return (
    <>
      <TopBar
        breadcrumbs={["Home", "DirectoryIQ", "AI Visibility"]}
        searchPlaceholder="Search AI visibility..."
      />

      <ListingHero
        title={displayName}
        subtitle={displayUrl ?? undefined}
        imageUrl={listing?.listing.mainImageUrl ?? null}
        score={displayScore}
        chips={[
          {
            label:
              integrations.openaiConfigured === null
                ? "AI Status Pending"
                : integrations.openaiConfigured
                  ? "AI Connected"
                  : "AI Not Connected",
            tone: integrations.openaiConfigured === null ? "neutral" : integrations.openaiConfigured ? "good" : "warn",
          },
          {
            label:
              integrations.bdConfigured === null
                ? "Website Status Pending"
                : integrations.bdConfigured
                  ? "Website Connected"
                  : "Website Not Connected",
            tone: integrations.bdConfigured === null ? "neutral" : integrations.bdConfigured ? "good" : "warn",
          },
        ]}
      />

      {integrations.openaiConfigured === false ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          AI connection not configured. Configure it in{" "}
          <Link href="/directoryiq/signal-sources?connector=openai" className="underline">Connections</Link>.
        </div>
      ) : null}

      {integrations.bdConfigured === false ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Website connection not configured. Configure it in{" "}
          <Link href="/directoryiq/signal-sources?connector=brilliant-directories" className="underline">Connections</Link>.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error.message}
          {error.status !== undefined ? ` (status: ${error.status})` : ""}
          {error.listingId ? " (listing context unavailable)" : ""}
          {error.reqId ? ` (reqId: ${error.reqId})` : ""}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <div
        className="sticky top-14 z-20 -mx-2 rounded-xl border border-white/10 bg-slate-950/95 px-2 py-2 backdrop-blur lg:hidden"
        data-testid="listing-mobile-sticky-strip"
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{`Step ${activeStepIndex + 1}`}</div>
            <div className="text-sm font-semibold text-slate-100">{activeStepConfig.title}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.08em] text-cyan-100">Mission Progress</div>
            <div className="text-base font-semibold text-cyan-100">{missionProgress}%</div>
            <div className="text-[11px] text-slate-300">{missionProgressLabel}</div>
          </div>
        </div>
        <div className="mt-2">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Mission steps">
            {MISSION_STEPS.map((step, index) => {
              const isActive = step.id === activeStepId;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`min-w-fit rounded-lg border px-3 py-2 text-left text-xs transition ${
                    isActive
                      ? "border-cyan-300/50 bg-cyan-400/20 text-cyan-100"
                      : "border-white/15 bg-white/[0.03] text-slate-300"
                  }`}
                  onClick={() => setMissionStep(step.id, { lock: true, persistInUrl: true })}
                  data-testid={`listing-step-nav-mobile-${step.id}`}
                >
                  <div className="font-semibold">{`Step ${index + 1}: ${step.title}`}</div>
                  <div className="text-[11px] text-slate-400">{missionStepStatusLabel(stepStatusMap[step.id])}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="listing-summary-cards">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Selection Score</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{displayScore}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Biggest Blocker</div>
          <div className="mt-1 text-sm font-medium text-slate-100">{biggestBlocker}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Fastest Win</div>
          <div className="mt-1 text-sm font-medium text-slate-100">{fastestWin}</div>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-3" data-testid="listing-mission-progress-card">
          <div className="text-xs uppercase tracking-[0.08em] text-cyan-100">Mission Progress</div>
          <div className="mt-1 text-2xl font-semibold text-cyan-100" data-testid="listing-mission-progress-percent">{missionProgress}%</div>
          <div className="text-xs text-cyan-100/90">{missionProgressLabel}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[220px,minmax(0,1fr),240px] lg:items-start">
        <aside className="hidden lg:block lg:sticky lg:top-32">
          <nav className="rounded-xl border border-white/10 bg-slate-950/65 p-3" aria-label="Mission step navigation">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mission Steps</div>
            <div className="mt-3 space-y-2">
              {MISSION_STEPS.map((step, index) => {
                const isActive = step.id === activeStepId;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isActive
                        ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25"
                    }`}
                    onClick={() => setMissionStep(step.id, { lock: true, persistInUrl: true })}
                    data-testid={`listing-step-nav-desktop-${step.id}`}
                  >
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">{`Step ${index + 1}`}</div>
                    <div className="mt-1 text-sm font-semibold">{step.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{missionStepStatusLabel(stepStatusMap[step.id])}</div>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-300">
            <div className="font-semibold text-slate-100">{`Current step: Step ${activeStepIndex + 1} - ${activeStepConfig.title}`}</div>
            <div className="mt-1">Status: {missionStepStatusLabel(stepStatusMap[activeStepConfig.id])}</div>
            <div className="mt-1">{activeStepConfig.subtitle}</div>
          </div>
          <div data-testid="listing-active-step-workspace">{stepPanels[activeStepId]}</div>
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-32">
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Quick Wins</div>
              <div className="mt-2 text-sm text-slate-200">{fastestWin}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Biggest Blocker</div>
              <div className="mt-2 text-sm text-slate-200">{biggestBlocker}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Ready to Launch</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-100">{launchReadyItems.length}</div>
            </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 mt-4 rounded-xl border border-white/10 bg-slate-950/95 p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setMissionStep(MISSION_STEPS[activeStepIndex - 1].id, { lock: true, persistInUrl: true })}
            disabled={!canGoBack}
            data-testid="listing-step-back"
          >
            Back
          </button>
          <button
            type="button"
            className="rounded-lg border border-cyan-300/30 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-cyan-100"
            onClick={() => setMissionStep(recommendedStepId, { lock: true, persistInUrl: true })}
            data-testid="listing-step-review"
          >
            Save / Review
          </button>
          <button
            type="button"
            className="rounded-lg border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-sm font-medium text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={goToNextStep}
            disabled={!canGoNext}
            data-testid="listing-step-next"
          >
            Next step
          </button>
        </div>
      </div>
    </>
  );
}
