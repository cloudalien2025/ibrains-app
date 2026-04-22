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
type PrimaryView = "setup" | "build" | "publish" | "settings";
type BuildTab = "plan" | "pages" | "assets";

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

const primaryNav: Array<{ id: PrimaryView; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "build", label: "Build" },
  { id: "publish", label: "Publish" },
];

const buildTabs: Array<{ id: BuildTab; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "pages", label: "Pages" },
  { id: "assets", label: "Assets" },
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
  const [activeView, setActiveView] = useState<PrimaryView>("setup");
  const [activeBuildTab, setActiveBuildTab] = useState<BuildTab>("plan");

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

  const setupReady = hasBusinessInfo && isConnected && aiConfigured;

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

  function renderSetup() {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-white/12 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Project</h2>
            <div className="mt-3 grid gap-3 text-xs text-slate-200">
              <div>
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
              <div>
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
                  className="mt-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs"
                  onClick={createProject}
                  disabled={busy || !normalizeNewProjectName(newProjectName)}
                >
                  {createStatus === "creating" ? "Creating..." : "Create Project"}
                </button>
              </div>
              <div>
                <label className="text-slate-300">Rename current project</label>
                <input
                  id="siteforge-project-name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2"
                />
                <div className="mt-1 text-slate-400">Rename state: {projectNameSaveState}</div>
              </div>
              {createStatusMessage ? <div className="text-slate-300">{createStatusMessage}</div> : null}
            </div>
          </section>

          <section className="rounded-xl border border-white/12 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">About your website</h2>
            <div className="mt-3 grid gap-3 text-xs text-slate-200 md:grid-cols-2">
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
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <div className="text-slate-300">Save state: {briefSaveState}</div>
              <button type="button" data-testid="siteforge-business-continue-action" className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-cyan-100" onClick={saveWebsiteBrief} disabled={busy || !selectedProjectId}>Save Website Brief</button>
            </div>
          </section>

          <section className="rounded-xl border border-white/12 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Connect your site</h2>
            <div className="mt-3 grid gap-3 text-xs text-slate-200">
              <div>
                <label className="text-slate-300">Connection label</label>
                <input value={connectionLabel} onChange={(event) => setConnectionLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label className="text-slate-300">WordPress URL</label>
                <input value={baseUrl} placeholder="https://example.com" onChange={(event) => setBaseUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label className="text-slate-300">WordPress username</label>
                <input value={username} placeholder="WordPress username" onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <div>
                <label className="text-slate-300">Application password</label>
                <input type="password" placeholder="WordPress application password" value={appPassword} onChange={(event) => setAppPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2" />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2">
                <input type="checkbox" checked={hasThriveHint} onChange={(event) => setHasThriveHint(event.target.checked)} /> Thrive already installed
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <div className="text-slate-300">{connectionResult?.message ?? "Connection not validated yet."}</div>
              <div className="flex gap-2">
                <button type="button" data-testid="siteforge-validate-connection-action" className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-cyan-100" onClick={saveAndValidateConnection} disabled={busy || !selectedProjectId}>Validate Connection</button>
                {savedConnection ? (
                  <button type="button" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2" onClick={revalidateConnection} disabled={busy || !selectedProjectId}>Recheck</button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/12 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">AI access</h2>
            <div className="mt-3 grid gap-3 text-xs text-slate-200">
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
            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <div className="text-slate-300">AI status: {aiStatusMessage ?? "not configured"}</div>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2" onClick={() => saveAiConfig("save")} disabled={busy}>Save API Keys</button>
                <button type="button" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2" onClick={removeAiKey} disabled={busy || (!activeProject?.hasSavedAiSecret && !activeProject?.hasSavedSerpApiSecret)}>Remove Saved Keys</button>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-cyan-100">Primary action</h3>
              <p className="mt-1 text-xs text-slate-300">Generate your initial plan after Setup is complete.</p>
            </div>
            <button
              type="button"
              data-testid="siteforge-generate-site-action"
              className={`rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ${busy || !setupReady ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => void runSitePipeline("generate")}
              disabled={busy || !setupReady}
            >
              Generate Plan
            </button>
          </div>
          {!setupReady ? (
            <ul className="mt-3 list-disc pl-5 text-xs text-slate-300">
              {!hasBusinessInfo ? <li>Complete your website brief.</li> : null}
              {!isConnected ? <li>Validate your WordPress connection.</li> : null}
              {!aiConfigured ? <li>Save at least one API key.</li> : null}
            </ul>
          ) : null}
        </section>
      </div>
    );
  }

  function renderBuildPlan() {
    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h3 className="text-base font-semibold text-white">Plan readiness</h3>
          <div className="mt-3 grid gap-3 text-xs text-slate-200 md:grid-cols-2">
            <div className="rounded-lg border border-white/12 bg-slate-900/60 px-3 py-2">Project selected: {selectedProjectId ? "yes" : "no"}</div>
            <div className="rounded-lg border border-white/12 bg-slate-900/60 px-3 py-2">Connection validated: {isConnected ? "yes" : "no"}</div>
            <div className="rounded-lg border border-white/12 bg-slate-900/60 px-3 py-2">Plan generated: {hasGeneratedSitePlan ? "yes" : "no"}</div>
            <div className="rounded-lg border border-white/12 bg-slate-900/60 px-3 py-2">Approved pages: {approvedPageSlugs.length}</div>
          </div>
        </section>

        <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-cyan-100">Primary action</h3>
              <p className="mt-1 text-xs text-slate-300">Build a draft after required items are complete.</p>
            </div>
            <button
              type="button"
              data-testid="siteforge-build-draft-action"
              className={`rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ${busy || !buildDraftState.canBuildDraft ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => void runSitePipeline("build")}
              disabled={busy || !buildDraftState.canBuildDraft}
            >
              {buildDraftStatus === "running" ? "Building Draft..." : buildDraftState.canBuildDraft ? "Build Draft" : "Fix Required Items"}
            </button>
          </div>
          {buildDraftMessage ? <div className="mt-2 text-xs text-slate-300">{buildDraftMessage}</div> : null}
          {!buildDraftState.canBuildDraft ? (
            <ul className="mt-3 list-disc pl-5 text-xs text-slate-300">
              {buildDraftState.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}
          {!canUseThriveNative ? (
            <div className="mt-3 text-xs text-amber-200">Thrive was detected, but the native build path is currently blocked.</div>
          ) : null}
        </section>
      </div>
    );
  }

  function renderBuildPages() {
    return (
      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h3 className="text-base font-semibold text-white">Pages</h3>
          <div className="mt-3 space-y-2 text-sm">
            {pageRows.map((page) => (
              <button
                key={page.slug}
                type="button"
                className="w-full rounded-xl border border-white/12 bg-slate-900/60 px-3 py-3 text-left transition hover:bg-slate-900/80"
                onClick={() => setSelectedPageSlug(page.slug)}
              >
                <div className="font-medium text-white">{page.title}</div>
                <div className="mt-1 text-xs text-slate-300">{page.pageType} · {page.goal}</div>
                <div className="mt-1 text-xs text-slate-400">Build: {page.buildStatus} · Approval: {page.approvalStatus}</div>
              </button>
            ))}
            {!pageRows.length ? <div className="rounded-xl border border-white/12 bg-slate-900/60 px-3 py-4 text-slate-300">No pages yet.</div> : null}
          </div>
        </section>

        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h3 className="text-base font-semibold text-white">Page details</h3>
          {selectedBuildPage ? (
            <div className="mt-3 space-y-3 text-xs text-slate-200">
              <div>Selected page: {selectedBuildPage.title}</div>
              <div>Shell template: {selectedBuildPage.shell}</div>
              <div>Sections: {(selectedBuildPage.sections ?? []).length}</div>
              <div>Approval state: {pageApprovalState.kind === "ready" ? "ready" : pageApprovalState.kind}</div>
              <button
                type="button"
                className="rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-3 py-2 text-cyan-100"
                onClick={() => {
                  setApprovedPageSlugs((prev) => (prev.includes(selectedBuildPage.slug) ? prev : [...prev, selectedBuildPage.slug]));
                }}
              >
                {pageApprovalState.kind === "ready" ? pageApprovalState.buttonLabel : "Approve selected page"}
              </button>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-300">No pages are ready for review yet.</div>
          )}
        </section>
      </div>
    );
  }

  function renderBuildAssets() {
    const symbolInventory = snapshot?.thriveIntelligence?.symbolInventory ?? [];
    const warnings = [
      ...(snapshot?.thriveIntelligence?.warnings ?? []),
      ...(currentSession?.executionResult?.warnings ?? []),
      ...(currentSession?.executionResult?.errors ?? []),
    ];

    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h3 className="text-base font-semibold text-white">Asset intelligence</h3>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200 md:grid-cols-4">
            <div><dt className="text-slate-400">Thrive detected</dt><dd>{isThriveDetected ? "Yes" : "No"}</dd></div>
            <div><dt className="text-slate-400">Template count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveTemplate ?? 0}</dd></div>
            <div><dt className="text-slate-400">Layout count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.thriveLayout ?? 0}</dd></div>
            <div><dt className="text-slate-400">Symbol count</dt><dd>{snapshot?.thriveIntelligence?.primitiveCounts.tcbSymbol ?? 0}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h3 className="text-base font-semibold text-white">Top symbols</h3>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Builder payload present</th>
                </tr>
              </thead>
              <tbody>
                {symbolInventory.slice(0, 8).map((symbol) => (
                  <tr key={symbol.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{symbol.id}</td>
                    <td className="px-2 py-2">{symbol.title || "Untitled"}</td>
                    <td className="px-2 py-2">{symbol.taxonomy.name ?? "Uncategorized"}</td>
                    <td className="px-2 py-2">{symbol.hasBuilderContent ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {!symbolInventory.length ? <tr><td colSpan={4} className="px-2 py-3 text-slate-400">No symbol inventory available yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h3 className="text-base font-semibold text-white">Warnings</h3>
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-200">
            {warnings.length ? warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>) : <li>No warnings detected.</li>}
          </ul>
        </section>
      </div>
    );
  }

  function renderBuild() {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {buildTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveBuildTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeBuildTab === tab.id
                  ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                  : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeBuildTab === "plan" ? renderBuildPlan() : null}
        {activeBuildTab === "pages" ? renderBuildPages() : null}
        {activeBuildTab === "assets" ? renderBuildAssets() : null}
      </div>
    );
  }

  function renderPublish() {
    const readyCount = publishChecklist.filter((item) => item.done).length;
    const totalCount = publishChecklist.length;

    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Readiness</h2>
          <div className="mt-3 text-sm text-slate-200">{readyCount}/{totalCount} checklist items complete.</div>
          <div className="mt-2 text-xs text-slate-300">Build mode used: {buildModeUsed ?? "not run"}</div>
          <div className="mt-1 text-xs text-slate-300">Native path available: {canUseThriveNative ? "yes" : "no"}</div>
        </section>

        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h3 className="text-base font-semibold text-white">Checklist</h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-200">
            {publishChecklist.map((item) => (
              <li key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                {item.done ? "[x]" : "[ ]"} {item.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-cyan-100">Primary action</h3>
              <p className="mt-1 text-xs text-slate-300">Promote only after Build draft succeeds.</p>
            </div>
            <button
              type="button"
              className={`rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ${!hasCompletedBuild ? "cursor-not-allowed opacity-60" : ""}`}
              disabled={!hasCompletedBuild}
            >
              Promote to Publish
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-white/12 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Diagnostics</h2>
          <div className="mt-3 text-xs text-slate-200">Storage mode: {storageSummary?.storageMode ?? "unknown"}</div>
          <div className="text-xs text-slate-200">Persistence health: {storageSummary?.persistenceHealth ?? "unknown"}</div>
          <div className="text-xs text-slate-200">Memory fallback active: {storageSummary?.fallbackActive ? "yes" : "no"}</div>
          <div className="mt-1 text-xs text-slate-300">{storageStatusMessage}</div>
          <div className="mt-3 text-xs text-slate-300">Raw Errors: {technicalError ?? "None"}</div>
          <div className="text-xs text-slate-300">Last run: {currentSession?.id ?? "none"}</div>
          <div className="text-xs text-slate-300">Last log: {runLogs[0] ? `${formatDate(runLogs[0].timestamp)} · ${runLogs[0].stage}` : "none"}</div>
        </section>
      </div>
    );
  }

  function renderView() {
    if (activeView === "setup") return renderSetup();
    if (activeView === "build") return renderBuild();
    if (activeView === "publish") return renderPublish();
    return renderSettings();
  }

  const isFirstTimeExperience = !projects.length || !pageRows.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_38%),radial-gradient(circle_at_90%_0%,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(180deg,_#050814_0%,_#0b1221_52%,_#070d19_100%)] text-slate-100">
      <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
        <section className="rounded-2xl border border-white/15 bg-slate-900/65 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">SiteForge</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">SiteForge</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Setup, build, and publish your site with a focused workflow.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-200">
                <div>Project: {activeProject?.name ?? "No project selected"}</div>
                <div className="mt-1">Thrive detected: {isThriveDetected ? "yes" : "no"}</div>
                <div className="mt-1">Connected: {isConnected ? "yes" : "no"}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveView("settings")}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activeView === "settings"
                    ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                    : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                Settings
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {primaryNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activeView === item.id
                    ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                    : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {error ? <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}
        </section>

        {storageSummary && storageSummary.persistenceHealth === "unavailable" ? (
          <section className="mt-4 rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="font-medium">Storage mode: {storageSummary.storageMode}</div>
            <div className="mt-1">{storageStatusMessage}</div>
          </section>
        ) : null}

        {isFirstTimeExperience ? (
          <section className="mt-4 rounded-2xl border border-white/12 bg-slate-900/60 p-5">
            <h2 className="text-xl font-semibold text-white">Welcome to SiteForge</h2>
            <p className="mt-2 text-sm text-slate-300">Start in Setup. Once ready, use Build tabs (Plan, Pages, Assets), then Publish.</p>
          </section>
        ) : null}

        <section className="mt-4">{renderView()}</section>
      </main>
    </div>
  );
}
