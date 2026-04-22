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
type JourneyPhase = "describe" | "connect" | "preview" | "approve" | "build" | "launch";

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

const journeyFlow: Array<{ id: JourneyPhase; label: string }> = [
  { id: "describe", label: "Describe" },
  { id: "connect", label: "Connect" },
  { id: "preview", label: "Preview" },
  { id: "approve", label: "Approve" },
  { id: "build", label: "Build" },
  { id: "launch", label: "Launch" },
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
  const [activePhase, setActivePhase] = useState<JourneyPhase>("describe");

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
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

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
    () => pageRows.find((page) => page.slug === selectedPageSlug) ?? pageRows[0] ?? null,
    [pageRows, selectedPageSlug]
  );

  const homePage = useMemo(() => pageRows.find((page) => page.slug === "home") ?? pageRows[0] ?? null, [pageRows]);
  const homeApproved = Boolean(homePage && approvedPageSlugs.includes(homePage.slug));

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

  const pageApprovalState = useMemo(
    () => getSelectedPageApprovalState({ pageRows, selectedPage: selectedBuildPage }),
    [pageRows, selectedBuildPage]
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

  const publishChecklist = useMemo(
    () => [
      { id: "pub-1", label: "Website brief saved", done: hasBusinessInfo },
      { id: "pub-2", label: "Connection validated", done: isConnected },
      { id: "pub-3", label: "AI access configured", done: aiConfigured },
      { id: "pub-4", label: "Plan generated", done: hasGeneratedSitePlan },
      { id: "pub-5", label: "At least one page approved", done: approvedPageSlugs.length > 0 },
      { id: "pub-6", label: "Build draft completed", done: hasCompletedBuild },
    ],
    [aiConfigured, approvedPageSlugs.length, hasBusinessInfo, hasCompletedBuild, hasGeneratedSitePlan, isConnected]
  );

  const allApprovalMomentsComplete =
    homeApproved && approvedPageSet && approvedCtaStyle && (!isThriveDetected || approvedReuseDecision);

  function recommendedPhase(): JourneyPhase {
    if (!hasBusinessInfo) return "describe";
    if (!isConnected || !aiConfigured) return "connect";
    if (!hasGeneratedSitePlan) return "preview";
    if (!allApprovalMomentsComplete) return "approve";
    if (!hasCompletedBuild) return "build";
    return "launch";
  }

  const phaseIndex = useMemo(() => {
    const map = new Map<JourneyPhase, number>();
    journeyFlow.forEach((phase, index) => map.set(phase.id, index));
    return map;
  }, []);

  useEffect(() => {
    const suggested = recommendedPhase();
    const current = phaseIndex.get(activePhase) ?? 0;
    const suggestedIndex = phaseIndex.get(suggested) ?? 0;
    if (suggestedIndex > current) setActivePhase(suggested);
  }, [activePhase, aiConfigured, allApprovalMomentsComplete, hasBusinessInfo, hasCompletedBuild, hasGeneratedSitePlan, isConnected, phaseIndex]);

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

  async function createFirstDirection() {
    const prompt = intentPrompt.trim();
    if (!prompt) {
      setIntentStatusMessage("Add your intent before creating direction.");
      return;
    }

    setIntentStatusMessage("Creating first direction...");
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
      setBriefSaveState("saved");
      setIntentStatusMessage("Direction created. Review assumptions and continue.");
      setActivePhase("connect");
    } catch (err: unknown) {
      setBriefSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to create first direction.";
      setUserError(message, "save");
      setIntentStatusMessage("We could not create direction yet.");
    } finally {
      setBusy(false);
    }
  }

  async function connectAndBegin() {
    clearErrors();
    setConnectStatusMessage("Preparing connection...");

    try {
      const targetProjectId = await ensureCanonicalActiveProjectId();
      if (!targetProjectId) return;
      if (!briefIsValid()) {
        setConnectStatusMessage("Your direction needs more detail before connecting.");
        setActivePhase("describe");
        return;
      }

      if (aiApiKey.trim() || serpApiKey.trim()) {
        setConnectStatusMessage("Saving AI access...");
        await saveAiConfig("save");
      } else if (!aiConfigured) {
        setConnectStatusMessage("Add an AI key to begin.");
        return;
      }

      setConnectStatusMessage("Connecting to WordPress...");
      await saveAndValidateConnection();

      setConnectStatusMessage("Creating your first preview...");
      await runSitePipeline("generate");

      setConnectStatusMessage("Connected and preview ready.");
      setActivePhase("preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connect and begin failed.";
      setUserError(message, "connect");
      setConnectStatusMessage("We could not connect and begin yet.");
    }
  }

  function previewPages(): string[] {
    if (pageRows.length) return pageRows.map((page) => page.title);
    if (intentAssumptions?.pageSet?.length) return intentAssumptions.pageSet;
    return ["Home", "Offer", "About", "Contact"];
  }

  function resolveBuildExperienceStatus(): { stage: "Preparing" | "Building" | "Verifying" | "Ready" | "Needs your input"; detail: string } {
    if (hasCompletedBuild) {
      return { stage: "Ready", detail: "Your draft is ready for launch review." };
    }

    if (!buildDraftState.canBuildDraft && (buildDraftStatus === "error" || approvedPageSlugs.length > 0)) {
      return { stage: "Needs your input", detail: buildDraftState.blockers[0] ?? "A required input is missing." };
    }

    if (buildDraftStatus === "running") {
      return { stage: "Building", detail: "Building a draft safely before publishing." };
    }

    const stage = String(currentSession?.runState.currentStage ?? "");
    if (currentSession?.status === "queued") {
      return { stage: "Preparing", detail: "Preparing your build sequence." };
    }
    if (currentSession?.status === "running") {
      if (stage.includes("qa") || stage.includes("verif")) {
        return { stage: "Verifying", detail: "Verifying layout and content for launch readiness." };
      }
      return { stage: "Building", detail: isThriveDetected ? "Building directly in Thrive." : "Building your draft safely before publishing." };
    }

    if (!buildDraftState.canBuildDraft) {
      return { stage: "Needs your input", detail: buildDraftState.blockers[0] ?? "A required input is missing." };
    }

    return { stage: "Preparing", detail: "Build is ready when you confirm." };
  }

  function advanceTo(phase: JourneyPhase) {
    setActivePhase(phase);
    if (phase === "build") setLaunchMessage(null);
  }

  function renderIntentScreen() {
    const examples = [
      "Build a high-converting homepage for my AI pet app.",
      "Create a trusted local service website that gets calls.",
      "Build a boutique brand site with storytelling and email capture.",
    ];

    return (
      <section className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5 md:p-6">
        <h2 className="text-xl font-semibold text-white">Describe</h2>
        <p className="text-sm text-slate-300">What kind of website do you want me to build?</p>
        <textarea
          data-testid="siteforge-intent-prompt"
          value={intentPrompt}
          onChange={(event) => setIntentPrompt(event.target.value)}
          placeholder="Describe the site outcome you want..."
          className="h-32 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-slate-100"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setIntentPrompt(example)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200"
            >
              {example}
            </button>
          ))}
        </div>

        {intentAssumptions ? (
          <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-xs text-slate-200">
            <div className="font-medium text-white">AI assumptions</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div>Business type: {intentAssumptions.businessType}</div>
              <div>Audience: {intentAssumptions.audience}</div>
              <div>Offer: {intentAssumptions.offer}</div>
              <div>Tone: {intentAssumptions.tone}</div>
              <div>Site archetype: {intentAssumptions.siteArchetype}</div>
              <div>CTA style: {intentAssumptions.ctaStrategy}</div>
            </div>
            <button
              type="button"
              className="mt-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs"
              onClick={() => setActivePhase("connect")}
            >
              Refine assumptions
            </button>
          </div>
        ) : null}

        <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-200">Primary action</div>
            <button
              type="button"
              data-testid="siteforge-create-direction-action"
              className={`rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ${busy ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => void createFirstDirection()}
              disabled={busy}
            >
              Create first direction
            </button>
          </div>
          {intentStatusMessage ? <div className="mt-2 text-xs text-slate-300">{intentStatusMessage}</div> : null}
        </div>
      </section>
    );
  }

  function renderConnectScreen() {
    const symbolCount = snapshot?.thriveIntelligence?.primitiveCounts.tcbSymbol ?? 0;
    const templateCount = snapshot?.thriveIntelligence?.primitiveCounts.thriveTemplate ?? 0;

    return (
      <section className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5 md:p-6">
        <h2 className="text-xl font-semibold text-white">Connect</h2>
        <p className="text-sm text-slate-300">Connect your site and access keys once. I will handle the rest.</p>

        <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
          <div>
            <label className="text-slate-300">WordPress URL</label>
            <input value={baseUrl} placeholder="https://example.com" onChange={(event) => setBaseUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
          </div>
          <div>
            <label className="text-slate-300">Username</label>
            <input value={username} placeholder="WordPress username" onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
          </div>
          <div>
            <label className="text-slate-300">App password</label>
            <input type="password" value={appPassword} placeholder="WordPress application password" onChange={(event) => setAppPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
          </div>
          <div>
            <label htmlFor="siteforge-ai-key" className="text-slate-300">AI key</label>
            <input id="siteforge-ai-key" type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="siteforge-serpapi-key" className="text-slate-300">Research key (optional)</label>
            <input id="siteforge-serpapi-key" type="password" value={serpApiKey} onChange={(event) => setSerpApiKey(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
          </div>
        </div>

        <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-200">Primary action</div>
            <button
              type="button"
              data-testid="siteforge-connect-begin-action"
              className={`rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ${busy ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => void connectAndBegin()}
              disabled={busy}
            >
              Connect and begin
            </button>
          </div>
          {connectStatusMessage ? <div className="mt-2 text-xs text-slate-300">{connectStatusMessage}</div> : null}
        </div>

        {(isConnected || snapshot) ? (
          <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-xs text-slate-200">
            <div>Connected to WordPress: {isConnected ? "yes" : "not yet"}</div>
            <div className="mt-1">Thrive detected: {isThriveDetected ? "yes" : "no"}</div>
            <div className="mt-1">Reusable assets found: {symbolCount}</div>
            <div className="mt-1">Existing shell opportunities found: {templateCount > 0 ? "yes" : "not yet"}</div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderPreviewScreen() {
    const pages = previewPages();
    const reuseSummary = isThriveDetected
      ? "I can reuse your existing Thrive shell and blocks where it improves speed."
      : "No Thrive shell detected yet. I will build a safe draft structure first.";

    return (
      <section className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5 md:p-6">
        <h2 className="text-xl font-semibold text-white">Preview</h2>
        <p className="text-sm text-slate-300">Here is the site I think you need.</p>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_0.9fr]">
          <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-xs text-slate-200">
            <div className="font-medium text-white">AI reasoning summary</div>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Direction: {intentAssumptions?.siteArchetype ?? "Conversion-focused growth site"}</li>
              <li>Audience: {briefForm.targetAudience || intentAssumptions?.audience || "Defined from your prompt"}</li>
              <li>Offer: {briefForm.mainOffer || intentAssumptions?.offer || "Primary offer will be clarified"}</li>
              <li>CTA style: {intentAssumptions?.ctaStrategy ?? "Lead capture first, conversion second"}</li>
              <li>{reuseSummary}</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-xs text-slate-200">
            <div className="font-medium text-white">Live site blueprint</div>
            <div className="mt-2">Homepage approach: {homePage?.title ?? "Conversion-first homepage with strong proof and CTA"}</div>
            <div className="mt-2">Proposed page set:</div>
            <ul className="mt-1 list-disc pl-4">
              {pages.map((page) => (
                <li key={page}>{page}</li>
              ))}
            </ul>
            <div className="mt-2">CTA style: {intentAssumptions?.ctaStrategy ?? "Focused primary CTA with one supporting CTA"}</div>
            <div className="mt-2">Reuse decision: {isThriveDetected ? "Reuse where quality is high, replace where needed." : "Create new safe draft assets."}</div>
          </div>

          <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-xs text-slate-200">
            <div className="font-medium text-white">Active decision</div>
            {hasGeneratedSitePlan ? (
              <>
                <div className="mt-2">Your first draft direction is ready for approval.</div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-cyan-100"
                  onClick={() => advanceTo("approve")}
                >
                  Review approvals
                </button>
              </>
            ) : (
              <>
                <div className="mt-2">I need a connected setup before I can render a full preview.</div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-cyan-100"
                  onClick={() => advanceTo("connect")}
                >
                  Go to Connect
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderApproveScreen() {
    if (!pageRows.length) {
      return (
        <section className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5 md:p-6">
          <h2 className="text-xl font-semibold text-white">Approve</h2>
          <p className="text-sm text-slate-300">No pages are ready to approve yet.</p>
          <button
            type="button"
            className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100"
            onClick={() => advanceTo("preview")}
          >
            Review preview
          </button>
        </section>
      );
    }

    const activeApproval = !homeApproved
      ? { key: "home", label: "Approve Homepage", action: () => homePage && setApprovedPageSlugs((prev) => (prev.includes(homePage.slug) ? prev : [...prev, homePage.slug])) }
      : !approvedPageSet
        ? { key: "pageset", label: "Use this page set", action: () => setApprovedPageSet(true) }
        : !approvedCtaStyle
          ? { key: "cta", label: "Use this CTA style", action: () => setApprovedCtaStyle(true) }
          : isThriveDetected && !approvedReuseDecision
            ? { key: "reuse", label: "Approve reuse decisions", action: () => setApprovedReuseDecision(true) }
            : null;

    return (
      <section className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5 md:p-6">
        <h2 className="text-xl font-semibold text-white">Approve</h2>
        <p className="text-sm text-slate-300">Confirm meaning, direction, and decisions before build.</p>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-xs text-slate-200">
            <div className="font-medium text-white">Approval moments</div>
            <ul className="mt-2 space-y-2">
              <li className="rounded-lg border border-white/12 px-3 py-2">{homeApproved ? "[x]" : "[ ]"} Homepage direction</li>
              <li className="rounded-lg border border-white/12 px-3 py-2">{approvedPageSet ? "[x]" : "[ ]"} Page set</li>
              <li className="rounded-lg border border-white/12 px-3 py-2">{approvedCtaStyle ? "[x]" : "[ ]"} CTA style</li>
              {isThriveDetected ? (
                <li className="rounded-lg border border-white/12 px-3 py-2">{approvedReuseDecision ? "[x]" : "[ ]"} Reuse / replace decision</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4 text-xs text-slate-200">
            <div className="font-medium text-cyan-100">Primary action</div>
            {activeApproval ? (
              <button
                type="button"
                data-testid="siteforge-approve-active-action"
                className="mt-3 w-full rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100"
                onClick={activeApproval.action}
              >
                {activeApproval.label}
              </button>
            ) : (
              <button
                type="button"
                data-testid="siteforge-approve-active-action"
                className="mt-3 w-full rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100"
                onClick={() => advanceTo("build")}
              >
                Move to Build
              </button>
            )}
            <div className="mt-3">Selected page: {selectedBuildPage?.title ?? "None"}</div>
            <div className="mt-1">Approval hint: {pageApprovalState.kind === "ready" ? pageApprovalState.buttonLabel : pageApprovalState.message}</div>
          </div>
        </div>
      </section>
    );
  }

  function renderBuildScreen() {
    const experience = resolveBuildExperienceStatus();

    return (
      <section className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5 md:p-6">
        <h2 className="text-xl font-semibold text-white">Build</h2>
        <p className="text-sm text-slate-300">I will build the approved draft safely before publishing.</p>

        <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-sm text-slate-200">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</div>
          <div className="mt-2 text-xl font-semibold text-white">{experience.stage}</div>
          <div className="mt-2 text-sm text-slate-300">{experience.detail}</div>
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-300">
            <li>{isThriveDetected ? "Building directly in Thrive when safe." : "Building a safe draft structure first."}</li>
            <li>{snapshot?.thriveIntelligence?.symbolInventory?.length ? "Reusing existing assets where quality is high." : "Creating reusable assets from approved direction."}</li>
            <li>Verifying before launch review.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-200">Primary action</div>
            <button
              type="button"
              data-testid="siteforge-build-primary-action"
              className={`rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ${busy || !buildDraftState.canBuildDraft ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => void runSitePipeline("build")}
              disabled={busy || !buildDraftState.canBuildDraft}
            >
              {buildDraftStatus === "running" ? "Building..." : "Build this in Thrive"}
            </button>
          </div>
          {buildDraftMessage ? <div className="mt-2 text-xs text-slate-300">{buildDraftMessage}</div> : null}
        </div>
      </section>
    );
  }

  function renderLaunchScreen() {
    const launchReady = hasCompletedBuild;
    const title = launchReady ? "Ready to go live" : "One thing left";

    let actionLabel = "Review build";
    let action: () => void = () => advanceTo("build");
    if (!hasGeneratedSitePlan) {
      actionLabel = "Review preview";
      action = () => advanceTo("preview");
    } else if (!allApprovalMomentsComplete) {
      actionLabel = "Review approvals";
      action = () => advanceTo("approve");
    } else if (launchReady && baseUrl) {
      actionLabel = "Publish draft";
      action = () => {
        const target = `${baseUrl.replace(/\/$/, "")}/wp-admin/edit.php?post_type=page`;
        window.open(target, "_blank", "noopener,noreferrer");
        setLaunchMessage("Opened your WordPress publishing view in a new tab.");
      };
    } else if (launchReady) {
      actionLabel = "Publish draft";
      action = () => setLaunchMessage("Add your WordPress URL in Connect so I can open your publishing view.");
    }

    const readyCount = publishChecklist.filter((item) => item.done).length;

    return (
      <section className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5 md:p-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-300">{launchReady ? "Your draft passed build checks and is ready for final publishing." : "I still need one approval or build step before launch."}</p>

        <div className="rounded-xl border border-white/12 bg-slate-900/60 p-4 text-xs text-slate-200">
          <div>Progress: {readyCount}/{publishChecklist.length} launch signals complete.</div>
          <div className="mt-2">Homepage ready: {homeApproved ? "yes" : "no"}</div>
          <div className="mt-1">Page set confirmed: {approvedPageSet ? "yes" : "no"}</div>
          <div className="mt-1">Build complete: {hasCompletedBuild ? "yes" : "no"}</div>
        </div>

        <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-200">Primary action</div>
            <button
              type="button"
              data-testid="siteforge-launch-primary-action"
              className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100"
              onClick={action}
            >
              {actionLabel}
            </button>
          </div>
          {launchMessage ? <div className="mt-2 text-xs text-slate-300">{launchMessage}</div> : null}
        </div>
      </section>
    );
  }

  function renderAdvancedPanel() {
    return (
      <details className="rounded-2xl border border-white/12 bg-slate-900/45 p-4 text-xs text-slate-200">
        <summary className="cursor-pointer font-medium text-white">Advanced</summary>
        <div className="mt-4 space-y-4">
          <section className="rounded-xl border border-white/12 bg-white/5 p-3">
            <div className="font-medium text-white">Diagnostics</div>
            <div className="mt-2">Storage mode: {storageSummary?.storageMode ?? "unknown"}</div>
            <div>Persistence health: {storageSummary?.persistenceHealth ?? "unknown"}</div>
            <div>Memory fallback active: {storageSummary?.fallbackActive ? "yes" : "no"}</div>
            <div className="mt-1 text-slate-300">{storageStatusMessage}</div>
            <div className="mt-2 text-slate-300">Raw Errors: {technicalError ?? "None"}</div>
            <div className="text-slate-300">Last run: {currentSession?.id ?? "none"}</div>
          </section>

          <section className="rounded-xl border border-white/12 bg-white/5 p-3">
            <div className="font-medium text-white">Project controls</div>
            <div className="mt-2">
              <label className="text-slate-300">Current project</label>
              <select
                data-testid="siteforge-project-select"
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
            <div className="mt-2">
              <label className="text-slate-300">New project name</label>
              <input
                data-testid="siteforge-new-project-name-input"
                placeholder="e.g. iPetzo"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
              <button
                type="button"
                className="mt-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                onClick={createProject}
                disabled={busy || !normalizeNewProjectName(newProjectName)}
              >
                {createStatus === "creating" ? "Creating..." : "Create Project"}
              </button>
            </div>
            <div className="mt-2">
              <label className="text-slate-300">Rename current project</label>
              <input
                id="siteforge-project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
              />
              <div className="mt-1 text-slate-400">Rename state: {projectNameSaveState}</div>
            </div>
            {createStatusMessage ? <div className="mt-2 text-slate-300">{createStatusMessage}</div> : null}
          </section>

          <section className="rounded-xl border border-white/12 bg-white/5 p-3">
            <div className="font-medium text-white">Connection details</div>
            <button
              type="button"
              className="mt-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2"
              onClick={() => void revalidateConnection()}
              disabled={busy || !selectedProjectId}
            >
              Revalidate connection
            </button>
            <button
              type="button"
              className="ml-2 mt-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2"
              onClick={removeAiKey}
              disabled={busy || (!activeProject?.hasSavedAiSecret && !activeProject?.hasSavedSerpApiSecret)}
            >
              Remove Saved Keys
            </button>
          </section>

          <section className="rounded-xl border border-white/12 bg-white/5 p-3">
            <div className="font-medium text-white">Run logs</div>
            <div className="mt-2 space-y-1 text-[11px] text-slate-300">
              {runLogs.slice(0, 6).map((log) => (
                <div key={log.logId}>{log.timestamp} · {log.stage} · {log.message}</div>
              ))}
              {!runLogs.length ? <div>No logs yet.</div> : null}
            </div>
          </section>
        </div>
      </details>
    );
  }

  function renderPhase() {
    if (activePhase === "describe") return renderIntentScreen();
    if (activePhase === "connect") return renderConnectScreen();
    if (activePhase === "preview") return renderPreviewScreen();
    if (activePhase === "approve") return renderApproveScreen();
    if (activePhase === "build") return renderBuildScreen();
    return renderLaunchScreen();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_38%),radial-gradient(circle_at_90%_0%,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(180deg,_#050814_0%,_#0b1221_52%,_#070d19_100%)] text-slate-100">
      <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
        <section className="rounded-2xl border border-white/15 bg-slate-900/65 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">SiteForge 2050</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">Your AI website partner</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">From intent to launch: one decision at a time.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-200">
              <div>Project: {activeProject?.name ?? "No project selected"}</div>
              <div className="mt-1">Connection: {isConnected ? "connected" : "pending"}</div>
              <div className="mt-1">Thrive: {isThriveDetected ? "detected" : "not detected"}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {journeyFlow.map((phase) => (
              <button
                key={phase.id}
                type="button"
                onClick={() => setActivePhase(phase.id)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activePhase === phase.id
                    ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                    : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                {phase.label}
              </button>
            ))}
          </div>

          {error ? <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}
        </section>

        <section className="mt-4">{renderPhase()}</section>
        <section className="mt-4">{renderAdvancedPanel()}</section>
      </main>
    </div>
  );
}
