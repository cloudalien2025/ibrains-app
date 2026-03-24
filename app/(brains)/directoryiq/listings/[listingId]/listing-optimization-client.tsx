"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/ecomviper/TopBar";
import NeonButton from "@/components/ecomviper/NeonButton";
import { fetchJsonWithTimeout, RequestTimeoutError } from "@/lib/directoryiq/fetchWithTimeout";
import { buildStep2DraftApiUrl } from "@/lib/directoryiq/step2DraftApiHost";
import { buildDirectoryIqWriteApiUrl } from "@/lib/directoryiq/writeApiHost";
import {
  MISSION_CONTROL_STEPS,
  REQUIRED_VALID_SUPPORT_COUNT,
  STEP3_UNLOCK_CONTRACT,
  normalizeSupportCandidates,
  summarizeSupportValidity,
  type MissionStepId,
  type SupportSlotKey,
} from "@/lib/directoryiq/missionControlContract";
import {
  buildSeoPackageFromBrief,
  buildSupportBrief,
  buildSupportResearchArtifact,
  classifySlotAction,
  normalizeSlotValidity,
  progressTowardRequiredValid,
  slugify,
  toStep2UserState,
  type Step2InternalState,
  type Step2MissionPlan,
  type Step2MissionPlanSlot,
  type Step2PrimarySlot,
  type Step2RecommendedAction,
  type Step2SeoPackage,
  type Step2SupportBrief,
  type Step2SupportResearchArtifact,
  type Step2UserState,
} from "@/lib/directoryiq/step2SupportEngineContract";
import {
  deriveSafeStep2BlockerMessage,
  isStep2SetupBlockerMessage,
} from "@/lib/directoryiq/step2CardActionContract";
import {
  derivePublishDisabledReason,
  deriveStep2AggregateState,
  step2SummaryCopy,
  type Step2AggregateState,
  type Step2DraftStatus,
  type Step2ImageStatus,
  type Step2LinkStatus,
  type Step2PublishStatus,
  type Step2ReviewStatus,
} from "@/lib/directoryiq/step2SlotWorkflowContract";

type UiState = "idle" | "generating" | "generated" | "previewing" | "ready_to_push" | "pushing" | "done";
type LifecycleState = "Detected" | "Recommended" | "Generated" | "Approved" | "Published";
type MapConnectionTone = "standard" | "flywheel";

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
  outboundSupportLinks: Array<unknown>;
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
    blockerCode?: string;
    blockerMessage?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

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
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  evidenceSummary: string;
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

type FlywheelRecommendationItem = {
  key: string;
  type:
    | "blog_posts_should_link_to_listing"
    | "strengthen_anchor_text"
    | "listing_should_link_back_to_support_post"
    | "category_or_guide_page_should_join_cluster"
    | "missing_reciprocal_link";
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  evidenceSummary: string;
  sourceEntity: {
    id: string;
    type: "listing" | "blog_post" | "guide_page" | "category_page" | "support_page";
    title: string;
    url?: string | null;
  };
  targetEntity: {
    id: string;
    type: "listing" | "blog_post" | "guide_page" | "category_page" | "support_page";
    title: string;
    url?: string | null;
  };
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
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type BlogReinforcementPlanItem = {
  id:
    | "publish_comparison_decision_post"
    | "publish_faq_support_post"
    | "publish_local_context_guide"
    | "publish_reciprocal_support_post"
    | "publish_cluster_hub_support_page"
    | "refresh_anchor_intent_post";
  title: string;
  priority: "high" | "medium" | "low";
  targetIntent?: string;
  suggestedContentPurpose: string;
  suggestedTargetSurface: "blog" | "support_page" | "comparison" | "faq" | "local_guide" | "cluster_hub";
  suggestedAngle?: string;
  expectedSelectionImpact?: string;
  rationale: string;
  evidenceSummary: string;
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
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type ListingSerpContentStructureItem = {
  id:
    | "structure_decision_comparison"
    | "structure_faq_framework"
    | "structure_local_context"
    | "structure_reciprocal_links"
    | "structure_cluster_hub"
    | "structure_anchor_intent";
  title: string;
  priority: "high" | "medium" | "low";
  recommendedTitlePattern: string;
  suggestedH1: string;
  suggestedSections: string[];
  faqThemes: string[];
  localModifiers: string[];
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
  items: ListingSerpContentStructureItem[];
};

type ListingSerpContentStructureResponse = {
  ok: boolean;
  contentStructure?: ListingSerpContentStructureModel;
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type ListingMultiActionUpgradeItem = {
  actionId: string;
  key:
    | "optimize_listing_description"
    | "repair_flywheel_links"
    | "publish_reinforcement_post"
    | "build_reinforcement_cluster"
    | "publish_local_context_support"
    | "strengthen_anchor_intent"
    | "implement_serp_structure_recommendations";
  title: string;
  description: string;
  whyItMatters: string;
  expectedImpact: string;
  dependencies: string[];
  recommendedPriority: "high" | "medium" | "low";
  readinessState: "ready" | "blocked" | "abstained";
  status: "available" | "blocked" | "not_recommended";
  rationale: string;
  evidenceSummary: string;
  targetSurface: "listing" | "blog" | "support_page" | "cluster";
  blockingReasons?: string[];
  previewCapability?: {
    supported: boolean;
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
  items: ListingMultiActionUpgradeItem[];
};

type ListingMultiActionUpgradeResponse = {
  ok: boolean;
  multiAction?: ListingMultiActionUpgradeModel;
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type RecommendedActionItem = {
  key: string;
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  evidenceSummary: string;
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
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type SelectionIntentClusterItem = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceSummary: string;
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
  items: SelectionIntentClusterItem[];
};

type ListingSelectionIntentClustersResponse = {
  ok: boolean;
  intentClusters?: ListingSelectionIntentClustersModel;
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
  };
};

type DirectoryIqJobAccepted = {
  jobId?: string;
  reqId?: string;
  acceptedAt?: string;
  statusEndpoint?: string;
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  };
};

type DirectoryIqJobStatus = {
  status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  stage?: string;
  result?: Record<string, unknown>;
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  };
};

type UiError = {
  message: string;
  reqId?: string;
  code?: string;
  status?: number;
  listingId?: string;
};

function normalizeMissionStepQuery(value: string | null): MissionStepId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "find-support" || normalized === "step-1" || normalized === "step1") return "find-support";
  if (normalized === "create-support" || normalized === "step-2" || normalized === "step2") return "create-support";
  if (normalized === "optimize-listing" || normalized === "step-3" || normalized === "step3") return "optimize-listing";
  // Backwards compatibility with previous labels/routes.
  if (normalized === "make-connections" || normalized === "connect-existing-pages") return "find-support";
  if (normalized === "generate-content" || normalized === "create-support-content") return "create-support";
  if (normalized === "upgrade-the-listing") return "optimize-listing";
  return null;
}

type MapNodeCategory = "blog_post" | "page" | "support" | "hub" | "category" | "location" | "comparison" | "faq" | "local_guide";

type AuthorityMapNode = {
  id: string;
  label: string;
  title: string;
  category: MapNodeCategory;
  connectionTone: MapConnectionTone;
  lifecycle: LifecycleState;
  details: string;
  source: "connected" | "mention";
  relation: "already_connected" | "mention_without_link";
  url?: string | null;
};

type LinkOperationStatus = "Detected" | "Recommended" | "Approved" | "Published";

type LinkOperation = {
  key: string;
  title: string;
  sourcePage: string;
  targetPage: string;
  suggestedAnchorText: string;
  guidance: string;
  rationale: string;
  status: LinkOperationStatus;
};

type ContentAssetState = {
  slot: number;
  title: string;
  focusTopic: string;
  draftStatus: Step2DraftStatus;
  imageStatus: Step2ImageStatus;
  reviewStatus: Step2ReviewStatus;
  publishStatus: Step2PublishStatus;
  blogToListingLinkStatus: Step2LinkStatus;
  listingToBlogLinkStatus: Step2LinkStatus;
  draftVersion: number;
  imageVersion: number;
  approvedSnapshotDraftVersion: number | null;
  approvedSnapshotImageVersion: number | null;
  draftHtml: string;
  featuredImageUrl: string;
  approvalToken: string | null;
  publishedUrl: string;
  scoreAfter: number | null;
  draftGeneratedAt: string | null;
  imageGeneratedAt: string | null;
  approvedAt: string | null;
  publishAttemptedAt: string | null;
  publishCompletedAt: string | null;
  draftLastErrorCode: string | null;
  draftLastErrorMessage: string | null;
  imageLastErrorCode: string | null;
  imageLastErrorMessage: string | null;
  publishLastErrorCode: string | null;
  publishLastErrorMessage: string | null;
  publishLastReqId: string | null;
  lastLinkErrorCode: string | null;
  lastLinkErrorMessage: string | null;
};

type Step2DraftContractInput = {
  missionPlanSlot: Step2MissionPlanSlot;
  supportBrief: Step2SupportBrief;
  seoPackage: Step2SeoPackage;
  researchArtifact: Step2SupportResearchArtifact;
};

type Step2SlotRuntime = {
  internalState: Step2InternalState;
  userState: Step2UserState;
  recommendedAction: Step2RecommendedAction;
  published: boolean;
  linked: boolean;
  metadataReady: boolean;
  qualityPass: boolean;
  nonDuplicate: boolean;
  step3Consumable: boolean;
  countsTowardRequiredFive: boolean;
  publishedUrl: string | null;
  researchArtifact: Step2SupportResearchArtifact | null;
  supportBrief: Step2SupportBrief | null;
  seoPackage: Step2SeoPackage | null;
  errorMessage: string | null;
};

type PersistedMissionState = {
  activeStepId: MissionStepId;
  listingLifecycle: LifecycleState;
  listingApprovedForPublish: boolean;
  linkStates: Record<string, LinkOperationStatus>;
  contentAssets: Record<string, ContentAssetState>;
  selectedMapNodeId: string | null;
};

function toPriorityBadge(value: string): string {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";
  return "Info";
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function firstNonEmptyValue(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function waitForDirectoryIqJobResult<T extends Record<string, unknown>>(
  accepted: DirectoryIqJobAccepted,
  fallback: string,
  listingId?: string
): Promise<{ ok: true; data: T } | { ok: false; error: UiError }> {
  const endpoint = (accepted.statusEndpoint ?? "").trim();
  if (!endpoint) {
    return { ok: false, error: { message: fallback, code: "JOB_ENDPOINT_MISSING", listingId } };
  }

  const timeoutAt = Date.now() + 180_000;
  const pollDelayMs = 800;

  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    const statusUrl = buildDirectoryIqWriteApiUrl(endpoint);
    const statusRes = await fetch(statusUrl, { cache: "no-store" });
    const statusJson = (await statusRes.json().catch(() => ({}))) as DirectoryIqJobStatus & ApiErrorShape;
    if (!statusRes.ok) {
      return { ok: false, error: parseError(statusJson, fallback, statusRes.status, listingId) };
    }

    if (statusJson.status === "succeeded") {
      return { ok: true, data: asRecord(statusJson.result) as T };
    }
    if (statusJson.status === "failed" || statusJson.status === "cancelled") {
      return {
        ok: false,
        error: {
          message: statusJson.error?.message ?? fallback,
          code: statusJson.error?.code,
          reqId: statusJson.error?.reqId,
          listingId,
        },
      };
    }
  }

  return { ok: false, error: { message: `${fallback} Timed out waiting for job completion.`, code: "JOB_TIMEOUT", listingId } };
}

function isJobAcceptedPayload(value: unknown): value is DirectoryIqJobAccepted {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as DirectoryIqJobAccepted;
  return typeof payload.jobId === "string" && typeof payload.statusEndpoint === "string";
}

async function resolveDirectoryIqJobOrInline<T extends Record<string, unknown>>(
  res: Response,
  json: ApiErrorShape & Record<string, unknown>,
  fallback: string,
  listingId?: string
): Promise<{ ok: true; data: T } | { ok: false; error: UiError }> {
  if (!res.ok) {
    return { ok: false, error: parseError(json, fallback, res.status, listingId) };
  }

  if (res.status === 202 || isJobAcceptedPayload(json)) {
    return waitForDirectoryIqJobResult<T>(json, fallback, listingId);
  }

  return { ok: true, data: asRecord(json) as T };
}

function stringifyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof RequestTimeoutError) return `${fallback} timed out.`;
  if (error instanceof Error) return error.message;
  return fallback;
}

function mapNodeLayout(index: number, mobileTuned = false): { x: number; y: number } {
  const desktopPoints = [
    { x: 12, y: 18 },
    { x: 50, y: 10 },
    { x: 86, y: 18 },
    { x: 90, y: 46 },
    { x: 86, y: 74 },
    { x: 50, y: 86 },
    { x: 14, y: 74 },
    { x: 10, y: 46 },
  ];
  const mobilePoints = [
    { x: 18, y: 12 },
    { x: 50, y: 8 },
    { x: 82, y: 12 },
    { x: 91, y: 32 },
    { x: 91, y: 68 },
    { x: 82, y: 88 },
    { x: 50, y: 92 },
    { x: 18, y: 88 },
    { x: 9, y: 68 },
    { x: 9, y: 32 },
  ];
  const points = mobileTuned ? mobilePoints : desktopPoints;
  return points[index % points.length];
}

function lifecycleClassName(state: LifecycleState): string {
  if (state === "Published") return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
  if (state === "Approved") return "border-cyan-300/40 bg-cyan-400/15 text-cyan-100";
  if (state === "Generated") return "border-indigo-300/40 bg-indigo-400/15 text-indigo-100";
  if (state === "Recommended") return "border-amber-300/40 bg-amber-400/15 text-amber-100";
  return "border-white/20 bg-white/5 text-slate-200";
}

function nodeCategoryLabel(category: MapNodeCategory): string {
  if (category === "blog_post") return "Blog Post";
  if (category === "support") return "Support Asset";
  if (category === "hub") return "Support Asset";
  if (category === "category") return "Support Asset";
  if (category === "location") return "Support Asset";
  if (category === "comparison") return "Comparison Page";
  if (category === "faq") return "FAQ Asset";
  if (category === "local_guide") return "Local Guide";
  return "Support Asset";
}

function recommendationTypeLabel(type: FlywheelRecommendationItem["type"]): string {
  if (type === "blog_posts_should_link_to_listing") return "Add listing link from support post";
  if (type === "listing_should_link_back_to_support_post") return "Add reciprocal listing link";
  if (type === "missing_reciprocal_link") return "Complete reciprocal link pair";
  if (type === "strengthen_anchor_text") return "Strengthen anchor text";
  return "Expand cluster support";
}

function missionStepContract(stepId: MissionStepId) {
  return MISSION_CONTROL_STEPS.find((step) => step.id === stepId) ?? MISSION_CONTROL_STEPS[0];
}

function reinforcementPlanSlot(itemId: BlogReinforcementPlanItem["id"]): SupportSlotKey {
  if (itemId === "publish_comparison_decision_post") return "comparison_alternatives";
  if (itemId === "publish_local_context_guide") return "location_intent_proximity";
  if (itemId === "publish_faq_support_post") return "experience_itinerary_problem_solving";
  if (itemId === "publish_cluster_hub_support_page") return "audience_fit_use_case";
  if (itemId === "publish_reciprocal_support_post") return "best_of_recommendation";
  return "unclassified";
}

function toStep2PrimarySlot(slotKey: SupportSlotKey): Step2PrimarySlot {
  if (slotKey === "best_of_recommendation") return "best_of";
  if (slotKey === "audience_fit_use_case") return "audience_fit";
  if (slotKey === "location_intent_proximity") return "location_intent";
  if (slotKey === "comparison_alternatives") return "comparison";
  return "experience_itinerary";
}

function step2StatusLabel(state: Step2InternalState): Step2UserState {
  return toStep2UserState(state);
}

function step2ActionInput(missionSlot: Step2MissionPlanSlot, runtime: Step2SlotRuntime | undefined) {
  return {
    internalState: runtime?.internalState ?? "not_started",
    recommendedAction: runtime?.recommendedAction ?? missionSlot.recommended_action,
    countsTowardRequiredFive: runtime?.countsTowardRequiredFive ?? missionSlot.counts_toward_required_five_now,
  };
}

function step2StateLabel(status: Step2AggregateState): string {
  if (status === "create_ready") return "Create Ready";
  if (status === "generating") return "Working";
  if (status === "draft_ready") return "Draft Ready";
  if (status === "image_ready") return "Featured Image Ready";
  if (status === "preview_ready") return "Preview Ready";
  if (status === "approved") return "Approved";
  if (status === "publishing") return "Publishing";
  if (status === "published") return "Published";
  return "Needs Attention";
}

function step2StatusClassName(status: Step2AggregateState): string {
  if (status === "published") return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
  if (status === "approved" || status === "preview_ready") return "border-cyan-300/40 bg-cyan-400/15 text-cyan-100";
  if (status === "create_ready" || status === "draft_ready" || status === "image_ready") return "border-amber-300/40 bg-amber-400/15 text-amber-100";
  if (status === "generating" || status === "publishing") return "border-indigo-300/40 bg-indigo-400/15 text-indigo-100";
  return "border-rose-300/40 bg-rose-400/15 text-rose-100";
}

function step2CardDescription(input: {
  summary: string;
  purpose: string;
  title: string;
  listingName: string;
  asset: ContentAssetState;
}): string {
  if (input.asset.publishStatus === "failed") {
    if (input.asset.publishLastErrorMessage) return `Publish failed: ${input.asset.publishLastErrorMessage}`;
    if (input.asset.lastLinkErrorMessage) return `Publish failed: ${input.asset.lastLinkErrorMessage}`;
  }
  if (input.asset.draftStatus === "failed" && input.asset.draftLastErrorMessage) return `Draft failed: ${input.asset.draftLastErrorMessage}`;
  if (input.asset.imageStatus === "failed" && input.asset.imageLastErrorMessage) return `Featured image failed: ${input.asset.imageLastErrorMessage}`;
  const purpose = normalizeText(input.purpose);
  if (purpose && input.summary === "This support article has not been generated yet.") return purpose;
  return input.summary || `Helps AI engines understand why ${input.listingName} is a strong choice for ${normalizeText(input.title)}.`;
}

const OPENAI_SETUP_BLOCKER_TITLE = "OpenAI is not configured for this site.";
const OPENAI_SETUP_BLOCKER_BODY = "Connect it in DirectoryIQ > Signal Sources to generate support articles.";
const STEP2_LISTING_URL_BLOCKER =
  "Article generation requires a listing URL for contextual links. Reconnect or fix listing URL source, then refresh support data.";

function translateStep2ErrorMessage(raw: string | null | undefined, code?: string | null | undefined): string {
  return deriveSafeStep2BlockerMessage({ message: raw, code });
}

function stepNavTestIdSuffix(stepId: MissionStepId): string {
  if (stepId === "find-support") return "make-connections";
  if (stepId === "create-support") return "generate-content";
  return "optimize-listing";
}

function flywheelEntityTypeLabel(type: FlywheelRecommendationItem["sourceEntity"]["type"]): string {
  if (type === "listing") return "Listing";
  if (type === "blog_post") return "Blog post";
  if (type === "guide_page") return "Guide page";
  if (type === "category_page") return "Category page";
  return "Support page";
}

function linkStatusLabel(status: LinkOperationStatus): string {
  if (status === "Approved") return "In Mission Plan";
  if (status === "Published") return "In Mission Plan";
  return "Recommended";
}

function mapConnectionPoints(index: number, mobileTuned = false): { x1: number; y1: number; x2: number; y2: number } {
  const point = mapNodeLayout(index, mobileTuned);
  const cx = 50;
  const cy = 50;
  const rx = mobileTuned ? 36 : 31;
  const ry = mobileTuned ? 20 : 24;
  const nodeRadius = mobileTuned ? 4 : 4.5;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const distance = Math.hypot(dx, dy) || 1;
  const edgeScale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  const x1 = cx + dx * edgeScale;
  const y1 = cy + dy * edgeScale;
  const x2 = point.x - (dx / distance) * nodeRadius;
  const y2 = point.y - (dy / distance) * nodeRadius;
  return { x1, y1, x2, y2 };
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
  const stepParam = searchParams.get("step");
  const siteQuery = siteIdParam ? `?site_id=${encodeURIComponent(siteIdParam)}` : "";
  const hasValidListingId = Boolean(listingId) && listingId !== "undefined" && listingId !== "null";
  const effectiveListingId = hasValidListingId ? listingId : "";

  const [uiState, setUiState] = useState<UiState>("idle");
  const [listing, setListing] = useState<ListingDetailResponse | null>(initialListing);
  const [integrations, setIntegrations] = useState<IntegrationStatusResponse>(initialIntegrations);
  const [error, setError] = useState<UiError | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  const [support, setSupport] = useState<ListingSupportModel | null>(null);
  const [supportMeta, setSupportMeta] = useState<ListingSupportResponse["meta"] | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportLoading, setSupportLoading] = useState(true);

  const [gaps, setGaps] = useState<ListingAuthorityGapsModel | null>(null);
  const [gapsMeta, setGapsMeta] = useState<ListingAuthorityGapsResponse["meta"] | null>(null);
  const [gapsError, setGapsError] = useState<string | null>(null);
  const [gapsLoading, setGapsLoading] = useState(true);

  const [flywheel, setFlywheel] = useState<ListingFlywheelLinksModel | null>(null);
  const [flywheelError, setFlywheelError] = useState<string | null>(null);
  const [flywheelLoading, setFlywheelLoading] = useState(true);

  const [actions, setActions] = useState<ListingRecommendedActionsModel | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [actionsLoading, setActionsLoading] = useState(true);

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

  const [draftId, setDraftId] = useState("");
  const [proposedDescription, setProposedDescription] = useState("");
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [listingApprovalToken, setListingApprovalToken] = useState("");

  const storageKey = useMemo(() => {
    if (!effectiveListingId) return "";
    const suffix = siteIdParam ? `:${siteIdParam}` : ":default";
    return `directoryiq:listings:mission-control:${effectiveListingId}${suffix}`;
  }, [effectiveListingId, siteIdParam]);

  const [activeStepId, setActiveStepId] = useState<MissionStepId>("find-support");
  const [listingLifecycle, setListingLifecycle] = useState<LifecycleState>("Detected");
  const [listingApprovedForPublish, setListingApprovedForPublish] = useState(false);
  const [selectedMapNodeId, setSelectedMapNodeId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isMobileMapViewport, setIsMobileMapViewport] = useState(false);
  const [linkOperations, setLinkOperations] = useState<LinkOperation[]>([]);
  const [contentAssets, setContentAssets] = useState<Record<string, ContentAssetState>>({});
  const [step2Runtime, setStep2Runtime] = useState<Record<string, Step2SlotRuntime>>({});

  useEffect(() => {
    const queryStep = normalizeMissionStepQuery(stepParam);
    if (!queryStep) return;
    setActiveStepId(queryStep);
  }, [stepParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobileMapViewport(media.matches);
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistedMissionState;
      const persistedStep = normalizeMissionStepQuery((parsed.activeStepId as string | null | undefined) ?? null);
      setActiveStepId(persistedStep ?? "find-support");
      setListingLifecycle(parsed.listingLifecycle ?? "Detected");
      setListingApprovedForPublish(Boolean(parsed.listingApprovedForPublish));
      setSelectedMapNodeId(parsed.selectedMapNodeId ?? null);
      setContentAssets(parsed.contentAssets ?? {});
      const persistedLinkStates = parsed.linkStates ?? {};
      setLinkOperations((previous) =>
        previous.map((item) => ({ ...item, status: persistedLinkStates[item.key] ?? item.status }))
      );
    } catch {
      // ignore invalid persisted state
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const linkStates = linkOperations.reduce<Record<string, LinkOperationStatus>>((acc, item) => {
      acc[item.key] = item.status;
      return acc;
    }, {});
    const persisted: PersistedMissionState = {
      activeStepId,
      listingLifecycle,
      listingApprovedForPublish,
      linkStates,
      contentAssets,
      selectedMapNodeId,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(persisted));
  }, [activeStepId, listingLifecycle, listingApprovedForPublish, linkOperations, contentAssets, selectedMapNodeId, storageKey]);

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
        setError({ message: stringifyErrorMessage(err, "Failed to load listing details."), status: 0, listingId: effectiveListingId });
        setListing(null);
      }
    })();

    void (async () => {
      try {
        const { response, json } = await fetchJsonWithTimeout<SignalSourcesResponse>(
          "/api/directoryiq/signal-sources",
          { cache: "no-store" },
          DETAIL_REQUEST_TIMEOUT_MS
        );

        if (!response.ok) {
          setIntegrations({ openaiConfigured: null, bdConfigured: null });
          return;
        }

        const connectors = Array.isArray(json.connectors) ? json.connectors : [];
        const openAiConnector = connectors.find((connector) => connector.connector_id === "openai");
        const bdConnector = connectors.find((connector) => connector.connector_id === "brilliant_directories_api");
        setIntegrations({
          openaiConfigured: typeof openAiConnector?.connected === "boolean" ? openAiConnector.connected : null,
          bdConfigured: typeof bdConnector?.connected === "boolean" ? bdConnector.connected : null,
        });
      } catch {
        setIntegrations({ openaiConfigured: null, bdConfigured: null });
      }
    })();

    void (async () => {
      try {
        setSupportLoading(true);
        const { response, json } = await fetchJsonWithTimeout<ListingSupportResponse>(supportPath, { cache: "no-store" }, DETAIL_REQUEST_TIMEOUT_MS);
        if (!response.ok || !json.ok) {
          const message = typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to load support model.";
          setSupportError(message);
          setSupport(null);
          setSupportMeta(null);
          return;
        }
        setSupport(json.support ?? null);
        setSupportMeta(json.meta ?? null);
        setSupportError(null);
      } catch (err) {
        setSupportError(stringifyErrorMessage(err, "Support diagnostics request"));
        setSupport(null);
        setSupportMeta(null);
      } finally {
        setSupportLoading(false);
      }
    })();

    void (async () => {
      try {
        setGapsLoading(true);
        const { response, json } = await fetchJsonWithTimeout<ListingAuthorityGapsResponse>(gapsPath, { cache: "no-store" }, DETAIL_REQUEST_TIMEOUT_MS);
        if (!response.ok || !json.ok) {
          const message = typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to evaluate authority gaps.";
          setGapsError(message);
          setGaps(null);
          setGapsMeta(null);
          return;
        }
        setGaps(json.gaps ?? null);
        setGapsMeta(json.meta ?? null);
        setGapsError(null);
      } catch (err) {
        setGapsError(stringifyErrorMessage(err, "Gap analysis request"));
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
    const gapsReady = Boolean(gaps) && gapsMeta?.dataStatus !== "analysis_unavailable";

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
      } else {
        setFlywheelLoading(true);
        setFlywheelError(null);
      }
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
          const message = typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to evaluate flywheel links.";
          setFlywheel(null);
          setFlywheelError(message);
          setFlywheelLoading(false);
          return;
        }
        setFlywheel(json.flywheel);
        setFlywheelError(null);
        setFlywheelLoading(false);
      } catch (err) {
        if (!active) return;
        setFlywheel(null);
        setFlywheelError(stringifyErrorMessage(err, "Flywheel evaluation"));
        setFlywheelLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, supportMeta, gapsMeta, supportError, gapsError, supportLoading, gapsLoading, DETAIL_REQUEST_TIMEOUT_MS]);

  useEffect(() => {
    if (!effectiveListingId || !support || !gaps) {
      if (!supportLoading && !gapsLoading) {
        setActions(null);
        setActionsError("Recommended actions are unavailable until support and gap diagnostics are ready.");
        setActionsLoading(false);
      } else {
        setActionsLoading(true);
        setActionsError(null);
      }
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
          const message = typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to evaluate recommended actions.";
          setActions(null);
          setActionsError(message);
          setActionsLoading(false);
          return;
        }
        setActions(json.actions);
        setActionsError(null);
        setActionsLoading(false);
      } catch (err) {
        if (!active) return;
        setActions(null);
        setActionsError(stringifyErrorMessage(err, "Actions evaluation"));
        setActionsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, supportLoading, gapsLoading, DETAIL_REQUEST_TIMEOUT_MS]);

  useEffect(() => {
    if (!effectiveListingId || !support || !gaps || !flywheel || !actions) {
      if (!flywheelLoading && !actionsLoading) {
        setIntentClusters(null);
        setIntentClustersError("Intent clustering is unavailable until flywheel and recommended actions are ready.");
        setIntentClustersLoading(false);
      } else {
        setIntentClustersLoading(true);
        setIntentClustersError(null);
      }
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
            body: JSON.stringify({ support, gaps, actions, flywheel }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;
        if (!response.ok || !json.ok || !json.intentClusters) {
          const message =
            typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to evaluate intent clusters.";
          setIntentClusters(null);
          setIntentClustersError(message);
          setIntentClustersLoading(false);
          return;
        }
        setIntentClusters(json.intentClusters);
        setIntentClustersError(null);
        setIntentClustersLoading(false);
      } catch (err) {
        if (!active) return;
        setIntentClusters(null);
        setIntentClustersError(stringifyErrorMessage(err, "Intent cluster evaluation"));
        setIntentClustersLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, actions, flywheel, flywheelLoading, actionsLoading, DETAIL_REQUEST_TIMEOUT_MS]);

  useEffect(() => {
    if (!effectiveListingId || !support || !gaps || !flywheel || !actions || !intentClusters) {
      if (!intentClustersLoading && !actionsLoading && !flywheelLoading) {
        setReinforcementPlan(null);
        setReinforcementPlanError("Content generation planning is unavailable until upstream intelligence is ready.");
        setReinforcementPlanLoading(false);
      } else {
        setReinforcementPlanLoading(true);
        setReinforcementPlanError(null);
      }
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
            body: JSON.stringify({ support, gaps, flywheel, actions, intentClusters }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;
        if (!response.ok || !json.ok || !json.reinforcementPlan) {
          const message = typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to evaluate content generation plan.";
          setReinforcementPlan(null);
          setReinforcementPlanError(message);
          setReinforcementPlanLoading(false);
          return;
        }
        setReinforcementPlan(json.reinforcementPlan);
        setReinforcementPlanError(null);
        setReinforcementPlanLoading(false);
      } catch (err) {
        if (!active) return;
        setReinforcementPlan(null);
        setReinforcementPlanError(stringifyErrorMessage(err, "Content plan evaluation"));
        setReinforcementPlanLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, flywheel, actions, intentClusters, flywheelLoading, actionsLoading, intentClustersLoading, DETAIL_REQUEST_TIMEOUT_MS]);

  useEffect(() => {
    if (!effectiveListingId || !support || !gaps || !flywheel || !actions || !intentClusters || !reinforcementPlan) {
      if (!reinforcementPlanLoading && !intentClustersLoading && !actionsLoading) {
        setContentStructure(null);
        setContentStructureError("SERP-informed structure is unavailable until reinforcement planning is ready.");
        setContentStructureLoading(false);
      } else {
        setContentStructureLoading(true);
        setContentStructureError(null);
      }
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
            body: JSON.stringify({ support, gaps, flywheel, actions, intentClusters, reinforcementPlan }),
          },
          DETAIL_REQUEST_TIMEOUT_MS
        );
        if (!active) return;
        if (!response.ok || !json.ok || !json.contentStructure) {
          const message = typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to evaluate SERP structure.";
          setContentStructure(null);
          setContentStructureError(message);
          setContentStructureLoading(false);
          return;
        }
        setContentStructure(json.contentStructure);
        setContentStructureError(null);
        setContentStructureLoading(false);
      } catch (err) {
        if (!active) return;
        setContentStructure(null);
        setContentStructureError(stringifyErrorMessage(err, "Content structure evaluation"));
        setContentStructureLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, flywheel, actions, intentClusters, reinforcementPlan, reinforcementPlanLoading, intentClustersLoading, actionsLoading, DETAIL_REQUEST_TIMEOUT_MS]);

  useEffect(() => {
    if (!effectiveListingId || !support || !gaps || !flywheel || !actions || !intentClusters || !reinforcementPlan || !contentStructure) {
      if (!contentStructureLoading && !reinforcementPlanLoading) {
        setMultiAction(null);
        setMultiActionError("Listing optimization actions are unavailable until upstream analysis is complete.");
        setMultiActionLoading(false);
      } else {
        setMultiActionLoading(true);
        setMultiActionError(null);
      }
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
              flywheel,
              actions,
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
          const message = typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to evaluate optimize-listing actions.";
          setMultiAction(null);
          setMultiActionError(message);
          setMultiActionLoading(false);
          return;
        }
        setMultiAction(json.multiAction);
        setMultiActionError(null);
        setMultiActionLoading(false);
      } catch (err) {
        if (!active) return;
        setMultiAction(null);
        setMultiActionError(stringifyErrorMessage(err, "Optimize listing action evaluation"));
        setMultiActionLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, flywheel, actions, intentClusters, reinforcementPlan, contentStructure, contentStructureLoading, reinforcementPlanLoading, integrations.openaiConfigured, integrations.bdConfigured, DETAIL_REQUEST_TIMEOUT_MS]);

  const displayName = listing?.listing.listing_name || support?.listing.title || "Listing";
  const displayUrl = firstNonEmptyValue(listing?.listing.listing_url, support?.listing.canonicalUrl);
  const baseScore = listing?.evaluation.totalScore ?? 0;

  const connectNowFlywheelItems = (flywheel?.items ?? []).filter((item) => item.type !== "category_or_guide_page_should_join_cluster");
  const missingFlywheelItems = (flywheel?.items ?? []).filter((item) => item.type === "category_or_guide_page_should_join_cluster").slice(0, 5);

  const flywheelLinks = useMemo(() => {
    return connectNowFlywheelItems.slice(0, 5).map((item) => ({
      key: item.key,
      title: normalizeText(item.title),
      sourcePage: normalizeText(item.sourceEntity.title),
      targetPage: normalizeText(item.targetEntity.title),
      suggestedAnchorText: normalizeText(item.anchorGuidance?.suggestedAnchorText) || `Read more about ${displayName}`,
      guidance: normalizeText(item.anchorGuidance?.guidance) || "Place this link in context near the first mention.",
      rationale: normalizeText(item.rationale),
      status: "Recommended" as LinkOperationStatus,
    }));
  }, [connectNowFlywheelItems, displayName]);

  useEffect(() => {
    if (!flywheelLinks.length) return;
    setLinkOperations((previous) => {
      const previousByKey = new Map(previous.map((item) => [item.key, item]));
      const merged = flywheelLinks.map((item) => previousByKey.get(item.key) ?? item);
      return merged;
    });
  }, [flywheelLinks]);

  const mapNodes = useMemo<AuthorityMapNode[]>(() => {
    const nodes: AuthorityMapNode[] = [];
    const seenTitles = new Set<string>();
    const publishedFlywheelTargetTitles = new Set(
      linkOperations
        .filter((operation) => operation.status === "Published")
        .map((operation) => normalizeText(operation.targetPage).toLowerCase())
        .filter(Boolean)
    );
    let connectedIndex = 0;
    let connectedBlogIndex = 0;
    let mentionIndex = 0;

    const toExistingCategory = (type: string): MapNodeCategory => {
      if (type === "blog_post") return "blog_post";
      if (type === "support") return "support";
      if (type === "hub") return "hub";
      if (type === "category") return "category";
      if (type === "location") return "location";
      return "support";
    };

    for (const item of support?.inboundLinkedSupport ?? []) {
      const title = normalizeText(item.title) || "Support Asset";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      const isBlogPost = item.sourceType === "blog_post";
      if (isBlogPost) {
        connectedBlogIndex += 1;
      } else {
        connectedIndex += 1;
      }
      const label = isBlogPost ? `B${connectedBlogIndex}` : `E${connectedIndex}`;
      const isFlywheel = publishedFlywheelTargetTitles.has(key);
      nodes.push({
        id: `existing-inbound-${item.sourceId}`,
        label,
        title,
        category: toExistingCategory(item.sourceType),
        connectionTone: isFlywheel ? "flywheel" : "standard",
        lifecycle: "Published",
        details: `${label}: ${title}`,
        source: "connected",
        relation: "already_connected",
        url: item.url ?? null,
      });
    }

    for (const item of support?.connectedSupportPages ?? []) {
      const title = normalizeText(item.title) || "Connected Support Page";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      connectedIndex += 1;
      const label = `E${connectedIndex}`;
      const isFlywheel = publishedFlywheelTargetTitles.has(key);
      nodes.push({
        id: `existing-connected-${item.id ?? connectedIndex}`,
        label,
        title,
        category: toExistingCategory(item.type),
        connectionTone: isFlywheel ? "flywheel" : "standard",
        lifecycle: "Published",
        details: `${label}: ${title}`,
        source: "connected",
        relation: "already_connected",
        url: item.url ?? null,
      });
    }

    for (const item of support?.mentionsWithoutLinks ?? []) {
      const title = normalizeText(item.title) || "Support Mention";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      mentionIndex += 1;
      const label = `M${mentionIndex}`;
      nodes.push({
        id: `existing-mention-${item.sourceId}`,
        label,
        title,
        category: toExistingCategory(item.sourceType),
        connectionTone: "standard",
        lifecycle: "Detected",
        details: `${label}: ${title}`,
        source: "mention",
        relation: "mention_without_link",
        url: item.url ?? null,
      });
    }

    return nodes.slice(0, 8);
  }, [support, linkOperations]);

  useEffect(() => {
    if (!mapNodes.length) return;
    if (!selectedMapNodeId) {
      setSelectedMapNodeId(mapNodes[0].id);
      return;
    }
    if (!mapNodes.some((node) => node.id === selectedMapNodeId)) {
      setSelectedMapNodeId(mapNodes[0].id);
    }
  }, [mapNodes, selectedMapNodeId]);

  const selectedMapNode = mapNodes.find((node) => node.id === selectedMapNodeId) ?? null;
  const step1Contract = missionStepContract("find-support");
  const step3Contract = missionStepContract("optimize-listing");

  const normalizedSupportCandidates = useMemo(
    () =>
      normalizeSupportCandidates({
        inboundLinkedSupport: (support?.inboundLinkedSupport ?? []).map((item) => ({
          id: item.sourceId,
          title: item.title,
          url: item.url ?? null,
          sourceType: item.sourceType,
          anchors: item.anchors,
          relationshipType: "links_to_listing" as const,
        })),
        mentionsWithoutLinks: (support?.mentionsWithoutLinks ?? []).map((item) => ({
          id: item.sourceId,
          title: item.title,
          url: item.url ?? null,
          sourceType: item.sourceType,
          anchors: [],
          relationshipType: "mentions_without_link" as const,
        })),
      }),
    [support]
  );
  const supportValidity = useMemo(() => summarizeSupportValidity(normalizedSupportCandidates), [normalizedSupportCandidates]);
  const validSupportFoundCount = supportValidity.validCount;
  const missingSupportSlotsText = supportValidity.missingSlotTypes.map((slot) => slot.label).join(" • ");
  const missionPlanSelectionCount = linkOperations.filter((item) => item.status === "Approved" || item.status === "Published").length;
  const step3Locked = validSupportFoundCount < REQUIRED_VALID_SUPPORT_COUNT;
  const step2MissionPlan = useMemo<Step2MissionPlan>(() => {
    const listingName = listing?.listing.listing_name ?? support?.listing.title ?? "Listing";
    const listingUrl = firstNonEmptyValue(support?.listing.canonicalUrl, listing?.listing.listing_url);
    const listingCategory = normalizeText(intentClusters?.items[0]?.title ?? "");
    const listingSubcategory = normalizeText(intentClusters?.items[1]?.title ?? "");
    const locationCity = normalizeText(contentStructure?.items[0]?.localModifiers?.[0] ?? "");
    const locationArea = normalizeText(contentStructure?.items[0]?.localModifiers?.[1] ?? "");
    const locationRegion = normalizeText(contentStructure?.items[0]?.localModifiers?.[2] ?? "");

    const selectedSlots = (reinforcementPlan?.items ?? []).slice(0, 5).map((item, index) => {
      const slotKey = reinforcementPlanSlot(item.id);
      const primarySlot = toStep2PrimarySlot(slotKey);
      const candidate = normalizedSupportCandidates.find((node) => toStep2PrimarySlot(node.dimensions.primarySlot) === primarySlot) ?? null;
      const currentState: Step2MissionPlanSlot["current_state"] =
        candidate?.validityState === "valid"
          ? "valid"
          : candidate?.validityState === "upgrade_candidate"
            ? "upgrade_candidate"
            : "missing";

      const slotDraft: Step2MissionPlanSlot = {
        slot_id: item.id,
        primary_slot: primarySlot,
        listing_url: listingUrl,
        slot_label: normalizeText(item.title) || `Support slot ${index + 1}`,
        slot_reason: normalizeText(item.rationale) || "Selected from Step 1 mission plan.",
        target_query_family: [normalizeText(item.title), normalizeText(item.suggestedAngle)].filter(Boolean),
        recommended_focus_keyword:
          normalizeText(item.targetIntent) ||
          normalizeText(contentStructure?.items[index]?.recommendedTitlePattern) ||
          normalizeText(item.title),
        recommended_angle: normalizeText(item.suggestedAngle) || normalizeText(item.suggestedContentPurpose) || normalizeText(item.title),
        existing_candidate_post_id: candidate?.candidate.id ?? null,
        existing_candidate_url: candidate?.candidate.url ?? null,
        existing_candidate_title: candidate?.candidate.title ?? null,
        current_state: currentState,
        recommended_action: "create",
        counts_toward_required_five_now: candidate?.validityState === "valid",
        step1_confidence: 0.8,
        selected_for_mission: true,
      };
      return {
        ...slotDraft,
        recommended_action: classifySlotAction(slotDraft),
      };
    });

    return {
      listing_id: effectiveListingId,
      site_id: siteIdParam ?? null,
      listing_title: listingName,
      listing_url: listingUrl,
      listing_type: "listing",
      listing_category: listingCategory,
      listing_subcategory: listingSubcategory,
      location_city: locationCity,
      location_area: locationArea,
      location_region: locationRegion,
      landmarks: [],
      differentiators: [],
      audience_fits: [],
      core_entities: [listingName],
      required_valid_support_count: REQUIRED_VALID_SUPPORT_COUNT,
      selected_slots: selectedSlots,
    };
  }, [
    contentStructure,
    effectiveListingId,
    intentClusters,
    listing,
    normalizedSupportCandidates,
    reinforcementPlan,
    siteIdParam,
    support,
  ]);
  const step2MissionSlots = step2MissionPlan.selected_slots;

  useEffect(() => {
    if (!step2MissionSlots.length) return;
    setStep2Runtime((previous) => {
      const next = { ...previous };
      for (const slot of step2MissionSlots) {
        if (next[slot.slot_id]) continue;
        const isConfirmed = slot.recommended_action === "confirm" && slot.counts_toward_required_five_now;
        next[slot.slot_id] = {
          internalState: isConfirmed ? "confirmed_valid" : "not_started",
          userState: step2StatusLabel(isConfirmed ? "confirmed_valid" : "not_started"),
          recommendedAction: slot.recommended_action,
          published: isConfirmed,
          linked: isConfirmed,
          metadataReady: isConfirmed,
          qualityPass: isConfirmed,
          nonDuplicate: true,
          step3Consumable: isConfirmed,
          countsTowardRequiredFive: slot.counts_toward_required_five_now,
          publishedUrl: slot.existing_candidate_url,
          researchArtifact: null,
          supportBrief: null,
          seoPackage: null,
          errorMessage: null,
        };
      }
      return next;
    });
  }, [step2MissionSlots]);

  const openAiBlockerFromSupportMeta = useMemo(() => {
    const supportMetaRecord = supportMeta as Record<string, unknown> | null;
    const metaCodeCandidates = [
      typeof supportMetaRecord?.blockerCode === "string" ? supportMetaRecord.blockerCode : "",
      typeof supportMetaRecord?.blocker_code === "string" ? supportMetaRecord.blocker_code : "",
      typeof supportMetaRecord?.errorCode === "string" ? supportMetaRecord.errorCode : "",
      typeof supportMetaRecord?.error_code === "string" ? supportMetaRecord.error_code : "",
    ];
    if (metaCodeCandidates.some((code) => normalizeText(code).toUpperCase() === "OPENAI_KEY_MISSING")) return true;

    const metaMessageCandidates = [
      typeof supportMetaRecord?.blockerMessage === "string" ? supportMetaRecord.blockerMessage : "",
      typeof supportMetaRecord?.blocker_message === "string" ? supportMetaRecord.blocker_message : "",
      typeof supportMetaRecord?.errorMessage === "string" ? supportMetaRecord.errorMessage : "",
      typeof supportMetaRecord?.error_message === "string" ? supportMetaRecord.error_message : "",
      supportError ?? "",
    ];
    return metaMessageCandidates.some((value) => isStep2SetupBlockerMessage(value));
  }, [supportMeta, supportError]);

  const openAiBlockerFromRuntime = useMemo(
    () => Object.values(step2Runtime).some((runtime) => isStep2SetupBlockerMessage(runtime.errorMessage)),
    [step2Runtime]
  );

  const step2OpenAiSetupBlocked =
    integrations.openaiConfigured === false || openAiBlockerFromSupportMeta || openAiBlockerFromRuntime;

  const step2Progress = useMemo(() => {
    const slotStates = step2MissionSlots.map((slot) => ({
      counts_toward_required_five: step2Runtime[slot.slot_id]?.countsTowardRequiredFive ?? slot.counts_toward_required_five_now,
    }));
    return progressTowardRequiredValid(slotStates);
  }, [step2MissionSlots, step2Runtime]);
  const step2SlotViewModels = useMemo(() => {
    return step2MissionSlots
      .map((missionSlot, index) => {
        const item = (reinforcementPlan?.items ?? []).find((candidate) => candidate.id === missionSlot.slot_id);
        if (!item) return null;
        const slot = index + 1;
        const asset = contentAssets[item.id] ?? initializeContentAsset(item, slot);
        const blueprint = contentStructure?.items[index] ?? null;
        const runtime = step2Runtime[missionSlot.slot_id];
        const aggregateState = deriveStep2AggregateState({
          draft_status: asset.draftStatus,
          image_status: asset.imageStatus,
          review_status: asset.reviewStatus,
          publish_status: asset.publishStatus,
          blog_to_listing_link_status: asset.blogToListingLinkStatus,
          listing_to_blog_link_status: asset.listingToBlogLinkStatus,
          published_url: asset.publishedUrl || null,
        });
        const publishDisabledReason = derivePublishDisabledReason({
          draftReady: asset.draftStatus === "ready",
          imageReady: asset.imageStatus === "ready",
          approved: asset.reviewStatus === "approved",
          publishing: asset.publishStatus === "publishing",
          published: asset.publishStatus === "published",
          integrationsReady: integrations.bdConfigured === true,
          listingIdentityResolved: Boolean(effectiveListingId),
        });
        const setupBlocked = step2OpenAiSetupBlocked && aggregateState === "create_ready";
        const summary = step2SummaryCopy(aggregateState);
        return {
          missionSlot,
          item,
          slot,
          asset,
          blueprint,
          runtime,
          aggregateState,
          summary,
          publishDisabledReason,
          setupBlocked,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [contentAssets, contentStructure, reinforcementPlan?.items, step2MissionSlots, step2Runtime, step2OpenAiSetupBlocked, integrations.bdConfigured, effectiveListingId]);
  const step2StatusBuckets = useMemo(() => {
    return step2SlotViewModels.reduce(
      (acc, entry) => {
        acc[entry.aggregateState] += 1;
        return acc;
      },
      {
        create_ready: 0,
        generating: 0,
        draft_ready: 0,
        image_ready: 0,
        preview_ready: 0,
        approved: 0,
        publishing: 0,
        published: 0,
        needs_attention: 0,
      } as Record<Step2AggregateState, number>
    );
  }, [step2SlotViewModels]);
  const step2SectionCta = useMemo(() => {
    const candidate = step2SlotViewModels.find((entry) => entry.aggregateState === "create_ready" || entry.aggregateState === "needs_attention");
    return { candidate };
  }, [step2SlotViewModels]);

  const largestGap = gaps?.items[0] ?? null;
  const fastestWinLink = linkOperations.find((item) => item.status === "Recommended") ?? null;
  const biggestBlocker =
    supportError || gapsError
      ? "Support diagnostics are unavailable."
      : largestGap
        ? normalizeText(largestGap.title)
        : "No major blockers detected right now.";
  const fastestWin = fastestWinLink
    ? `Add ${fastestWinLink.suggestedAnchorText} from ${fastestWinLink.sourcePage}.`
    : "Create one missing support asset from Step 2.";

  const missionProgress = useMemo(() => {
    const connectionsDone = linkOperations.some((item) => item.status === "Approved" || item.status === "Published");
    const listingDone = listingLifecycle === "Generated" || listingLifecycle === "Approved" || listingLifecycle === "Published";
    const contentDone = Object.values(contentAssets).some(
      (item) => item.draftStatus === "ready" || item.reviewStatus === "approved" || item.publishStatus === "published"
    );
    const completed = [connectionsDone, listingDone, contentDone].filter(Boolean).length;
    return Math.round((completed / 3) * 100);
  }, [linkOperations, listingLifecycle, contentAssets]);

  const publishedLinkCount = linkOperations.filter((item) => item.status === "Published").length;
  const approvedLinkCount = linkOperations.filter((item) => item.status === "Approved").length;

  const approvedContent = Object.values(contentAssets).filter((item) => item.reviewStatus === "approved");
  const publishedContent = Object.values(contentAssets).filter((item) => item.publishStatus === "published");
  const approvedImages = Object.values(contentAssets).filter((item) => item.imageStatus === "ready");

  const listingIsReady = listingLifecycle === "Approved" || uiState === "ready_to_push";
  const publishReadyCount = (listingIsReady ? 1 : 0) + approvedContent.length + approvedLinkCount;

  const computedScore = useMemo(() => {
    const listingBonus = listingLifecycle === "Published" ? 6 : 0;
    const contentBonus = publishedContent.length * 3;
    const linkBonus = publishedLinkCount * 2;
    return Math.min(100, baseScore + listingBonus + contentBonus + linkBonus);
  }, [baseScore, listingLifecycle, publishedContent.length, publishedLinkCount]);

  async function generateListingUpgrade() {
    if (!effectiveListingId) return;
    setNotice(null);
    setError(null);
    setUiState("generating");
    setListingLifecycle("Generated");

    const res = await fetch(
      buildDirectoryIqWriteApiUrl(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/generate`, siteQuery),
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "default" }),
      }
    );

    const json = (await res.json().catch(() => ({}))) as ApiErrorShape & Record<string, unknown>;
    const settled = await resolveDirectoryIqJobOrInline<{ draftId?: string; proposedDescription?: string }>(
      res,
      json,
      "Failed to generate listing optimization draft.",
      effectiveListingId
    );
    if (!settled.ok) {
      setUiState("idle");
      setListingLifecycle("Recommended");
      setError(settled.error);
      return;
    }

    setDraftId(typeof settled.data.draftId === "string" ? settled.data.draftId : "");
    setProposedDescription(typeof settled.data.proposedDescription === "string" ? settled.data.proposedDescription : "");
    setDiffRows([]);
    setListingApprovalToken("");
    setListingApprovedForPublish(false);
    setUiState("generated");
    setNotice("Listing optimization draft generated.");
  }

  async function previewListingUpgrade() {
    if (!effectiveListingId || !draftId) return;
    setNotice(null);
    setError(null);
    setUiState("previewing");

    const res = await fetch(
      buildDirectoryIqWriteApiUrl(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/preview`, siteQuery),
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId }),
      }
    );

    const json = (await res.json().catch(() => ({}))) as ApiErrorShape & Record<string, unknown>;
    const settled = await resolveDirectoryIqJobOrInline<{ diff?: DiffRow[]; approvalToken?: string }>(
      res,
      json,
      "Failed to preview listing optimization draft.",
      effectiveListingId
    );
    if (!settled.ok) {
      setUiState("generated");
      setError(settled.error);
      return;
    }

    setDiffRows(Array.isArray(settled.data.diff) ? settled.data.diff : []);
    setListingApprovalToken(typeof settled.data.approvalToken === "string" ? settled.data.approvalToken : "");
    setUiState("ready_to_push");
    setListingLifecycle("Approved");
    setNotice("Listing optimization is ready for publish.");
  }

  async function publishListingUpgrade() {
    if (!effectiveListingId || !draftId || !listingApprovedForPublish) return;

    setNotice(null);
    setError(null);
    setUiState("pushing");

    const res = await fetch(
      buildDirectoryIqWriteApiUrl(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/push`, siteQuery),
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        approved: true,
        approvalToken: listingApprovalToken,
      }),
      }
    );

    const json = (await res.json().catch(() => ({}))) as ApiErrorShape & Record<string, unknown>;
    const settled = await resolveDirectoryIqJobOrInline<Record<string, unknown>>(
      res,
      json,
      "Failed to publish listing optimization.",
      effectiveListingId
    );
    if (!settled.ok) {
      setUiState("ready_to_push");
      setError(settled.error);
      return;
    }

    setUiState("done");
    setListingLifecycle("Published");
    setNotice("Listing optimization published to site.");
    await loadListingAndIntegrations();
  }

  function initializeContentAsset(item: BlogReinforcementPlanItem, slot: number): ContentAssetState {
    const existing = contentAssets[item.id];
    if (existing) return existing;
    return {
      slot,
      title: normalizeText(item.title),
      focusTopic: normalizeText(item.suggestedAngle) || normalizeText(item.title),
      draftStatus: "not_started",
      imageStatus: "not_started",
      reviewStatus: "not_ready",
      publishStatus: "not_started",
      blogToListingLinkStatus: "not_started",
      listingToBlogLinkStatus: "not_started",
      draftVersion: 0,
      imageVersion: 0,
      approvedSnapshotDraftVersion: null,
      approvedSnapshotImageVersion: null,
      draftHtml: "",
      featuredImageUrl: "",
      approvalToken: null,
      publishedUrl: "",
      scoreAfter: null,
      draftGeneratedAt: null,
      imageGeneratedAt: null,
      approvedAt: null,
      publishAttemptedAt: null,
      publishCompletedAt: null,
      draftLastErrorCode: null,
      draftLastErrorMessage: null,
      imageLastErrorCode: null,
      imageLastErrorMessage: null,
      publishLastErrorCode: null,
      publishLastErrorMessage: null,
      publishLastReqId: null,
      lastLinkErrorCode: null,
      lastLinkErrorMessage: null,
    };
  }

  async function generateContentDraft(
    item: BlogReinforcementPlanItem,
    slot: number,
    contractInput?: Step2DraftContractInput
  ): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
    if (!effectiveListingId) return { ok: false, errorMessage: "Listing context is missing." };
    const current = initializeContentAsset(item, slot);

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        draftStatus: "generating",
        draftLastErrorCode: null,
        draftLastErrorMessage: null,
      },
    }));

    const resolvedListingUrlForDraft = firstNonEmptyValue(
      contractInput?.missionPlanSlot.listing_url,
      step2MissionPlan.listing_url,
      support?.listing.canonicalUrl,
      listing?.listing.listing_url,
      displayUrl
    );
    if (!resolvedListingUrlForDraft) {
      setError({ message: STEP2_LISTING_URL_BLOCKER });
      setContentAssets((previous) => ({
        ...previous,
        [item.id]: {
          ...current,
          draftStatus: "failed",
          draftLastErrorCode: "BAD_REQUEST",
          draftLastErrorMessage: STEP2_LISTING_URL_BLOCKER,
        },
      }));
      return { ok: false, errorMessage: STEP2_LISTING_URL_BLOCKER };
    }

    const draftQuery = siteQuery;
    const draftUrl = buildStep2DraftApiUrl(effectiveListingId, slot, draftQuery);
    const res = await fetch(draftUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "local_guide",
        focus_topic: current.focusTopic,
        title: current.title,
        step2_contract: contractInput
          ? {
              mission_plan_slot: contractInput.missionPlanSlot,
              support_brief: contractInput.supportBrief,
              seo_package: contractInput.seoPackage,
              research_artifact: contractInput.researchArtifact,
            }
          : undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as ApiErrorShape & Record<string, unknown>;
    const settled = await resolveDirectoryIqJobOrInline<{ draft_html?: string }>(
      res,
      json,
      "Failed to generate content draft.",
      effectiveListingId
    );
    if (!settled.ok) {
      const message = settled.error.message ?? "Failed to generate content draft.";
      const code = normalizeText(settled.error.code).toUpperCase();
      const translatedMessage = translateStep2ErrorMessage(message, code);
      if (code === "OPENAI_KEY_MISSING" || isStep2SetupBlockerMessage(message)) {
        setError({ message: `${OPENAI_SETUP_BLOCKER_TITLE} ${OPENAI_SETUP_BLOCKER_BODY}` });
      } else {
        setError({ message: translatedMessage });
      }
      setContentAssets((previous) => ({
        ...previous,
        [item.id]: {
          ...current,
          draftStatus: "failed",
          draftLastErrorCode: code || null,
          draftLastErrorMessage: translatedMessage,
        },
      }));
      return { ok: false, errorMessage: translatedMessage };
    }

    setContentAssets((previous) => ({
      ...previous,
        [item.id]: {
          ...current,
          draftStatus: "ready",
          draftVersion: current.draftVersion + 1,
          draftGeneratedAt: new Date().toISOString(),
          reviewStatus: current.imageStatus === "ready" ? "ready" : "not_ready",
          approvedAt: null,
          approvedSnapshotDraftVersion: null,
          approvedSnapshotImageVersion: null,
          publishStatus: "not_started",
          publishLastErrorCode: null,
          publishLastErrorMessage: null,
          publishLastReqId: null,
          publishAttemptedAt: null,
          publishCompletedAt: null,
          draftHtml: typeof settled.data.draft_html === "string" ? settled.data.draft_html : "",
        },
      }));
    setNotice(`Generated draft for ${current.title}.`);
    return { ok: true };
  }

  async function generateContentImage(item: BlogReinforcementPlanItem, slot: number): Promise<boolean> {
    if (!effectiveListingId) return false;
    const current = initializeContentAsset(item, slot);
    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        imageStatus: "generating",
        imageLastErrorCode: null,
        imageLastErrorMessage: null,
      },
    }));

    const res = await fetch(
      buildDirectoryIqWriteApiUrl(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/image`, siteQuery),
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus_topic: current.focusTopic }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as ApiErrorShape & Record<string, unknown>;
    const settled = await resolveDirectoryIqJobOrInline<{ featured_image_url?: string }>(
      res,
      json,
      "Failed to generate featured image.",
      effectiveListingId
    );

    if (!settled.ok) {
      setError({
        message: translateStep2ErrorMessage(settled.error.message, settled.error.code),
      });
      setContentAssets((previous) => ({
        ...previous,
        [item.id]: {
          ...current,
          imageStatus: "failed",
          imageLastErrorCode: settled.error.code ?? null,
          imageLastErrorMessage: translateStep2ErrorMessage(settled.error.message, settled.error.code),
        },
      }));
      return false;
    }

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        imageStatus: "ready",
        imageVersion: current.imageVersion + 1,
        imageGeneratedAt: new Date().toISOString(),
        reviewStatus: current.draftStatus === "ready" ? "ready" : "not_ready",
        approvedAt: null,
        approvedSnapshotDraftVersion: null,
        approvedSnapshotImageVersion: null,
        publishStatus: "not_started",
        publishLastErrorCode: null,
        publishLastErrorMessage: null,
        publishLastReqId: null,
        publishAttemptedAt: null,
        publishCompletedAt: null,
        featuredImageUrl: typeof settled.data.featured_image_url === "string" ? settled.data.featured_image_url : "",
      },
    }));
    setNotice(`Generated featured image for ${current.title}.`);
    return true;
  }

  async function approveContentAsset(item: BlogReinforcementPlanItem, slot: number): Promise<boolean> {
    if (!effectiveListingId) return false;
    const current = initializeContentAsset(item, slot);
    if (current.draftStatus !== "ready" || current.imageStatus !== "ready") {
      setError({ message: "Draft and featured image must both be ready before approval." });
      return false;
    }

    const res = await fetch(
      buildDirectoryIqWriteApiUrl(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/preview`, siteQuery),
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      approval_token?: string;
      preview?: { score_delta?: { after?: number } };
      error?: { message?: string; code?: string } | string;
    };

    if (!res.ok) {
      setError({
        message: translateStep2ErrorMessage(
          typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to approve content asset.",
          typeof json.error === "string" ? "" : json.error?.code
        ),
      });
      return false;
    }

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        reviewStatus: "approved",
        approvalToken: json.approval_token ?? null,
        approvedAt: new Date().toISOString(),
        approvedSnapshotDraftVersion: current.draftVersion,
        approvedSnapshotImageVersion: current.imageVersion,
        scoreAfter: json.preview?.score_delta?.after ?? null,
      },
    }));
    setNotice(`${current.title} approved for publish.`);
    return true;
  }

  async function publishContentAsset(item: BlogReinforcementPlanItem, slot: number): Promise<boolean> {
    if (!effectiveListingId) return false;
    const current = initializeContentAsset(item, slot);
    if (current.reviewStatus !== "approved") {
      setError({ message: "Approve this draft before publishing." });
      return false;
    }
    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        publishStatus: "publishing",
        publishAttemptedAt: new Date().toISOString(),
        publishLastErrorCode: null,
        publishLastErrorMessage: null,
        publishLastReqId: null,
      },
    }));

    const res = await fetch(
      buildDirectoryIqWriteApiUrl(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/publish`, siteQuery),
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approve_publish: true,
        approval_token: current.approvalToken ?? undefined,
      }),
      }
    );

    const json = (await res.json().catch(() => ({}))) as {
      published_url?: string;
      error?: { message?: string; code?: string; reqId?: string } | string;
    };
    if (!res.ok) {
      const message = translateStep2ErrorMessage(
        typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to publish content asset.",
        typeof json.error === "string" ? "" : json.error?.code
      );
      setError({
        message,
      });
      setContentAssets((previous) => ({
        ...previous,
        [item.id]: {
          ...current,
          publishStatus: "failed",
          publishLastErrorCode: typeof json.error === "string" ? null : json.error?.code ?? null,
          publishLastErrorMessage: message,
          publishLastReqId: typeof json.error === "string" ? null : json.error?.reqId ?? null,
        },
      }));
      return false;
    }

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        publishStatus: "published",
        publishCompletedAt: new Date().toISOString(),
        publishLastErrorCode: null,
        publishLastErrorMessage: null,
        publishLastReqId: null,
        blogToListingLinkStatus: "linked",
        listingToBlogLinkStatus: "linked",
        publishedUrl: json.published_url ?? "",
      },
    }));

    setLinkOperations((previous) =>
      previous.map((op) =>
        op.targetPage.toLowerCase().includes(current.title.toLowerCase()) && op.status !== "Published"
          ? { ...op, status: "Published" }
          : op
      )
    );

    await loadListingAndIntegrations();
    setNotice(`${current.title} published to site.`);
    return true;
  }

  function patchStep2Runtime(slotId: string, patch: Partial<Step2SlotRuntime>) {
    setStep2Runtime((previous) => {
      const current = previous[slotId];
      if (!current) return previous;
      const nextState = patch.internalState ?? current.internalState;
      return {
        ...previous,
        [slotId]: {
          ...current,
          ...patch,
          internalState: nextState,
          userState: step2StatusLabel(nextState),
        },
      };
    });
  }

  async function executeStep2SlotPipeline(input: {
    missionSlot: Step2MissionPlanSlot;
    item: BlogReinforcementPlanItem;
    slot: number;
  }) {
    const slotId = input.missionSlot.slot_id;
    const runtime = step2Runtime[slotId];
    if (!runtime) return;

    const actionInput = step2ActionInput(input.missionSlot, runtime);
    if (step2OpenAiSetupBlocked) {
      const blockerMessage = `${OPENAI_SETUP_BLOCKER_TITLE} ${OPENAI_SETUP_BLOCKER_BODY}`;
      setError({ message: blockerMessage });
      patchStep2Runtime(slotId, { internalState: "failed", errorMessage: blockerMessage });
      return;
    }
    if (runtime.internalState === "researching" || runtime.internalState === "brief_ready" || runtime.internalState === "generating") {
      setNotice("This article is currently generating.");
      return;
    }

    const action = actionInput.recommendedAction;
    patchStep2Runtime(slotId, { internalState: "researching", errorMessage: null });
    const contractInput = buildStep2DraftContractInput(input.missionSlot);
    const hasListingUrlPrerequisite = Boolean(firstNonEmptyValue(contractInput.missionPlanSlot.listing_url));
    if (!hasListingUrlPrerequisite) {
      setError({ message: STEP2_LISTING_URL_BLOCKER });
      patchStep2Runtime(slotId, { internalState: "failed", errorMessage: STEP2_LISTING_URL_BLOCKER });
      return;
    }
    patchStep2Runtime(slotId, {
      internalState: "brief_ready",
      researchArtifact: contractInput.researchArtifact,
      supportBrief: contractInput.supportBrief,
      seoPackage: contractInput.seoPackage,
      metadataReady: true,
      recommendedAction: action,
    });

    patchStep2Runtime(slotId, { internalState: "generating" });
    const generated = await generateContentDraft(input.item, input.slot, contractInput);
    if (!generated.ok) {
      patchStep2Runtime(slotId, { internalState: "failed", errorMessage: generated.errorMessage });
      return;
    }

    const imageGenerated = await generateContentImage(input.item, input.slot);
    if (imageGenerated) {
      patchStep2Runtime(slotId, { internalState: "image_ready" });
    }
    if (!imageGenerated) {
      patchStep2Runtime(slotId, { internalState: "failed", errorMessage: translateStep2ErrorMessage("Featured image generation failed.") });
      return;
    }
    patchStep2Runtime(slotId, { internalState: "image_ready", errorMessage: null });
  }

  function buildStep2DraftContractInput(missionSlot: Step2MissionPlanSlot): Step2DraftContractInput {
    const missionPlanSlot: Step2MissionPlanSlot = {
      ...missionSlot,
      listing_url: firstNonEmptyValue(
        missionSlot.listing_url,
        support?.listing.canonicalUrl,
        listing?.listing.listing_url,
        displayUrl
      ),
    };
    const relatedResults = (contentStructure?.items ?? [])
      .slice(0, 5)
      .map((entry, index) => ({
        title:
          normalizeText(entry.recommendedTitlePattern || entry.suggestedH1 || entry.title) ||
          `Result ${index + 1}`,
        url: `https://research.local/${slugify(missionPlanSlot.recommended_focus_keyword)}/${index + 1}`,
        rank: index + 1,
      }));
    const researchArtifact = buildSupportResearchArtifact({
      slot: missionPlanSlot,
      listingTitle: step2MissionPlan.listing_title,
      locationCity: step2MissionPlan.location_city,
      locationRegion: step2MissionPlan.location_region,
      serpTopResults: relatedResults,
      competitorHeadings: contentStructure?.items.flatMap((entry) => entry.suggestedSections).slice(0, 8),
      userQuestions: contentStructure?.items.flatMap((entry) => entry.faqThemes).slice(0, 6),
    });

    const supportBrief = buildSupportBrief({
      slot: missionPlanSlot,
      plan: step2MissionPlan,
      research: researchArtifact,
    });
    const seoPackage = buildSeoPackageFromBrief(supportBrief);

    return {
      missionPlanSlot,
      supportBrief,
      seoPackage,
      researchArtifact,
    };
  }

  function setLinkMissionPlan(itemKey: string, inMissionPlan: boolean) {
    setLinkOperations((previous) =>
      previous.map((item) => {
        if (item.key !== itemKey || item.status === "Published") return item;
        return { ...item, status: inMissionPlan ? "Approved" : "Recommended" };
      })
    );
  }

  async function publishAllApprovedAssets() {
    if (listingLifecycle === "Approved" && listingApprovedForPublish) {
      await publishListingUpgrade();
    }

    setLinkOperations((previous) =>
      previous.map((item) => (item.status === "Approved" ? { ...item, status: "Published" } : item))
    );

    for (const item of reinforcementPlan?.items.slice(0, 5) ?? []) {
      const slot = (reinforcementPlan?.items.findIndex((candidate) => candidate.id === item.id) ?? 0) + 1;
      const current = contentAssets[item.id] ?? initializeContentAsset(item, slot);
      if (current.reviewStatus === "approved") {
        await publishContentAsset(item, slot);
      }
    }
  }

  const recommendedMissingItems = missingFlywheelItems.slice(0, 5);
  const existingConnections = connectNowFlywheelItems.slice(0, 5);
  const alreadyConnectedAssets = mapNodes.filter((node) => node.relation === "already_connected").slice(0, 5);
  const mentionWithoutLinkAssets = mapNodes.filter((node) => node.relation === "mention_without_link").slice(0, 5);
  const missingGenerationItems = recommendedMissingItems.slice(0, 5);
  const linkStatusByKey = useMemo(() => {
    return new Map(linkOperations.map((operation) => [operation.key, operation.status]));
  }, [linkOperations]);
  const derivedRecommendationGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        groupKey: string;
        source: FlywheelRecommendationItem["sourceEntity"];
        items: FlywheelRecommendationItem[];
      }
    >();
    for (const item of existingConnections) {
      const groupKey = `${item.sourceEntity.type}:${item.sourceEntity.id}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(groupKey, {
          groupKey,
          source: item.sourceEntity,
          items: [item],
        });
      }
    }
    return Array.from(groups.values());
  }, [existingConnections]);
  const optimizedFlywheelLinks = useMemo(() => {
    const seen = new Set<string>();
    const links: string[] = [];
    for (const node of mapNodes) {
      if (node.relation === "already_connected") {
        const normalized = node.title.trim();
        if (!normalized || seen.has(normalized.toLowerCase())) continue;
        seen.add(normalized.toLowerCase());
        links.push(normalized);
      }
      if (links.length >= 5) break;
    }
    return links;
  }, [mapNodes]);

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Listing Mission Control"]} searchPlaceholder="Search listing mission..." />

      {integrations.openaiConfigured === false ? (
        <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {OPENAI_SETUP_BLOCKER_TITLE}{" "}
          <Link href="/directoryiq/signal-sources?connector=openai" className="underline">
            {OPENAI_SETUP_BLOCKER_BODY}
          </Link>
        </div>
      ) : null}

      {integrations.bdConfigured === false ? (
        <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Website connection not configured. Configure it in <Link href="/directoryiq/signal-sources?connector=brilliant-directories" className="underline">Connections</Link>.
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error.message}</div>
      ) : null}

      {notice ? (
        <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="min-w-0 space-y-4">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="authority-map-zone">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Authority Map</h2>
                <p className="text-xs text-slate-400">Listing-first authority view with real connected assets and real mentions.</p>
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-2 text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-300" />Flywheel</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-300" />Real Connected / Mention</span>
              </div>
            </div>

            <div className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="relative mx-auto aspect-[7/8] w-full max-w-full overflow-hidden sm:aspect-[16/10]" data-testid="authority-map-canvas">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {mapNodes.map((node, index) => {
                    const line = mapConnectionPoints(index, isMobileMapViewport);
                    const stroke = node.connectionTone === "flywheel" ? "rgba(52,211,153,0.9)" : "rgba(251,146,60,0.9)";
                    return (
                      <line
                        key={`line-${node.id}`}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke={stroke}
                        strokeWidth="0.65"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>

                <div
                  className="absolute left-1/2 top-1/2 h-[44%] w-[74%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[999px] border border-cyan-300/45 bg-slate-900 shadow-2xl sm:h-[58%] sm:w-[62%]"
                  data-testid="listing-hero-node"
                >
                  {listing?.listing.mainImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.listing.mainImageUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-sm text-slate-300">No listing image</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3" data-testid="listing-hero-overlay">
                    <div className="w-full max-w-[94%] rounded-2xl border border-white/35 bg-black/10 px-3 py-2.5 text-center shadow-lg backdrop-blur-md sm:max-w-[88%] sm:px-4 sm:py-3">
                      <div className="truncate text-sm font-semibold text-white sm:text-[15px]" data-testid="listing-hero-title">
                        {displayName}
                      </div>
                      {displayUrl ? (
                        <Link
                          className="mt-1 block max-w-full break-all text-[11px] text-cyan-100 underline underline-offset-4 sm:text-xs"
                          href={displayUrl}
                          target="_blank"
                          data-testid="listing-hero-url"
                        >
                          {displayUrl}
                        </Link>
                      ) : null}
                      <div className="mt-2 flex justify-center">
                        <div
                          className="inline-flex rounded-full border border-cyan-200/60 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-cyan-100 sm:text-xs"
                          data-testid="listing-hero-score"
                        >
                          AI Selection Score: {computedScore}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {mapNodes.map((node, index) => {
                  const point = mapNodeLayout(index, isMobileMapViewport);
                  const selected = node.id === selectedMapNodeId;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`absolute max-w-[32vw] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border px-2 py-1 text-[10px] font-semibold transition sm:max-w-none sm:px-3 sm:text-[11px] ${
                        selected
                          ? "border-cyan-200/80 bg-cyan-400/20 text-cyan-100"
                          : node.connectionTone === "flywheel"
                            ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-100"
                            : "border-orange-300/50 bg-orange-400/20 text-orange-100"
                      }`}
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                      onClick={() => {
                        setSelectedMapNodeId(node.id);
                        setDetailsOpen(true);
                      }}
                      data-testid={`authority-node-${node.label}`}
                    >
                      {node.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="authority-details-drawer">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setDetailsOpen((previous) => !previous)}
              aria-expanded={detailsOpen}
              data-testid="authority-details-toggle"
            >
              <span className="text-sm font-semibold text-slate-100">See Details</span>
              <span className="text-xs text-slate-400">{detailsOpen ? "Hide" : "Show"}</span>
            </button>
            {detailsOpen ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3" data-testid="authority-details-content">
                {mapNodes.map((node) => (
                  <button
                    key={`detail-${node.id}`}
                    type="button"
                    className={`rounded-lg border p-2 text-left ${node.id === selectedMapNodeId ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}
                    onClick={() => setSelectedMapNodeId(node.id)}
                  >
                    <div className="text-xs font-semibold text-slate-100">{node.details}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{nodeCategoryLabel(node.category)} • {node.lifecycle}</div>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedMapNode ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200" data-testid="authority-node-inspector">
                <div className="font-semibold text-slate-100">{selectedMapNode.label}: {selectedMapNode.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {nodeCategoryLabel(selectedMapNode.category)} • {selectedMapNode.lifecycle} • {selectedMapNode.relation === "already_connected" ? "already connected" : "mention without link"}
                </div>
                {selectedMapNode.url ? (
                  <a href={selectedMapNode.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-cyan-200 underline">
                    {selectedMapNode.url}
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-3" data-testid="mission-status-strip">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Biggest blocker</div>
                <div className="mt-1 line-clamp-2 text-sm text-slate-100">{biggestBlocker}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Fastest win</div>
                <div className="mt-1 line-clamp-2 text-sm text-slate-100">{fastestWin}</div>
              </div>
              <div className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-cyan-100">Mission progress</div>
                <div className="mt-1 text-xl font-semibold text-cyan-100" data-testid="listing-mission-progress-percent">{missionProgress}%</div>
              </div>
            </div>
          </section>

          <nav className="rounded-2xl border border-white/10 bg-slate-950/70 p-2" data-testid="listing-step-switcher-desktop">
            <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Listing workflow steps">
              {MISSION_CONTROL_STEPS.map((step) => {
                const isActive = activeStepId === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${isActive ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-white/15 bg-white/[0.03] text-slate-300"}`}
                    onClick={() => setActiveStepId(step.id)}
                    data-testid={`listing-step-nav-desktop-${stepNavTestIdSuffix(step.id)}`}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="listing-active-step-workspace">
            {activeStepId === "find-support" ? (
              <div data-testid="step-make-connections">
                <h3 className="text-lg font-semibold text-slate-100">{step1Contract.label}</h3>
                <p className="mt-1 text-sm text-slate-400">{step1Contract.description}</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Real existing connections</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-100">{alreadyConnectedAssets.length}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Real mentions without links</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-100">{mentionWithoutLinkAssets.length}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Valid support found</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-100">{validSupportFoundCount}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">In mission plan</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-100">{missionPlanSelectionCount}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300" data-testid="step1-validity-summary">
                  <div>
                    Valid support posts found: {validSupportFoundCount} / {REQUIRED_VALID_SUPPORT_COUNT}
                  </div>
                  <div className="mt-1">Upgrade candidates: {supportValidity.upgradeCandidateCount}</div>
                  <div className="mt-1">
                    Missing support types: {missingSupportSlotsText || "None"}
                  </div>
                  <div className="mt-1">Mission plan is a selection state only. Publishing is handled in Steps 2 and 3.</div>
                </div>

                {supportLoading || gapsLoading || flywheelLoading ? <div className="mt-3 text-sm text-slate-300">Loading connection intelligence...</div> : null}
                {supportError || gapsError || flywheelError ? (
                  <div className="mt-3 rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                    {supportError || gapsError || flywheelError}
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3" data-testid="step1-real-existing-connections">
                  <div className="text-xs uppercase tracking-[0.08em] text-emerald-100">Real existing connections</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-emerald-100">
                    {alreadyConnectedAssets.length ? (
                      alreadyConnectedAssets.map((node) => (
                        <span key={node.id} className="rounded-full border border-emerald-200/35 px-2 py-1">
                          {node.label}: {node.title}
                        </span>
                      ))
                    ) : (
                      <div className="text-sm text-emerald-100/80">No real connected assets were detected.</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3" data-testid="step1-real-mentions-without-links">
                  <div className="text-xs uppercase tracking-[0.08em] text-amber-100">Real mentions without links</div>
                  <div className="mt-2 space-y-1 text-xs text-amber-100">
                    {mentionWithoutLinkAssets.length ? (
                      mentionWithoutLinkAssets.map((node) => (
                        <div key={node.id} className="rounded-lg border border-amber-200/30 px-2 py-1">
                          {node.label}: {node.title}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-amber-100/80">No unlinked mentions were detected.</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 min-w-0 space-y-2" data-testid="step1-derived-recommendations">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Derived recommendations (local draft workflow)</div>
                  {derivedRecommendationGroups.map((group) => (
                    <div key={group.groupKey} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <div className="min-w-0 break-words text-sm font-semibold text-slate-100">{normalizeText(group.source.title)}</div>
                      <div className="mt-1 min-w-0 break-words text-[11px] text-slate-300">
                        Source: {flywheelEntityTypeLabel(group.source.type)} • <span className="break-all">ID: {group.source.id}</span>
                      </div>
                      {group.source.url ? (
                        <a href={group.source.url} target="_blank" rel="noreferrer" className="mt-1 block min-w-0 break-all text-[11px] text-cyan-200 underline">
                          {group.source.url}
                        </a>
                      ) : null}

                      <div className="mt-3 min-w-0 space-y-2">
                        {group.items.map((item) => {
                          const status = linkStatusByKey.get(item.key) ?? "Recommended";
                          const lifecycle = status === "Published" ? "Published" : status === "Approved" ? "Approved" : "Recommended";
                          return (
                            <div key={item.key} className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-3" data-testid="step1-recommendation-card">
                              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0 break-words text-xs font-semibold text-slate-100">{recommendationTypeLabel(item.type)}</div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${lifecycleClassName(lifecycle)}`}>
                                  {linkStatusLabel(status)}
                                </span>
                              </div>
                              <div className="mt-1 min-w-0 break-words text-xs text-slate-200">{normalizeText(item.title)}</div>
                              <div className="mt-1 min-w-0 break-words text-[11px] text-slate-400">{normalizeText(item.rationale)}</div>
                              <div className="mt-2 grid min-w-0 gap-1 text-[11px] text-slate-300 sm:grid-cols-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-200">Source</div>
                                  <div className="break-words">Type: {flywheelEntityTypeLabel(item.sourceEntity.type)}</div>
                                  <div className="break-words">Title: {normalizeText(item.sourceEntity.title)}</div>
                                  <div className="break-all">ID: {item.sourceEntity.id}</div>
                                  {item.sourceEntity.url ? <a href={item.sourceEntity.url} target="_blank" rel="noreferrer" className="block min-w-0 break-all text-cyan-200 underline">{item.sourceEntity.url}</a> : null}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-200">Target</div>
                                  <div className="break-words">Type: {flywheelEntityTypeLabel(item.targetEntity.type)}</div>
                                  <div className="break-words">Title: {normalizeText(item.targetEntity.title)}</div>
                                  <div className="break-all">ID: {item.targetEntity.id}</div>
                                  {item.targetEntity.url ? <a href={item.targetEntity.url} target="_blank" rel="noreferrer" className="block min-w-0 break-all text-cyan-200 underline">{item.targetEntity.url}</a> : null}
                                </div>
                              </div>
                              <div className="mt-3">
                                <label
                                  className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                                  data-testid="step1-recommendation-plan-control"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0 accent-cyan-400"
                                    checked={status === "Approved" || status === "Published"}
                                    onChange={(event) => setLinkMissionPlan(item.key, event.target.checked)}
                                    disabled={status === "Published"}
                                    data-testid="step1-recommendation-plan-checkbox"
                                  />
                                  <span className="min-w-0 break-words">
                                    {status === "Approved" || status === "Published" ? "In Mission Plan" : "Add to Mission Plan"}
                                  </span>
                                </label>
                              </div>
                              <div className="mt-2 text-[11px] text-slate-400">Planning state only. This does not publish to Brilliant Directories.</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {!derivedRecommendationGroups.length ? (
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">No derived recommendations right now.</div>
                  ) : null}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="step1-missing-connections">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Missing support to create in Step 2</div>
                  <div className="mt-2 space-y-1">
                    {missingGenerationItems.length ? (
                      missingGenerationItems.map((item) => (
                        <div key={item.key} className="text-sm text-slate-200">{normalizeText(item.title)}</div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-300">No critical missing assets right now.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {activeStepId === "optimize-listing" ? (
              <div data-testid="step-optimize-listing">
                <h3 className="text-lg font-semibold text-slate-100">{step3Contract.label}</h3>
                <p className="mt-1 text-sm text-slate-400">{step3Contract.description}</p>

                {step3Locked ? (
                  <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100" data-testid="step3-locked-state">
                    <div className="font-semibold">{STEP3_UNLOCK_CONTRACT.lockHeading}</div>
                    <div className="mt-1">
                      {STEP3_UNLOCK_CONTRACT.lockBody}
                    </div>
                    <div className="mt-1">
                      Valid support now: {validSupportFoundCount} / {STEP3_UNLOCK_CONTRACT.requiredValidSupportCount}
                    </div>
                    <div className="mt-1">{STEP3_UNLOCK_CONTRACT.lockHint}</div>
                    <div className="mt-1 text-xs text-amber-100/80">{STEP3_UNLOCK_CONTRACT.approximationNote}</div>
                  </div>
                ) : null}

                {multiActionLoading ? <div className="mt-3 text-sm text-slate-300">Loading optimization actions...</div> : null}
                {multiActionError ? <div className="mt-3 rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{multiActionError}</div> : null}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(multiAction?.items ?? []).filter((item) => item.targetSurface === "listing").slice(0, 4).map((item) => (
                    <div key={item.actionId} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-100">{normalizeText(item.title)}</div>
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">{toPriorityBadge(item.recommendedPriority)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{normalizeText(item.whyItMatters)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3" data-testid="step2-execution-console">
                  <div className="text-sm font-semibold text-cyan-100">Optimization execution</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <NeonButton onClick={() => void generateListingUpgrade()} disabled={uiState === "generating" || step3Locked}>Generate Listing Optimization</NeonButton>
                    <NeonButton variant="secondary" onClick={() => void previewListingUpgrade()} disabled={!draftId || uiState === "previewing" || step3Locked}>Preview Changes</NeonButton>
                    <NeonButton variant="secondary" onClick={() => setListingApprovedForPublish(true)} disabled={uiState !== "ready_to_push" || step3Locked}>Approve Listing Update</NeonButton>
                    <NeonButton onClick={() => void publishListingUpgrade()} disabled={uiState !== "ready_to_push" || !listingApprovedForPublish || integrations.bdConfigured !== true || step3Locked}>Publish to Site</NeonButton>
                  </div>
                  <div className="mt-2 text-xs text-slate-200">Lifecycle: <span className={`rounded border px-2 py-0.5 ${lifecycleClassName(listingLifecycle)}`}>{listingLifecycle}</span></div>
                </div>

                {proposedDescription ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Optimized listing package</div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{proposedDescription}</pre>
                  </div>
                ) : null}

                {diffRows.length ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Approval preview</div>
                    <div className="mt-2 max-h-64 overflow-auto rounded border border-white/10">
                      {diffRows.map((row, idx) => (
                        <div key={`${row.type}-${idx}`} className="grid grid-cols-2 gap-2 border-b border-white/10 p-2 text-xs">
                          <div className="rounded bg-slate-900/80 p-2 text-slate-300">{row.left || " "}</div>
                          <div className="rounded bg-slate-900/80 p-2 text-cyan-100">{row.right || " "}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="step2-flywheel-links">
                  <div className="text-sm font-semibold text-slate-100">Read more about {displayName}</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {optimizedFlywheelLinks.length ? (
                      optimizedFlywheelLinks.map((item) => <li key={item}>• {item}</li>)
                    ) : (
                      <li>• Add or create support assets in Step 1 and Step 2 to populate this module.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : null}

            {activeStepId === "create-support" ? (
              <div data-testid="step-generate-content">
                <h3 className="text-lg font-semibold text-slate-100">Build Support Articles</h3>
                <p className="mt-1 text-sm text-slate-400">Create the articles that help AI engines understand and recommend this listing.</p>

                {actionsLoading || intentClustersLoading || reinforcementPlanLoading || contentStructureLoading ? <div className="mt-3 text-sm text-slate-300">Loading content opportunities...</div> : null}
                {actionsError || intentClustersError || reinforcementPlanError || contentStructureError ? (
                  <div className="mt-3 rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                    {actionsError || intentClustersError || reinforcementPlanError || contentStructureError || "Content generation intelligence is not available yet."}
                  </div>
                ) : null}
                {!reinforcementPlanLoading && !reinforcementPlanError && (reinforcementPlan?.items?.length ?? 0) === 0 ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                    No high-priority missing authority assets are currently detected. Step 1 can still recommend up to five missing opportunities when support gaps appear.
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200" data-testid="step2-progress-summary">
                  <div className="font-semibold text-slate-100">
                    {step2Progress.valid_count} of {step2Progress.required_count} live
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-amber-100">Create Ready: {step2StatusBuckets.create_ready}</span>
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-cyan-100">Preview Ready: {step2StatusBuckets.preview_ready}</span>
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-cyan-100">Approved: {step2StatusBuckets.approved}</span>
                    <span className="rounded-full border border-rose-300/30 bg-rose-400/10 px-2 py-1 text-rose-100">Needs Attention: {step2StatusBuckets.needs_attention}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="step2-next-article-cta">
                  {step2OpenAiSetupBlocked ? (
                    <>
                      <Link
                        href="/directoryiq/signal-sources?connector=openai"
                        className="inline-flex rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-100"
                        data-testid="step2-openai-setup-cta"
                      >
                        Connect OpenAI in Signal Sources
                      </Link>
                      <span className="text-xs text-amber-100/90">
                        {OPENAI_SETUP_BLOCKER_TITLE} {OPENAI_SETUP_BLOCKER_BODY}
                      </span>
                    </>
                  ) : step2SectionCta.candidate ? (
                    <>
                      <NeonButton
                        onClick={() => {
                          if (!step2SectionCta.candidate) return;
                          void executeStep2SlotPipeline({
                            missionSlot: step2SectionCta.candidate.missionSlot,
                            item: step2SectionCta.candidate.item,
                            slot: step2SectionCta.candidate.slot,
                          });
                        }}
                        disabled={!step2SectionCta.candidate}
                        data-testid="step2-write-next-article"
                      >
                        Write Next Article
                      </NeonButton>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-slate-400">All articles are currently in review, approved, or published.</span>
                    </>
                  )}
                </div>

                <div className="mt-4 space-y-2" data-testid="step2-slot-list">
                  {step2SlotViewModels.map(({ missionSlot, item, slot, blueprint, runtime, aggregateState, summary, publishDisabledReason, setupBlocked, asset }) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      data-testid={`step2-slot-row-${missionSlot.slot_id}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{normalizeText(item.title)}</div>
                          <div className="mt-1 text-xs text-slate-300">
                            {step2CardDescription({
                              summary,
                              purpose: normalizeText(item.suggestedContentPurpose) || normalizeText(blueprint?.suggestedH1),
                              title: item.title,
                              listingName: displayName,
                              asset,
                            })}
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${step2StatusClassName(aggregateState)}`}
                          data-testid={`step2-slot-status-${missionSlot.slot_id}`}
                        >
                          {step2StateLabel(aggregateState)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2" data-testid={`step2-slot-actions-${missionSlot.slot_id}`}>
                        {setupBlocked ? (
                          <Link
                            href="/directoryiq/signal-sources?connector=openai"
                            className="inline-flex rounded-lg border border-amber-300/35 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-100"
                            data-testid={`step2-slot-openai-setup-cta-${missionSlot.slot_id}`}
                          >
                            Connect OpenAI
                          </Link>
                        ) : null}
                        {!setupBlocked && aggregateState === "create_ready" ? (
                          <button
                            type="button"
                            className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100"
                            onClick={() => void executeStep2SlotPipeline({ missionSlot, item, slot })}
                            data-testid={`step2-slot-primary-action-${missionSlot.slot_id}`}
                          >
                            Write Article
                          </button>
                        ) : null}
                        {!setupBlocked && aggregateState === "draft_ready" ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100"
                              onClick={() => setSelectedMapNodeId(missionSlot.slot_id)}
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100"
                              onClick={() => void generateContentDraft(item, slot, buildStep2DraftContractInput(missionSlot))}
                            >
                              Regenerate Draft
                            </button>
                          </>
                        ) : null}
                        {!setupBlocked && aggregateState === "image_ready" ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100"
                              onClick={() => setSelectedMapNodeId(missionSlot.slot_id)}
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100"
                              onClick={() => void generateContentImage(item, slot)}
                            >
                              Regenerate Image
                            </button>
                          </>
                        ) : null}
                        {!setupBlocked && aggregateState === "preview_ready" ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100"
                              onClick={() => setSelectedMapNodeId(missionSlot.slot_id)}
                            >
                              Preview & Approve
                            </button>
                            <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => void generateContentDraft(item, slot, buildStep2DraftContractInput(missionSlot))}>Regenerate Draft</button>
                            <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => void generateContentImage(item, slot)}>Regenerate Image</button>
                          </>
                        ) : null}
                        {!setupBlocked && aggregateState === "approved" ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-300/35 bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-100 disabled:opacity-60"
                              onClick={() => void publishContentAsset(item, slot)}
                              disabled={Boolean(publishDisabledReason)}
                            >
                              Publish
                            </button>
                            <button type="button" className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100" onClick={() => setSelectedMapNodeId(missionSlot.slot_id)}>Preview</button>
                            <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => setContentAssets((previous) => ({ ...previous, [item.id]: { ...asset, reviewStatus: "ready", approvedAt: null, approvalToken: null } }))}>Unapprove</button>
                            <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => void generateContentDraft(item, slot, buildStep2DraftContractInput(missionSlot))}>Regenerate Draft</button>
                            <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => void generateContentImage(item, slot)}>Regenerate Image</button>
                          </>
                        ) : null}
                        {!setupBlocked && aggregateState === "publishing" ? (
                          <button type="button" className="rounded-lg border border-indigo-300/35 bg-indigo-400/15 px-3 py-1.5 text-xs font-medium text-indigo-100" disabled>Publishing…</button>
                        ) : null}
                        {!setupBlocked && aggregateState === "published" && asset.publishedUrl ? (
                          <div data-testid={`step2-slot-secondary-action-${missionSlot.slot_id}`}>
                            <a
                              href={asset.publishedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-cyan-200 underline"
                              data-testid={`step2-view-post-${missionSlot.slot_id}`}
                            >
                              View Live Post
                            </a>
                          </div>
                        ) : null}
                        {!setupBlocked && aggregateState === "needs_attention" ? (
                          <>
                            {asset.draftStatus === "failed" ? <button type="button" className="rounded-lg border border-rose-300/35 bg-rose-400/15 px-3 py-1.5 text-xs font-medium text-rose-100" onClick={() => void generateContentDraft(item, slot, buildStep2DraftContractInput(missionSlot))}>Retry Draft</button> : null}
                            {asset.imageStatus === "failed" ? <button type="button" className="rounded-lg border border-rose-300/35 bg-rose-400/15 px-3 py-1.5 text-xs font-medium text-rose-100" onClick={() => void generateContentImage(item, slot)}>Retry Image</button> : null}
                            {asset.publishStatus === "failed" ? <button type="button" className="rounded-lg border border-rose-300/35 bg-rose-400/15 px-3 py-1.5 text-xs font-medium text-rose-100" onClick={() => void publishContentAsset(item, slot)}>Retry Publish</button> : null}
                            {(asset.draftHtml || asset.featuredImageUrl) ? <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => setSelectedMapNodeId(missionSlot.slot_id)}>Preview</button> : null}
                          </>
                        ) : null}
                      </div>

                      {runtime?.errorMessage || setupBlocked || publishDisabledReason ? (
                        <div className="mt-2 text-xs text-rose-200" data-testid={`step2-slot-needs-review-${missionSlot.slot_id}`}>
                          {setupBlocked
                            ? `${OPENAI_SETUP_BLOCKER_TITLE} ${OPENAI_SETUP_BLOCKER_BODY}`
                            : publishDisabledReason || translateStep2ErrorMessage(runtime?.errorMessage)}
                        </div>
                      ) : null}

                      {selectedMapNodeId === missionSlot.slot_id ? (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-200" data-testid={`step2-slot-preview-surface-${missionSlot.slot_id}`}>
                          <div className="text-sm font-semibold text-slate-100">{asset.title || normalizeText(item.title)}</div>
                          <div className="mt-2 text-slate-300">Listing: {displayName}</div>
                          <div className="text-slate-300">Listing URL: {displayUrl || "Unavailable"}</div>
                          <div className="mt-2 text-slate-300">This article should include reciprocal links between the blog post and listing.</div>
                          {asset.featuredImageUrl ? <img src={asset.featuredImageUrl} alt={asset.title || "Featured image"} className="mt-3 max-h-44 rounded border border-white/10 object-cover" /> : <div className="mt-3 text-slate-400">Featured image is not ready yet.</div>}
                          <div className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-slate-900/60 p-2">{asset.draftHtml || "Draft is not ready yet."}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100" onClick={() => void approveContentAsset(item, slot)} disabled={asset.draftStatus !== "ready" || asset.imageStatus !== "ready"}>Approve</button>
                            <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => void generateContentDraft(item, slot, buildStep2DraftContractInput(missionSlot))}>Regenerate Draft</button>
                            <button type="button" className="rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-medium text-slate-100" onClick={() => void generateContentImage(item, slot)}>Regenerate Image</button>
                            {asset.reviewStatus === "approved" ? (
                              <button type="button" className="rounded-lg border border-emerald-300/35 bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-100 disabled:opacity-60" onClick={() => void publishContentAsset(item, slot)} disabled={Boolean(publishDisabledReason)}>Publish</button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {activeStepId === "create-support" ? (
          <aside className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="publish-execution-layer">
            <h2 className="text-base font-semibold text-slate-100">Ready to Publish</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>{listingIsReady ? 1 : 0} listing update approved</li>
              <li>{approvedContent.length} blog posts approved</li>
              <li>{approvedImages.length} featured images ready</li>
              <li>{approvedLinkCount} flywheel links ready</li>
            </ul>

            <div className="mt-4 space-y-2">
              <NeonButton onClick={() => void publishAllApprovedAssets()} disabled={publishReadyCount === 0 || integrations.bdConfigured !== true}>
                Publish All Approved Assets
              </NeonButton>
              <NeonButton variant="secondary" onClick={() => setActiveStepId("optimize-listing")}>Preview Changes</NeonButton>
              <NeonButton variant="secondary" onClick={() => void publishAllApprovedAssets()} disabled={publishReadyCount === 0 || integrations.bdConfigured !== true}>Publish Selected</NeonButton>
              <NeonButton variant="secondary" onClick={() => setNotice("Draft saved for this listing mission.")}>Save as Draft</NeonButton>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
              <div className="uppercase tracking-[0.08em] text-slate-400">Lifecycle coverage</div>
              <div className="mt-2">Listing improvements: {listingLifecycle}</div>
              <div>Blog posts: {publishedContent.length} Published / {approvedContent.length} Approved</div>
              <div>Featured images: {approvedImages.length} ready</div>
              <div>Flywheel links: {publishedLinkCount} Queued (draft) / {approvedLinkCount} Ready (draft)</div>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-400" data-testid="map-refresh-summary">
        Map refresh logic: connections switch from orange to green when links are queued in this draft workspace. Score refresh path: base listing score + deterministic publish bonuses.
      </div>
    </>
  );
}
