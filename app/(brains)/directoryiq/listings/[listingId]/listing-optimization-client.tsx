"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import ListingHero from "@/components/directoryiq/ListingHero";

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
    dataStatus: "gaps_found" | "no_meaningful_gaps";
  };
  items: AuthorityGapItem[];
};

type ListingAuthorityGapsResponse = {
  ok: boolean;
  gaps?: ListingAuthorityGapsModel;
  meta?: {
    source: string;
    evaluatedAt: string;
    dataStatus: "gaps_found" | "no_meaningful_gaps";
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
  };
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  } | string;
};

type MultiActionPriority = "high" | "medium" | "low";
type MultiActionStatus = "available" | "blocked" | "not_recommended";
type MultiActionKey =
  | "optimize_listing_description"
  | "repair_flywheel_links"
  | "publish_reinforcement_post"
  | "build_reinforcement_cluster"
  | "publish_local_context_support"
  | "strengthen_anchor_intent"
  | "implement_serp_structure_recommendations";

type ListingMultiActionUpgradeItem = {
  key: MultiActionKey;
  title: string;
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
  const [supportError, setSupportError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<ListingAuthorityGapsModel | null>(null);
  const [gapsError, setGapsError] = useState<string | null>(null);
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
        const listingRes = await fetch(listingPath, { cache: "no-store" });
        const listingJson = (await listingRes.json().catch(() => ({}))) as ListingDetailPayload & ApiErrorShape;
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
        const message = err instanceof Error ? err.message : "Failed to load listing details.";
        setError({ message, status: 0, listingId: effectiveListingId });
        setListing(null);
      }
    })();

    void (async () => {
      try {
        const response = await fetch("/api/directoryiq/signal-sources", { cache: "no-store" });
        const json = (await response.json().catch(() => ({}))) as SignalSourcesResponse & ApiErrorShape;
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
        const supportRes = await fetch(supportPath, {
          cache: "no-store",
        });
        const supportJson = (await supportRes.json().catch(() => ({}))) as ListingSupportResponse;
        if (!supportRes.ok || !supportJson.ok) {
          const supportMessage =
            typeof supportJson.error === "string"
              ? supportJson.error
              : supportJson.error?.message ?? "Failed to load support model.";
          setSupportError(supportMessage);
          setSupport(null);
          return;
        }

        setSupport(supportJson.support ?? null);
        setSupportError(null);
      } catch (supportErr) {
        const message = supportErr instanceof Error ? supportErr.message : "Failed to load support model.";
        setSupportError(message);
        setSupport(null);
      }
    })();

    void (async () => {
      try {
        const gapsRes = await fetch(gapsPath, {
          cache: "no-store",
        });
        const gapsJson = (await gapsRes.json().catch(() => ({}))) as ListingAuthorityGapsResponse;
        if (!gapsRes.ok || !gapsJson.ok) {
          const gapsMessage =
            typeof gapsJson.error === "string"
              ? gapsJson.error
              : gapsJson.error?.message ?? "Failed to evaluate authority gaps.";
          setGapsError(gapsMessage);
          setGaps(null);
          return;
        }

        setGaps(gapsJson.gaps ?? null);
        setGapsError(null);
      } catch (gapsErr) {
        const message = gapsErr instanceof Error ? gapsErr.message : "Failed to evaluate authority gaps.";
        setGapsError(message);
        setGaps(null);
      }
    })();
  }

  useEffect(() => {
    void loadListingAndIntegrations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveListingId, siteQuery]);

  useEffect(() => {
    if (!effectiveListingId) return;

    if (supportError || gapsError) {
      setActions(null);
      setActionsLoading(false);
      setActionsError("Actions evaluation failed because support and gaps diagnostics are unavailable.");
      return;
    }

    if (!support || !gaps) {
      setActionsLoading(true);
      setActionsError(null);
      return;
    }

    let active = true;
    setActionsLoading(true);
    setActionsError(null);

    void (async () => {
      try {
        const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/actions${siteQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ support, gaps }),
        });
        const json = (await response.json().catch(() => ({}))) as ListingRecommendedActionsResponse;
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
        const message = actionsErr instanceof Error ? actionsErr.message : "Failed to evaluate recommended actions.";
        setActions(null);
        setActionsError(message);
        setActionsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, supportError, gapsError]);

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
        const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/intent-clusters${siteQuery}`, {
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
        });
        const json = (await response.json().catch(() => ({}))) as ListingSelectionIntentClustersResponse;
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
          intentClustersErr instanceof Error ? intentClustersErr.message : "Failed to evaluate selection intent clusters.";
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
        const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/reinforcement-plan${siteQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ support, gaps, actions, flywheel, intentClusters }),
        });
        const json = (await response.json().catch(() => ({}))) as ListingBlogReinforcementPlanResponse;
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
          reinforcementPlanErr instanceof Error ? reinforcementPlanErr.message : "Failed to evaluate blog reinforcement plan.";
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
        const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/content-structure${siteQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ support, gaps, actions, flywheel, intentClusters, reinforcementPlan }),
        });
        const json = (await response.json().catch(() => ({}))) as ListingSerpContentStructureResponse;
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
          contentStructureErr instanceof Error
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
        const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/multi-action${siteQuery}`, {
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
        });
        const json = (await response.json().catch(() => ({}))) as ListingMultiActionUpgradeResponse;
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
          multiActionErr instanceof Error ? multiActionErr.message : "Failed to evaluate multi-action upgrade system.";
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

    if (supportError || gapsError) {
      setFlywheel(null);
      setFlywheelLoading(false);
      setFlywheelError("Flywheel evaluation failed because support and gaps diagnostics are unavailable.");
      return;
    }

    if (!support || !gaps) {
      setFlywheelLoading(true);
      setFlywheelError(null);
      return;
    }

    let active = true;
    setFlywheelLoading(true);
    setFlywheelError(null);

    void (async () => {
      try {
        const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/flywheel-links${siteQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ support, gaps }),
        });
        const json = (await response.json().catch(() => ({}))) as ListingFlywheelLinksResponse;
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
        const message = flywheelErr instanceof Error ? flywheelErr.message : "Failed to evaluate flywheel links.";
        setFlywheel(null);
        setFlywheelError(message);
        setFlywheelLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveListingId, siteQuery, support, gaps, supportError, gapsError]);

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
    (fallbackId ? `Listing #${fallbackId}` : "Listing");
  const displayUrl = listing?.listing.listing_url ?? null;
  const displayScore = listing?.evaluation.totalScore ?? 0;
  const supportSummary = support?.summary ?? {
    inboundLinkedSupportCount: 0,
    mentionWithoutLinkCount: 0,
    outboundSupportLinkCount: 0,
    connectedSupportPageCount: 0,
    lastGraphRunAt: null,
  };
  const gapsSummary = gaps?.summary ?? {
    totalGaps: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    evaluatedAt: "",
    lastGraphRunAt: null,
    dataStatus: "no_meaningful_gaps" as const,
  };
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

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "AI Visibility"]} searchPlaceholder="Search AI visibility..." />

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
          {error.listingId ? ` (listing: ${error.listingId})` : ""}
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
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">What's Helping</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.inboundLinkedSupportCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Visibility Gaps</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{gapsSummary.totalGaps}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Recommended Improvements</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{actions?.summary.totalActions ?? 0}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Trust Signals</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.connectedSupportPageCount}</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setWorkspaceView("helping")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "helping" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          What's Helping
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceView("missing")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "missing" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          What's Missing
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceView("improvements")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "improvements" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          Recommended Improvements
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceView("publish")}
          className={`rounded-lg border px-3 py-2 text-sm ${workspaceView === "publish" ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}
        >
          Publish
        </button>
      </div>

      {workspaceView === "helping" ? (
      <>
      <HudCard title="What's Helping" subtitle="Current trust and visibility signals supporting this listing.">
        {supportError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {supportError}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Supporting Links In</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.inboundLinkedSupportCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mentions Without Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.mentionWithoutLinkCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Outbound Support Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.outboundSupportLinkCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Connected Support Pages</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.connectedSupportPageCount}</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          {supportSummary.lastGraphRunAt
            ? `Last graph refresh: ${new Date(supportSummary.lastGraphRunAt).toLocaleString()}`
            : "Last graph refresh: Not available yet."}
        </div>

        <div className="mt-5 space-y-5">
          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Inbound Linked Support</div>
            <div className="mt-2 space-y-2">
              {support?.inboundLinkedSupport?.length ? (
                support.inboundLinkedSupport.map((item) => (
                  <div key={`${item.sourceId}-${item.url ?? ""}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.sourceId}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.sourceType} · Anchors: {item.anchors.length ? item.anchors.join(", ") : "None captured"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No inbound linked support detected yet.</div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mentions Without Links</div>
            <div className="mt-2 space-y-2">
              {support?.mentionsWithoutLinks?.length ? (
                support.mentionsWithoutLinks.map((item) => (
                  <div key={`${item.sourceId}-${item.url ?? ""}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.sourceId}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.sourceType} · {item.mentionSnippet ?? "No snippet captured"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No unlinked mentions detected yet.</div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Listing Outbound Support Links</div>
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
                <div className="text-sm text-slate-400">No outbound support links detected yet.</div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Connected Support Pages</div>
            <div className="mt-2 space-y-2">
              {support?.connectedSupportPages?.length ? (
                support.connectedSupportPages.map((item, index) => (
                  <div key={`${item.id ?? "support"}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.id ?? "Support page"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.type}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No connected support pages detected yet.</div>
              )}
            </div>
          </section>
        </div>
      </HudCard>

      <HudCard title="Trust Signals" subtitle="Cross-link opportunities that strengthen AI visibility.">
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
                  <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.priority}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.type}
                      </span>
                      {item.suggestedSurface ? (
                        <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                          {item.suggestedSurface}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{item.rationale}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.evidenceSummary}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Source: {item.sourceEntity.title} → Target: {item.targetEntity.title}
                    </div>
                    {item.anchorGuidance?.suggestedAnchorText ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Suggested anchor: {item.anchorGuidance.suggestedAnchorText}
                      </div>
                    ) : null}
                    {item.anchorGuidance?.guidance ? (
                      <div className="mt-1 text-xs text-slate-400">Anchor guidance: {item.anchorGuidance.guidance}</div>
                    ) : null}
                    {item.linkedGapTypes?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked gaps: {item.linkedGapTypes.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>
      </>
      ) : null}

      {workspaceView === "missing" ? (
      <HudCard title="Visibility Gaps" subtitle="What AI systems still struggle to verify about this listing.">
        {gapsError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {gapsError}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Total Gaps</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{gapsSummary.totalGaps}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">High Severity</div>
            <div className="mt-1 text-2xl font-semibold text-rose-200">{gapsSummary.highCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Medium Severity</div>
            <div className="mt-1 text-2xl font-semibold text-amber-100">{gapsSummary.mediumCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Low Severity</div>
            <div className="mt-1 text-2xl font-semibold text-cyan-100">{gapsSummary.lowCount}</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          {gapsSummary.lastGraphRunAt
            ? `Last graph refresh: ${new Date(gapsSummary.lastGraphRunAt).toLocaleString()}`
            : "Last graph refresh: Not available yet."}
        </div>

        {gapsSummary.dataStatus === "no_meaningful_gaps" && !gapsError ? (
          <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            No major visibility gaps found for this listing.
          </div>
        ) : null}

        {gapsSummary.dataStatus === "gaps_found" ? (
          <div className="mt-4 space-y-2">
            {gaps?.items.map((item) => (
              <div key={item.type} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                  <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                    {item.severity}
                  </span>
                  <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                    {item.type}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-300">{item.explanation}</div>
                <div className="mt-1 text-xs text-slate-400">{item.evidenceSummary}</div>
              </div>
            ))}
          </div>
        ) : null}
      </HudCard>
      ) : null}

      {workspaceView === "improvements" ? (
      <>
      <HudCard title="Recommended Improvements" subtitle="Highest-impact updates to improve AI selection and trust.">
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
                  <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.priority}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.key}
                      </span>
                      {item.targetSurface ? (
                        <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                          {item.targetSurface}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{item.rationale}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.evidenceSummary}</div>
                    {item.linkedGapTypes?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked gaps: {item.linkedGapTypes.join(", ")}</div>
                    ) : null}
                    {item.dependsOn?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Depends on: {item.dependsOn.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>

      <HudCard title="Target Selection Intent" subtitle="What this listing should be selected for and where support is still missing.">
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
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Primary Intent</div>
                <div className="mt-1 text-base font-semibold text-slate-100">{intentProfile.primaryIntent}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Intent Confidence</div>
                <div className="mt-1 text-base font-semibold text-slate-100">{intentProfile.confidence}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Secondary Intents</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {intentProfile.secondaryIntents.length ? (
                    intentProfile.secondaryIntents.map((intent) => (
                      <span key={intent} className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-slate-200">
                        {intent}
                      </span>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No secondary intents resolved.</div>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Local Modifiers</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {intentProfile.localModifiers.length ? (
                    intentProfile.localModifiers.map((modifier) => (
                      <span key={modifier} className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-slate-200">
                        {modifier}
                      </span>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No local modifiers detected from current listing context.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Target Entities</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {intentProfile.targetEntities.length ? (
                    intentProfile.targetEntities.map((entity) => (
                      <span key={entity} className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-slate-200">
                        {entity}
                      </span>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No target entities resolved.</div>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Supporting Entities</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {intentProfile.supportingEntities.length ? (
                    intentProfile.supportingEntities.map((entity) => (
                      <span key={entity} className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-slate-200">
                        {entity}
                      </span>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No supporting entities resolved.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Supported Entities</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {intentProfile.supportedEntities.length ? (
                    intentProfile.supportedEntities.map((entity) => (
                      <span key={entity} className="rounded border border-emerald-300/40 px-2 py-0.5 text-[11px] text-emerald-100">
                        {entity}
                      </span>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No verified support entities yet.</div>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Missing Entities</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {intentProfile.missingEntities.length ? (
                    intentProfile.missingEntities.map((entity) => (
                      <span key={entity} className="rounded border border-amber-300/40 px-2 py-0.5 text-[11px] text-amber-100">
                        {entity}
                      </span>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No major missing entities detected.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Comparison Frames</div>
              <div className="mt-2 space-y-1">
                {intentProfile.comparisonFrames.map((frame) => (
                  <div key={frame} className="text-sm text-slate-200">
                    {frame}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Cluster Priority Ranking</div>
              <div className="mt-2 space-y-2">
                {intentProfile.clusterPriorityRanking.map((cluster) => (
                  <div key={cluster.clusterId} className="rounded border border-white/10 bg-black/10 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{cluster.title}</div>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {cluster.priority}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        score {cluster.score}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{cluster.rationale}</div>
                  </div>
                ))}
              </div>
            </div>

            {intentClusters.summary.dataStatus === "no_major_reinforcement_intent_clusters_identified" ? (
              <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major reinforcement intent clusters identified.
              </div>
            ) : null}

            {intentClusters.summary.dataStatus === "clusters_identified" ? (
              <div className="mt-4 space-y-2">
                {intentClusters.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.priority}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.id}
                      </span>
                      {item.suggestedReinforcementDirection ? (
                        <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                          {item.suggestedReinforcementDirection.surface}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{item.rationale}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.evidenceSummary}</div>
                    {item.suggestedReinforcementDirection ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Direction: {item.suggestedReinforcementDirection.direction}
                      </div>
                    ) : null}
                    {item.linkedGapTypes?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked gaps: {item.linkedGapTypes.join(", ")}</div>
                    ) : null}
                    {item.linkedActionKeys?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked actions: {item.linkedActionKeys.join(", ")}</div>
                    ) : null}
                    {item.linkedFlywheelTypes?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked flywheel signals: {item.linkedFlywheelTypes.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>

      <HudCard title="Content Plan" subtitle="Content ideas that strengthen visibility and trust around this listing.">
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
                  <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.priority}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.id}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.suggestedTargetSurface}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{item.rationale}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.evidenceSummary}</div>
                    <div className="mt-1 text-xs text-slate-400">Purpose: {item.suggestedContentPurpose}</div>
                    {item.suggestedAngle ? (
                      <div className="mt-1 text-xs text-slate-400">Suggested angle: {item.suggestedAngle}</div>
                    ) : null}
                    {item.linkedGapTypes?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked gaps: {item.linkedGapTypes.join(", ")}</div>
                    ) : null}
                    {item.linkedIntentClusterIds?.length ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Linked intent clusters: {item.linkedIntentClusterIds.join(", ")}
                      </div>
                    ) : null}
                    {item.linkedActionKeys?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked actions: {item.linkedActionKeys.join(", ")}</div>
                    ) : null}
                    {item.linkedFlywheelTypes?.length ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Linked flywheel signals: {item.linkedFlywheelTypes.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </HudCard>

      <HudCard title="Search Visibility Structure" subtitle="Page structure ideas based on search visibility patterns.">
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
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                SERP pattern coverage is not available yet; structure recommendations are based on current listing diagnostics.
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
                  <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.priority}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.id}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.suggestedStructureType}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{item.rationale}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.evidenceSummary}</div>
                    <div className="mt-1 text-xs text-slate-400">Suggested sections: {item.suggestedSections.join(" • ")}</div>
                    <div className="mt-1 text-xs text-slate-400">Suggested components: {item.suggestedComponents.join(" • ")}</div>
                    {item.linkedReinforcementItemIds?.length ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Linked reinforcement items: {item.linkedReinforcementItemIds.join(", ")}
                      </div>
                    ) : null}
                    {item.linkedIntentClusterIds?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked intent clusters: {item.linkedIntentClusterIds.join(", ")}</div>
                    ) : null}
                    {item.serpPatternSummary?.commonHeadings?.length ? (
                      <div className="mt-1 text-xs text-slate-400">SERP headings: {item.serpPatternSummary.commonHeadings.join(", ")}</div>
                    ) : null}
                    {item.serpPatternSummary?.commonQuestions?.length ? (
                      <div className="mt-1 text-xs text-slate-400">SERP questions: {item.serpPatternSummary.commonQuestions.join(", ")}</div>
                    ) : null}
                  </div>
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
        title="Improve This Listing"
        subtitle="Create and publish improvements from your highest-priority visibility recommendations."
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

            {multiAction.summary.dataStatus === "no_major_upgrade_actions_available" ? (
              <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                No major upgrade actions available.
              </div>
            ) : null}

            {multiAction.summary.dataStatus === "upgrade_actions_available" ? (
              <div className="space-y-2">
                {multiAction.items.map((item) => (
                  <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.priority}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.status}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.targetSurface}
                      </span>
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                        {item.key}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{item.rationale}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.evidenceSummary}</div>
                    {item.linkedGapTypes?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked gaps: {item.linkedGapTypes.join(", ")}</div>
                    ) : null}
                    {item.linkedIntentClusterIds?.length ? (
                      <div className="mt-1 text-xs text-slate-400">Linked intent clusters: {item.linkedIntentClusterIds.join(", ")}</div>
                    ) : null}
                    {item.linkedReinforcementItemIds?.length ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Linked reinforcement items: {item.linkedReinforcementItemIds.join(", ")}
                      </div>
                    ) : null}
                    {item.linkedStructureItemIds?.length ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Linked structure items: {item.linkedStructureItemIds.join(", ")}
                      </div>
                    ) : null}
                    {item.blockingReasons?.length ? (
                      <div className="mt-1 text-xs text-amber-100">Blocked: {item.blockingReasons.join(" ")}</div>
                    ) : null}
                    {item.previewCapability?.note ? (
                      <div className="mt-1 text-xs text-slate-400">Preview metadata: {item.previewCapability.note}</div>
                    ) : null}
                  </div>
                ))}
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
