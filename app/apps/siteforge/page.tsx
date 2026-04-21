"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeNewProjectName } from "@/lib/siteforge/newProjectName";
import { ProjectNameSaveState, shouldPersistProjectName } from "@/lib/siteforge/projectNameAutosave";
import { brandToneOptions, homepageStrategyModes, websiteGoalOptions } from "@/lib/siteforge/contracts";
import {
  BuildSessionView as BuildSession,
  HomepageStrategy,
  normalizeProjectPayload,
  normalizeProjectsPayload,
  normalizeSession,
  normalizeWorkspace,
  resolveInitialProjectId,
  SiteForgeConnectionView as SiteForgeConnection,
  SiteForgeProjectView as SiteForgeProject,
  SiteForgeRunLogView as SiteForgeRunLog,
  SiteForgeSnapshotView as SiteForgeSnapshot,
  SiteForgeWorkspaceView as SiteForgeWorkspace,
} from "@/lib/siteforge/workspaceShape";
import {
  AgentRosterEntry,
  AgencyDeliverable,
  AgencyStatus,
  AgencyWorkstream,
  ApprovalItem,
  ConfidenceLevel,
  ExperimentIdea,
  PublishChecklistItem,
  ReusableAsset,
  createDefaultAgentRoster,
} from "@/lib/siteforge/agencyWorkspace";
import { ActionButton, SurfaceCard } from "@/components/siteforge/AgencyPrimitives";

type CapabilityCheck = {
  connected: boolean;
  canWritePages: boolean;
  canManageSettings: boolean;
  thriveDetected: boolean;
  thriveSignals: string[];
  message: string;
};

type StorageSummary = {
  storageMode: "postgres" | "memory";
  persistenceHealth: "healthy" | "degraded" | "unavailable";
  fallbackAllowed: boolean;
  fallbackActive: boolean;
  reason: string | null;
  runtimeEnv?: "test" | "development" | "production";
};

type WebsiteBriefForm = {
  businessName: string;
  businessType: string;
  businessDescription: string;
  targetAudience: string;
  websiteGoal: (typeof websiteGoalOptions)[number];
  mainOffer: string;
  brandTone: (typeof brandToneOptions)[number];
  marketLocation: string;
  competitors: string;
  differentiators: string;
};

type CreateStatus = "idle" | "creating" | "created" | "error";
type OpenProjectResult =
  | { ok: true }
  | { ok: false; reason: "superseded" | "failed"; message?: string };

type WorkspaceView =
  | "mission-control"
  | "strategy"
  | "brand"
  | "funnels"
  | "pages"
  | "page-studio"
  | "global-assets"
  | "thrive-intelligence"
  | "experiments"
  | "publish"
  | "settings";

type BuildDraftState = {
  canBuildDraft: boolean;
  blockers: string[];
};

type SelectedPageApprovalState =
  | { kind: "empty"; message: string }
  | { kind: "needs_selection"; message: string }
  | { kind: "ready"; buttonLabel: string };

type PageFilterState = {
  status: "all" | "approved" | "awaiting";
  pageType: "all" | "homepage" | "support";
  ownerAgent: "all" | string;
  funnel: "all" | "lead-gen" | "authority";
  approved: "all" | "approved" | "unapproved";
  built: "all" | "built" | "unbuilt";
};

const primaryNav: Array<{ id: WorkspaceView; label: string }> = [
  { id: "mission-control", label: "Mission Control" },
  { id: "strategy", label: "Strategy" },
  { id: "brand", label: "Brand" },
  { id: "funnels", label: "Funnels" },
  { id: "pages", label: "Pages" },
  { id: "global-assets", label: "Global Assets" },
  { id: "thrive-intelligence", label: "Thrive Intelligence" },
  { id: "experiments", label: "Experiments" },
  { id: "publish", label: "Publish" },
  { id: "settings", label: "Settings" },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && (payload as { error?: { message?: string } }).error?.message
        ? (payload as { error: { message: string } }).error.message
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload as T;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function resolveFriendlyError(raw: string, context: "load" | "connect" | "generate" | "build" | "save"): string {
  const text = raw.toLowerCase();
  if (text.includes("project not found")) return "Selected project could not be loaded.";
  if (text.includes("502") || text.includes("bad gateway")) {
    if (context === "generate") return "We couldn’t generate your site yet.";
    if (context === "build") return "Your WordPress site connected, but the build failed.";
    return "We couldn’t complete that step right now.";
  }
  if (text.includes("application password is required")) return "Please add your WordPress application password to continue.";
  if (text.includes("no usable openai api key") || text.includes("ai key")) {
    return "Please save an AI key before generating your site.";
  }
  if (context === "generate") return "We couldn’t generate your site yet.";
  if (context === "build") return "Thrive was detected, but the native build path is currently blocked.";
  if (context === "connect") return "We couldn’t validate your WordPress connection yet.";
  return raw;
}

function labelFromStatus(progress: number): AgencyStatus {
  if (progress >= 100) return "Built";
  if (progress >= 80) return "Approved";
  if (progress >= 60) return "Awaiting approval";
  if (progress >= 35) return "Drafting";
  if (progress > 0) return "Researching";
  return "Not started";
}

function confidenceFromNumber(value: number): ConfidenceLevel {
  if (value >= 0.9) return "Verified";
  if (value >= 0.75) return "High";
  if (value >= 0.5) return "Medium";
  return "Low";
}

export function normalizePageApprovalName(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "Page";
  if (trimmed === "Home") return "Homepage";
  if (trimmed.toLowerCase().endsWith("page")) return trimmed;
  return `${trimmed} Page`;
}

export function getBuildDraftState({
  projectSelected,
  isConnected,
  pageCount,
  approvedPageCount,
}: {
  projectSelected: boolean;
  isConnected: boolean;
  pageCount: number;
  approvedPageCount: number;
}): BuildDraftState {
  const blockers: string[] = [];
  if (!projectSelected) blockers.push("Select a project first.");
  if (!isConnected) blockers.push("Validate your WordPress connection.");
  if (pageCount === 0) blockers.push("Generate pages before publishing.");
  if (approvedPageCount === 0) blockers.push("Approve at least one page before building your draft.");
  return { canBuildDraft: blockers.length === 0, blockers };
}

export function getSelectedPageApprovalState({
  pageRows,
  selectedPage,
}: {
  pageRows: Array<{ title: string }>;
  selectedPage: { title: string } | null;
}): SelectedPageApprovalState {
  if (!pageRows.length) return { kind: "empty", message: "No pages are ready for review yet." };
  if (!selectedPage) return { kind: "needs_selection", message: "Select a page to review." };
  return { kind: "ready", buttonLabel: `Approve ${normalizePageApprovalName(selectedPage.title)}` };
}

export default function SiteForgeAppPage() {
  const [activeView, setActiveView] = useState<WorkspaceView>("mission-control");
  const [projects, setProjects] = useState<SiteForgeProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [sessions, setSessions] = useState<BuildSession[]>([]);
  const [runLogs, setRunLogs] = useState<SiteForgeRunLog[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SiteForgeSnapshot | null>(null);
  const [savedConnection, setSavedConnection] = useState<SiteForgeConnection | null>(null);

  const [newProjectName, setNewProjectName] = useState("");
  const [projectName, setProjectName] = useState("SiteForge Project");
  const [persistedProjectName, setPersistedProjectName] = useState("SiteForge Project");
  const [projectNameSaveState, setProjectNameSaveState] = useState<ProjectNameSaveState>("idle");

  const [briefForm, setBriefForm] = useState<WebsiteBriefForm>({
    businessName: "",
    businessType: "",
    businessDescription: "",
    targetAudience: "",
    websiteGoal: "capture_leads",
    mainOffer: "",
    brandTone: "expert",
    marketLocation: "",
    competitors: "",
    differentiators: "",
  });
  const [briefSaveState, setBriefSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [aiApiKey, setAiApiKey] = useState("");
  const [serpApiKey, setSerpApiKey] = useState("");
  const [aiModel, setAiModel] = useState("gpt-4.1-mini");
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);

  const [connectionLabel, setConnectionLabel] = useState("Primary WordPress Site");
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [hasThriveHint, setHasThriveHint] = useState(false);
  const [homepageStrategy, setHomepageStrategy] = useState<HomepageStrategy>("use_existing");
  const [connectionResult, setConnectionResult] = useState<CapabilityCheck | null>(null);

  const [createStatus, setCreateStatus] = useState<CreateStatus>("idle");
  const [createStatusMessage, setCreateStatusMessage] = useState<string | null>(null);
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null);

  const [selectedPageSlug, setSelectedPageSlug] = useState<string | null>(null);
  const [approvedPageSlugs, setApprovedPageSlugs] = useState<string[]>([]);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [buildDraftStatus, setBuildDraftStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [buildDraftMessage, setBuildDraftMessage] = useState<string | null>(null);

  const [pageFilters, setPageFilters] = useState<PageFilterState>({
    status: "all",
    pageType: "all",
    ownerAgent: "all",
    funnel: "all",
    approved: "all",
    built: "all",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);

  const projectNameSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectNameSaveSeqRef = useRef(0);
  const loadProjectsSeqRef = useRef(0);
  const openProjectSeqRef = useRef(0);
  const activeProjectIntentRef = useRef<string | null>(null);

  const activeProject = useMemo(
    () => projects.find((entry) => entry.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const activeProjectId = activeProject?.id ?? null;
  const hasValidActiveProject = Boolean(activeProjectId && selectedProjectId === activeProjectId);

  const currentSession = useMemo(
    () => sessions.find((entry) => entry.id === currentSessionId) ?? sessions[0] ?? null,
    [sessions, currentSessionId]
  );

  const pageRows = useMemo(
    () =>
      currentSession?.buildSpec?.pages?.map((page, index) => ({
        slug: page.slug,
        title: page.title,
        pageType: index === 0 || page.slug === "home" ? "homepage" : "support",
        goal: page.title === "Home" || page.slug === "home" ? "Primary conversion" : "Support intent",
        shell: page.slug === "home" ? "thrive-homepage-canonical" : "thrive-standard-content",
        contentStatus: index === 0 ? "Recommended" : "Drafting",
        buildStatus: currentSession.status === "completed" ? "Built" : "Awaiting approval",
        approvalStatus: approvedPageSlugs.includes(page.slug) ? "Approved" : "Awaiting approval",
        ownerAgent: index === 0 ? "content-architect" : "copy-chief",
        funnel: index < 3 ? "lead-gen" : "authority",
        sections: page.sections,
      })) ?? [],
    [approvedPageSlugs, currentSession]
  );

  const selectedStudioPage = useMemo(
    () => pageRows.find((page) => page.slug === selectedPageSlug) ?? pageRows[0] ?? null,
    [pageRows, selectedPageSlug]
  );

  const isConnected = Boolean(connectionResult?.connected || savedConnection?.lastValidationStatus === "valid");
  const isThriveDetected = Boolean(connectionResult?.thriveDetected || savedConnection?.thriveDetected || snapshot?.thriveDetected);
  const aiConfigured = Boolean(activeProject?.hasSavedAiSecret || activeProject?.hasSavedSerpApiSecret);

  const hasBusinessInfo = useMemo(() => {
    const payload = {
      businessName: briefForm.businessName.trim(),
      businessType: briefForm.businessType.trim(),
      businessDescription: briefForm.businessDescription.trim(),
      targetAudience: briefForm.targetAudience.trim(),
      mainOffer: briefForm.mainOffer.trim(),
    };
    return Boolean(payload.businessName && payload.businessType && payload.businessDescription && payload.targetAudience && payload.mainOffer);
  }, [briefForm]);

  const hasGeneratedSitePlan = pageRows.length > 0;
  const hasCompletedBuild = currentSession?.status === "completed" && Boolean(currentSession?.executionResult);

  const buildModeUsed = useMemo(() => {
    const thrive = currentSession?.executionResult?.thrive;
    if (!thrive) return null;
    if (thrive.buildModeUsed) return thrive.buildModeUsed;
    if (thrive.currentMode === "thrive_native_staging_mode" && thrive.nativeValidation?.status === "passed") return "thrive_native";
    if (thrive.enabled) return "thrive_fallback";
    return "wordpress_fallback";
  }, [currentSession]);

  const canUseThriveNative = useMemo(() => {
    if (!isThriveDetected) return false;
    const guardEligible = currentSession?.executionResult?.thrive?.nativeGuard?.eligible;
    if (typeof guardEligible === "boolean") return guardEligible;
    return true;
  }, [currentSession, isThriveDetected]);

  const selectedReviewPage = useMemo(
    () => pageRows.find((page) => page.slug === selectedPageSlug) ?? null,
    [pageRows, selectedPageSlug]
  );

  const pageApprovalState = useMemo(
    () => getSelectedPageApprovalState({ pageRows, selectedPage: selectedReviewPage }),
    [pageRows, selectedReviewPage]
  );

  const buildDraftState = useMemo(
    () =>
      getBuildDraftState({
        projectSelected: Boolean(selectedProjectId),
        isConnected,
        pageCount: pageRows.length,
        approvedPageCount: approvedPageSlugs.length,
      }),
    [approvedPageSlugs.length, isConnected, pageRows.length, selectedProjectId]
  );

  const selectedProjectInOptions = useMemo(
    () => (selectedProjectId ? projects.some((entry) => entry.id === selectedProjectId) : true),
    [projects, selectedProjectId]
  );

  const storageStatusMessage =
    storageSummary?.persistenceHealth === "unavailable"
      ? "Persistent storage unavailable. SiteForge is disabled until database storage is restored."
      : storageSummary?.persistenceHealth === "degraded"
        ? "SiteForge is running in memory mode (development/test only). Projects are not durable."
        : "Persistent Postgres storage is healthy.";

  const agents = useMemo<AgentRosterEntry[]>(() => {
    const roster = createDefaultAgentRoster();
    const blockers = currentSession?.executionResult?.errors ?? [];
    return roster.map((entry) => {
      if (entry.id === "qa-publish-agent" && blockers.length) {
        return { ...entry, status: "Blocked", blockers };
      }
      return entry;
    });
  }, [currentSession]);

  const agentById = useMemo(() => {
    const map = new Map<string, AgentRosterEntry>();
    agents.forEach((agent) => map.set(agent.id, agent));
    return map;
  }, [agents]);

  const approvals = useMemo<ApprovalItem[]>(() => {
    const base: ApprovalItem[] = [
      {
        id: "ap-1",
        level: "Directional approval",
        itemName: "Homepage hero direction",
        ownerAgentId: "strategy-director",
        changeSummary: "Value proposition refined around speed-to-launch + Thrive continuity.",
        confidence: "High",
        affectedPages: ["Home"],
        preview: "Direction memo v2",
        status: "Awaiting approval",
      },
      {
        id: "ap-2",
        level: "Structural approval",
        itemName: "Shell recommendation",
        ownerAgentId: "theme-shell-architect",
        changeSummary: "Homepage mapped to Shell Template candidate with lead-focused Layout System.",
        confidence: "High",
        affectedPages: ["Home", "Lead Magnet"],
        preview: "Shell and layout mapping",
        status: "Awaiting approval",
      },
      {
        id: "ap-3",
        level: "Content approval",
        itemName: "CTA stack",
        ownerAgentId: "copy-chief",
        changeSummary: "Primary CTA moved to diagnostic call with segmented secondary action.",
        confidence: "Medium",
        affectedPages: ["Home", "Thank You"],
        preview: "CTA variants",
        status: "Needs revision",
      },
      {
        id: "ap-4",
        level: "Build approval",
        itemName: "Lead magnet flow",
        ownerAgentId: "builder-operations-agent",
        changeSummary: "Flow dependencies are mapped and build-ready pending final legal review.",
        confidence: "High",
        affectedPages: ["Lead Magnet", "Opt-in Confirmation", "Thank You"],
        preview: "Flow readiness report",
        status: "Awaiting approval",
      },
    ];

    if (pageApprovalState.kind === "ready" && selectedReviewPage) {
      base.push({
        id: `ap-page-${selectedReviewPage.slug}`,
        level: "Content approval",
        itemName: normalizePageApprovalName(selectedReviewPage.title),
        ownerAgentId: "content-architect",
        changeSummary: "Section stack and copy layer are ready for review.",
        confidence: "High",
        affectedPages: [selectedReviewPage.title],
        preview: "Page brief preview",
        status: approvedPageSlugs.includes(selectedReviewPage.slug) ? "Approved" : "Awaiting approval",
      });
    }

    return base;
  }, [approvedPageSlugs, pageApprovalState.kind, selectedReviewPage]);

  const workstreams = useMemo<AgencyWorkstream[]>(() => {
    const rows: AgencyWorkstream[] = [
      {
        id: "ws-positioning",
        name: "Positioning",
        ownerAgentId: "strategy-director",
        progress: hasBusinessInfo ? 75 : 35,
        nextMilestone: "Approve positioning statement",
        blockerState: hasBusinessInfo ? "No blocker" : "Business brief incomplete",
        status: hasBusinessInfo ? "Awaiting approval" : "Researching",
        confidence: hasBusinessInfo ? "High" : "Medium",
      },
      {
        id: "ws-shell",
        name: "Site Shell",
        ownerAgentId: "theme-shell-architect",
        progress: isThriveDetected ? 70 : 50,
        nextMilestone: "Approve shell template mapping",
        blockerState: isThriveDetected ? "No blocker" : "Thrive signals pending",
        status: "Awaiting approval",
        confidence: isThriveDetected ? "Verified" : "Medium",
      },
      {
        id: "ws-homepage",
        name: "Homepage",
        ownerAgentId: "content-architect",
        progress: selectedStudioPage ? 78 : 42,
        nextMilestone: "Approve hero, proof, and CTA sections",
        blockerState: pageRows.length ? "No blocker" : "No generated page brief",
        status: pageRows.length ? "Awaiting approval" : "Drafting",
        confidence: pageRows.length ? "High" : "Medium",
      },
      {
        id: "ws-lead-funnel",
        name: "Lead Funnel",
        ownerAgentId: "builder-operations-agent",
        progress: hasGeneratedSitePlan ? 64 : 20,
        nextMilestone: "Validate lead magnet flow dependencies",
        blockerState: hasGeneratedSitePlan ? "Legal review pending" : "Generate site plan first",
        status: hasGeneratedSitePlan ? "Drafting" : "Researching",
        confidence: hasGeneratedSitePlan ? "High" : "Low",
      },
      {
        id: "ws-blog",
        name: "Blog Engine",
        ownerAgentId: "content-architect",
        progress: 35,
        nextMilestone: "Finalize category architecture",
        blockerState: "Awaiting editorial cadence input",
        status: "Researching",
        confidence: "Medium",
      },
      {
        id: "ws-conversion",
        name: "Conversion System",
        ownerAgentId: "cro-analyst",
        progress: hasGeneratedSitePlan ? 58 : 18,
        nextMilestone: "Launch first two experiments",
        blockerState: hasGeneratedSitePlan ? "Awaiting baseline evidence" : "Pages not generated",
        status: hasGeneratedSitePlan ? "Drafting" : "Not started",
        confidence: hasGeneratedSitePlan ? "Medium" : "Low",
      },
    ];

    return rows.map((row) => ({ ...row, status: labelFromStatus(row.progress) }));
  }, [hasBusinessInfo, hasGeneratedSitePlan, isThriveDetected, pageRows.length, selectedStudioPage]);

  const latestDeliverables = useMemo<AgencyDeliverable[]>(() => {
    const fromTimeline: AgencyDeliverable[] = (currentSession?.runState.timeline ?? []).slice(-4).reverse().map((entry, index) => ({
      id: `dl-${index}-${entry.at}`,
      title: entry.message,
      ownerAgentId: index % 2 === 0 ? "builder-operations-agent" : "copy-chief",
      status: (entry.level === "error" ? "Needs revision" : entry.level === "warning" ? "Awaiting approval" : "Recommended") as AgencyStatus,
      confidence: (entry.level === "error" ? "Low" : "High") as ConfidenceLevel,
      timestamp: entry.at,
    }));

    if (fromTimeline.length) return fromTimeline;

    return [
      {
        id: "dl-seed-1",
        title: "Homepage brief and section stack",
        ownerAgentId: "content-architect",
        status: "Awaiting approval",
        confidence: "High",
        timestamp: activeProject?.updatedAt ?? currentSession?.createdAt ?? "",
      },
      {
        id: "dl-seed-2",
        title: "Shell template recommendation",
        ownerAgentId: "theme-shell-architect",
        status: "Recommended",
        confidence: "High",
        timestamp: activeProject?.updatedAt ?? currentSession?.createdAt ?? "",
      },
    ];
  }, [activeProject?.updatedAt, currentSession]);

  const reusableAssets = useMemo<ReusableAsset[]>(() => {
    const symbols = snapshot?.thriveIntelligence?.symbolInventory ?? [];
    const mapped: ReusableAsset[] = symbols.slice(0, 8).map((symbol) => ({
      id: `asset-symbol-${symbol.id}`,
      name: symbol.title || "Untitled symbol",
      type: (symbol.inferredRole === "header" ? "Header" : symbol.inferredRole === "footer" ? "Footer" : "Reusable Block"),
      category: symbol.taxonomy.name ?? "Uncategorized",
      usageCount: pageRows.length ? Math.max(1, Math.floor(pageRows.length / 2)) : 0,
      source: "Thrive symbol inventory",
      status: (symbol.reusable ? "Approved" : "Recommended") as AgencyStatus,
      compatiblePageTypes: ["Homepage", "Landing", "Lead Magnet"],
      fingerprint: symbol.contentHash ?? symbol.cssHash ?? null,
      matchConfidence: symbol.keywords?.length ? 0.9 : 0.65,
    }));

    if (mapped.length) return mapped;

    return [
      {
        id: "asset-header-1",
        name: "Shapeshift Header Standard",
        type: "Header",
        category: "Global",
        usageCount: 5,
        source: "Safe seed",
        status: "Approved",
        compatiblePageTypes: ["Homepage", "Content", "Offer"],
        fingerprint: null,
        matchConfidence: 0.72,
      },
      {
        id: "asset-cta-1",
        name: "Lead Magnet CTA Band",
        type: "CTA Block",
        category: "Conversion",
        usageCount: 3,
        source: "Safe seed",
        status: "Recommended",
        compatiblePageTypes: ["Homepage", "Lead Magnet"],
        fingerprint: null,
        matchConfidence: 0.68,
      },
    ];
  }, [pageRows.length, snapshot]);

  const experiments = useMemo<ExperimentIdea[]>(() => {
    return [
      {
        id: "exp-1",
        variantName: "Hero message: speed promise",
        rationale: "Early run logs show stronger engagement when outcomes are explicit in first fold.",
        expectedGain: "+8% primary CTA clicks",
        confidence: "Medium",
        affectedPages: ["Home"],
        status: "Recommended",
      },
      {
        id: "exp-2",
        variantName: "Two-step opt-in confirmation",
        rationale: "Lead quality often improves with confirmation framing before thank-you routing.",
        expectedGain: "+12% qualified lead completion",
        confidence: "High",
        affectedPages: ["Lead Magnet", "Opt-in Confirmation"],
        status: "Drafting",
      },
    ];
  }, []);

  const publishChecklist = useMemo<PublishChecklistItem[]>(() => {
    return [
      { id: "pub-1", label: "Homepage assigned", done: Boolean(snapshot?.currentHomepageId), ownerAgentId: "qa-publish-agent" },
      { id: "pub-2", label: "Core CTA working", done: approvedPageSlugs.length > 0, ownerAgentId: "copy-chief" },
      { id: "pub-3", label: "Lead magnet connected", done: hasGeneratedSitePlan, ownerAgentId: "builder-operations-agent" },
      { id: "pub-4", label: "Thank-you flow complete", done: hasGeneratedSitePlan, ownerAgentId: "builder-operations-agent" },
      { id: "pub-5", label: "Header/footer approved", done: reusableAssets.some((asset) => asset.type === "Header"), ownerAgentId: "thrive-asset-librarian" },
      { id: "pub-6", label: "Mobile review complete", done: false, ownerAgentId: "qa-publish-agent" },
      { id: "pub-7", label: "Legal pages present", done: pageRows.some((page) => page.slug.includes("privacy") || page.slug.includes("terms")), ownerAgentId: "qa-publish-agent" },
    ];
  }, [approvedPageSlugs.length, hasGeneratedSitePlan, pageRows, reusableAssets, snapshot?.currentHomepageId]);

  const filteredPages = useMemo(() => {
    return pageRows.filter((page) => {
      if (pageFilters.status !== "all") {
        const approved = page.approvalStatus === "Approved";
        if (pageFilters.status === "approved" && !approved) return false;
        if (pageFilters.status === "awaiting" && approved) return false;
      }
      if (pageFilters.pageType !== "all" && page.pageType !== pageFilters.pageType) return false;
      if (pageFilters.ownerAgent !== "all" && page.ownerAgent !== pageFilters.ownerAgent) return false;
      if (pageFilters.funnel !== "all" && page.funnel !== pageFilters.funnel) return false;
      if (pageFilters.approved !== "all") {
        const approved = page.approvalStatus === "Approved";
        if (pageFilters.approved === "approved" && !approved) return false;
        if (pageFilters.approved === "unapproved" && approved) return false;
      }
      if (pageFilters.built !== "all") {
        const built = page.buildStatus === "Built";
        if (pageFilters.built === "built" && !built) return false;
        if (pageFilters.built === "unbuilt" && built) return false;
      }
      return true;
    });
  }, [pageFilters, pageRows]);

  const missionWarnings = useMemo(() => {
    const warnings: string[] = [];
    warnings.push(...(snapshot?.thriveIntelligence?.warnings ?? []));
    warnings.push(...(currentSession?.executionResult?.warnings ?? []));
    warnings.push(...(currentSession?.executionResult?.errors ?? []));
    if (!isConnected) warnings.push("Connection is not validated.");
    if (!aiConfigured) warnings.push("AI keys are not fully configured.");
    return Array.from(new Set(warnings)).slice(0, 8);
  }, [aiConfigured, currentSession, isConnected, snapshot]);

  function setUserError(rawMessage: string, context: "load" | "connect" | "generate" | "build" | "save") {
    setTechnicalError(rawMessage);
    setError(resolveFriendlyError(rawMessage, context));
  }

  function clearErrors() {
    setError(null);
    setTechnicalError(null);
  }

  function briefPayload() {
    return {
      businessName: briefForm.businessName.trim(),
      businessType: briefForm.businessType.trim(),
      businessDescription: briefForm.businessDescription.trim(),
      targetAudience: briefForm.targetAudience.trim(),
      websiteGoal: briefForm.websiteGoal,
      mainOffer: briefForm.mainOffer.trim(),
      brandTone: briefForm.brandTone,
      marketLocation: briefForm.marketLocation.trim(),
      competitors: briefForm.competitors.trim(),
      differentiators: briefForm.differentiators.trim(),
    };
  }

  function briefIsValid() {
    const payload = briefPayload();
    return Boolean(payload.businessName && payload.businessType && payload.businessDescription && payload.targetAudience && payload.mainOffer);
  }

  function resetWorkspaceState() {
    activeProjectIntentRef.current = null;
    setSelectedProjectId("");
    setSessions([]);
    setRunLogs([]);
    setCurrentSessionId(null);
    setSnapshot(null);
    setSavedConnection(null);
    setNewProjectName("");
    setProjectName("SiteForge Project");
    setPersistedProjectName("SiteForge Project");
    setProjectNameSaveState("idle");
    setBriefForm({
      businessName: "",
      businessType: "",
      businessDescription: "",
      targetAudience: "",
      websiteGoal: "capture_leads",
      mainOffer: "",
      brandTone: "expert",
      marketLocation: "",
      competitors: "",
      differentiators: "",
    });
    setBriefSaveState("idle");
    setAiApiKey("");
    setSerpApiKey("");
    setAiModel("gpt-4.1-mini");
    setAiStatusMessage(null);
    setConnectionLabel("Primary WordPress Site");
    setBaseUrl("");
    setUsername("");
    setAppPassword("");
    setHasThriveHint(false);
    setHomepageStrategy("use_existing");
    setConnectionResult(null);
  }

  async function applyWorkspace(workspace: SiteForgeWorkspace) {
    setProjects((prev) => {
      const others = prev.filter((entry) => entry.id !== workspace.project.id);
      return [workspace.project, ...others];
    });
    setSessions(workspace.runHistory);
    setRunLogs(workspace.runLogs);
    setCurrentSessionId(workspace.latestRun?.id ?? workspace.runHistory[0]?.id ?? null);
    setSnapshot(workspace.snapshot);
    setSavedConnection(workspace.activeConnection);

    setProjectName(workspace.project.name);
    setPersistedProjectName(workspace.project.name);
    setProjectNameSaveState("idle");

    setBriefForm((prev) => {
      const incoming = workspace.project.websiteBrief;
      const hasLocalDraft =
        prev.businessName.trim() ||
        prev.businessType.trim() ||
        prev.businessDescription.trim() ||
        prev.targetAudience.trim() ||
        prev.mainOffer.trim();
      if (!incoming && hasLocalDraft) return prev;
      return {
        businessName: incoming?.businessName ?? "",
        businessType: incoming?.businessType ?? "",
        businessDescription: incoming?.businessDescription ?? "",
        targetAudience: incoming?.targetAudience ?? "",
        websiteGoal: incoming?.websiteGoal ?? "capture_leads",
        mainOffer: incoming?.mainOffer ?? "",
        brandTone: incoming?.brandTone ?? "expert",
        marketLocation: incoming?.marketLocation ?? "",
        competitors: incoming?.competitors ?? "",
        differentiators: incoming?.differentiators ?? "",
      };
    });

    setAiModel(workspace.project.aiModel ?? "gpt-4.1-mini");
    setAiApiKey("");
    setSerpApiKey("");
    setAiStatusMessage(
      workspace.project.hasSavedAiSecret || workspace.project.hasSavedSerpApiSecret ? "API keys saved" : "No API keys configured"
    );
    setHomepageStrategy(workspace.project.homepageStrategy);

    if (workspace.activeConnection) {
      setConnectionLabel(workspace.activeConnection.label);
      setBaseUrl(workspace.activeConnection.wordpressUrl);
      setUsername(workspace.activeConnection.username);
      setHasThriveHint(workspace.activeConnection.thriveDetected);
      setConnectionResult({
        connected: workspace.activeConnection.lastValidationStatus === "valid",
        canWritePages: workspace.activeConnection.writeAccess,
        canManageSettings: workspace.activeConnection.writeAccess,
        thriveDetected: workspace.activeConnection.thriveDetected,
        thriveSignals: [],
        message:
          workspace.activeConnection.lastValidationStatus === "valid"
            ? "Connection validated and saved."
            : workspace.activeConnection.lastValidationStatus === "invalid"
              ? "Saved credentials need revalidation."
              : "Connection not validated yet.",
      });
    } else {
      setConnectionResult(null);
    }

    setAppPassword("");
  }

  async function persistProjectNameUpdate(): Promise<void> {
    if (!shouldPersistProjectName({ selectedProjectId: activeProjectId ?? "", projectName, persistedProjectName })) {
      return;
    }

    const seq = projectNameSaveSeqRef.current + 1;
    projectNameSaveSeqRef.current = seq;
    setProjectNameSaveState("saving");

    try {
      if (!activeProjectId) {
        setProjectNameSaveState("error");
        setUserError("No active project selected.", "save");
        return;
      }

      const payload = await fetchJson<unknown>(`/api/siteforge/projects/${encodeURIComponent(activeProjectId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: projectName.trim(),
          currentState: "workspace",
        }),
      });
      const workspace = normalizeWorkspace(payload);
      if (!workspace) throw new Error("Project rename response was invalid.");

      if (projectNameSaveSeqRef.current !== seq) return;
      await applyWorkspace(workspace);
      setProjectNameSaveState("saved");
    } catch (err: unknown) {
      if (projectNameSaveSeqRef.current !== seq) return;
      setProjectNameSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save project name.";
      setUserError(message, "save");
    }
  }

  async function ensureCanonicalActiveProjectId(): Promise<string | null> {
    if (hasValidActiveProject && activeProjectId) return activeProjectId;

    const candidateProjectId = selectedProjectId || activeProjectIntentRef.current;
    if (!candidateProjectId) {
      setUserError("No active project selected.", "load");
      return null;
    }

    setUserError("Selected project is out of sync. Reloading project state.", "load");
    activeProjectIntentRef.current = candidateProjectId;
    const openResult = await openProject(candidateProjectId, "workspace");
    if (!openResult.ok) {
      activeProjectIntentRef.current = null;
      setSelectedProjectId("");
      setUserError(openResult.message ?? "Active project is no longer available.", "load");
      return null;
    }

    return candidateProjectId;
  }

  async function openProject(
    projectId: string,
    source: "load" | "create" | "user" | "workspace" = "user"
  ): Promise<OpenProjectResult> {
    if (!projectId) return { ok: false, reason: "failed", message: "Project id is required." };
    const intentId = activeProjectIntentRef.current;
    if (source === "load" && intentId && intentId !== projectId) {
      return { ok: false, reason: "superseded" };
    }

    const openSeq = openProjectSeqRef.current + 1;
    openProjectSeqRef.current = openSeq;
    setBusy(true);
    clearErrors();

    try {
      setSelectedProjectId(projectId);
      const payload = await fetchJson<unknown>(`/api/siteforge/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        body: JSON.stringify({ markOpened: true }),
      });
      const workspace = normalizeWorkspace(payload);
      if (!workspace) throw new Error("Invalid SiteForge workspace payload.");
      if (openProjectSeqRef.current !== openSeq) return { ok: false, reason: "superseded" };
      await applyWorkspace(workspace);
      return { ok: true };
    } catch (err: unknown) {
      if (openProjectSeqRef.current !== openSeq) return { ok: false, reason: "superseded" };
      const message = err instanceof Error ? err.message : "Failed to load workspace.";
      setUserError(message, "load");
      setSelectedProjectId("");
      setSessions([]);
      setRunLogs([]);
      setCurrentSessionId(null);
      setSnapshot(null);
      setSavedConnection(null);
      return { ok: false, reason: "failed", message };
    } finally {
      if (openProjectSeqRef.current === openSeq) setBusy(false);
    }
  }

  async function loadProjects() {
    const loadSeq = loadProjectsSeqRef.current + 1;
    loadProjectsSeqRef.current = loadSeq;
    const raw = await fetchJson<unknown>("/api/siteforge/projects");
    if (loadProjectsSeqRef.current !== loadSeq) return;
    const data = normalizeProjectsPayload(raw);
    setProjects(data.projects);

    if (!data.projects.length) {
      resetWorkspaceState();
      return;
    }

    const intendedProjectId = activeProjectIntentRef.current;
    if (intendedProjectId && data.projects.some((project) => project.id === intendedProjectId) && selectedProjectId !== intendedProjectId) {
      setSelectedProjectId(intendedProjectId);
    }

    const targetProjectId =
      intendedProjectId && data.projects.some((project) => project.id === intendedProjectId)
        ? intendedProjectId
        : resolveInitialProjectId(data.projects, data.lastOpenedProjectId);

    if (!targetProjectId) {
      resetWorkspaceState();
      return;
    }

    if (loadProjectsSeqRef.current !== loadSeq) return;
    const openResult = await openProject(targetProjectId, "load");
    if (loadProjectsSeqRef.current !== loadSeq) return;
    if (openResult.ok || openResult.reason === "superseded") return;

    for (const candidate of data.projects) {
      if (candidate.id === targetProjectId) continue;
      if (activeProjectIntentRef.current && candidate.id !== activeProjectIntentRef.current) continue;
      if (loadProjectsSeqRef.current !== loadSeq) return;
      const candidateResult = await openProject(candidate.id, "load");
      if (candidateResult.ok || candidateResult.reason === "superseded") return;
      if (loadProjectsSeqRef.current !== loadSeq) return;
    }

    resetWorkspaceState();
  }

  async function loadStorageSummary() {
    const res = await fetch("/api/siteforge/admin/summary", {
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await res.json().catch(() => null)) as { summary?: StorageSummary; error?: { message?: string } } | null;
    if (payload?.summary) {
      setStorageSummary(payload.summary);
      if (!res.ok && payload.error?.message) setUserError(payload.error.message, "load");
      return;
    }
    if (!res.ok && payload?.error?.message) setUserError(payload.error.message, "load");
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadStorageSummary();
        await loadProjects();
      } catch (err: unknown) {
        setUserError(err instanceof Error ? err.message : "Failed to load SiteForge projects.", "load");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;
    const selected = sessions.find((entry) => entry.id === currentSessionId);
    if (!selected || !["queued", "running"].includes(selected.status)) return;

    const timer = window.setInterval(async () => {
      try {
        const data = await fetchJson<{ session?: unknown }>(`/api/siteforge/sessions/${encodeURIComponent(currentSessionId)}`);
        const normalizedSession = normalizeSession(data?.session, activeProject?.id ?? selected.id);
        if (!normalizedSession) return;
        setSessions((prev) => [normalizedSession, ...prev.filter((entry) => entry.id !== normalizedSession.id)]);
      } catch {
        // polling best-effort
      }
    }, 1700);

    return () => window.clearInterval(timer);
  }, [activeProject, currentSessionId, sessions]);

  useEffect(() => {
    if (!shouldPersistProjectName({ selectedProjectId: activeProjectId ?? "", projectName, persistedProjectName })) {
      return;
    }

    setProjectNameSaveState("idle");
    if (projectNameSaveTimerRef.current) clearTimeout(projectNameSaveTimerRef.current);

    projectNameSaveTimerRef.current = setTimeout(() => {
      void persistProjectNameUpdate();
    }, 500);

    return () => {
      if (projectNameSaveTimerRef.current) clearTimeout(projectNameSaveTimerRef.current);
    };
  }, [activeProjectId, persistedProjectName, projectName]);

  useEffect(() => {
    setApprovedPageSlugs((prev) => prev.filter((slug) => pageRows.some((page) => page.slug === slug)));
    setSelectedPageSlug((prev) => (prev && pageRows.some((page) => page.slug === prev) ? prev : pageRows[0]?.slug ?? null));
  }, [pageRows]);

  async function createProject() {
    const createName = normalizeNewProjectName(newProjectName);
    if (!createName) {
      setCreateStatus("error");
      setCreateStatusMessage("New Project Name is required.");
      return;
    }

    loadProjectsSeqRef.current += 1;
    setBusy(true);
    clearErrors();
    setCreateStatus("creating");
    setCreateStatusMessage(null);

    try {
      const payload = await fetchJson<unknown>("/api/siteforge/projects", {
        method: "POST",
        body: JSON.stringify({ name: createName, description: "Persistent SiteForge workspace" }),
      });
      const normalized = normalizeProjectPayload(payload);
      if (!normalized) throw new Error("Project create response was invalid.");

      setProjects((prev) => [normalized.project, ...prev.filter((entry) => entry.id !== normalized.project.id)]);
      activeProjectIntentRef.current = normalized.project.id;
      setSelectedProjectId(normalized.project.id);
      const opened = await openProject(normalized.project.id, "create");
      if (!opened.ok && opened.reason === "failed") {
        throw new Error(opened.message ?? "Project was created but could not be opened.");
      }
      setNewProjectName("");
      setCreateStatus("created");
      setCreateStatusMessage(`Project created: ${normalized.project.name}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Project creation failed.";
      setUserError(message, "save");
      setCreateStatus("error");
      setCreateStatusMessage(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAndValidateConnection() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    clearErrors();

    try {
      const data = await fetchJson<{ result: CapabilityCheck; connection: SiteForgeConnection }>(
        `/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/connection`,
        {
          method: "POST",
          body: JSON.stringify({
            connectionId: savedConnection?.connectionId,
            label: connectionLabel,
            baseUrl,
            username,
            appPassword,
            hasThriveHint,
          }),
        }
      );

      setConnectionResult(data.result);
      setSavedConnection(data.connection);
      setAppPassword("");
      activeProjectIntentRef.current = targetProjectId;
      await openProject(targetProjectId, "workspace");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection validation failed.";
      setUserError(message, "connect");
    } finally {
      setBusy(false);
    }
  }

  async function revalidateConnection() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    clearErrors();

    try {
      const data = await fetchJson<{ result: CapabilityCheck; connection: SiteForgeConnection }>(
        `/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/connection`,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: connectionLabel,
            baseUrl,
            username,
            appPassword: appPassword || undefined,
            hasThriveHint,
          }),
        }
      );
      setConnectionResult(data.result);
      setSavedConnection(data.connection);
      setAppPassword("");
      activeProjectIntentRef.current = targetProjectId;
      await openProject(targetProjectId, "workspace");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Revalidation failed.";
      setUserError(message, "connect");
    } finally {
      setBusy(false);
    }
  }

  async function saveWebsiteBrief() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;
    if (!briefIsValid()) {
      setUserError("Please complete all required business fields.", "save");
      return;
    }

    setBusy(true);
    setBriefSaveState("saving");
    clearErrors();

    try {
      const payload = await fetchJson<unknown>(`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          websiteBrief: briefPayload(),
          currentState: "workspace",
        }),
      });
      const workspace = normalizeWorkspace(payload);
      if (!workspace) throw new Error("Website brief save response was invalid.");
      await applyWorkspace(workspace);
      setBriefSaveState("saved");
    } catch (err: unknown) {
      setBriefSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save business info.";
      setUserError(message, "save");
    } finally {
      setBusy(false);
    }
  }

  async function saveAiConfig(mode: "save" | "update") {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;
    if (!aiApiKey.trim() && !serpApiKey.trim() && mode === "save") {
      setUserError("Provide at least one API key (OpenAI or SerpApi).", "save");
      return;
    }

    setBusy(true);
    clearErrors();

    try {
      const data = await fetchJson<{ workspace: unknown; ai: { status: string } }>(
        `/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/ai`,
        {
          method: mode === "save" ? "POST" : "PATCH",
          body: JSON.stringify({
            openAiApiKey: aiApiKey,
            serpApiKey,
            model: aiModel,
          }),
        }
      );
      const workspace = normalizeWorkspace(data.workspace);
      if (!workspace) throw new Error("AI config response was invalid.");
      await applyWorkspace(workspace);
      setAiApiKey("");
      setSerpApiKey("");
      setAiStatusMessage(data.ai.status === "saved" ? "API keys saved" : "No API keys configured");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save AI configuration.";
      setUserError(message, "save");
    } finally {
      setBusy(false);
    }
  }

  async function removeAiKey() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    clearErrors();

    try {
      const data = await fetchJson<{ workspace: unknown }>(`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/ai`, {
        method: "DELETE",
      });
      const workspace = normalizeWorkspace(data.workspace);
      if (!workspace) throw new Error("AI config removal response was invalid.");
      await applyWorkspace(workspace);
      setAiApiKey("");
      setSerpApiKey("");
      setAiStatusMessage("No API keys configured");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove API keys.";
      setUserError(message, "save");
    } finally {
      setBusy(false);
    }
  }

  async function runSitePipeline(mode: "generate" | "build") {
    if (!briefIsValid()) {
      const message =
        mode === "generate"
          ? "Please complete your business info before generating."
          : "Complete the required items before building your draft.";
      setUserError(message, mode === "generate" ? "generate" : "build");
      if (mode === "build") {
        setBuildDraftStatus("error");
        setBuildDraftMessage(message);
      }
      return;
    }

    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    clearErrors();
    if (mode === "build") {
      setBuildDraftStatus("running");
      setBuildDraftMessage("Building draft…");
    }

    try {
      const data = await fetchJson<{ session: BuildSession }>(`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/build`, {
        method: "POST",
        body: JSON.stringify({
          websiteBrief: briefPayload(),
          connectionId: savedConnection?.connectionId,
          homepageStrategy: mode === "generate" ? "draft_only" : homepageStrategy,
          connection: {
            label: connectionLabel,
            baseUrl,
            username,
            appPassword: appPassword || undefined,
            hasThriveHint,
          },
        }),
      });

      setSessions((prev) => [data.session, ...prev.filter((entry) => entry.id !== data.session.id)]);
      setCurrentSessionId(data.session.id);
      setAppPassword("");
      activeProjectIntentRef.current = targetProjectId;
      await openProject(targetProjectId, "workspace");
      if (mode === "build") {
        setBuildDraftStatus("success");
        setBuildDraftMessage("Draft build completed successfully.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : mode === "generate" ? "Failed to generate site." : "Build failed.";
      setUserError(message, mode === "generate" ? "generate" : "build");
      if (mode === "build") {
        setBuildDraftStatus("error");
        setBuildDraftMessage(resolveFriendlyError(message, "build"));
      }
    } finally {
      setBusy(false);
    }
  }

  function renderMissionControl() {
    const pulseEntries =
      runLogs.slice(0, 6).length > 0
        ? runLogs.slice(0, 6).map((log) => ({ at: log.timestamp, stage: log.stage, message: log.message }))
        : (currentSession?.runState.timeline ?? []).slice(0, 6).map((entry) => ({
            at: entry.at,
            stage: entry.stage,
            message: entry.message,
          }));

    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <SurfaceCard
            title="Project Mission"
            owner="Strategy Director"
            status={hasBusinessInfo ? "Awaiting approval" : "Researching"}
            confidence={hasBusinessInfo ? "High" : "Medium"}
            actions={
              <>
                <ActionButton label="Edit Brief" onClick={() => setActiveView("strategy")} />
                <ActionButton label="View Blueprint" onClick={() => setActiveView("pages")} />
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-3 text-xs text-slate-200">
              <div><dt className="text-slate-400">Site name</dt><dd>{activeProject?.name ?? "No project selected"}</dd></div>
              <div><dt className="text-slate-400">Primary goal</dt><dd>{briefForm.websiteGoal}</dd></div>
              <div><dt className="text-slate-400">Market / audience</dt><dd>{briefForm.targetAudience || "Not set"}</dd></div>
              <div><dt className="text-slate-400">Main offer</dt><dd>{briefForm.mainOffer || "Not set"}</dd></div>
              <div><dt className="text-slate-400">Funnel type</dt><dd>Lead generation</dd></div>
              <div><dt className="text-slate-400">Thrive stack detected</dt><dd>{isThriveDetected ? "Yes" : "No"}</dd></div>
              <div><dt className="text-slate-400">Current stage</dt><dd>{currentSession?.runState.currentStage ?? "planning"}</dd></div>
            </dl>
          </SurfaceCard>

          <SurfaceCard
            title="Agency Team"
            owner="Operations"
            status="Recommended"
            confidence="Verified"
            actions={<ActionButton label="Open Full Roster" onClick={() => setActiveView("strategy")} />}
          >
            <div className="space-y-2 text-xs">
              {agents.slice(0, 5).map((agent) => (
                <div key={agent.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-medium text-white">{agent.displayName}</div>
                  <div className="text-slate-300">{agent.specialty}</div>
                  <div className="mt-1 text-slate-400">Current task: {agent.currentTask}</div>
                  <div className="mt-1 text-slate-400">Status: {agent.status} | Confidence: {agent.confidence}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <SurfaceCard
            title="Approval Queue"
            owner="QA / Publish Agent"
            status="Awaiting approval"
            confidence="High"
            actions={
              <>
                <ActionButton label="Review" tone="primary" />
                <ActionButton
                  label="Approve"
                  onClick={() => {
                    if (!selectedReviewPage) return;
                    if (!approvedPageSlugs.includes(selectedReviewPage.slug)) {
                      setApprovedPageSlugs((prev) => [...prev, selectedReviewPage.slug]);
                    }
                  }}
                />
                <ActionButton label="Request Revision" tone="danger" />
              </>
            }
          >
            <div className="space-y-2 text-xs text-slate-200">
              {approvals.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-medium text-white">{item.itemName}</div>
                  <div className="mt-1 text-slate-400">{item.level} | Owner: {agentById.get(item.ownerAgentId)?.displayName ?? item.ownerAgentId}</div>
                  <div className="mt-1 text-slate-300">{item.changeSummary}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Thrive Snapshot" owner="Thrive Asset Librarian" status="Recommended" confidence="Verified">
            <dl className="grid grid-cols-2 gap-3 text-xs text-slate-200">
              <div><dt className="text-slate-400">Active skin</dt><dd>{snapshot?.thriveIntelligence?.activeSkin?.name ?? "Unknown"}</dd></div>
              <div><dt className="text-slate-400">Homepage mapping</dt><dd>{snapshot?.currentHomepageTitle ?? "Not mapped"}</dd></div>
              <div><dt className="text-slate-400">Template count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveTemplate ?? 0}</dd></div>
              <div><dt className="text-slate-400">Layout count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveLayout ?? 0}</dd></div>
              <div><dt className="text-slate-400">Section count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveSection ?? 0}</dd></div>
              <div><dt className="text-slate-400">Symbol count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.tcbSymbol ?? 0}</dd></div>
              <div><dt className="text-slate-400">Warning count</dt><dd>{snapshot?.thriveIntelligence?.warnings.length ?? 0}</dd></div>
            </dl>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Agency Intake Controls" owner="Builder Operations Agent" status="Drafting" confidence="High">
          <div className="grid gap-3 md:grid-cols-2 text-xs text-slate-200">
            <div>
              <label className="text-slate-300">Project</label>
              <select
                value={selectedProjectId}
                onChange={(event) => {
                  activeProjectIntentRef.current = event.target.value || null;
                  void openProject(event.target.value, "user");
                }}
                disabled={!projects.length || busy}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              >
                {selectedProjectId && !selectedProjectInOptions ? <option value={selectedProjectId}>Loading selected project...</option> : null}
                {!projects.length ? <option value="">No project selected</option> : null}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name} · {project.status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-300">New Project Name</label>
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="e.g. iPetzo"
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
              <button
                type="button"
                className="mt-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs"
                onClick={createProject}
                disabled={busy || !normalizeNewProjectName(newProjectName)}
              >
                {createStatus === "creating" ? "Creating..." : "Create Project"}
              </button>
            </div>
            <div>
              <label className="text-slate-300">WordPress URL</label>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://example.com"
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-slate-300">WordPress Username</label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="WordPress username"
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-slate-300">Application Password</label>
              <input
                type="password"
                value={appPassword}
                onChange={(event) => setAppPassword(event.target.value)}
                placeholder="WordPress application password"
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="siteforge-ai-key" className="text-slate-300">OpenAI API key</label>
              <input
                id="siteforge-ai-key"
                type="password"
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="siteforge-brief-business-name" className="text-slate-300">Business name</label>
              <input
                id="siteforge-brief-business-name"
                value={briefForm.businessName}
                onChange={(event) => setBriefForm((prev) => ({ ...prev, businessName: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="siteforge-brief-business-type" className="text-slate-300">Business type</label>
              <input
                id="siteforge-brief-business-type"
                value={briefForm.businessType}
                onChange={(event) => setBriefForm((prev) => ({ ...prev, businessType: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="siteforge-brief-target-audience" className="text-slate-300">Target audience</label>
              <input
                id="siteforge-brief-target-audience"
                value={briefForm.targetAudience}
                onChange={(event) => setBriefForm((prev) => ({ ...prev, targetAudience: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="siteforge-brief-main-offer" className="text-slate-300">Main offer</label>
              <input
                id="siteforge-brief-main-offer"
                value={briefForm.mainOffer}
                onChange={(event) => setBriefForm((prev) => ({ ...prev, mainOffer: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="siteforge-brief-business-description" className="text-slate-300">What does your business do?</label>
              <textarea
                id="siteforge-brief-business-description"
                value={briefForm.businessDescription}
                onChange={(event) => setBriefForm((prev) => ({ ...prev, businessDescription: event.target.value }))}
                className="mt-1 h-20 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs"
              onClick={() => setReviewMessage(null)}
            >
              Tell Us About Your Business
            </button>
            <button
              type="button"
              data-testid="siteforge-validate-connection-action"
              className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100"
              onClick={saveAndValidateConnection}
              disabled={busy || !selectedProjectId}
            >
              Validate Connection
            </button>
            <button
              type="button"
              data-testid="siteforge-generate-site-action"
              className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100"
              onClick={() => void runSitePipeline("generate")}
              disabled={busy || !isConnected || !hasBusinessInfo || !aiConfigured}
            >
              Generate Site
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs"
              onClick={() => void saveAiConfig("save")}
              disabled={busy}
            >
              Save API Keys
            </button>
          </div>
          {createStatusMessage ? <div className="mt-2 text-xs text-slate-300">{createStatusMessage}</div> : null}
        </SurfaceCard>

        <SurfaceCard title="Workstream Progress Board" owner="Mission Control" status="Drafting" confidence="High">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2">Workstream</th>
                  <th className="px-2 py-2">Owner agent</th>
                  <th className="px-2 py-2">Progress</th>
                  <th className="px-2 py-2">Next milestone</th>
                  <th className="px-2 py-2">Blocker state</th>
                </tr>
              </thead>
              <tbody>
                {workstreams.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{agentById.get(row.ownerAgentId)?.displayName ?? row.ownerAgentId}</td>
                    <td className="px-2 py-2">{row.progress}%</td>
                    <td className="px-2 py-2">{row.nextMilestone}</td>
                    <td className="px-2 py-2">{row.blockerState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <div className="grid gap-4 xl:grid-cols-2">
          <SurfaceCard
            title="Latest Deliverables"
            owner="Builder Operations Agent"
            status="Awaiting approval"
            confidence="High"
            actions={
              <>
                <ActionButton label="Preview" onClick={() => setActiveView("page-studio")} />
                <ActionButton label="Compare" />
                <ActionButton label="Approve" />
                <ActionButton label="Revise" tone="danger" />
              </>
            }
          >
            <div className="space-y-2 text-xs text-slate-200">
              {latestDeliverables.map((deliverable) => (
                <div key={deliverable.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-medium text-white">{deliverable.title}</div>
                  <div className="mt-1 text-slate-400">
                    Owner: {agentById.get(deliverable.ownerAgentId)?.displayName ?? deliverable.ownerAgentId} | Status: {deliverable.status}
                  </div>
                  <div className="mt-1 text-slate-400">Timestamp: {formatDate(deliverable.timestamp)}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Agency Pulse" owner="Mission Control" status="Drafting" confidence="High">
            <ol className="space-y-2 text-xs text-slate-200">
              {pulseEntries.map((entry, idx) => (
                <li key={`${entry.at}-${idx}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-slate-400">{formatDate(entry.at)} · {entry.stage}</div>
                  <div className="mt-1 text-white">{entry.message}</div>
                </li>
              ))}
            </ol>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Risk / Warnings" owner="QA / Publish Agent" status={missionWarnings.length ? "Blocked" : "Approved"} confidence="Medium">
          <ul className="list-disc pl-5 text-xs text-slate-200">
            {missionWarnings.length ? missionWarnings.map((warning) => <li key={warning}>{warning}</li>) : <li>No blockers detected in current workspace.</li>}
          </ul>
        </SurfaceCard>
      </div>
    );
  }

  function renderStrategy() {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_320px]">
        <SurfaceCard title="Business Brief" owner="Strategy Director" status={hasBusinessInfo ? "Drafting" : "Researching"} confidence="High">
          <div className="space-y-2 text-xs text-slate-200">
            <div>Business: {briefForm.businessName || "Not set"}</div>
            <div>Type: {briefForm.businessType || "Not set"}</div>
            <div>Description: {briefForm.businessDescription || "Not set"}</div>
            <div>Main offer: {briefForm.mainOffer || "Not set"}</div>
          </div>
        </SurfaceCard>
        <SurfaceCard title="ICP / Audience" owner="Strategy Director" status="Drafting" confidence="Medium">
          <div className="text-xs text-slate-200">{briefForm.targetAudience || "Add audience details in Settings to improve targeting."}</div>
        </SurfaceCard>
        <SurfaceCard title="Strategy Director" owner="Strategy Director" status="Awaiting approval" confidence="High">
          <div className="text-xs text-slate-200">Current task: {agentById.get("strategy-director")?.currentTask}</div>
        </SurfaceCard>
        <SurfaceCard title="Positioning" owner="Strategy Director" status="Awaiting approval" confidence="High">
          <div className="text-xs text-slate-200">Draft angle: "Your AI web agency for Thrive Themes" with offer-focused differentiation.</div>
        </SurfaceCard>
        <SurfaceCard title="Sitemap Recommendation" owner="Content Architect" status="Recommended" confidence="High">
          <div className="text-xs text-slate-200">Core pages: Homepage, Lead Magnet, Opt-in Confirmation, Thank You, Core Offer, Follow-up Content.</div>
        </SurfaceCard>
        <SurfaceCard title="Strategy Decisions" owner="Mission Control" status="Awaiting approval" confidence="Medium">
          <ul className="list-disc pl-5 text-xs text-slate-200">
            <li>Approve Direction</li>
            <li>Confirm funnel type and audience clarity</li>
            <li>Lock conversion promise before copy finalization</li>
          </ul>
        </SurfaceCard>
      </div>
    );
  }

  function renderBrand() {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard title="Brand Identity" owner="Brand Director" status="Drafting" confidence="Medium">
          <div className="text-xs text-slate-200">Tone: {briefForm.brandTone}. Brand system is tuned for premium agency delivery and clarity-first hierarchy.</div>
        </SurfaceCard>
        <SurfaceCard title="Design Tokens" owner="Brand Director" status="Recommended" confidence="High">
          <div className="text-xs text-slate-200">Token set covers typography, spacing, layered cards, and action color semantics for approvals and risk.</div>
        </SurfaceCard>
        <SurfaceCard title="Thrive Theme Mapping" owner="Theme Shell Architect" status="Recommended" confidence="High">
          <div className="text-xs text-slate-200">Active skin: {snapshot?.thriveIntelligence?.activeSkin?.name ?? "Unknown"}. Mapping emphasizes Shell Template and Layout System compatibility.</div>
        </SurfaceCard>
        <SurfaceCard title="Brand Rules" owner="Brand Director" status="Awaiting approval" confidence="Medium">
          <ul className="list-disc pl-5 text-xs text-slate-200">
            <li>No conflicting CTA tones per page</li>
            <li>Keep claims precise and evidence-backed</li>
            <li>Maintain reusable block naming standards</li>
          </ul>
        </SurfaceCard>
      </div>
    );
  }

  function renderFunnels() {
    const nodes = ["Homepage", "Lead Magnet", "Opt-in Confirmation", "Thank You", "Core Offer", "Follow-up Content"];
    return (
      <div className="space-y-4">
        <SurfaceCard title="Funnel Overview Board" owner="Builder Operations Agent" status="Drafting" confidence="High">
          <div className="grid gap-2 md:grid-cols-3">
            {nodes.map((node) => (
              <div key={node} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">{node}</div>
            ))}
          </div>
        </SurfaceCard>
        <div className="grid gap-4 xl:grid-cols-3">
          <SurfaceCard title="Funnel Logic" owner="Strategy Director" status="Awaiting approval" confidence="High">
            <div className="text-xs text-slate-200">Sequence is configured for lead qualification before core offer promotion.</div>
          </SurfaceCard>
          <SurfaceCard title="Offer Stack" owner="Copy Chief" status="Drafting" confidence="Medium">
            <div className="text-xs text-slate-200">Main offer: {briefForm.mainOffer || "Not set"} with diagnostic call and follow-up nurture stack.</div>
          </SurfaceCard>
          <SurfaceCard title="Conversion Recommendations" owner="CRO Analyst" status="Recommended" confidence="Medium">
            <div className="text-xs text-slate-200">Prioritize friction reduction on opt-in confirmation and CTA consistency across first three steps.</div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderPagesIndex() {
    return (
      <div className="space-y-4">
        <SurfaceCard title="Pages Index" owner="Content Architect" status="Drafting" confidence="High">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6 text-xs">
            <select value={pageFilters.status} onChange={(e) => setPageFilters((p) => ({ ...p, status: e.target.value as PageFilterState["status"] }))} className="rounded-lg border border-white/15 bg-slate-900/65 px-2 py-2">
              <option value="all">status: all</option>
              <option value="approved">status: approved</option>
              <option value="awaiting">status: awaiting</option>
            </select>
            <select value={pageFilters.pageType} onChange={(e) => setPageFilters((p) => ({ ...p, pageType: e.target.value as PageFilterState["pageType"] }))} className="rounded-lg border border-white/15 bg-slate-900/65 px-2 py-2">
              <option value="all">page type: all</option>
              <option value="homepage">homepage</option>
              <option value="support">support</option>
            </select>
            <select value={pageFilters.ownerAgent} onChange={(e) => setPageFilters((p) => ({ ...p, ownerAgent: e.target.value }))} className="rounded-lg border border-white/15 bg-slate-900/65 px-2 py-2">
              <option value="all">owner agent: all</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}
            </select>
            <select value={pageFilters.funnel} onChange={(e) => setPageFilters((p) => ({ ...p, funnel: e.target.value as PageFilterState["funnel"] }))} className="rounded-lg border border-white/15 bg-slate-900/65 px-2 py-2">
              <option value="all">funnel: all</option>
              <option value="lead-gen">lead-gen</option>
              <option value="authority">authority</option>
            </select>
            <select value={pageFilters.approved} onChange={(e) => setPageFilters((p) => ({ ...p, approved: e.target.value as PageFilterState["approved"] }))} className="rounded-lg border border-white/15 bg-slate-900/65 px-2 py-2">
              <option value="all">approved / unapproved: all</option>
              <option value="approved">approved</option>
              <option value="unapproved">unapproved</option>
            </select>
            <select value={pageFilters.built} onChange={(e) => setPageFilters((p) => ({ ...p, built: e.target.value as PageFilterState["built"] }))} className="rounded-lg border border-white/15 bg-slate-900/65 px-2 py-2">
              <option value="all">built / unbuilt: all</option>
              <option value="built">built</option>
              <option value="unbuilt">unbuilt</option>
            </select>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2">Page Name</th>
                  <th className="px-2 py-2">Page Type</th>
                  <th className="px-2 py-2">Goal</th>
                  <th className="px-2 py-2">Shell</th>
                  <th className="px-2 py-2">Content Status</th>
                  <th className="px-2 py-2">Build Status</th>
                  <th className="px-2 py-2">Approval Status</th>
                  <th className="px-2 py-2">Owner Agent</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.map((page) => (
                  <tr key={page.slug} className="border-t border-white/10">
                    <td className="px-2 py-2">{page.title}</td>
                    <td className="px-2 py-2">{page.pageType}</td>
                    <td className="px-2 py-2">{page.goal}</td>
                    <td className="px-2 py-2">{page.shell}</td>
                    <td className="px-2 py-2">{page.contentStatus}</td>
                    <td className="px-2 py-2">{page.buildStatus}</td>
                    <td className="px-2 py-2">{page.approvalStatus}</td>
                    <td className="px-2 py-2">{agentById.get(page.ownerAgent)?.displayName ?? page.ownerAgent}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <ActionButton label="Open Page Studio" onClick={() => { setSelectedPageSlug(page.slug); setActiveView("page-studio"); }} />
                        <ActionButton label="Preview Brief" />
                        <ActionButton label="Compare Versions" />
                        <ActionButton label="Approve" onClick={() => setApprovedPageSlugs((prev) => prev.includes(page.slug) ? prev : [...prev, page.slug])} />
                        <ActionButton label="Send to Build" onClick={() => setActiveView("publish")} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredPages.length ? (
                  <tr><td colSpan={9} className="px-2 py-3 text-slate-400">No pages match your current filters.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  function renderPageStudio() {
    const sections = selectedStudioPage?.sections ?? [];
    const variantSeed = ["Hero", "Proof", "Benefits", "CTA", "FAQ", "Testimonials", "Final CTA"];
    const studioSections = sections.length ? sections.map((section) => section.heading || "Section") : variantSeed;

    return (
      <div className="grid gap-4 2xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <SurfaceCard title="Page Overview" owner="Content Architect" status="Drafting" confidence="High">
          <div className="space-y-3 text-xs text-slate-200">
            <div>Page: {selectedStudioPage?.title ?? "No page selected"}</div>
            <div>Goal: {selectedStudioPage?.goal ?? "Not available"}</div>
            <div>Dependencies: Shell template, CTA blocks, legal references</div>
            <div>Linked funnel steps: Homepage to Lead Magnet to Thank You</div>
            <div>Reusable assets used: {reusableAssets.slice(0, 3).map((asset) => asset.name).join(", ") || "None"}</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-medium text-white">Section Navigator</div>
              <div className="mt-2 space-y-1">
                {studioSections.map((name, idx) => (
                  <div key={`${name}-${idx}`} className="rounded-md border border-white/10 px-2 py-1">{String(name)}</div>
                ))}
              </div>
            </div>
          </div>
        </SurfaceCard>

        <div className="space-y-4">
          <SurfaceCard title="Page Brief" owner="Strategy Director" status="Awaiting approval" confidence="High">
            <div className="text-xs text-slate-200">This page is positioned to convert cold Thrive traffic into qualified lead actions.</div>
          </SurfaceCard>
          <SurfaceCard title="Shell Recommendation" owner="Theme Shell Architect" status="Recommended" confidence="High">
            <div className="text-xs text-slate-200">Recommended Shell Template: {selectedStudioPage?.shell ?? "thrive-homepage-canonical"}</div>
          </SurfaceCard>

          <div className="space-y-3">
            {studioSections.map((section, index) => {
              const matchedAsset = reusableAssets[index % Math.max(reusableAssets.length, 1)];
              const owner = index % 2 === 0 ? "copy-chief" : "content-architect";
              return (
                <SurfaceCard
                  key={`${section}-${index}`}
                  title={`${String(section)} Section`}
                  owner={agentById.get(owner)?.displayName ?? owner}
                  status={index < 2 ? "Awaiting approval" : "Drafting"}
                  confidence={index < 2 ? "High" : "Medium"}
                  actions={
                    <>
                      <ActionButton label="Preview" />
                      <ActionButton label="Swap Variant" />
                      <ActionButton
                        label="Approve"
                        onClick={() => {
                          if (!selectedStudioPage) return;
                          setApprovedPageSlugs((prev) => prev.includes(selectedStudioPage.slug) ? prev : [...prev, selectedStudioPage.slug]);
                        }}
                      />
                      <ActionButton label="Request Revision" tone="danger" />
                      <ActionButton label="Lock Section" />
                    </>
                  }
                >
                  <div className="grid gap-2 text-xs text-slate-200 md:grid-cols-2">
                    <div>Purpose: conversion-focused narrative layer</div>
                    <div>Content summary: concise claim + proof + CTA progression</div>
                    <div>Recommended Thrive asset type: {index % 2 === 0 ? "Reusable Block" : "Section Asset"}</div>
                    <div>Matched reusable asset: {matchedAsset?.name ?? "No match"}</div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          <SurfaceCard title="Copy Layer" owner="Copy Chief" status="Drafting" confidence="Medium">
            <div className="text-xs text-slate-200">Primary copy variants are tracked per section with evidence notes and approval history.</div>
          </SurfaceCard>
          <SurfaceCard title="Build Readiness" owner="Builder Operations Agent" status={buildDraftState.canBuildDraft ? "Awaiting approval" : "Blocked"} confidence="High">
            <div className="text-xs text-slate-200">{buildDraftState.canBuildDraft ? "Ready for Build" : buildDraftState.blockers.join(" ")}</div>
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          <SurfaceCard title="Agent Collaboration" owner="Mission Control" status="Drafting" confidence="High">
            <div className="space-y-2 text-xs text-slate-200">
              {agents.slice(0, 4).map((agent) => (
                <div key={agent.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-medium text-white">{agent.displayName}</div>
                  <div className="text-slate-400">{agent.currentTask}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>
          <SurfaceCard title="Version History" owner="Builder Operations Agent" status="Recommended" confidence="High">
            <div className="space-y-2 text-xs text-slate-200">
              {latestDeliverables.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="text-slate-400">{formatDate(item.timestamp)}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderGlobalAssets() {
    const tabs = [
      "Headers",
      "Footers",
      "Symbols / Reusable Blocks",
      "Sections",
      "Templates / Shell Templates",
      "Layouts / Layout Systems",
      "CTA Blocks",
      "FAQs",
      "Testimonials",
    ];

    return (
      <div className="space-y-4">
        <SurfaceCard title="Global Asset Library" owner="Thrive Asset Librarian" status="Recommended" confidence="Verified">
          <div className="flex flex-wrap gap-2 text-xs text-slate-200">
            {tabs.map((tab) => (
              <span key={tab} className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{tab}</span>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reusableAssets.map((asset) => (
            <SurfaceCard
              key={asset.id}
              title={asset.name}
              owner="Thrive Asset Librarian"
              status={asset.status}
              confidence={confidenceFromNumber(asset.matchConfidence ?? 0.6)}
              actions={
                <>
                  <ActionButton label="Preview" />
                  <ActionButton label="Reuse" />
                  <ActionButton label="Recommend for page" onClick={() => setActiveView("page-studio")} />
                  <ActionButton label="Mark preferred" />
                  <ActionButton label="Mark deprecated" tone="danger" />
                </>
              }
            >
              <div className="space-y-1 text-xs text-slate-200">
                <div>Type: {asset.type}</div>
                <div>Category: {asset.category}</div>
                <div>Usage count: {asset.usageCount}</div>
                <div>Source: {asset.source}</div>
                <div>Compatible page types: {asset.compatiblePageTypes.join(", ")}</div>
                <div>Fingerprint / match confidence: {asset.fingerprint ?? "n/a"} / {asset.matchConfidence?.toFixed(2) ?? "n/a"}</div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>
    );
  }

  function renderThriveIntelligence() {
    const symbolInventory = snapshot?.thriveIntelligence?.symbolInventory ?? [];
    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <SurfaceCard title="Environment Snapshot" owner="Thrive Asset Librarian" status="Recommended" confidence="Verified">
            <dl className="grid grid-cols-2 gap-2 text-xs text-slate-200">
              <div><dt className="text-slate-400">Thrive detected</dt><dd>{isThriveDetected ? "Yes" : "No"}</dd></div>
              <div><dt className="text-slate-400">Active skin</dt><dd>{snapshot?.thriveIntelligence?.activeSkin?.name ?? "Unknown"}</dd></div>
              <div><dt className="text-slate-400">Homepage page ID / mapping</dt><dd>{snapshot?.currentHomepageId ?? "n/a"} / {snapshot?.currentHomepageTitle ?? "n/a"}</dd></div>
              <div><dt className="text-slate-400">page_for_posts</dt><dd>{snapshot?.knownPages.find((entry) => entry.slug.includes("blog"))?.id ?? "n/a"}</dd></div>
              <div><dt className="text-slate-400">Connection state</dt><dd>{connectionResult?.message ?? "Not validated"}</dd></div>
              <div><dt className="text-slate-400">Last inventory refresh</dt><dd>{formatDate(snapshot?.thriveIntelligence?.collectedAt)}</dd></div>
            </dl>
          </SurfaceCard>
          <SurfaceCard title="Inventory Summary" owner="Thrive Asset Librarian" status="Recommended" confidence="Verified">
            <dl className="grid grid-cols-2 gap-2 text-xs text-slate-200">
              <div><dt className="text-slate-400">Template count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveTemplate ?? 0}</dd></div>
              <div><dt className="text-slate-400">Layout count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveLayout ?? 0}</dd></div>
              <div><dt className="text-slate-400">Section count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveSection ?? 0}</dd></div>
              <div><dt className="text-slate-400">Symbol count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.tcbSymbol ?? 0}</dd></div>
              <div><dt className="text-slate-400">Category counts</dt><dd>{new Set(symbolInventory.map((symbol) => symbol.taxonomy.slug ?? "uncategorized")).size}</dd></div>
              <div><dt className="text-slate-400">Header/footer counts</dt><dd>{snapshot?.thriveIntelligence?.symbolSummary.headers ?? 0} / {snapshot?.thriveIntelligence?.symbolSummary.footers ?? 0}</dd></div>
            </dl>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Symbol Intelligence" owner="Thrive Asset Librarian" status="Recommended" confidence="Verified">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Builder payload present</th>
                  <th className="px-2 py-2">CSS present</th>
                  <th className="px-2 py-2">Fingerprint hash</th>
                  <th className="px-2 py-2">Recommended use cases</th>
                </tr>
              </thead>
              <tbody>
                {symbolInventory.slice(0, 10).map((symbol) => (
                  <tr key={symbol.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{symbol.id}</td>
                    <td className="px-2 py-2">{symbol.title}</td>
                    <td className="px-2 py-2">{symbol.taxonomy.name ?? "Uncategorized"}</td>
                    <td className="px-2 py-2">{symbol.hasBuilderContent ? "Yes" : "No"}</td>
                    <td className="px-2 py-2">{symbol.hasCustomCss ? "Yes" : "No"}</td>
                    <td className="px-2 py-2">{symbol.contentHash ?? symbol.cssHash ?? "n/a"}</td>
                    <td className="px-2 py-2">{symbol.inferredRole === "header" ? "Global navigation" : symbol.inferredRole === "footer" ? "Global footer" : "Section composition"}</td>
                  </tr>
                ))}
                {!symbolInventory.length ? <tr><td colSpan={7} className="px-2 py-3 text-slate-400">No symbol inventory available yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <div className="grid gap-4 xl:grid-cols-3">
          <SurfaceCard title="Template Intelligence" owner="Theme Shell Architect" status="Recommended" confidence="High">
            <ul className="list-disc pl-5 text-xs text-slate-200">
              <li>Homepage candidate: {snapshot?.currentHomepageTitle ?? "Not mapped"}</li>
              <li>Page candidate: {snapshot?.thriveIntelligence?.activeSkin?.slug ?? "Not mapped"}</li>
              <li>Post/archive candidates: {snapshot?.knownPages.filter((page) => page.slug.includes("blog")).length || 0}</li>
              <li>Mapped use cases: homepage shell, lead flow pages, content support pages</li>
            </ul>
          </SurfaceCard>
          <SurfaceCard title="Risk / Safety" owner="QA / Publish Agent" status={canUseThriveNative ? "Awaiting approval" : "Blocked"} confidence="High">
            <ul className="list-disc pl-5 text-xs text-slate-200">
              <li>Blocked endpoints: none added in this UI lane</li>
              <li>Read-only mode: true for intelligence surfaces</li>
              <li>Unresolved mappings: {snapshot?.thriveSectionResolutions.filter((r) => r.matchedSymbolId === null).length ?? 0}</li>
              <li>Staging required flags: {canUseThriveNative ? "No" : "Yes"}</li>
            </ul>
          </SurfaceCard>
          <SurfaceCard
            title="Refresh / Manifest"
            owner="Thrive Asset Librarian"
            status="Recommended"
            confidence="High"
            actions={
              <>
                <ActionButton label="Refresh inventory" onClick={() => void revalidateConnection()} />
                <ActionButton label="Compare previous snapshot" />
                <ActionButton label="Export manifest" />
                <ActionButton label="View discovery log" />
              </>
            }
          >
            <div className="text-xs text-slate-200">This panel only surfaces existing intelligence data and safe discovery logs.</div>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Thrive Translation" owner="Mission Control" status="Recommended" confidence="Verified">
          <div className="grid gap-2 text-xs text-slate-200 md:grid-cols-2">
            <div>`thrive_template` maps to Shell Template</div>
            <div>`thrive_layout` maps to Layout System</div>
            <div>`tcb_symbol` maps to Reusable Block</div>
            <div>`thrive_section` maps to Section Asset</div>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  function renderExperiments() {
    return (
      <div className="space-y-4">
        <SurfaceCard title="Active Experiments" owner="CRO Analyst" status="Drafting" confidence="Medium">
          <div className="space-y-2 text-xs text-slate-200">
            {experiments.map((exp) => (
              <div key={exp.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-medium text-white">{exp.variantName}</div>
                <div className="mt-1">Rationale: {exp.rationale}</div>
                <div className="mt-1">Expected gain: {exp.expectedGain}</div>
                <div className="mt-1">Confidence: {exp.confidence}</div>
                <div className="mt-1">Affected pages: {exp.affectedPages.join(", ")}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>
        <div className="grid gap-4 xl:grid-cols-2">
          <SurfaceCard title="Opportunities Queue" owner="CRO Analyst" status="Recommended" confidence="Medium">
            <ul className="list-disc pl-5 text-xs text-slate-200">
              <li>CTA hierarchy tuning on homepage</li>
              <li>Proof section ordering test for social evidence timing</li>
              <li>FAQ density optimization for mobile conversion</li>
            </ul>
          </SurfaceCard>
          <SurfaceCard title="Evidence Panel" owner="CRO Analyst" status="Researching" confidence="Medium">
            <div className="text-xs text-slate-200">Evidence is currently seed/demo-backed and ready for live analytics wiring.</div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderPublish() {
    const readyCount = publishChecklist.filter((item) => item.done).length;
    const totalCount = publishChecklist.length;

    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <SurfaceCard title="Readiness Summary" owner="QA / Publish Agent" status={readyCount === totalCount ? "Approved" : "Awaiting approval"} confidence="High">
            <div className="text-xs text-slate-200">{readyCount}/{totalCount} checklist items complete.</div>
            <div className="mt-2 text-xs text-slate-300">Build mode used: {buildModeUsed ?? "not run"}</div>
            <div className="mt-2 text-xs text-slate-300">Native path available: {canUseThriveNative ? "yes" : "no"}</div>
          </SurfaceCard>
          <SurfaceCard title="Publish Actions" owner="Builder Operations Agent" status="Awaiting approval" confidence="High">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="siteforge-build-draft-action"
                className={`rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100 ${busy || !buildDraftState.canBuildDraft ? "cursor-not-allowed opacity-60" : ""}`}
                onClick={() => void runSitePipeline("build")}
                disabled={busy || !buildDraftState.canBuildDraft}
              >
                {buildDraftStatus === "running" ? "Building Draft..." : buildDraftState.canBuildDraft ? "Build Draft" : "Fix Required Items"}
              </button>
              <ActionButton label="Promote to Publish" tone="primary" disabled={!hasCompletedBuild} />
              <ActionButton label="Review Deliverable" onClick={() => setActiveView("mission-control")} />
            </div>
            {buildDraftMessage ? <div className="mt-2 text-xs text-slate-300">{buildDraftMessage}</div> : null}
            {!canUseThriveNative ? (
              <div className="mt-2 text-xs text-amber-200">Thrive was detected, but the native build path is currently blocked.</div>
            ) : null}
          </SurfaceCard>
          <SurfaceCard title="Audit Log" owner="QA / Publish Agent" status="Drafting" confidence="Medium">
            <div className="space-y-1 text-xs text-slate-200">
              {runLogs.slice(0, 6).map((log) => (
                <div key={log.logId}>{formatDate(log.timestamp)} · {log.stage} · {log.message}</div>
              ))}
              {!runLogs.length ? <div>No audit entries yet.</div> : null}
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Publish Checklist" owner="QA / Publish Agent" status="Awaiting approval" confidence="High">
          <ul className="space-y-2 text-xs text-slate-200">
            {publishChecklist.map((item) => (
              <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                {item.done ? "[x]" : "[ ]"} {item.label} · Owner: {agentById.get(item.ownerAgentId)?.displayName ?? item.ownerAgentId}
              </li>
            ))}
          </ul>
          {!buildDraftState.canBuildDraft ? (
            <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <div>Complete the missing items before building your draft.</div>
              <ul className="mt-2 list-disc pl-4">
                {buildDraftState.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </SurfaceCard>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="space-y-4">
        <SurfaceCard title="Project + Connection Control" owner="Builder Operations Agent" status="Drafting" confidence="High">
          <div className="grid gap-3 md:grid-cols-2 text-xs text-slate-200">
            <div>
              <label className="text-slate-300">Project</label>
              <select
                value={selectedProjectId}
                onChange={(event) => {
                  activeProjectIntentRef.current = event.target.value || null;
                  void openProject(event.target.value, "user");
                }}
                disabled={!projects.length || busy}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              >
                {selectedProjectId && !selectedProjectInOptions ? <option value={selectedProjectId}>Loading selected project...</option> : null}
                {!projects.length ? <option value="">No project selected</option> : null}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name} · {project.status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300">New Project Name</label>
              <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              <button type="button" className="mt-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs" onClick={createProject} disabled={busy || !normalizeNewProjectName(newProjectName)}>{createStatus === "creating" ? "Creating..." : "Create Project"}</button>
            </div>

            <div>
              <label className="text-slate-300">Rename Current Project</label>
              <input id="siteforge-project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              <div className="mt-1 text-slate-400">Rename state: {projectNameSaveState}</div>
            </div>

            <div>
              <label className="text-slate-300">Connection Label</label>
              <input value={connectionLabel} onChange={(event) => setConnectionLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
            </div>

            <div>
              <label className="text-slate-300">WordPress URL</label>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
            </div>
            <div>
              <label className="text-slate-300">WordPress Username</label>
              <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="text-slate-300">Application Password</label>
              <input type="password" value={appPassword} onChange={(event) => setAppPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2">
              <input type="checkbox" checked={hasThriveHint} onChange={(event) => setHasThriveHint(event.target.checked)} /> Thrive already installed
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" data-testid="siteforge-validate-connection-action" className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100" onClick={saveAndValidateConnection} disabled={busy || !selectedProjectId}>Validate Connection</button>
            {savedConnection ? (
              <button type="button" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs" onClick={revalidateConnection} disabled={busy || !selectedProjectId}>Recheck Connection</button>
            ) : null}
          </div>
          {createStatusMessage ? <div className="mt-2 text-xs text-slate-300">{createStatusMessage}</div> : null}
        </SurfaceCard>

        <div className="grid gap-4 xl:grid-cols-2">
          <SurfaceCard title="Business Brief Editor" owner="Strategy Director" status="Drafting" confidence="High">
            <div className="grid gap-2 md:grid-cols-2 text-xs text-slate-200">
              <div>
                <label htmlFor="siteforge-brief-business-name">Business name</label>
                <input id="siteforge-brief-business-name" value={briefForm.businessName} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessName: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="siteforge-brief-business-type">Business type</label>
                <input id="siteforge-brief-business-type" value={briefForm.businessType} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessType: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="siteforge-brief-target-audience">Target audience</label>
                <input id="siteforge-brief-target-audience" value={briefForm.targetAudience} onChange={(event) => setBriefForm((prev) => ({ ...prev, targetAudience: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="siteforge-brief-main-offer">Main offer</label>
                <input id="siteforge-brief-main-offer" value={briefForm.mainOffer} onChange={(event) => setBriefForm((prev) => ({ ...prev, mainOffer: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="siteforge-brief-business-description">What does your business do?</label>
                <textarea id="siteforge-brief-business-description" value={briefForm.businessDescription} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessDescription: event.target.value }))} className="mt-1 h-24 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="siteforge-brief-goal">Main goal</label>
                <select id="siteforge-brief-goal" value={briefForm.websiteGoal} onChange={(event) => setBriefForm((prev) => ({ ...prev, websiteGoal: event.target.value as WebsiteBriefForm["websiteGoal"] }))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2">
                  {websiteGoalOptions.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="siteforge-brief-tone">Brand tone</label>
                <select id="siteforge-brief-tone" value={briefForm.brandTone} onChange={(event) => setBriefForm((prev) => ({ ...prev, brandTone: event.target.value as WebsiteBriefForm["brandTone"] }))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2">
                  {brandToneOptions.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" data-testid="siteforge-business-continue-action" className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100" onClick={saveWebsiteBrief} disabled={busy || !selectedProjectId}>Continue</button>
            </div>
            <div className="mt-2 text-xs text-slate-300">Business info save state: {briefSaveState}</div>
          </SurfaceCard>

          <SurfaceCard title="AI Configuration" owner="Strategy Director" status="Drafting" confidence="Medium">
            <div className="grid gap-2 text-xs text-slate-200">
              <div>
                <label htmlFor="siteforge-ai-key">OpenAI API key</label>
                <input id="siteforge-ai-key" type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="siteforge-serpapi-key">SerpApi API key (optional)</label>
                <input id="siteforge-serpapi-key" type="password" value={serpApiKey} onChange={(event) => setSerpApiKey(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="siteforge-ai-model">AI model</label>
                <select id="siteforge-ai-model" value={aiModel} onChange={(event) => setAiModel(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2">
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  <option value="gpt-4.1">gpt-4.1</option>
                  <option value="gpt-5-mini">gpt-5-mini</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs" onClick={() => saveAiConfig("save")} disabled={busy}>Save API Keys</button>
              <button type="button" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs" onClick={removeAiKey} disabled={busy || (!activeProject?.hasSavedAiSecret && !activeProject?.hasSavedSerpApiSecret)}>Remove Saved Keys</button>
              <button type="button" data-testid="siteforge-generate-site-action" className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100" onClick={() => void runSitePipeline("generate")} disabled={busy || !isConnected || !hasBusinessInfo || !aiConfigured}>Generate Site</button>
            </div>
            <div className="mt-2 text-xs text-slate-300">AI status: {aiStatusMessage ?? "not configured"}</div>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Storage + Diagnostics" owner="QA / Publish Agent" status="Recommended" confidence="High">
          <div className="text-xs text-slate-200">Storage mode: {storageSummary?.storageMode ?? "unknown"}</div>
          <div className="text-xs text-slate-200">Persistence health: {storageSummary?.persistenceHealth ?? "unknown"}</div>
          <div className="text-xs text-slate-200">Memory fallback active: {storageSummary?.fallbackActive ? "yes" : "no"}</div>
          <div className="mt-1 text-xs text-slate-300">{storageStatusMessage}</div>
          <div className="mt-3 text-xs text-slate-300">Raw Errors: {technicalError ?? "None"}</div>
          <div className="text-xs text-slate-300">Diagnostics: execution mode {currentSession?.executionResult?.thrive.executionMode ?? "unknown"}</div>
        </SurfaceCard>
      </div>
    );
  }

  function renderContent() {
    if (activeView === "mission-control") return renderMissionControl();
    if (activeView === "strategy") return renderStrategy();
    if (activeView === "brand") return renderBrand();
    if (activeView === "funnels") return renderFunnels();
    if (activeView === "pages") return renderPagesIndex();
    if (activeView === "page-studio") return renderPageStudio();
    if (activeView === "global-assets") return renderGlobalAssets();
    if (activeView === "thrive-intelligence") return renderThriveIntelligence();
    if (activeView === "experiments") return renderExperiments();
    if (activeView === "publish") return renderPublish();
    return renderSettings();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_38%),radial-gradient(circle_at_90%_0%,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(180deg,_#050814_0%,_#0b1221_52%,_#070d19_100%)] text-slate-100">
      <main className="mx-auto max-w-[1480px] px-4 py-6 md:px-8">
        <section className="rounded-2xl border border-white/15 bg-slate-900/65 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">SiteForge</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">Your AI web agency for Thrive Themes</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Operate strategy, brand, funnel, page, and publish workflows through a Thrive-aware agency command center.
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-200">
              <div>Project: {activeProject?.name ?? "No project selected"}</div>
              <div className="mt-1">Thrive detected: {isThriveDetected ? "yes" : "no"}</div>
              <div className="mt-1">Connected: {isConnected ? "yes" : "no"}</div>
              <div className="mt-1">Build mode used: {buildModeUsed ?? "not run"}</div>
            </div>
          </div>
          {error ? <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}
        </section>

        {storageSummary && (storageSummary.persistenceHealth !== "healthy" || storageSummary.fallbackActive) ? (
          <section
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              storageSummary.persistenceHealth === "healthy"
                ? "border border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                : "border border-amber-300/35 bg-amber-500/10 text-amber-100"
            }`}
          >
            <div className="font-medium">Storage mode: {storageSummary.storageMode}</div>
            <div className="mt-1">
              Persistence health: {storageSummary.persistenceHealth} | Memory fallback active: {storageSummary.fallbackActive ? "yes" : "no"}
            </div>
            <div className="mt-1">{storageStatusMessage}</div>
          </section>
        ) : null}

        <section className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-white/12 bg-slate-900/60 p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Agency Navigation</div>
            <div className="mt-2 space-y-1">
              {primaryNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                    activeView === item.id
                      ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                      : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button" className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-slate-200" onClick={() => setActiveView("page-studio")}>Open Page Studio</button>
          </aside>
          <div>{renderContent()}</div>
        </section>
      </main>
    </div>
  );
}
