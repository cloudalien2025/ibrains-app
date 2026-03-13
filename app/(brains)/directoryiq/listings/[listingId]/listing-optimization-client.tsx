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
type WorkspaceView = "helping" | "missing" | "improvements" | "publish";

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

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

function toPlainLabel(value: string): string {
  return value
    .replace(UUID_PATTERN, "this location")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleWords(value: string): string {
  const plain = toPlainLabel(value);
  if (!plain) return plain;
  return plain
    .split(" ")
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function toPlainIntent(value: string): string {
  const mapped: Record<string, string> = {
    choose_best_dining_option: "Be the first choice for nearby diners",
    book_best_place_to_stay: "Be the trusted place to book nearby",
    select_best_local_activity: "Be the easiest local activity to choose",
    hire_trusted_local_service: "Be the trusted local service to hire",
    select_best_local_option: "Be the clear local choice in this area",
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

function cleanCustomerText(value: string): string {
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

function toListingReference(value?: string | null): string {
  if (!value) return "this listing";
  if (UUID_PATTERN.test(value) || /^\d+$/.test(value)) return "this listing";
  return toPlainLabel(value);
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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("helping");

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
    setNotice("Upgrade draft generated.");
  }

  async function previewChanges() {
    if (!effectiveListingId || !draftId) return;

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
    setNotice("Listing upgrade pushed successfully.");
    await loadListingAndIntegrations();
  }

  const fallbackId = effectiveListingId || (listingId && listingId !== "undefined" && listingId !== "null" ? listingId : "");
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
  const stepLabels: Record<WorkspaceView, string> = {
    helping: "Step 1: Confirm what this listing should be known for",
    missing: "Step 2: Find what is still missing",
    improvements: "Step 3: Add the right content and proof",
    publish: "Step 4: Review and publish improvements",
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Support Signals Found</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">
            {topMetricValue(supportSummary?.inboundLinkedSupportCount, {
              loading: supportLoading,
              unresolved: supportUnresolved,
            })}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Things Still Missing</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">
            {topMetricValue(gapsSummary?.totalGaps, {
              loading: gapsLoading,
              unresolved: gapsUnresolved,
            })}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Next Improvements</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">
            {topMetricValue(actions?.summary.totalActions, {
              loading: actionsLoading,
              unresolved: Boolean(actionsError) || (!actionsLoading && !actions),
            })}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Proof Pages Connected</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">
            {topMetricValue(supportSummary?.connectedSupportPageCount, {
              loading: supportLoading,
              unresolved: supportUnresolved,
            })}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-100">
        {stepLabels[workspaceView]}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setWorkspaceView("helping")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "helping" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          Step 1: What's Helping
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceView("missing")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "missing" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          Step 2: What's Missing
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceView("improvements")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "improvements" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          Step 3: Recommended Improvements
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceView("publish")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "publish" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          Step 4: Publish
        </button>
      </div>

      {workspaceView === "helping" ? (
      <>
      <HudCard title="Step 1: What's Helping And What This Listing Should Be Known For" subtitle="Start with the goal, then review the proof already connected to this listing.">
        {supportError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {supportError}
          </div>
        ) : null}

        {supportLoading ? <div className="text-sm text-slate-300">Loading support diagnostics...</div> : null}
        {supportUnresolved ? (
          <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Support diagnostics are not available yet.
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Supporting Links In</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(supportSummary?.inboundLinkedSupportCount, {
                loading: supportLoading,
                unresolved: supportUnresolved,
              })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mentions Without Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(supportSummary?.mentionWithoutLinkCount, {
                loading: supportLoading,
                unresolved: supportUnresolved,
              })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Outbound Support Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(supportSummary?.outboundSupportLinkCount, {
                loading: supportLoading,
                unresolved: supportUnresolved,
              })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Connected Support Pages</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(supportSummary?.connectedSupportPageCount, {
                loading: supportLoading,
                unresolved: supportUnresolved,
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          {supportSummary?.lastGraphRunAt
            ? `Last graph refresh: ${new Date(supportSummary?.lastGraphRunAt).toLocaleString()}`
            : "Last graph refresh: Not available yet."}
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">What this listing should be known for</div>
          <div className="mt-1 text-base font-semibold text-slate-100">{toPlainIntent(intentProfile.primaryIntent)}</div>
          {intentProfile.secondaryIntents.length ? (
            <div className="mt-2 text-xs text-slate-300">
              Also relevant for: {intentProfile.secondaryIntents.slice(0, 3).map((value) => toPlainLabel(value)).join(", ")}
            </div>
          ) : null}
        </div>

        <div className="mt-5 space-y-5">
          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Helpful pages already linking here</div>
            <div className="mt-2 space-y-2">
              {support?.inboundLinkedSupport?.length ? (
                support.inboundLinkedSupport.map((item) => (
                  <div key={`${item.sourceId}-${item.url ?? ""}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? "Support page"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.sourceType} · Anchors: {item.anchors.length ? item.anchors.join(", ") : "None captured"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">
                  {supportUnresolved ? "Support diagnostics are not available yet." : "No inbound linked support detected yet."}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mentions that need a link</div>
            <div className="mt-2 space-y-2">
              {support?.mentionsWithoutLinks?.length ? (
                support.mentionsWithoutLinks.map((item) => (
                  <div key={`${item.sourceId}-${item.url ?? ""}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? "Mentioned support page"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.sourceType} · {item.mentionSnippet ?? "No snippet captured"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">
                  {supportUnresolved ? "Support diagnostics are not available yet." : "No unlinked mentions detected yet."}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Helpful pages linked from this listing</div>
            <div className="mt-2 space-y-2">
              {support?.outboundSupportLinks?.length ? (
                support.outboundSupportLinks.map((item, index) => (
                  <div key={`${item.targetId ?? "target"}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.url ?? "Support link"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.targetType ?? "support"} · Listing links out</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">
                  {supportUnresolved ? "Support diagnostics are not available yet." : "No outbound support links detected yet."}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Support pages already connected</div>
            <div className="mt-2 space-y-2">
              {support?.connectedSupportPages?.length ? (
                support.connectedSupportPages.map((item, index) => (
                  <div key={`${item.id ?? "support"}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? "Support page"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.type}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">
                  {supportUnresolved ? "Support diagnostics are not available yet." : "No connected support pages detected yet."}
                </div>
              )}
            </div>
          </section>
        </div>
      </HudCard>

      <HudCard title="Proof and Trust Signals" subtitle="Suggested link improvements that strengthen trust and visibility.">
        {flywheelError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {flywheelError}
          </div>
        ) : null}

        {flywheelLoading && !flywheelError ? (
          <div className="text-sm text-slate-300">Evaluating flywheel links...</div>
        ) : null}

        {flywheel && !flywheelError ? (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total Recommendations</div>
                <div className="mt-1 text-2xl font-semibold text-slate-100">{flywheel.summary.totalRecommendations}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">High Priority</div>
                <div className="mt-1 text-2xl font-semibold text-rose-200">{flywheel.summary.highPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Medium Priority</div>
                <div className="mt-1 text-2xl font-semibold text-amber-100">{flywheel.summary.mediumPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Low Priority</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-100">{flywheel.summary.lowPriorityCount}</div>
              </div>
            </div>

            {flywheel.summary.dataStatus === "no_major_flywheel_opportunities" ? (
              <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major flywheel opportunities found.
              </div>
            ) : null}

            {flywheel.summary.dataStatus === "flywheel_opportunities_found" ? (
              <div className="mt-4 space-y-2">
                {flywheel.items.map((item) => (
                  <CompactRecommendationCard
                    key={item.key}
                    title={cleanCustomerText(item.title)}
                    priority={item.priority}
                    whyItMatters={cleanCustomerText(item.rationale)}
                    nextStep={`Link ${cleanCustomerText(item.sourceEntity.title)} to ${cleanCustomerText(item.targetEntity.title)} with contextual language.`}
                    includeItems={compactList([
                      item.anchorGuidance?.suggestedAnchorText ? `Anchor text: ${item.anchorGuidance.suggestedAnchorText}` : null,
                    ])}
                    includeLabel="What to include"
                    primaryAction="Add or repair the recommended internal link pair."
                    detailItems={[
                      { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                      { label: "Source", value: cleanCustomerText(item.sourceEntity.title) },
                      { label: "Target", value: cleanCustomerText(item.targetEntity.title) },
                      { label: "Anchor guidance", value: item.anchorGuidance?.guidance ? cleanCustomerText(item.anchorGuidance.guidance) : null },
                      {
                        label: "Related gaps",
                        value: item.linkedGapTypes?.length ? item.linkedGapTypes.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                      { label: "Recommendation type", value: cleanCustomerText(item.type) },
                      { label: "Suggested surface", value: item.suggestedSurface ? cleanCustomerText(item.suggestedSurface) : null },
                    ]}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>
      </>
      ) : null}

      {workspaceView === "missing" ? (
      <HudCard title="Step 2: Find What Is Still Missing" subtitle="These are the biggest missing proof points to fix next.">
        {gapsError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {gapsError}
          </div>
        ) : null}

        {gapsLoading && !gapsError ? (
          <div className="text-sm text-slate-300">Evaluating visibility gaps...</div>
        ) : null}

        {gapsSummary?.dataStatus === "analysis_unavailable" && !gapsLoading && !gapsError ? (
          <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Gap analysis is not available yet.
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total Gaps</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {topMetricValue(gapsSummary?.totalGaps, { loading: gapsLoading, unresolved: gapsUnresolved })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">High Severity</div>
            <div className="mt-1 text-2xl font-semibold text-rose-200">
              {topMetricValue(gapsSummary?.highCount, { loading: gapsLoading, unresolved: gapsUnresolved })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Medium Severity</div>
            <div className="mt-1 text-2xl font-semibold text-amber-100">
              {topMetricValue(gapsSummary?.mediumCount, { loading: gapsLoading, unresolved: gapsUnresolved })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Low Severity</div>
            <div className="mt-1 text-2xl font-semibold text-cyan-100">
              {topMetricValue(gapsSummary?.lowCount, { loading: gapsLoading, unresolved: gapsUnresolved })}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          {gapsSummary?.lastGraphRunAt
            ? `Last graph refresh: ${new Date(gapsSummary?.lastGraphRunAt).toLocaleString()}`
            : "Last graph refresh: Not available yet."}
        </div>

        {gapsSummary?.dataStatus === "no_meaningful_gaps" && !gapsError ? (
          <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            No major visibility gaps found for this listing.
          </div>
        ) : null}

        {gapsSummary?.dataStatus === "gaps_found" ? (
          <div className="mt-4 space-y-2">
            {gaps?.items.map((item) => (
              <CompactRecommendationCard
                key={item.type}
                title={cleanCustomerText(item.title)}
                priority={item.severity}
                whyItMatters={cleanCustomerText(item.explanation)}
                nextStep="Add the missing proof directly on the listing or in a support page, then connect it with a clear link."
                includeItems={compactList(item.evidence?.anchors ?? [])}
                includeLabel="What to include"
                primaryAction="Close this gap in your next update cycle."
                detailItems={[
                  { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                  { label: "Internal category", value: cleanCustomerText(item.type) },
                  { label: "URLs", value: item.evidence?.urls?.slice(0, 3).join(", ") ?? null },
                  { label: "Entities", value: item.evidence?.entities?.slice(0, 4).join(", ") ?? null },
                ]}
              />
            ))}
          </div>
        ) : null}
      </HudCard>
      ) : null}

      {workspaceView === "improvements" ? (
      <>
      <HudCard title="Step 3: Recommended Improvements" subtitle="Here is what to create or update next, in plain priority order.">
        {actionsError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {actionsError}
          </div>
        ) : null}

        {actionsLoading && !actionsError ? (
          <div className="text-sm text-slate-300">Evaluating recommended actions...</div>
        ) : null}

        {actions && !actionsError ? (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total Actions</div>
                <div className="mt-1 text-2xl font-semibold text-slate-100">{actions.summary.totalActions}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">High Priority</div>
                <div className="mt-1 text-2xl font-semibold text-rose-200">{actions.summary.highPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Medium Priority</div>
                <div className="mt-1 text-2xl font-semibold text-amber-100">{actions.summary.mediumPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Low Priority</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-100">{actions.summary.lowPriorityCount}</div>
              </div>
            </div>

            {actions.summary.dataStatus === "no_major_actions_recommended" ? (
              <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major actions recommended at this time.
              </div>
            ) : null}

            {actions.summary.dataStatus === "actions_recommended" ? (
              <div className="mt-4 space-y-2">
                {actions.items.map((item) => (
                  <CompactRecommendationCard
                    key={item.key}
                    title={cleanCustomerText(item.title)}
                    priority={item.priority}
                    whyItMatters={cleanCustomerText(item.rationale)}
                    nextStep={
                      item.targetSurface
                        ? `Apply this on the ${cleanCustomerText(item.targetSurface)} surface first.`
                        : "Apply this in the next listing optimization update."
                    }
                    primaryAction="Execute this recommendation in priority order."
                    detailItems={[
                      { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                      {
                        label: "Related missing items",
                        value: item.linkedGapTypes?.length ? item.linkedGapTypes.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                      {
                        label: "Dependencies",
                        value: item.dependsOn?.length ? item.dependsOn.map((value) => cleanCustomerText(value)).join(", ") : "None",
                      },
                      { label: "Target surface", value: item.targetSurface ? cleanCustomerText(item.targetSurface) : null },
                    ]}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>

      <HudCard title="What This Listing Should Be Known For" subtitle="This keeps your content focused on the right customer intent.">
        {intentClustersError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {intentClustersError}
          </div>
        ) : null}

        {intentClustersLoading && !intentClustersError ? (
          <div className="text-sm text-slate-300">Resolving selection intent clusters...</div>
        ) : null}

        {intentClusters && !intentClustersError ? (
          <>
            <CompactRecommendationCard
              title={toPlainIntent(intentProfile.primaryIntent)}
              priority={intentProfile.confidence}
              whyItMatters="This defines how customers evaluate this listing and which proof to prioritize first."
              nextStep="Center your listing copy and support content around this primary decision intent."
              includeItems={compactList(
                intentProfile.missingEntities.length ? intentProfile.missingEntities : intentProfile.targetEntities,
                5
              )}
              includeLabel={intentProfile.missingEntities.length ? "What to include next" : "Topics to emphasize"}
              primaryAction="Align your next content update to this intent before adding more assets."
              detailItems={[
                {
                  label: "Secondary intents",
                  value: intentProfile.secondaryIntents.length
                    ? intentProfile.secondaryIntents.map((intent) => toPlainIntent(intent)).join(", ")
                    : "None resolved",
                },
                {
                  label: "Local modifiers",
                  value: intentProfile.localModifiers.length ? intentProfile.localModifiers.map((value) => cleanCustomerText(value)).join(", ") : "None detected",
                },
                {
                  label: "Helpful supporting topics",
                  value: intentProfile.supportingEntities.length
                    ? intentProfile.supportingEntities.map((value) => cleanCustomerText(value)).join(", ")
                    : "None resolved",
                },
                {
                  label: "Already covered",
                  value: intentProfile.supportedEntities.length
                    ? intentProfile.supportedEntities.map((value) => cleanCustomerText(value)).join(", ")
                    : "No verified support entities yet",
                },
                {
                  label: "Comparison ideas",
                  value: intentProfile.comparisonFrames.length
                    ? intentProfile.comparisonFrames.map((value) => cleanCustomerText(value)).join(", ")
                    : "No comparison ideas yet",
                },
                {
                  label: "Priority ranking",
                  value: intentProfile.clusterPriorityRanking.length
                    ? intentProfile.clusterPriorityRanking
                        .map((cluster) => `${cleanCustomerText(cluster.title)} (${toPriorityLabel(cluster.priority)})`)
                        .join(", ")
                    : "No ranking details",
                },
              ]}
            />

            {intentClusters.summary.dataStatus === "no_major_reinforcement_intent_clusters_identified" ? (
              <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major reinforcement intent clusters identified.
              </div>
            ) : null}

            {intentClusters.summary.dataStatus === "clusters_identified" ? (
              <div className="mt-4 space-y-2">
                {intentClusters.items.map((item) => (
                  <CompactRecommendationCard
                    key={item.id}
                    title={cleanCustomerText(item.title)}
                    priority={item.priority}
                    whyItMatters={cleanCustomerText(item.rationale)}
                    nextStep={
                      item.suggestedReinforcementDirection
                        ? cleanCustomerText(item.suggestedReinforcementDirection.direction)
                        : "Create the related support asset and connect it back to this listing."
                    }
                    primaryAction="Implement this focus area in the next support content update."
                    detailItems={[
                      { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                      {
                        label: "Related missing items",
                        value: item.linkedGapTypes?.length ? item.linkedGapTypes.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                      {
                        label: "Related actions",
                        value: item.linkedActionKeys?.length ? item.linkedActionKeys.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                      {
                        label: "Linked flywheel types",
                        value: item.linkedFlywheelTypes?.length ? item.linkedFlywheelTypes.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                    ]}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>

      <HudCard title="What To Create Next (Content Plan)" subtitle="Content ideas to build trust, prove fit, and help customers choose this listing.">
        {reinforcementPlanError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {reinforcementPlanError}
          </div>
        ) : null}

        {reinforcementPlanLoading && !reinforcementPlanError ? (
          <div className="text-sm text-slate-300">Building reinforcement plan...</div>
        ) : null}

        {reinforcementPlan && !reinforcementPlanError ? (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total Plan Items</div>
                <div className="mt-1 text-2xl font-semibold text-slate-100">{reinforcementPlan.summary.totalPlanItems}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">High Priority</div>
                <div className="mt-1 text-2xl font-semibold text-rose-200">{reinforcementPlan.summary.highPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Medium Priority</div>
                <div className="mt-1 text-2xl font-semibold text-amber-100">{reinforcementPlan.summary.mediumPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Low Priority</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-100">{reinforcementPlan.summary.lowPriorityCount}</div>
              </div>
            </div>

            {reinforcementPlan.summary.dataStatus === "no_major_reinforcement_plan_items_identified" ? (
              <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major reinforcement plan items identified.
              </div>
            ) : null}

            {reinforcementPlan.summary.dataStatus === "plan_items_identified" ? (
              <div className="mt-4 space-y-2">
                {reinforcementPlan.items.map((item) => (
                  <CompactRecommendationCard
                    key={item.id}
                    title={cleanCustomerText(item.title)}
                    priority={item.priority}
                    whyItMatters={cleanCustomerText(item.whyItMatters ?? item.rationale)}
                    nextStep={cleanCustomerText(item.suggestedContentPurpose)}
                    includeItems={compactList(
                      item.missingSupportEntities?.length
                        ? item.missingSupportEntities
                        : [item.suggestedAngle, item.targetIntent ? toPlainIntent(item.targetIntent) : null]
                    )}
                    includeLabel="What to include"
                    primaryAction="Create this asset and link it to the listing and related proof pages."
                    detailItems={[
                      { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                      { label: "Expected impact", value: item.expectedSelectionImpact ? cleanCustomerText(item.expectedSelectionImpact) : null },
                      { label: "Target intent", value: item.targetIntent ? toPlainIntent(item.targetIntent) : null },
                      { label: "Suggested angle", value: item.suggestedAngle ? cleanCustomerText(item.suggestedAngle) : null },
                      { label: "Priority context", value: item.rankingContext ? cleanCustomerText(item.rankingContext) : null },
                      { label: "Recommendation type", value: item.recommendationType ? cleanCustomerText(item.recommendationType) : null },
                      { label: "Target surface", value: cleanCustomerText(item.suggestedTargetSurface) },
                      { label: "Internal linking pattern", value: item.suggestedInternalLinkPattern ? cleanCustomerText(item.suggestedInternalLinkPattern) : null },
                      {
                        label: "Related missing items",
                        value: item.linkedGapTypes?.length ? item.linkedGapTypes.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                      {
                        label: "Related actions",
                        value: item.linkedActionKeys?.length ? item.linkedActionKeys.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                      { label: "Reinforces", value: item.reinforcesListingId ? toListingReference(item.reinforcesListingId) : null },
                    ]}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>

      <HudCard title="How To Organize This Page" subtitle="A simple page blueprint based on intent and proven search patterns.">
        {contentStructureError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {contentStructureError}
          </div>
        ) : null}

        {contentStructureLoading && !contentStructureError ? (
          <div className="text-sm text-slate-300">Evaluating SERP-informed content structure...</div>
        ) : null}

        {contentStructure && !contentStructureError ? (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total Recommendations</div>
                <div className="mt-1 text-2xl font-semibold text-slate-100">{contentStructure.summary.totalRecommendations}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">High Priority</div>
                <div className="mt-1 text-2xl font-semibold text-rose-200">{contentStructure.summary.highPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Medium Priority</div>
                <div className="mt-1 text-2xl font-semibold text-amber-100">{contentStructure.summary.mediumPriorityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Low Priority</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-100">{contentStructure.summary.lowPriorityCount}</div>
              </div>
            </div>

            {contentStructure.serpPatternSummary ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                SERP pattern coverage: {contentStructure.serpPatternSummary.readySlotCount}/{contentStructure.serpPatternSummary.totalSlotCount} ready slot
                {contentStructure.serpPatternSummary.readySlotCount === 1 ? "" : "s"}
                {contentStructure.serpPatternSummary.targetLengthBand
                  ? ` · target length ${contentStructure.serpPatternSummary.targetLengthBand.min}-${contentStructure.serpPatternSummary.targetLengthBand.max} words (median ${contentStructure.serpPatternSummary.targetLengthBand.median})`
                  : ""}
                {` · source ${toPlainLabel(contentStructure.summary.serpPatternSource)}`}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                SERP pattern coverage is not available yet; structure recommendations are based on {toPlainLabel(contentStructure.summary.serpPatternSource)}.
              </div>
            )}

            {contentStructure.summary.dataStatus === "no_major_structure_recommendations_identified" ? (
              <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major structure recommendations identified.
              </div>
            ) : null}

            {contentStructure.summary.dataStatus === "structure_recommendations_identified" ? (
              <div className="mt-4 space-y-2">
                {contentStructure.items.map((item) => (
                  <CompactRecommendationCard
                    key={item.id}
                    title={cleanCustomerText(item.title)}
                    priority={item.priority}
                    whyItMatters={cleanCustomerText(item.whyThisStructureMatters)}
                    nextStep={`Use "${cleanCustomerText(item.suggestedH1)}" as the page H1 and follow the suggested section order.`}
                    includeItems={compactList(item.suggestedSections, 4)}
                    includeLabel="What to include"
                    primaryAction="Use this blueprint when creating or updating the page."
                    detailItems={[
                      { label: "Rationale", value: cleanCustomerText(item.rationale) },
                      { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                      { label: "Recommended asset type", value: cleanCustomerText(item.recommendedContentType) },
                      { label: "Title pattern", value: cleanCustomerText(item.recommendedTitlePattern) },
                      { label: "Suggested H2 structure", value: item.suggestedH2Structure.map((value) => cleanCustomerText(value)).join(" | ") },
                      { label: "Suggested components", value: item.suggestedComponents.map((value) => cleanCustomerText(value)).join(", ") },
                      { label: "Comparison criteria", value: item.comparisonCriteria.length ? item.comparisonCriteria.map((value) => cleanCustomerText(value)).join(", ") : null },
                      { label: "FAQ themes", value: item.faqThemes.length ? item.faqThemes.map((value) => cleanCustomerText(value)).join(", ") : null },
                      { label: "Local modifiers", value: item.localModifiers.length ? item.localModifiers.map((value) => cleanCustomerText(value)).join(", ") : null },
                      {
                        label: "Entity coverage targets",
                        value: item.entityCoverageTargets.length ? item.entityCoverageTargets.map((value) => cleanCustomerText(value)).join(", ") : null,
                      },
                      {
                        label: "Internal link opportunities",
                        value: item.internalLinkOpportunities.length
                          ? item.internalLinkOpportunities.map((value) => cleanCustomerText(value)).join(" | ")
                          : null,
                      },
                      {
                        label: "Related content ideas",
                        value: item.linkedReinforcementItemIds?.length
                          ? item.linkedReinforcementItemIds.map((value) => cleanCustomerText(value)).join(", ")
                          : null,
                      },
                      {
                        label: "Common headings",
                        value: item.serpPatternSummary?.commonHeadings?.length
                          ? item.serpPatternSummary.commonHeadings.map((value) => cleanCustomerText(value)).join(", ")
                          : null,
                      },
                    ]}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>
      </>
      ) : null}

      {workspaceView === "publish" ? (
      <HudCard
        title="Step 4: Review And Publish Improvements"
        subtitle="Follow this guided checklist to publish the right improvements in order."
      >
        {multiActionError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {multiActionError}
          </div>
        ) : null}

        {multiActionLoading && !multiActionError ? (
          <div className="text-sm text-slate-300">Preparing improvement options...</div>
        ) : null}

        {multiAction && !multiActionError ? (
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total Actions</div>
                <div className="mt-1 text-2xl font-semibold text-slate-100">{multiAction.summary.totalActions}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Available</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-100">{multiAction.summary.availableCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Blocked</div>
                <div className="mt-1 text-2xl font-semibold text-amber-100">{multiAction.summary.blockedCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Not Recommended</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-100">{multiAction.summary.notRecommendedCount}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Ready Actions</div>
                <div className="mt-1 text-xl font-semibold text-emerald-100">{multiAction.grouped?.byReadiness?.ready?.length ?? 0}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Blocked Actions</div>
                <div className="mt-1 text-xl font-semibold text-amber-100">{multiAction.grouped?.byReadiness?.blocked?.length ?? 0}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Abstained Actions</div>
                <div className="mt-1 text-xl font-semibold text-cyan-100">{multiAction.grouped?.byReadiness?.abstained?.length ?? 0}</div>
              </div>
            </div>

            {multiAction.summary.dataStatus === "no_major_upgrade_actions_available" ? (
              <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major upgrade actions available.
              </div>
            ) : null}

            {multiAction.summary.dataStatus === "upgrade_actions_available" ? (
              <div className="space-y-4">
                {(["ready", "blocked", "abstained"] as const).map((groupKey) => {
                  const groupedItems = multiAction.items.filter((item) => item.readinessState === groupKey);
                  if (!groupedItems.length) return null;
                  return (
                    <div key={groupKey} className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.08em] text-slate-400">
                        {groupKey === "ready" ? "Ready Actions" : groupKey === "blocked" ? "Blocked Actions" : "Abstained Actions"}
                      </div>
                      {groupedItems.map((item) => (
                        <CompactRecommendationCard
                          key={item.actionId}
                          title={cleanCustomerText(item.title)}
                          priority={item.recommendedPriority}
                          whyItMatters={cleanCustomerText(item.whyItMatters)}
                          nextStep={cleanCustomerText(item.description)}
                          includeItems={compactList([
                            item.expectedImpact,
                            item.sourceSignals.primaryIntent ? `Primary intent: ${toPlainIntent(item.sourceSignals.primaryIntent)}` : null,
                          ])}
                          includeLabel="What to include"
                          primaryAction={
                            item.readinessState === "blocked"
                              ? "Unblock dependencies first, then run this action."
                              : "Run this action in this publish cycle."
                          }
                          detailItems={[
                            { label: "Evidence", value: cleanCustomerText(item.evidenceSummary) },
                            { label: "Readiness", value: cleanCustomerText(item.readinessState) },
                            { label: "Target surface", value: cleanCustomerText(item.targetSurface) },
                            {
                              label: "Dependencies",
                              value: item.dependencies.length ? item.dependencies.map((value) => cleanCustomerText(value)).join(", ") : "None",
                            },
                            {
                              label: "Related missing items",
                              value: item.linkedGapTypes?.length ? item.linkedGapTypes.map((value) => cleanCustomerText(value)).join(", ") : null,
                            },
                            {
                              label: "Related focus signals",
                              value: item.linkedIntentClusterIds?.length
                                ? item.linkedIntentClusterIds.map((value) => cleanCustomerText(value)).join(", ")
                                : null,
                            },
                            {
                              label: "Related content ideas",
                              value: item.linkedReinforcementItemIds?.length
                                ? item.linkedReinforcementItemIds.map((value) => cleanCustomerText(value)).join(", ")
                                : null,
                            },
                            {
                              label: "Related page-structure ideas",
                              value: item.linkedStructureItemIds?.length
                                ? item.linkedStructureItemIds.map((value) => cleanCustomerText(value)).join(", ")
                                : null,
                            },
                            {
                              label: "Blocked reason",
                              value: item.blockingReasons?.length ? item.blockingReasons.map((value) => cleanCustomerText(value)).join(" ") : null,
                            },
                            {
                              label: "Preview details",
                              value: item.previewPayload ? cleanCustomerText(`${item.previewPayload.mode}: ${item.previewPayload.detail}`) : null,
                            },
                            { label: "Preview metadata", value: item.previewCapability?.note ? cleanCustomerText(item.previewCapability.note) : null },
                          ]}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-3">
              <h4 className="text-sm font-semibold text-cyan-100">Publish Surface: Listing Description</h4>
              {optimizeActionBlocked ? (
                <div className="mt-2 text-sm text-amber-100">
                  {optimizeListingAction?.blockingReasons?.join(" ") ?? "This action is currently blocked."}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <NeonButton onClick={() => void generateUpgrade()} disabled={state === "generating" || !optimizeActionExecutable}>
                  {state === "generating" ? "Preparing..." : "Improve This Listing"}
                </NeonButton>

                {(state === "generated" || state === "previewing" || state === "ready_to_push" || state === "done") && draftId ? (
                  <NeonButton variant="secondary" onClick={() => void previewChanges()} disabled={state === "previewing" || !optimizeActionExecutable}>
                    {state === "previewing" ? "Preparing..." : "Preview Changes"}
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
                  <summary className="cursor-pointer text-sm font-medium text-slate-100">Draft Improvements</summary>
                  <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-900/80 p-3 text-sm text-slate-200">{proposedDescription}</pre>
                </details>
              ) : null}

              {state === "ready_to_push" ? (
                <div className="mt-3 space-y-3 rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-3">
                  <h4 className="text-sm font-semibold text-cyan-100">Change Preview</h4>
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
                    <span>I reviewed the diff and approve this push.</span>
                  </label>

                  <NeonButton onClick={() => void approveAndPush()} disabled={!approved || !integrations.bdConfigured}>
                    Publish Improvements
                  </NeonButton>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </HudCard>
      ) : null}
    </>
  );
}
