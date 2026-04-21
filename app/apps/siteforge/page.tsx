"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brainTheme } from "@/components/brain-dock/brainTheme";
import { brandToneOptions, homepageStrategyModes, websiteGoalOptions } from "@/lib/siteforge/contracts";
import { normalizeNewProjectName } from "@/lib/siteforge/newProjectName";
import { ProjectNameSaveState, shouldPersistProjectName } from "@/lib/siteforge/projectNameAutosave";
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
type OpenProjectResult =
  | { ok: true }
  | { ok: false; reason: "superseded" | "failed"; message?: string };
type SimpleStepKey = "connect" | "business" | "generate" | "review" | "build" | "done";
type BuildModeUsed = "thrive_native" | "thrive_fallback" | "wordpress_fallback";

const simpleSteps: Array<{ key: SimpleStepKey; label: string }> = [
  { key: "connect", label: "Connect Site" },
  { key: "business", label: "Tell Us About Your Business" },
  { key: "generate", label: "Generate Site" },
  { key: "review", label: "Review Pages" },
  { key: "build", label: "Build in Thrive" },
  { key: "done", label: "Done" },
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

export default function SiteForgeAppPage() {
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
  const [currentStep, setCurrentStep] = useState<SimpleStepKey>("connect");
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      currentSession?.buildSpec?.pages?.map((page) => ({
        slug: page.slug,
        title: page.title,
        purpose: page.title === "Home" || page.slug === "home" ? "Primary conversion" : "Support intent",
        sections: page.sections.length,
      })) ?? [],
    [currentSession]
  );

  const isConnected = Boolean(connectionResult?.connected || savedConnection?.lastValidationStatus === "valid");
  const isThriveDetected = Boolean(connectionResult?.thriveDetected || savedConnection?.thriveDetected);
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
  const canReviewPages = hasGeneratedSitePlan;
  const canBuildInThrive = isConnected && hasGeneratedSitePlan;
  const isGenerating = currentSession?.status === "queued" || currentSession?.status === "running";
  const hasCompletedBuild = currentSession?.status === "completed" && Boolean(currentSession?.executionResult);
  const hasFatalBuildFailure = currentSession?.status === "failed";

  const buildModeUsed: BuildModeUsed | null = useMemo(() => {
    const thrive = currentSession?.executionResult?.thrive;
    if (!thrive) return null;
    if (thrive.buildModeUsed) return thrive.buildModeUsed;
    if (thrive.currentMode === "thrive_native_staging_mode" && thrive.nativeValidation?.status === "passed") {
      return "thrive_native";
    }
    if (thrive.enabled) return "thrive_fallback";
    return "wordpress_fallback";
  }, [currentSession]);

  const canUseThriveNative = useMemo(() => {
    if (!isThriveDetected) return false;
    const guardEligible = currentSession?.executionResult?.thrive?.nativeGuard?.eligible;
    if (typeof guardEligible === "boolean") return guardEligible;
    return true;
  }, [currentSession, isThriveDetected]);

  const hasPartialBuildFailure = useMemo(() => {
    if (!hasCompletedBuild) return false;
    const execution = currentSession?.executionResult;
    if (!execution) return false;
    return !execution.success || execution.warnings.length > 0 || execution.errors.length > 0;
  }, [currentSession, hasCompletedBuild]);

  const storageStatusMessage =
    storageSummary?.persistenceHealth === "unavailable"
      ? "Persistent storage unavailable. SiteForge is disabled until database storage is restored."
      : storageSummary?.persistenceHealth === "degraded"
        ? "SiteForge is running in memory mode (development/test only). Projects are not durable."
        : "Persistent Postgres storage is healthy.";

  const selectedProjectInOptions = useMemo(
    () => (selectedProjectId ? projects.some((entry) => entry.id === selectedProjectId) : true),
    [projects, selectedProjectId]
  );

  const unlockedStep: SimpleStepKey = useMemo(() => {
    if (!isConnected) return "connect";
    if (!hasBusinessInfo || !aiConfigured) return "business";
    if (!hasGeneratedSitePlan) return "generate";
    if (!hasCompletedBuild) return "review";
    if (hasPartialBuildFailure) return "build";
    return "done";
  }, [aiConfigured, hasBusinessInfo, hasCompletedBuild, hasGeneratedSitePlan, hasPartialBuildFailure, isConnected]);

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
    setCurrentStep("connect");
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
        // best-effort polling
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
    if (hasFatalBuildFailure) {
      setCurrentStep("build");
      return;
    }
    if (hasCompletedBuild) {
      setCurrentStep("done");
      return;
    }
    if (hasGeneratedSitePlan) {
      if (currentStep === "connect" || currentStep === "business" || currentStep === "generate") {
        setCurrentStep("review");
      }
      return;
    }
    if (isConnected && hasBusinessInfo) {
      if (currentStep === "connect" || currentStep === "business") setCurrentStep("generate");
      return;
    }
    if (isConnected && currentStep === "connect") {
      setCurrentStep("business");
    }
  }, [currentStep, hasBusinessInfo, hasCompletedBuild, hasFatalBuildFailure, hasGeneratedSitePlan, isConnected]);

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
      setCurrentStep("business");
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
      setCurrentStep("generate");
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
      setUserError("Please complete your business info before generating.", "generate");
      return;
    }

    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    clearErrors();

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
      setCurrentStep(mode === "generate" ? "review" : "done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : mode === "generate" ? "Failed to generate site." : "Build failed.";
      setUserError(message, mode === "generate" ? "generate" : "build");
      setCurrentStep(mode === "generate" ? "generate" : "build");
    } finally {
      setBusy(false);
    }
  }

  const currentTimeline = currentSession?.runState.timeline ?? [];

  const stepUnlocked = (key: SimpleStepKey): boolean => {
    if (key === "connect") return true;
    if (key === "business") return isConnected;
    if (key === "generate") return isConnected && hasBusinessInfo && aiConfigured;
    if (key === "review") return canReviewPages;
    if (key === "build") return canBuildInThrive;
    return hasCompletedBuild;
  };

  const stepCardTone = (key: SimpleStepKey): string => {
    if (currentStep === key) return "border-cyan-300/60 bg-cyan-500/15 text-cyan-100";
    if (stepUnlocked(key)) return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
    return "border-white/20 bg-white/5 text-slate-300";
  };

  return (
    <div className="ecomviper-hud min-h-screen text-slate-100">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-30" />

      <main className="relative mx-auto max-w-[1280px] px-6 py-8">
        <section className={`${brainTheme.glassCard} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">SiteForge</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">Simple Thrive Website Builder</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Connect your site, share your business details, generate pages, review them, then build in Thrive.
              </p>
            </div>
            <button
              type="button"
              className={brainTheme.secondaryButton}
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Hide Advanced" : "Advanced"}
            </button>
          </div>
        </section>

        {error ? (
          <section className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </section>
        ) : null}

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

        <section className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className={`${brainTheme.glassCard} h-fit p-4`}>
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Progress</div>
            <div className="mt-3 space-y-2">
              {simpleSteps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => {
                    if (stepUnlocked(step.key)) setCurrentStep(step.key);
                  }}
                  disabled={!stepUnlocked(step.key)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${stepCardTone(step.key)} ${
                    !stepUnlocked(step.key) ? "opacity-70" : ""
                  }`}
                >
                  <div className="font-semibold">{index + 1}. {step.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
              <div>Connected: {isConnected ? "yes" : "no"}</div>
              <div className="mt-1">Thrive detected: {isThriveDetected ? "yes" : "no"}</div>
              <div className="mt-1">Can use Thrive native: {canUseThriveNative ? "yes" : "no"}</div>
              <div className="mt-1">Generated pages: {pageRows.length}</div>
              <div className="mt-1">Latest run: {currentSession?.status ?? "not started"}</div>
            </div>
          </aside>

          <div className="space-y-4">
            {currentStep === "connect" ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-xl font-semibold text-slate-100">Connect Site</h2>
                <p className="mt-2 text-sm text-slate-300">Connect your WordPress site so SiteForge can build pages for you.</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={(event) => {
                        activeProjectIntentRef.current = event.target.value || null;
                        void openProject(event.target.value, "user");
                      }}
                      disabled={!projects.length || busy}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    >
                      {selectedProjectId && !selectedProjectInOptions ? <option value={selectedProjectId}>Loading selected project...</option> : null}
                      {!projects.length ? <option value="">No project selected</option> : null}
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name} · {project.status}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-400">New Project Name</label>
                    <input
                      value={newProjectName}
                      onChange={(event) => setNewProjectName(event.target.value)}
                      placeholder="e.g. iPetzo"
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className={`${brainTheme.secondaryButton} mt-2`}
                      onClick={createProject}
                      disabled={busy || !normalizeNewProjectName(newProjectName)}
                    >
                      {createStatus === "creating" ? "Creating..." : "Create Project"}
                    </button>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Rename Current Project</label>
                    <input
                      id="siteforge-project-name"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    />
                    <div className="mt-1 text-xs text-slate-400">Rename state: {projectNameSaveState}</div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Connection Label</label>
                    <input
                      value={connectionLabel}
                      onChange={(event) => setConnectionLabel(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-400">WordPress URL</label>
                    <input
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder="https://example.com"
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-400">WordPress Username</label>
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="WordPress username"
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Application Password</label>
                    <input
                      type="password"
                      value={appPassword}
                      onChange={(event) => setAppPassword(event.target.value)}
                      placeholder={savedConnection?.hasSavedSecret ? "Update password (optional)" : "WordPress application password"}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs text-slate-300">
                  <label className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2">
                    <input type="checkbox" checked={hasThriveHint} onChange={(event) => setHasThriveHint(event.target.checked)} />
                    Thrive already installed
                  </label>
                  <div>{connectionResult?.message ?? "Connection not checked yet."}</div>
                </div>

                {createStatusMessage ? <div className="mt-2 text-xs text-slate-300">{createStatusMessage}</div> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" data-testid="siteforge-validate-connection-action" className={brainTheme.glowButton} onClick={saveAndValidateConnection} disabled={busy || !selectedProjectId}>
                    Validate Connection
                  </button>
                  {savedConnection ? (
                    <button type="button" className={brainTheme.secondaryButton} onClick={revalidateConnection} disabled={busy || !selectedProjectId}>
                      Recheck Connection
                    </button>
                  ) : null}
                  {isConnected ? (
                    <button type="button" className={brainTheme.secondaryButton} onClick={() => setCurrentStep("business")}>Continue</button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {currentStep === "business" ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-xl font-semibold text-slate-100">Tell Us About Your Business</h2>
                <p className="mt-2 text-sm text-slate-300">Add your business details so SiteForge can generate the right pages and messaging.</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="siteforge-brief-business-name" className="text-xs text-slate-300">Business name</label>
                    <input id="siteforge-brief-business-name" value={briefForm.businessName} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessName: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-business-type" className="text-xs text-slate-300">Business type</label>
                    <input id="siteforge-brief-business-type" value={briefForm.businessType} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessType: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="siteforge-brief-business-description" className="text-xs text-slate-300">What does your business do?</label>
                    <textarea id="siteforge-brief-business-description" value={briefForm.businessDescription} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessDescription: event.target.value }))} className="mt-1 h-20 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-target-audience" className="text-xs text-slate-300">Target audience</label>
                    <input id="siteforge-brief-target-audience" value={briefForm.targetAudience} onChange={(event) => setBriefForm((prev) => ({ ...prev, targetAudience: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-main-offer" className="text-xs text-slate-300">Main offer</label>
                    <input id="siteforge-brief-main-offer" value={briefForm.mainOffer} onChange={(event) => setBriefForm((prev) => ({ ...prev, mainOffer: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-goal" className="text-xs text-slate-300">Main goal</label>
                    <select id="siteforge-brief-goal" value={briefForm.websiteGoal} onChange={(event) => setBriefForm((prev) => ({ ...prev, websiteGoal: event.target.value as WebsiteBriefForm["websiteGoal"] }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm">
                      {websiteGoalOptions.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-tone" className="text-xs text-slate-300">Brand tone</label>
                    <select id="siteforge-brief-tone" value={briefForm.brandTone} onChange={(event) => setBriefForm((prev) => ({ ...prev, brandTone: event.target.value as WebsiteBriefForm["brandTone"] }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm">
                      {brandToneOptions.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="siteforge-ai-key" className="text-xs text-slate-300">OpenAI API key</label>
                    <input id="siteforge-ai-key" type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} placeholder={activeProject?.hasSavedAiSecret ? "Enter key to replace saved key" : "sk-..."} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="siteforge-serpapi-key" className="text-xs text-slate-300">SerpApi API key (optional)</label>
                    <input id="siteforge-serpapi-key" type="password" value={serpApiKey} onChange={(event) => setSerpApiKey(event.target.value)} placeholder={activeProject?.hasSavedSerpApiSecret ? "Enter key to replace saved key" : "serpapi-..."} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="siteforge-ai-model" className="text-xs text-slate-300">AI model</label>
                    <select id="siteforge-ai-model" value={aiModel} onChange={(event) => setAiModel(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm">
                      <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                      <option value="gpt-4.1">gpt-4.1</option>
                      <option value="gpt-5-mini">gpt-5-mini</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-300">Business info save state: {briefSaveState} · AI status: {aiStatusMessage ?? "not configured"}</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={brainTheme.secondaryButton} onClick={() => saveAiConfig("save")} disabled={busy}>Save API Keys</button>
                  <button type="button" className={brainTheme.secondaryButton} onClick={removeAiKey} disabled={busy || (!activeProject?.hasSavedAiSecret && !activeProject?.hasSavedSerpApiSecret)}>Remove Saved Keys</button>
                  <button type="button" data-testid="siteforge-business-continue-action" className={brainTheme.glowButton} onClick={saveWebsiteBrief} disabled={busy || !selectedProjectId}>Continue</button>
                </div>
              </section>
            ) : null}

            {currentStep === "generate" ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-xl font-semibold text-slate-100">Generate Site</h2>
                <p className="mt-2 text-sm text-slate-300">Generate your initial site package and page plan.</p>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                  <div>Connected: {isConnected ? "yes" : "no"}</div>
                  <div className="mt-1">Business info complete: {hasBusinessInfo ? "yes" : "no"}</div>
                  <div className="mt-1">AI configured: {aiConfigured ? "yes" : "no"}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" data-testid="siteforge-generate-site-action" className={brainTheme.glowButton} onClick={() => void runSitePipeline("generate")} disabled={busy || !isConnected || !hasBusinessInfo || !aiConfigured}>
                    Generate Site
                  </button>
                  {hasGeneratedSitePlan ? (
                    <button type="button" className={brainTheme.secondaryButton} onClick={() => setCurrentStep("review")}>Continue</button>
                  ) : null}
                </div>
                {isGenerating ? <div className="mt-3 text-xs text-cyan-200">Generating your site plan…</div> : null}
              </section>
            ) : null}

            {currentStep === "review" ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-xl font-semibold text-slate-100">Review Pages</h2>
                <p className="mt-2 text-sm text-slate-300">Check the generated pages before building in Thrive.</p>

                <div className="mt-4 overflow-auto">
                  <table className="min-w-full text-left text-sm text-slate-300">
                    <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                      <tr>
                        <th className="px-2 py-2">Page</th>
                        <th className="px-2 py-2">Purpose</th>
                        <th className="px-2 py-2">Sections</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((page) => (
                        <tr key={page.slug} className="border-t border-white/10">
                          <td className="px-2 py-2">{page.title}</td>
                          <td className="px-2 py-2">{page.purpose}</td>
                          <td className="px-2 py-2">{page.sections}</td>
                        </tr>
                      ))}
                      {!pageRows.length ? (
                        <tr>
                          <td colSpan={3} className="px-2 py-3 text-slate-400">No pages yet. Generate your site first.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={brainTheme.glowButton} onClick={() => setCurrentStep("build")} disabled={!canReviewPages}>
                    Continue
                  </button>
                  {!canReviewPages ? <div className="text-xs text-slate-400">Generate Site first to review pages.</div> : null}
                </div>
              </section>
            ) : null}

            {currentStep === "build" ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-xl font-semibold text-slate-100">Build in Thrive</h2>
                <p className="mt-2 text-sm text-slate-300">Build your generated site using Thrive-native execution when available.</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                    <div>Thrive detected: {isThriveDetected ? "yes" : "no"}</div>
                    <div className="mt-1">Native path available: {canUseThriveNative ? "yes" : "no"}</div>
                    <div className="mt-1">Current mode: {buildModeUsed ?? "not run"}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                    <div>Homepage strategy</div>
                    <select
                      value={homepageStrategy}
                      onChange={(event) => setHomepageStrategy(event.target.value as HomepageStrategy)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
                    >
                      {homepageStrategyModes.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!canUseThriveNative ? (
                  <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    Thrive was detected, but the native build path is currently blocked.
                  </div>
                ) : null}

                {hasPartialBuildFailure ? (
                  <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    We created some pages, but a few steps still need attention.
                  </div>
                ) : null}

                {hasFatalBuildFailure ? (
                  <div className="mt-3 rounded-xl border border-rose-300/40 bg-rose-500/10 p-3 text-xs text-rose-100">
                    Your WordPress site connected, but the build failed.
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" data-testid="siteforge-build-in-thrive-action" className={brainTheme.glowButton} onClick={() => void runSitePipeline("build")} disabled={busy || !canBuildInThrive}>
                    Build in Thrive
                  </button>
                  <button type="button" className={brainTheme.secondaryButton} onClick={() => setCurrentStep("done")} disabled={!hasCompletedBuild}>
                    Finish
                  </button>
                </div>
              </section>
            ) : null}

            {currentStep === "done" ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-xl font-semibold text-slate-100">Done</h2>
                <p className="mt-2 text-sm text-slate-300">Your latest run is complete. You can rebuild anytime from Build in Thrive.</p>
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                  <div>Build mode used: {buildModeUsed ?? "not available"}</div>
                  <div className="mt-1">Completed: {hasCompletedBuild ? "yes" : "no"}</div>
                  <div className="mt-1">Latest run: {currentSession?.status ?? "none"}</div>
                  <div className="mt-1">Last updated: {formatDate(currentSession?.createdAt)}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={brainTheme.secondaryButton} onClick={() => setCurrentStep("review")}>Review Pages</button>
                  <button type="button" className={brainTheme.glowButton} onClick={() => setCurrentStep("build")}>Build in Thrive</button>
                </div>
              </section>
            ) : null}

            {showAdvanced ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-lg font-semibold text-slate-100">Advanced</h2>
                <p className="mt-2 text-sm text-slate-300">Technical details, diagnostics, run history, and raw errors.</p>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                    <h3 className="text-sm font-semibold text-slate-100">Run History</h3>
                    <div className="mt-2 space-y-1">
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => setCurrentSessionId(session.id)}
                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-left"
                        >
                          {formatDate(session.createdAt)} · {session.type} · {session.status} · {session.runState.currentStage}
                        </button>
                      ))}
                      {!sessions.length ? <div>No run history yet.</div> : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                    <h3 className="text-sm font-semibold text-slate-100">Diagnostics</h3>
                    <div className="mt-2 space-y-1">
                      <div>Execution mode: {currentSession?.executionResult?.thrive.executionMode ?? "unknown"}</div>
                      <div>Current mode: {currentSession?.executionResult?.thrive.currentMode ?? "unknown"}</div>
                      <div>Native guard eligible: {currentSession?.executionResult?.thrive.nativeGuard?.eligible ? "yes" : "no"}</div>
                      <div>Native validation: {currentSession?.executionResult?.thrive.nativeValidation?.status ?? "not run"}</div>
                      <div>Warnings: {currentSession?.executionResult?.warnings.length ?? 0}</div>
                      <div>Errors: {currentSession?.executionResult?.errors.length ?? 0}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-100">Timeline</h3>
                    <div className="mt-2 space-y-1">
                      {currentTimeline.map((entry, index) => (
                        <div key={`${entry.at}-${index}`}>{formatDate(entry.at)} · {entry.stage} · {entry.level} · {entry.message}</div>
                      ))}
                      {!currentTimeline.length ? <div>No timeline entries.</div> : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-100">Run Logs</h3>
                    <div className="mt-2 max-h-56 space-y-1 overflow-auto">
                      {runLogs.map((log) => (
                        <div key={log.logId}>{formatDate(log.timestamp)} · {log.stage} · {log.level} · {log.message}</div>
                      ))}
                      {!runLogs.length ? <div>No run logs yet.</div> : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-100">Raw Errors</h3>
                    <div className="mt-2">{technicalError ?? "None"}</div>
                    <div className="mt-2">Session error summary: {currentSession?.errorSummary ?? "None"}</div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-100">Snapshot</h3>
                    <div className="mt-2">Homepage: {snapshot?.currentHomepageTitle ?? "unknown"}</div>
                    <div className="mt-1">Known pages: {snapshot?.knownPages.length ?? 0}</div>
                    <div className="mt-1">Thrive symbols: {snapshot?.thriveIntelligence?.symbolSummary.total ?? 0}</div>
                    <div className="mt-1">Section resolutions: {snapshot?.thriveSectionResolutions.length ?? 0}</div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
