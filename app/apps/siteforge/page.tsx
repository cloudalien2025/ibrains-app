"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeNewProjectName } from "@/lib/siteforge/newProjectName";
import { ProjectNameSaveState, shouldPersistProjectName } from "@/lib/siteforge/projectNameAutosave";
import { brandToneOptions, websiteGoalOptions } from "@/lib/siteforge/contracts";
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
type JourneyPhase = "connect" | "describe" | "launch";

type OpenProjectResult =
  | { ok: true }
  | { ok: false; reason: "superseded" | "failed"; message?: string };

type BuildDraftState = {
  canBuildDraft: boolean;
  blockers: string[];
};

type SelectedPageApprovalState =
  | { kind: "empty"; message: string }
  | { kind: "needs_selection"; message: string }
  | { kind: "ready"; buttonLabel: string };

type IntentAssumptions = {
  businessType: string;
  audience: string;
  offer: string;
  tone: string;
  siteArchetype: string;
  ctaStrategy: string;
  pageSet: string[];
};

type ResearchAvailabilityState = {
  usingMarketResearch: boolean;
  summary: string;
};

type LaunchExperienceState = {
  stage:
    | "Ready to build"
    | "Researching your market"
    | "Planning your pages"
    | "Building in Thrive"
    | "Verifying your draft"
    | "Draft ready"
    | "We need connection details"
    | "We need your website description"
    | "Add your AI key";
  detail: string;
};

type LaunchProgressStageId =
  | "preparing"
  | "researching"
  | "planning"
  | "writing"
  | "designing"
  | "building"
  | "verifying"
  | "ready";

type LaunchProgressStageStatus = "completed" | "current" | "upcoming";

type LaunchProgressStage = {
  id: LaunchProgressStageId;
  label: string;
  description: string;
  status: LaunchProgressStageStatus;
};

type LaunchProgressState = {
  percentage: number;
  currentStageLabel: string;
  currentStageDescription: string;
  stages: LaunchProgressStage[];
  isActiveBuild: boolean;
};

const launchProgressStages: Array<{ id: LaunchProgressStageId; label: string }> = [
  { id: "preparing", label: "Preparing your build" },
  { id: "researching", label: "Researching your market" },
  { id: "planning", label: "Planning your pages" },
  { id: "writing", label: "Writing your content" },
  { id: "designing", label: "Designing your layout" },
  { id: "building", label: "Building in Thrive" },
  { id: "verifying", label: "Verifying your draft" },
  { id: "ready", label: "Draft ready" },
];

const journeyFlow: Array<{ id: JourneyPhase; label: string }> = [
  { id: "connect", label: "Connect" },
  { id: "describe", label: "Describe" },
  { id: "launch", label: "Launch" },
];

const sfSurfaceCardClass = "space-y-4 rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 md:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]";
const sfLabelClass = "text-[#334155]";
const sfInputClass = "mt-1 w-full rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-[#0F172A] placeholder:text-[#94A3B8]";
const sfInfoPanelClass = "rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/70 p-4";
const sfPrimaryButtonClass = "rounded-lg border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]";
const sfSecondaryButtonClass = "rounded-full border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs text-[#334155] transition hover:bg-[#F8FBFF]";

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

function intentToAssumptions(prompt: string): IntentAssumptions {
  const text = prompt.toLowerCase();
  const businessType = text.includes("service")
    ? "Local service business"
    : text.includes("saas") || text.includes("app")
      ? "SaaS / software"
      : text.includes("boutique") || text.includes("brand")
        ? "Boutique brand"
        : "Growth business";

  const audience = text.includes("local")
    ? "Nearby buyers ready to act"
    : text.includes("b2b")
      ? "Decision makers evaluating solutions"
      : "People searching for a trusted solution";

  const offer = text.includes("call")
    ? "Consultation call"
    : text.includes("email") || text.includes("capture")
      ? "Lead magnet + email nurture"
      : "Primary offer with clear conversion path";

  const tone = text.includes("trusted") || text.includes("trust") ? "credible" : text.includes("boutique") ? "premium" : "expert";
  const siteArchetype = text.includes("homepage") ? "Single high-converting homepage" : "Conversion-focused growth site";
  const ctaStrategy = text.includes("calls") ? "Call-first CTA" : "Lead capture first, conversion second";

  return {
    businessType,
    audience,
    offer,
    tone,
    siteArchetype,
    ctaStrategy,
    pageSet: ["Home", "Offer", "About", "Contact", "Lead Capture"],
  };
}

function intentToBrief(prompt: string): WebsiteBriefForm {
  const assumptions = intentToAssumptions(prompt);
  const normalizedPrompt = prompt.trim();
  const fallbackName = "Intent-led Site";

  return {
    businessName: fallbackName,
    businessType: assumptions.businessType,
    businessDescription: normalizedPrompt || "Website generated from intent.",
    targetAudience: assumptions.audience,
    websiteGoal: "capture_leads",
    mainOffer: assumptions.offer,
    brandTone: assumptions.tone === "premium" ? "premium" : assumptions.tone === "credible" ? "modern" : "expert",
    marketLocation: "",
    competitors: "",
    differentiators: "Built from user intent with conversion-first structure.",
  };
}

function intentToProjectName(prompt: string): string {
  const cleaned = prompt
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
  return normalizeNewProjectName(cleaned ? `${cleaned} Site` : "Intent SiteForge Project") ?? "Intent SiteForge Project";
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
  hasWebsiteDescription,
}: {
  projectSelected: boolean;
  isConnected: boolean;
  hasWebsiteDescription: boolean;
}): BuildDraftState {
  const blockers: string[] = [];
  if (!projectSelected) blockers.push("Select a project first.");
  if (!isConnected) blockers.push("Connect your website first.");
  if (!hasWebsiteDescription) blockers.push("Add your website description.");
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

export function getResearchAvailabilityState({ hasSerpApiKey }: { hasSerpApiKey: boolean }): ResearchAvailabilityState {
  if (hasSerpApiKey) {
    return {
      usingMarketResearch: true,
      summary: "Using market research",
    };
  }
  return {
    usingMarketResearch: false,
    summary: "Building from your intent and current site",
  };
}

export function getLaunchExperienceState({
  hasCompletedBuild,
  currentSession,
  hasSerpApiKey,
  hasAiAccess,
  isConnected,
  hasWebsiteDescription,
}: {
  hasCompletedBuild: boolean;
  currentSession: BuildSession | null;
  hasSerpApiKey: boolean;
  hasAiAccess: boolean;
  isConnected: boolean;
  hasWebsiteDescription: boolean;
}): LaunchExperienceState {
  if (!isConnected) {
    return { stage: "We need connection details", detail: "Add your WordPress connection details to continue." };
  }
  if (!hasWebsiteDescription) {
    return { stage: "We need your website description", detail: "Describe the homepage and pages you want created." };
  }
  if (!hasAiAccess) {
    return { stage: "Add your AI key", detail: "Add your AI key to start building." };
  }
  if (hasCompletedBuild) {
    return { stage: "Draft ready", detail: "Your draft is ready." };
  }

  const stage = String(currentSession?.runState.currentStage ?? "").toLowerCase();
  if (currentSession?.status === "queued") {
    if (hasSerpApiKey) return { stage: "Researching your market", detail: "Researching what works in your market." };
    return { stage: "Planning your pages", detail: "Planning your homepage and page set." };
  }

  if (currentSession?.status === "running") {
    if (stage.includes("research")) {
      return { stage: "Researching your market", detail: "Researching what works in your market." };
    }
    if (stage.includes("plan") || stage.includes("brief") || stage.includes("content") || stage.includes("spec")) {
      return { stage: "Planning your pages", detail: "Planning your homepage and page set." };
    }
    if (stage.includes("qa") || stage.includes("verify")) {
      return { stage: "Verifying your draft", detail: "Verifying your draft." };
    }
    return { stage: "Building in Thrive", detail: "Building your draft." };
  }

  if (hasSerpApiKey) {
    return { stage: "Researching your market", detail: "Researching what works in your market." };
  }
  return { stage: "Ready to build", detail: "Everything is set. Build when you are ready." };
}

function resolveLaunchStageDescription(stageId: LaunchProgressStageId, params: { hasSerpApiKey: boolean; isThriveDetected: boolean }): string {
  if (stageId === "preparing") return "Initializing your project context and build inputs.";
  if (stageId === "researching") {
    return params.hasSerpApiKey
      ? "Analyzing market patterns and positioning signals for your category."
      : "SerpAPI is unavailable, so we are grounding this build in your description and connected site.";
  }
  if (stageId === "planning") return "Mapping page priorities, section order, and conversion flow.";
  if (stageId === "writing") return "Drafting conversion-focused copy from your brief.";
  if (stageId === "designing") return "Composing section hierarchy, spacing rhythm, and visual structure.";
  if (stageId === "building") {
    return params.isThriveDetected
      ? "Applying your page structure to Thrive-compatible output."
      : "Building your draft with your current site shell and WordPress fallback path.";
  }
  if (stageId === "verifying") return "Running quality checks and validating your generated draft.";
  return "Your draft is ready. Review, edit, and publish from Thrive.";
}

function resolveSessionStageIndex(params: { session: BuildSession | null; hasSerpApiKey: boolean }): number {
  const session = params.session;
  if (!session) return 0;
  if (session.status === "queued") return 0;
  if (session.status === "completed") return 7;

  const current = String(session.runState.currentStage ?? "").toLowerCase();
  const timelineMessages = session.runState.timeline.map((entry) => entry.message.toLowerCase());

  if (current.includes("planning")) {
    if (timelineMessages.some((message) => message.includes("planning your site structure"))) return 2;
    if (timelineMessages.some((message) => message.includes("market intelligence"))) return 1;
    return params.hasSerpApiKey ? 1 : 2;
  }

  if (current.includes("writing")) return 3;

  if (current.includes("building")) {
    if (timelineMessages.some((message) => message.includes("building technical page specification"))) return 5;
    return 4;
  }

  if (current.includes("executing")) return 5;
  if (current.includes("review") || current.includes("final")) return 6;
  if (current.includes("completed")) return 7;

  return 0;
}

export function getLaunchProgressState(params: {
  currentSession: BuildSession | null;
  hasCompletedBuild: boolean;
  hasSerpApiKey: boolean;
  isThriveDetected: boolean;
}): LaunchProgressState {
  const currentIndex = params.hasCompletedBuild ? 7 : resolveSessionStageIndex({ session: params.currentSession, hasSerpApiKey: params.hasSerpApiKey });
  const currentStageMeta = launchProgressStages[currentIndex] ?? launchProgressStages[0];
  const percentage = params.hasCompletedBuild
    ? 100
    : Math.max(
        params.currentSession?.runState.progressPct ?? 0,
        Math.round((currentIndex / (launchProgressStages.length - 1)) * 100)
      );

  const stages = launchProgressStages.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    description: resolveLaunchStageDescription(stage.id, {
      hasSerpApiKey: params.hasSerpApiKey,
      isThriveDetected: params.isThriveDetected,
    }),
    status: (index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming") as LaunchProgressStageStatus,
  }));

  const currentStage = stages[currentIndex] ?? stages[0];
  const isActiveBuild = Boolean(params.currentSession && ["queued", "running"].includes(params.currentSession.status));

  return {
    percentage: Math.max(0, Math.min(100, percentage)),
    currentStageLabel: currentStage.label,
    currentStageDescription: currentStage.description,
    stages,
    isActiveBuild,
  };
}

export default function SiteForgeAppPage() {
  const [activePhase, setActivePhase] = useState<JourneyPhase>("connect");

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

  const [intentPrompt, setIntentPrompt] = useState("");
  const [intentAssumptions, setIntentAssumptions] = useState<IntentAssumptions | null>(null);
  const [intentStatusMessage, setIntentStatusMessage] = useState<string | null>(null);
  const [connectStatusMessage, setConnectStatusMessage] = useState<string | null>(null);

  const [selectedPageSlug, setSelectedPageSlug] = useState<string | null>(null);
  const [approvedPageSlugs, setApprovedPageSlugs] = useState<string[]>([]);
  const [approvedPageSet, setApprovedPageSet] = useState(false);
  const [approvedCtaStyle, setApprovedCtaStyle] = useState(false);
  const [approvedReuseDecision, setApprovedReuseDecision] = useState(false);

  const [buildDraftStatus, setBuildDraftStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [buildDraftMessage, setBuildDraftMessage] = useState<string | null>(null);

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
        buildStatus: currentSession.status === "completed" ? "Built" : "Awaiting approval",
        approvalStatus: approvedPageSlugs.includes(page.slug) ? "Approved" : "Awaiting approval",
        sections: page.sections,
      })) ?? [],
    [approvedPageSlugs, currentSession]
  );

  const selectedBuildPage = useMemo(
    () => pageRows.find((page) => page.slug === selectedPageSlug) ?? pageRows.find((page) => page.slug === "home") ?? pageRows[0] ?? null,
    [pageRows, selectedPageSlug]
  );

  const homePage = useMemo(() => pageRows.find((page) => page.slug === "home") ?? pageRows[0] ?? null, [pageRows]);
  const homeApproved = Boolean(homePage && approvedPageSlugs.includes(homePage.slug));

  const isConnected = Boolean(connectionResult?.connected || savedConnection?.lastValidationStatus === "valid");
  const isThriveDetected = Boolean(connectionResult?.thriveDetected || savedConnection?.thriveDetected || snapshot?.thriveDetected);
  const hasAiAccess = Boolean(activeProject?.hasSavedAiSecret);
  const hasSerpApiAccess = Boolean(activeProject?.hasSavedSerpApiSecret);

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

  const buildDraftState = useMemo(
    () =>
      getBuildDraftState({
        projectSelected: Boolean(selectedProjectId),
        isConnected,
        hasWebsiteDescription: hasBusinessInfo,
      }),
    [hasBusinessInfo, isConnected, selectedProjectId]
  );

  const researchAvailability = useMemo(
    () => getResearchAvailabilityState({ hasSerpApiKey: hasSerpApiAccess }),
    [hasSerpApiAccess]
  );

  const launchExperienceState = useMemo(
    () =>
      getLaunchExperienceState({
        hasCompletedBuild,
        currentSession,
        hasSerpApiKey: hasSerpApiAccess,
        hasAiAccess,
        isConnected,
        hasWebsiteDescription: hasBusinessInfo,
      }),
    [currentSession, hasAiAccess, hasBusinessInfo, hasCompletedBuild, hasSerpApiAccess, isConnected]
  );

  const launchProgressState = useMemo(
    () =>
      getLaunchProgressState({
        currentSession,
        hasCompletedBuild,
        hasSerpApiKey: hasSerpApiAccess,
        isThriveDetected,
      }),
    [currentSession, hasCompletedBuild, hasSerpApiAccess, isThriveDetected]
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

  useEffect(() => {
    if (!pageRows.length) {
      setApprovedPageSet(false);
      setApprovedCtaStyle(false);
      setApprovedReuseDecision(false);
    }
  }, [pageRows.length, currentSession?.id]);

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
    setIntentPrompt("");
    setIntentAssumptions(null);
    setIntentStatusMessage(null);
    setConnectStatusMessage(null);
    setApprovedPageSlugs([]);
    setApprovedPageSet(false);
    setApprovedCtaStyle(false);
    setApprovedReuseDecision(false);
    setBuildDraftStatus("idle");
    setBuildDraftMessage(null);
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

  async function saveWebsiteBriefPayload(targetProjectId: string, payload: ReturnType<typeof briefPayload>) {
    const data = await fetchJson<unknown>(`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}`, {
      method: "PATCH",
      body: JSON.stringify({ websiteBrief: payload, currentState: "workspace" }),
    });
    const workspace = normalizeWorkspace(data);
    if (!workspace) throw new Error("Website brief save response was invalid.");
    await applyWorkspace(workspace);
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

  async function ensureProjectForIntent(intent: string): Promise<string | null> {
    const canonical = await ensureCanonicalActiveProjectId();
    if (canonical) return canonical;

    const generatedName = intentToProjectName(intent);
    if (!generatedName) return null;

    setCreateStatus("creating");
    setCreateStatusMessage(null);
    const payload = await fetchJson<unknown>("/api/siteforge/projects", {
      method: "POST",
      body: JSON.stringify({ name: generatedName, description: "Persistent SiteForge workspace" }),
    });
    const normalized = normalizeProjectPayload(payload);
    if (!normalized) throw new Error("Project create response was invalid.");

    setProjects((prev) => [normalized.project, ...prev.filter((entry) => entry.id !== normalized.project.id)]);
    activeProjectIntentRef.current = normalized.project.id;
    setSelectedProjectId(normalized.project.id);
    const opened = await openProject(normalized.project.id, "create");
    if (!opened.ok && opened.reason === "failed") throw new Error(opened.message ?? "Project was created but could not be opened.");
    setCreateStatus("created");
    setCreateStatusMessage(`Project created: ${normalized.project.name}`);
    return normalized.project.id;
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
    setSelectedPageSlug((prev) => (prev && pageRows.some((page) => page.slug === prev) ? prev : pageRows.find((page) => page.slug === "home")?.slug ?? pageRows[0]?.slug ?? null));
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
      await saveWebsiteBriefPayload(targetProjectId, briefPayload());
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

    if (mode === "build" && !buildDraftState.canBuildDraft) {
      const blocker = buildDraftState.blockers[0] ?? "Connect your website first.";
      setBuildDraftStatus("error");
      setBuildDraftMessage(blocker);
      return;
    }

    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    clearErrors();
    if (mode === "build") {
      setBuildDraftStatus("running");
      setBuildDraftMessage("Build started. Tracking progress below.");
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
        setBuildDraftStatus("running");
        setBuildDraftMessage("Build is in progress.");
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

  async function createFirstDirection() {
    const prompt = intentPrompt.trim();
    if (!prompt) {
      setIntentStatusMessage("Describe the homepage and additional pages you want created.");
      return;
    }

    if (!isConnected) {
      setIntentStatusMessage("Connect your website first.");
      setActivePhase("connect");
      return;
    }

    if (!hasAiAccess && !aiApiKey.trim()) {
      setIntentStatusMessage("Add your AI key.");
      setActivePhase("connect");
      return;
    }

    setIntentStatusMessage("Creating your website plan...");
    clearErrors();

    try {
      const projectId = await ensureProjectForIntent(prompt);
      if (!projectId) throw new Error("Unable to prepare a project for this intent.");

      const inferred = intentToBrief(prompt);
      const assumptions = intentToAssumptions(prompt);
      setIntentAssumptions(assumptions);
      setBriefForm(inferred);

      setBusy(true);
      setBriefSaveState("saving");
      await saveWebsiteBriefPayload(projectId, {
        businessName: inferred.businessName.trim(),
        businessType: inferred.businessType.trim(),
        businessDescription: inferred.businessDescription.trim(),
        targetAudience: inferred.targetAudience.trim(),
        websiteGoal: inferred.websiteGoal,
        mainOffer: inferred.mainOffer.trim(),
        brandTone: inferred.brandTone,
        marketLocation: inferred.marketLocation.trim(),
        competitors: inferred.competitors.trim(),
        differentiators: inferred.differentiators.trim(),
      });
      // Keep intent-derived brief in local state before generation if workspace payload omits websiteBrief.
      setBriefForm(inferred);
      setBriefSaveState("saved");
      await runSitePipeline("generate");
      setIntentStatusMessage("Website plan ready.");
      setActivePhase("describe");
    } catch (err: unknown) {
      setBriefSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to create first direction.";
      setUserError(message, "save");
      setIntentStatusMessage("We could not create your website plan yet.");
    } finally {
      setBusy(false);
    }
  }

  async function connectAndBegin() {
    clearErrors();
    setConnectStatusMessage("Connecting your website...");

    try {
      let targetProjectId = await ensureCanonicalActiveProjectId();
      if (!targetProjectId) {
        targetProjectId = await ensureProjectForIntent(intentPrompt.trim() || "SiteForge project");
      }
      if (!targetProjectId) return;

      if (!aiApiKey.trim() && !hasAiAccess) {
        setConnectStatusMessage("Add your AI key.");
        return;
      }

      if (aiApiKey.trim() || serpApiKey.trim()) {
        setConnectStatusMessage("Saving AI and research access...");
        await saveAiConfig("save");
      }

      setConnectStatusMessage("Validating WordPress access...");
      await saveAndValidateConnection();
      setConnectStatusMessage("Connected");
      setActivePhase("describe");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connect website failed.";
      setUserError(message, "connect");
      setConnectStatusMessage("We could not connect your website yet.");
    }
  }

  function previewPages(): string[] {
    if (pageRows.length) return pageRows.map((page) => page.title);
    if (intentAssumptions?.pageSet?.length) return intentAssumptions.pageSet;
    return ["Home", "Offer", "About", "Contact"];
  }

  function renderConnectStep() {
    const symbolCount = snapshot?.thriveIntelligence?.primitiveCounts.tcbSymbol ?? 0;
    const templateCount = snapshot?.thriveIntelligence?.primitiveCounts.thriveTemplate ?? 0;

    return (
      <section className={sfSurfaceCardClass}>
        <h2 className="text-xl font-semibold text-[#0F172A]">Connect</h2>
        <p className="text-sm text-[#334155]">Connect your site and required keys once.</p>

        <div className="grid gap-3 text-sm text-[#334155] md:grid-cols-2">
          <div>
            <label className={sfLabelClass}>WordPress URL</label>
            <input value={baseUrl} placeholder="https://example.com" onChange={(event) => setBaseUrl(event.target.value)} className={sfInputClass} />
          </div>
          <div>
            <label className={sfLabelClass}>Username</label>
            <input value={username} placeholder="WordPress username" onChange={(event) => setUsername(event.target.value)} className={sfInputClass} />
          </div>
          <div>
            <label className={sfLabelClass}>App password</label>
            <input type="password" value={appPassword} placeholder="WordPress application password" onChange={(event) => setAppPassword(event.target.value)} className={sfInputClass} />
          </div>
          <div>
            <label htmlFor="siteforge-ai-key" className={sfLabelClass}>OpenAI key</label>
            <input id="siteforge-ai-key" type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} className={sfInputClass} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="siteforge-serpapi-key" className={sfLabelClass}>SerpAPI key</label>
            <input id="siteforge-serpapi-key" type="password" value={serpApiKey} onChange={(event) => setSerpApiKey(event.target.value)} className={sfInputClass} />
          </div>
        </div>

        <div className="rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[#334155]">Primary action</div>
            <button
              type="button"
              data-testid="siteforge-connect-website-action"
              className={`${sfPrimaryButtonClass} ${busy ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => void connectAndBegin()}
              disabled={busy}
            >
              Connect Website
            </button>
          </div>
          {connectStatusMessage ? <div className="mt-2 text-xs text-[#334155]">{connectStatusMessage}</div> : null}
          {aiStatusMessage ? <div className="mt-1 text-xs text-[#64748B]">{aiStatusMessage}</div> : null}
        </div>

        {(isConnected || snapshot) ? (
          <div className={`${sfInfoPanelClass} text-xs text-[#334155]`}>
            <div>Connected: {isConnected ? "yes" : "not yet"}</div>
            <div className="mt-1">Thrive detected: {isThriveDetected ? "yes" : "no"}</div>
            <div className="mt-1">Reusable assets found: {symbolCount}</div>
            <div className="mt-1">Direct Thrive build: {isThriveDetected ? "possible" : "safe fallback likely"}</div>
            <div className="mt-1">Shell opportunities: {templateCount > 0 ? "found" : "not yet"}</div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderDescribeStep() {
    const pages = previewPages();
    const examplePrompt =
      "Build a homepage for iPetzo that quickly builds trust with dog and cat owners, explains the app clearly, and pushes them to start a trial. Also create an About page, FAQ page, and Contact page.";
    const keyMessages = [briefForm.mainOffer, briefForm.differentiators, briefForm.targetAudience]
      .map((value) => value.trim())
      .filter(Boolean);
    const primaryCta = intentAssumptions?.ctaStrategy ?? "Lead capture first, conversion second";
    const homepageGoal = homePage?.goal ?? "Primary conversion";

    return (
      <section className={sfSurfaceCardClass}>
        <h2 className="text-xl font-semibold text-[#0F172A]">Describe</h2>
        <p className="text-sm text-[#334155]">Describe the homepage and additional pages you want created.</p>

        <textarea
          data-testid="siteforge-intent-prompt"
          value={intentPrompt}
          onChange={(event) => setIntentPrompt(event.target.value)}
          placeholder="Describe the homepage and additional pages you want created."
          className="h-36 w-full rounded-xl border border-[#D9E4F0] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
        />

        <button
          type="button"
          className={sfSecondaryButtonClass}
          onClick={() => setIntentPrompt(examplePrompt)}
        >
          {examplePrompt}
        </button>

        <div className="rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[#334155]">Primary action</div>
            <button
              type="button"
              data-testid="siteforge-create-plan-action"
              className={`${sfPrimaryButtonClass} ${busy ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => void createFirstDirection()}
              disabled={busy}
            >
              Create Website Plan
            </button>
          </div>
          {intentStatusMessage ? <div className="mt-2 text-xs text-[#334155]">{intentStatusMessage}</div> : null}
        </div>

        {hasGeneratedSitePlan ? (
          <section className="rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/70 p-4 text-xs text-[#334155]">
            <div className="font-medium text-[#0F172A]">Plan summary</div>
            <div className="mt-3">Homepage goal: {homepageGoal}</div>
            <div className="mt-3">Key messages:</div>
            <ul className="mt-1 list-disc pl-4 text-[#334155]">
              {(keyMessages.length ? keyMessages : ["Conversion-first messaging based on your intent."]).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            <div className="mt-3">Proposed pages:</div>
            <ul className="mt-1 list-disc pl-4 text-[#334155]">
              {pages.map((page) => (
                <li key={page}>{page}</li>
              ))}
            </ul>
            <div className="mt-3">Primary CTA: {primaryCta}</div>
          </section>
        ) : null}
      </section>
    );
  }

  function renderLaunchStep() {
    const canBuild = buildDraftState.canBuildDraft && hasAiAccess && !launchProgressState.isActiveBuild && !hasCompletedBuild;
    const homepageUrl =
      currentSession?.executionResult?.createdPages.find((page) => page.slug === "home")?.url ??
      currentSession?.executionResult?.createdPages[0]?.url ??
      null;
    const builtPageCount = currentSession?.executionResult?.createdPages.length ?? 0;
    const buildMode = currentSession?.executionResult?.thrive.buildModeUsed ?? null;
    const strategy = currentSession?.websiteStrategy ?? null;
    const researchSignal = currentSession?.marketIntelligence?.researchIntelligence ?? null;
    const researchConfidence = currentSession?.marketIntelligence?.status === "used" ? "high" : "low";
    const usingThriveAssets = Boolean(
      currentSession?.buildSpec?.pages.some((page) =>
        page.sections.some((section) => {
          const decision = (section as { metadata?: { renderTargetDecision?: string } }).metadata?.renderTargetDecision;
          return (
            decision === "prefer_existing_thrive_symbol" ||
            decision === "prefer_existing_thrive_section" ||
            decision === "prefer_existing_thrive_template" ||
            decision === "prefer_existing_thrive_layout"
          );
        })
      )
    );
    const premiumLayoutSelected = Boolean(
      currentSession?.buildSpec?.pages.some((page) =>
        typeof (page as { metadata?: { premiumCompositionSummary?: unknown } }).metadata?.premiumCompositionSummary === "string"
      )
    );
    const strategyDrivenBuild = Boolean(currentSession?.websiteStrategy && currentSession?.marketIntelligence);

    return (
      <section className={sfSurfaceCardClass}>
        <h2 className="text-xl font-semibold text-[#0F172A]">Launch</h2>
        <p className="text-sm text-[#334155]">Build your website draft from your description and connected site.</p>

        <div className="rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/70 p-4 text-sm text-[#334155]">
          <div className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Status</div>
          <div className="mt-2 text-xl font-semibold text-[#0F172A]">{launchExperienceState.stage}</div>
          <div className="mt-2 text-sm text-[#334155]">{launchExperienceState.detail}</div>
          <ul className="mt-3 list-disc pl-5 text-xs text-[#334155]">
            <li>{researchAvailability.summary}</li>
            <li>{isThriveDetected ? "Building in Thrive" : "Building with your current site shell"}</li>
            <li>Verifying your draft</li>
          </ul>
        </div>

        <div className="rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/70 p-4 text-xs text-[#334155]">
          <div className="font-medium text-[#0F172A]">Intelligence summary</div>
          <div className="mt-2">Research mode: {hasSerpApiAccess ? "SerpAPI pattern synthesis" : "Brief + connected site fallback"}.</div>
          <div className="mt-1">Research confidence: {researchConfidence}.</div>
          {researchSignal?.niche ? <div className="mt-1">Detected niche: {researchSignal.niche}.</div> : null}
          {strategy ? (
            <>
              <div className="mt-1">Strategy: {strategy.siteType} site focused on {strategy.primaryConversionGoal}.</div>
              <div className="mt-1">Primary CTA: {strategy.homepageStrategy.primaryCta}.</div>
            </>
          ) : null}
          <div className="mt-1">
            Thrive inventory: {snapshot?.thriveIntelligence?.symbolSummary.total ?? 0} symbols, {snapshot?.thriveIntelligence?.primitiveCounts.thriveTemplate ?? 0} templates.
          </div>
          {snapshot?.thriveIntelligence?.activeSkin?.name ? (
            <div className="mt-1">Active skin: {snapshot.thriveIntelligence.activeSkin.name}.</div>
          ) : null}
          {usingThriveAssets ? <div className="mt-1">Using Thrive assets: selected reusable primitives matched your strategy.</div> : null}
          {premiumLayoutSelected ? <div className="mt-1">Premium layout selected: enhanced hero, CTA rhythm, trust rendering, and mobile hierarchy applied.</div> : null}
          {strategyDrivenBuild ? <div className="mt-1">Strategy-driven build: research, strategy, and Thrive inventory were combined for composition decisions.</div> : null}
        </div>

        <div className="rounded-xl border border-[#22D3EE]/30 bg-white p-4 shadow-[0_0_24px_rgba(34,211,238,0.14)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[#2563EB]">Build progress</div>
              <div className="mt-1 text-base font-semibold text-[#0F172A]">{launchProgressState.currentStageLabel}</div>
              <div className="mt-1 text-xs text-[#334155]">{launchProgressState.currentStageDescription}</div>
            </div>
            <div className="text-sm font-semibold text-[#1D4ED8]">{launchProgressState.percentage}%</div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#EAF1F8]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#22D3EE] transition-all duration-500"
              style={{ width: `${launchProgressState.percentage}%` }}
              aria-label="Build progress bar"
              data-testid="siteforge-build-progress-bar"
            />
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="siteforge-build-stage-list">
            {launchProgressState.stages.map((stage) => (
              <li
                key={stage.id}
                className={`rounded-lg border px-2.5 py-2 text-xs ${
                  stage.status === "completed"
                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                    : stage.status === "current"
                      ? "border-[#22D3EE]/35 bg-[#22D3EE]/12 text-[#0F172A]"
                      : "border-[#D9E4F0] bg-[#F8FBFF] text-[#334155]"
                }`}
              >
                <div className="font-medium">{stage.label}</div>
                <div className="mt-1 text-[11px] leading-4 opacity-90">{stage.description}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[#334155]">Primary action</div>
            {hasCompletedBuild ? (
              homepageUrl ? (
                <a
                  href={homepageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={sfPrimaryButtonClass}
                >
                  View Draft in Thrive
                </a>
              ) : (
                <button
                  type="button"
                  className={sfPrimaryButtonClass}
                  onClick={() => setActivePhase("describe")}
                >
                  Review Draft Content
                </button>
              )
            ) : (
              <button
                type="button"
                data-testid="siteforge-build-website-action"
                className={`${sfPrimaryButtonClass} ${busy || !canBuild ? "cursor-not-allowed opacity-60" : ""}`}
                onClick={() => void runSitePipeline("build")}
                disabled={busy || !canBuild}
              >
                {launchProgressState.isActiveBuild || buildDraftStatus === "running" ? "Building..." : "Build Website"}
              </button>
            )}
          </div>
          {buildDraftMessage ? <div className="mt-2 text-xs text-[#334155]">{buildDraftMessage}</div> : null}
          {hasCompletedBuild ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-100 p-3 text-xs text-emerald-700">
              <div className="font-medium">Draft ready</div>
              <div className="mt-1">What was created: {builtPageCount} page{builtPageCount === 1 ? "" : "s"} in your draft build.</div>
              <div className="mt-1">
                What to review next: hero clarity, feature accuracy, CTA strength, and mobile section spacing before publish.
              </div>
              {buildMode ? <div className="mt-1">Build mode: {buildMode}.</div> : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderPhase() {
    if (activePhase === "connect") return renderConnectStep();
    if (activePhase === "describe") return renderDescribeStep();
    return renderLaunchStep();
  }

  return (
    <div className="px-1 py-1 md:px-2" data-testid="siteforge-workspace-content">
      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.09)]"
        data-testid="siteforge-primary-workspace"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#2563EB]">SiteForge 2050</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#0F172A]">Your AI website partner</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#334155]">Connect once, describe what you want, and launch.</p>
          </div>
          <div className="rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/75 px-4 py-3 text-xs text-[#334155]">
            <div>Project: {activeProject?.name ?? "No project selected"}</div>
            <div className="mt-1">Connection: {isConnected ? "connected" : "pending"}</div>
            <div className="mt-1">Thrive: {isThriveDetected ? "detected" : "not detected"}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-[#D9E4F0] pb-3">
          {journeyFlow.map((phase) => (
            <button
              key={phase.id}
              type="button"
              onClick={() => setActivePhase(phase.id)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activePhase === phase.id
                  ? "border-[#2563EB] bg-[#2563EB] text-white"
                  : "border-[#D9E4F0] bg-white text-[#334155] hover:bg-[#F8FBFF]"
              }`}
            >
              {phase.label}
            </button>
          ))}
        </div>

        {error ? <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-100 px-4 py-3 text-sm text-amber-700">{error}</div> : null}
      </section>

      <section className="mt-4" data-testid="siteforge-workspace-phase-panel">
        {renderPhase()}
      </section>
    </div>
  );
}
