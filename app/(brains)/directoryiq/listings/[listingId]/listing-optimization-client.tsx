"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/ecomviper/TopBar";
import NeonButton from "@/components/ecomviper/NeonButton";
import { fetchJsonWithTimeout, RequestTimeoutError } from "@/lib/directoryiq/fetchWithTimeout";

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

type UiError = {
  message: string;
  reqId?: string;
  code?: string;
  status?: number;
  listingId?: string;
};

type MissionStepId = "make-connections" | "optimize-listing" | "generate-content";

const MISSION_STEPS: Array<{ id: MissionStepId; label: string }> = [
  { id: "make-connections", label: "Step 1: Make Connections" },
  { id: "generate-content", label: "Step 2: Generate Content" },
  { id: "optimize-listing", label: "Step 3: Optimize Listing" },
];

function normalizeMissionStepQuery(value: string | null): MissionStepId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "make-connections" || normalized === "step-1" || normalized === "step1") return "make-connections";
  if (normalized === "generate-content" || normalized === "step-2" || normalized === "step2") return "generate-content";
  if (normalized === "optimize-listing" || normalized === "step-3" || normalized === "step3") return "optimize-listing";
  // Backwards compatibility with previous labels/routes.
  if (normalized === "connect-existing-pages" || normalized === "create-support-content") return "generate-content";
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
  source: "existing" | "missing" | "generated";
  relation: "already_connected" | "recommended_connection" | "recommended_missing";
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
  status: LifecycleState;
  imageStatus: LifecycleState;
  flywheelStatus: LifecycleState;
  draftHtml: string;
  featuredImageUrl: string;
  approvalToken: string;
  publishedUrl: string;
  scoreAfter: number | null;
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

function parseError(json: ApiErrorShape, fallback: string, status?: number, listingId?: string): UiError {
  return {
    message: json.error?.message ?? fallback,
    reqId: json.error?.reqId,
    code: json.error?.code,
    status,
    listingId,
  };
}

function stringifyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof RequestTimeoutError) return `${fallback} timed out.`;
  if (error instanceof Error) return error.message;
  return fallback;
}

function mapNodeLayout(index: number): { x: number; y: number } {
  const points = [
    { x: 12, y: 18 },
    { x: 50, y: 10 },
    { x: 86, y: 18 },
    { x: 90, y: 46 },
    { x: 86, y: 74 },
    { x: 50, y: 86 },
    { x: 14, y: 74 },
    { x: 10, y: 46 },
  ];
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
  if (category === "hub") return "Hub Page";
  if (category === "category") return "Category Page";
  if (category === "location") return "Location Page";
  if (category === "comparison") return "Comparison Page";
  if (category === "faq") return "FAQ Asset";
  if (category === "local_guide") return "Local Guide";
  return "Page";
}

function mapConnectionPoints(index: number): { x1: number; y1: number; x2: number; y2: number } {
  const point = mapNodeLayout(index);
  const cx = 50;
  const cy = 50;
  const rx = 31;
  const ry = 24;
  const nodeRadius = 4.5;
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

  const [activeStepId, setActiveStepId] = useState<MissionStepId>("make-connections");
  const [listingLifecycle, setListingLifecycle] = useState<LifecycleState>("Detected");
  const [listingApprovedForPublish, setListingApprovedForPublish] = useState(false);
  const [selectedMapNodeId, setSelectedMapNodeId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [linkOperations, setLinkOperations] = useState<LinkOperation[]>([]);
  const [contentAssets, setContentAssets] = useState<Record<string, ContentAssetState>>({});

  useEffect(() => {
    const queryStep = normalizeMissionStepQuery(stepParam);
    if (!queryStep) return;
    setActiveStepId(queryStep);
  }, [stepParam]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistedMissionState;
      setActiveStepId(parsed.activeStepId ?? "make-connections");
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
  const displayUrl = listing?.listing.listing_url ?? support?.listing.canonicalUrl ?? null;
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
    let existingIndex = 0;
    let generatedIndex = 0;
    let missingIndex = 0;

    const toExistingCategory = (type: string): MapNodeCategory => {
      if (type === "blog_post") return "blog_post";
      if (type === "support") return "support";
      if (type === "hub") return "hub";
      if (type === "category") return "category";
      if (type === "location") return "location";
      return "page";
    };

    const toPlanCategory = (surface?: string): MapNodeCategory => {
      if (surface === "comparison") return "comparison";
      if (surface === "faq") return "faq";
      if (surface === "local_guide") return "local_guide";
      if (surface === "support_page") return "support";
      if (surface === "cluster_hub") return "hub";
      return "blog_post";
    };

    for (const item of support?.inboundLinkedSupport ?? []) {
      const title = normalizeText(item.title) || "Support Asset";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      existingIndex += 1;
      nodes.push({
        id: `existing-inbound-${item.sourceId}`,
        label: `E${existingIndex}`,
        title,
        category: toExistingCategory(item.sourceType),
        connectionTone: "flywheel",
        lifecycle: "Published",
        details: `E${existingIndex}: ${title}`,
        source: "existing",
        relation: "already_connected",
        url: item.url ?? null,
      });
    }

    for (const item of support?.connectedSupportPages ?? []) {
      const title = normalizeText(item.title) || "Connected Support Page";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      existingIndex += 1;
      nodes.push({
        id: `existing-connected-${item.id ?? existingIndex}`,
        label: `E${existingIndex}`,
        title,
        category: toExistingCategory(item.type),
        connectionTone: "flywheel",
        lifecycle: "Published",
        details: `E${existingIndex}: ${title}`,
        source: "existing",
        relation: "already_connected",
        url: item.url ?? null,
      });
    }

    for (const item of support?.mentionsWithoutLinks ?? []) {
      const title = normalizeText(item.title) || "Support Mention";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      existingIndex += 1;
      nodes.push({
        id: `existing-mention-${item.sourceId}`,
        label: `E${existingIndex}`,
        title,
        category: toExistingCategory(item.sourceType),
        connectionTone: "standard",
        lifecycle: "Recommended",
        details: `E${existingIndex}: ${title}`,
        source: "existing",
        relation: "recommended_connection",
        url: item.url ?? null,
      });
    }

    for (const item of reinforcementPlan?.items.slice(0, 5) ?? []) {
      const asset = contentAssets[item.id];
      if (!asset || asset.status === "Recommended") continue;
      const title = normalizeText(asset.title || item.title) || "Generated Support Asset";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      generatedIndex += 1;
      nodes.push({
        id: `generated-${item.id}`,
        label: `G${generatedIndex}`,
        title,
        category: toPlanCategory(item.suggestedTargetSurface),
        connectionTone: asset.status === "Published" ? "flywheel" : "standard",
        lifecycle: asset.status,
        details: `G${generatedIndex}: ${title}`,
        source: "generated",
        relation: asset.status === "Published" ? "already_connected" : "recommended_connection",
        url: asset.publishedUrl || null,
      });
    }

    for (const item of missingFlywheelItems.slice(0, 5)) {
      const title = normalizeText(item.title) || "Missing Support Asset";
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      missingIndex += 1;
      nodes.push({
        id: `missing-flywheel-${item.key}`,
        label: `M${missingIndex}`,
        title,
        category: "blog_post",
        connectionTone: "standard",
        lifecycle: "Recommended",
        details: `M${missingIndex}: ${title}`,
        source: "missing",
        relation: "recommended_missing",
        url: item.targetEntity.url ?? null,
      });
    }

    return nodes.slice(0, 8);
  }, [support, missingFlywheelItems, reinforcementPlan, contentAssets]);

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
    : "Generate one missing authority asset from Step 2.";

  const missionProgress = useMemo(() => {
    const connectionsDone = linkOperations.some((item) => item.status === "Approved" || item.status === "Published");
    const listingDone = listingLifecycle === "Generated" || listingLifecycle === "Approved" || listingLifecycle === "Published";
    const contentDone = Object.values(contentAssets).some((item) => item.status === "Generated" || item.status === "Approved" || item.status === "Published");
    const completed = [connectionsDone, listingDone, contentDone].filter(Boolean).length;
    return Math.round((completed / 3) * 100);
  }, [linkOperations, listingLifecycle, contentAssets]);

  const publishedLinkCount = linkOperations.filter((item) => item.status === "Published").length;
  const approvedLinkCount = linkOperations.filter((item) => item.status === "Approved").length;

  const approvedContent = Object.values(contentAssets).filter((item) => item.status === "Approved");
  const publishedContent = Object.values(contentAssets).filter((item) => item.status === "Published");
  const approvedImages = Object.values(contentAssets).filter((item) => item.imageStatus === "Approved" || item.imageStatus === "Generated");

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

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/generate${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "default" }),
    });

    const json = (await res.json().catch(() => ({}))) as { draftId?: string; proposedDescription?: string } & ApiErrorShape;

    if (!res.ok) {
      setUiState("idle");
      setListingLifecycle("Recommended");
      setError(parseError(json, "Failed to generate listing optimization draft."));
      return;
    }

    setDraftId(json.draftId ?? "");
    setProposedDescription(json.proposedDescription ?? "");
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

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/preview${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId }),
    });

    const json = (await res.json().catch(() => ({}))) as { diff?: DiffRow[]; approvalToken?: string } & ApiErrorShape;
    if (!res.ok) {
      setUiState("generated");
      setError(parseError(json, "Failed to preview listing optimization draft."));
      return;
    }

    setDiffRows(json.diff ?? []);
    setListingApprovalToken(json.approvalToken ?? "");
    setUiState("ready_to_push");
    setListingLifecycle("Approved");
    setNotice("Listing optimization is ready for publish.");
  }

  async function publishListingUpgrade() {
    if (!effectiveListingId || !draftId || !listingApprovedForPublish) return;

    setNotice(null);
    setError(null);
    setUiState("pushing");

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/push${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        approved: true,
        approvalToken: listingApprovalToken,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as ApiErrorShape;
    if (!res.ok) {
      setUiState("ready_to_push");
      setError(parseError(json, "Failed to publish listing optimization."));
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
      status: "Recommended",
      imageStatus: "Detected",
      flywheelStatus: "Recommended",
      draftHtml: "",
      featuredImageUrl: "",
      approvalToken: "",
      publishedUrl: "",
      scoreAfter: null,
    };
  }

  async function generateContentDraft(item: BlogReinforcementPlanItem, slot: number) {
    if (!effectiveListingId) return;
    const current = initializeContentAsset(item, slot);

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: { ...current, status: "Generated" },
    }));

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/draft${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "local_guide",
        focus_topic: current.focusTopic,
        title: current.title,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { draft_html?: string; error?: { message?: string } | string };
    if (!res.ok) {
      setError({ message: typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to generate content draft." });
      setContentAssets((previous) => ({
        ...previous,
        [item.id]: { ...current, status: "Recommended" },
      }));
      return;
    }

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        status: "Generated",
        draftHtml: json.draft_html ?? "",
      },
    }));
    setNotice(`Generated draft for ${current.title}.`);
  }

  async function generateContentImage(item: BlogReinforcementPlanItem, slot: number) {
    if (!effectiveListingId) return;
    const current = initializeContentAsset(item, slot);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/image${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus_topic: current.focusTopic }),
    });
    const json = (await res.json().catch(() => ({}))) as { featured_image_url?: string; error?: { message?: string } | string };

    if (!res.ok) {
      setError({ message: typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to generate featured image." });
      return;
    }

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        imageStatus: "Generated",
        featuredImageUrl: json.featured_image_url ?? "",
      },
    }));
    setNotice(`Generated featured image for ${current.title}.`);
  }

  async function approveContentAsset(item: BlogReinforcementPlanItem, slot: number) {
    if (!effectiveListingId) return;
    const current = initializeContentAsset(item, slot);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/preview${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = (await res.json().catch(() => ({}))) as {
      approval_token?: string;
      preview?: { score_delta?: { after?: number } };
      error?: { message?: string } | string;
    };

    if (!res.ok) {
      setError({ message: typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to approve content asset." });
      return;
    }

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        status: "Approved",
        imageStatus: current.imageStatus === "Detected" ? "Recommended" : current.imageStatus,
        flywheelStatus: "Approved",
        approvalToken: json.approval_token ?? "",
        scoreAfter: json.preview?.score_delta?.after ?? null,
      },
    }));
    setNotice(`${current.title} approved for publish.`);
  }

  async function publishContentAsset(item: BlogReinforcementPlanItem, slot: number) {
    if (!effectiveListingId) return;
    const current = initializeContentAsset(item, slot);
    if (!current.approvalToken) return;

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/publish${siteQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approve_publish: true,
        approval_token: current.approvalToken,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as { published_url?: string; error?: { message?: string } | string };
    if (!res.ok) {
      setError({ message: typeof json.error === "string" ? json.error : json.error?.message ?? "Failed to publish content asset." });
      return;
    }

    setContentAssets((previous) => ({
      ...previous,
      [item.id]: {
        ...current,
        status: "Published",
        imageStatus: current.imageStatus === "Detected" ? "Recommended" : current.imageStatus,
        flywheelStatus: "Published",
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
  }

  function approveLink(itemKey: string) {
    setLinkOperations((previous) => previous.map((item) => (item.key === itemKey ? { ...item, status: "Approved" } : item)));
  }

  function publishLink(itemKey: string) {
    setLinkOperations((previous) => previous.map((item) => (item.key === itemKey ? { ...item, status: "Published" } : item)));
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
      if (current.status === "Approved" && current.approvalToken) {
        await publishContentAsset(item, slot);
      }
    }
  }

  const recommendedMissingItems = missingFlywheelItems.slice(0, 5);
  const existingConnections = connectNowFlywheelItems.slice(0, 5);
  const alreadyConnectedAssets = mapNodes.filter((node) => node.relation === "already_connected").slice(0, 5);
  const existingSupportCount = support?.summary.connectedSupportPageCount ?? support?.connectedSupportPages.length ?? 0;
  const missingGenerationItems = recommendedMissingItems.slice(0, 5);
  const optimizedFlywheelLinks = useMemo(() => {
    const seen = new Set<string>();
    const links: string[] = [];
    for (const node of mapNodes) {
      if (node.relation === "already_connected" || node.relation === "recommended_connection") {
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

      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="listing-mission-header">
        <div className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Listing mission control</div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">{displayName}</h1>
            {displayUrl ? (
              <Link className="mt-1 block text-xs text-cyan-200 underline underline-offset-4" href={displayUrl} target="_blank">
                {displayUrl}
              </Link>
            ) : null}
          </div>
          <div className="text-xs text-slate-300">Step order: Make Connections, Generate Content, Optimize Listing</div>
        </div>
      </div>

      {integrations.openaiConfigured === false ? (
        <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          AI connection not configured. Configure it in <Link href="/directoryiq/signal-sources?connector=openai" className="underline">Connections</Link>.
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="authority-map-zone">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Authority Map</h2>
                <p className="text-xs text-slate-400">Listing-first authority view with connected, recommended, and missing support assets.</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-300" />Connected</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-300" />Recommended</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="relative mx-auto aspect-[16/10] max-w-4xl" data-testid="authority-map-canvas">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {mapNodes.map((node, index) => {
                    const line = mapConnectionPoints(index);
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
                  className="absolute left-1/2 top-1/2 h-[58%] w-[62%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[999px] border border-cyan-300/45 bg-slate-900 shadow-2xl"
                  data-testid="listing-hero-node"
                >
                  {listing?.listing.mainImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.listing.mainImageUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-sm text-slate-300">No listing image</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                    {displayUrl ? (
                      <Link className="mt-1 block truncate text-xs text-cyan-100 underline underline-offset-4" href={displayUrl} target="_blank">
                        {displayUrl}
                      </Link>
                    ) : null}
                    <div className="mt-1 inline-flex rounded-full border border-cyan-200/60 bg-black/30 px-2 py-0.5 text-[11px] text-cyan-100">
                      AI Visibility Score / AI Selection {computedScore}
                    </div>
                  </div>
                </div>

                {mapNodes.map((node, index) => {
                  const point = mapNodeLayout(index);
                  const selected = node.id === selectedMapNodeId;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
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

          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="authority-details-drawer">
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
                  {nodeCategoryLabel(selectedMapNode.category)} • {selectedMapNode.lifecycle} • {selectedMapNode.relation.replace(/_/g, " ")}
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
              {MISSION_STEPS.map((step) => {
                const isActive = activeStepId === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${isActive ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-white/15 bg-white/[0.03] text-slate-300"}`}
                    onClick={() => setActiveStepId(step.id)}
                    data-testid={`listing-step-nav-desktop-${step.id}`}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="listing-active-step-workspace">
            {activeStepId === "make-connections" ? (
              <div data-testid="step-make-connections">
                <h3 className="text-lg font-semibold text-slate-100">Step 1: Make Connections</h3>
                <p className="mt-1 text-sm text-slate-400">Identify what already supports this listing, what is missing, and which missing assets should be created next.</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Existing support</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-100">{existingSupportCount}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Connect now</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-100">{existingConnections.length}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Missing assets</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-100">{missingGenerationItems.length}</div>
                  </div>
                </div>

                {supportLoading || gapsLoading || flywheelLoading ? <div className="mt-3 text-sm text-slate-300">Loading connection intelligence...</div> : null}
                {supportError || gapsError || flywheelError ? (
                  <div className="mt-3 rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                    {supportError || gapsError || flywheelError}
                  </div>
                ) : null}

                {alreadyConnectedAssets.length ? (
                  <div className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-3">
                    <div className="text-xs uppercase tracking-[0.08em] text-emerald-100">Already connected</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-emerald-100">
                      {alreadyConnectedAssets.map((node) => (
                        <span key={node.id} className="rounded-full border border-emerald-200/35 px-2 py-1">
                          {node.label}: {node.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2" data-testid="step1-existing-connections">
                  {existingConnections.slice(0, 5).map((item) => {
                    const op = linkOperations.find((operation) => operation.key === item.key);
                    const status = op?.status ?? "Recommended";
                    return (
                      <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-100">{normalizeText(item.title)}</div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${lifecycleClassName(status === "Published" ? "Published" : status === "Approved" ? "Approved" : "Recommended")}`}>{status}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{normalizeText(item.rationale)}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100"
                            onClick={() => approveLink(item.key)}
                            disabled={status === "Approved" || status === "Published"}
                          >
                            Approve link
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-300/35 bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-100"
                            onClick={() => publishLink(item.key)}
                            disabled={status === "Published"}
                          >
                            Publish to Site
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="step1-missing-connections">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Missing support to route into Step 3</div>
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
                <h3 className="text-lg font-semibold text-slate-100">Step 3: Optimize Listing</h3>
                <p className="mt-1 text-sm text-slate-400">Build the strongest AI-ready listing package, then approve and publish.</p>

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
                    <NeonButton onClick={() => void generateListingUpgrade()} disabled={uiState === "generating"}>Generate Listing Optimization</NeonButton>
                    <NeonButton variant="secondary" onClick={() => void previewListingUpgrade()} disabled={!draftId || uiState === "previewing"}>Preview Changes</NeonButton>
                    <NeonButton variant="secondary" onClick={() => setListingApprovedForPublish(true)} disabled={uiState !== "ready_to_push"}>Approve Listing Update</NeonButton>
                    <NeonButton onClick={() => void publishListingUpgrade()} disabled={uiState !== "ready_to_push" || !listingApprovedForPublish || integrations.bdConfigured !== true}>Publish to Site</NeonButton>
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
                      <li>• Add or generate support assets in Step 1 and Step 2 to populate this module.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : null}

            {activeStepId === "generate-content" ? (
              <div data-testid="step-generate-content">
                <h3 className="text-lg font-semibold text-slate-100">Step 2: Generate Content</h3>
                <p className="mt-1 text-sm text-slate-400">Generate missing authority assets, approve them, and publish directly.</p>

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

                <div className="mt-4 space-y-2" data-testid="step3-content-assets">
                  {(reinforcementPlan?.items ?? []).slice(0, 5).map((item, index) => {
                    const slot = index + 1;
                    const asset = contentAssets[item.id] ?? initializeContentAsset(item, slot);
                    const blueprint = contentStructure?.items[index] ?? null;

                    return (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-100">{normalizeText(item.title)}</div>
                            <div className="mt-1 text-xs text-slate-400">{normalizeText(item.suggestedContentPurpose)}</div>
                            <div className="mt-1 text-[11px] text-slate-300">
                              Type: <span className="text-slate-100">{normalizeText(item.suggestedTargetSurface)}</span> • Status: <span className="text-slate-100">{asset.status}</span>
                            </div>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${lifecycleClassName(asset.status)}`}>{asset.status}</span>
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                            <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">FAQ focus</div>
                            <div className="mt-1 text-xs text-slate-200">{blueprint?.faqThemes.slice(0, 2).join(" • ") || "Use service, location, and comparison FAQs."}</div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                            <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Internal linking plan</div>
                            <div className="mt-1 text-xs text-slate-200">Link back to {displayName} and 1 related authority post.</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100" onClick={() => void generateContentDraft(item, slot)}>Generate Draft</button>
                          <button type="button" className="rounded-lg border border-indigo-300/35 bg-indigo-400/15 px-3 py-1.5 text-xs font-medium text-indigo-100" onClick={() => void generateContentImage(item, slot)}>Generate Image</button>
                          <button type="button" className="rounded-lg border border-emerald-300/35 bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-100" onClick={() => void approveContentAsset(item, slot)} disabled={asset.status === "Detected" || asset.status === "Recommended"}>Approve</button>
                          <button type="button" className="rounded-lg border border-emerald-300/35 bg-emerald-400/25 px-3 py-1.5 text-xs font-medium text-emerald-50" onClick={() => void publishContentAsset(item, slot)} disabled={asset.status !== "Approved"}>Publish to Site</button>
                        </div>

                        <div className="mt-2 grid gap-1 text-[11px] text-slate-300">
                          <div>Supports listing: <span className="text-slate-100">{displayName}</span></div>
                          <div>Image state: <span className={`rounded border px-1.5 py-0.5 ${lifecycleClassName(asset.imageStatus)}`}>{asset.imageStatus}</span></div>
                          <div>Flywheel state: <span className={`rounded border px-1.5 py-0.5 ${lifecycleClassName(asset.flywheelStatus)}`}>{asset.flywheelStatus}</span></div>
                          {asset.publishedUrl ? <div>Published URL: <a href={asset.publishedUrl} target="_blank" rel="noreferrer" className="text-cyan-200 underline">{asset.publishedUrl}</a></div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-testid="publish-execution-layer">
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
            <div>Flywheel links: {publishedLinkCount} Published / {approvedLinkCount} Approved</div>
          </div>
        </aside>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-400" data-testid="map-refresh-summary">
        Map refresh logic: connections switch from orange to green when assets or links move to Published. Score refresh path: base listing score + deterministic publish bonuses.
      </div>
    </>
  );
}
