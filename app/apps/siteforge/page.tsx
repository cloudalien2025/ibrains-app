"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { brainTheme } from "@/components/brain-dock/brainTheme";
import { brandToneOptions, websiteGoalOptions } from "@/lib/siteforge/contracts";
import {
  BuildSessionView as BuildSession,
  BuildStage,
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
import { normalizeNewProjectName } from "@/lib/siteforge/newProjectName";
import { ProjectNameSaveState, shouldPersistProjectName } from "@/lib/siteforge/projectNameAutosave";

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

type CreateStatus = "idle" | "creating" | "created" | "error";
type OpenProjectResult =
  | { ok: true }
  | { ok: false; reason: "superseded" | "failed"; message?: string };

type AgencyNavKey =
  | "mission_control"
  | "strategy"
  | "brand"
  | "funnels"
  | "pages"
  | "global_assets"
  | "thrive_intelligence"
  | "experiments"
  | "publish"
  | "settings";

type BuildTabKey = "plan" | "pages" | "assets";

type AgencyStatus =
  | "Not started"
  | "Researching"
  | "Drafting"
  | "Recommended"
  | "Awaiting approval"
  | "Approved"
  | "Building"
  | "Built"
  | "Needs revision"
  | "Blocked";

type ConfidenceLevel = "Low" | "Medium" | "High" | "Verified";

type AgentRosterEntry = {
  id: string;
  displayName: string;
  specialty: string;
  mission: string;
  currentTask: string;
  status: AgencyStatus;
  confidence: ConfidenceLevel;
  ownedObjects: string[];
  outputs: string[];
  blockers?: string[];
};

const visibleSteps: BuildStage[] = ["planning", "writing", "building", "reviewing", "finalizing"];

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

function Stepper({ stage }: { stage: BuildStage }) {
  const activeIndex = Math.max(0, visibleSteps.findIndex((entry) => entry === stage));

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        {visibleSteps.map((step, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;
          const tone = complete
            ? "border-emerald-300/60 bg-emerald-300/20 text-emerald-100"
            : active
              ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
              : "border-white/20 bg-white/5 text-slate-300";

          return (
            <div key={step} className="flex min-w-max items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${tone}`}>
                {index + 1}
              </div>
              <div className="text-sm font-medium capitalize text-slate-100">{step}</div>
              {index < visibleSteps.length - 1 ? (
                <div className={`h-px w-12 ${index < activeIndex ? "bg-emerald-300/50" : "bg-white/15"}`} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [refinePrompt, setRefinePrompt] = useState("");
  const [builderPrompt, setBuilderPrompt] = useState("");

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
  const [activeNav, setActiveNav] = useState<AgencyNavKey>("settings");
  const [activeBuildTab, setActiveBuildTab] = useState<BuildTabKey>("plan");
  const [pageStudioSlug, setPageStudioSlug] = useState<string | null>(null);
  const [assetsTab, setAssetsTab] = useState<
    "headers" | "footers" | "symbols" | "sections" | "templates" | "layouts" | "cta_blocks" | "faqs" | "testimonials"
  >("symbols");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectNameSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectNameSaveSeqRef = useRef(0);
  const loadProjectsSeqRef = useRef(0);
  const openProjectSeqRef = useRef(0);
  const activeProjectIntentRef = useRef<string | null>(null);

  const currentSession = useMemo(
    () => sessions.find((entry) => entry.id === currentSessionId) ?? null,
    [sessions, currentSessionId]
  );
  const activeProject = useMemo(
    () => projects.find((entry) => entry.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const activeProjectId = activeProject?.id ?? null;
  const hasValidActiveProject = Boolean(activeProjectId && selectedProjectId === activeProjectId);
  const thriveIntel = snapshot?.thriveIntelligence ?? currentSession?.executionResult?.thrive.intelligence ?? null;
  const thriveExecutionMode = currentSession?.executionResult?.thrive.executionMode ?? "wp_safe_mode";
  const thriveRuntime = currentSession?.executionResult?.thrive.runtime ?? snapshot?.thriveModeSummary ?? {
    wpSafeMode: true,
    thriveIntelMode: false,
    stagingNativeMode: false,
  };
  const thriveCurrentMode =
    currentSession?.executionResult?.thrive.currentMode ??
    (thriveRuntime.stagingNativeMode
      ? "thrive_native_staging_mode"
      : thriveRuntime.thriveIntelMode
        ? "thrive_intel_mode"
        : "wp_safe_mode");
  const thriveNativeGuard =
    currentSession?.executionResult?.thrive.nativeGuard ?? snapshot?.thriveNativeGuard ?? null;
  const thriveNativeComposition =
    currentSession?.executionResult?.thrive.nativeComposition ?? snapshot?.thriveNativeComposition ?? null;
  const thriveNativeExecution =
    currentSession?.executionResult?.thrive.nativeExecution ?? snapshot?.thriveNativeExecution ?? null;
  const thriveNativeValidation =
    currentSession?.executionResult?.thrive.nativeValidation ?? snapshot?.thriveNativeValidation ?? null;
  const marketIntelligence = currentSession?.marketIntelligence ?? snapshot?.marketIntelligence ?? null;
  const thriveSectionResolutions =
    currentSession?.executionResult?.thrive.sectionResolutions ?? snapshot?.thriveSectionResolutions ?? [];
  const reusableSummary = useMemo(
    () => ({
      reusableNow: thriveSectionResolutions.filter((entry) => entry.resolution === "existing_symbol").length,
      safeWritableNow: thriveSectionResolutions.filter((entry) => entry.preferredRenderTarget === "wordpress_page_content" || entry.preferredRenderTarget === "wp_html_fallback").length,
      stagedOnly: thriveSectionResolutions.filter(
        (entry) =>
          entry.preferredRenderTarget === "future_landing_page_candidate" ||
          entry.preferredRenderTarget === "future_thrive_template_assignment"
      ).length,
    }),
    [thriveSectionResolutions]
  );
  const visualCompositionSummary = useMemo(() => {
    const byType = (type: string) => thriveSectionResolutions.find((entry) => entry.sectionType === type);
    const hero = byType("hero");
    const features = byType("features");
    const cta = byType("cta");
    const faq = byType("faq");
    const testimonial = byType("testimonials");
    const trust = byType("contact") ?? byType("problem");
    const sectionIntents = thriveNativeComposition?.sections ?? [];
    const reused = sectionIntents.filter(
      (entry) => entry.intent === "reused_existing" || entry.intent === "reused_visual_symbol"
    ).length;
    const created = sectionIntents.filter(
      (entry) =>
        entry.intent === "created_native" ||
        entry.intent === "created_visual_native_section" ||
        entry.intent === "created_visual_cta_block" ||
        entry.intent === "created_visual_faq_toggle"
    ).length;
    const fallback = sectionIntents.filter(
      (entry) =>
        entry.intent === "wp_fallback" ||
        entry.intent === "improved_visual_fallback" ||
        entry.intent === "blocked_by_guard" ||
        entry.intent === "blocked_by_missing_contract"
    ).length;
    const lowDesignWarnings = thriveSectionResolutions
      .filter((entry) => !entry.designIntentSatisfied || entry.primitiveSelectionSource === "safe_fallback")
      .map((entry) => `${entry.sectionType}:${entry.fallbackReason ?? "safe_fallback"}`);

    return {
      hero: hero?.visualPattern ?? "n/a",
      features: features?.visualPattern ?? "n/a",
      cta: cta?.visualPattern ?? "n/a",
      faq: faq?.visualPattern ?? "n/a",
      testimonial: testimonial?.visualPattern ?? "n/a",
      trust: trust?.visualPattern ?? "n/a",
      reused,
      created,
      fallback,
      lowDesignWarnings,
    };
  }, [thriveSectionResolutions, thriveNativeComposition]);
  const selectedProjectInOptions = useMemo(
    () => (selectedProjectId ? projects.some((entry) => entry.id === selectedProjectId) : true),
    [projects, selectedProjectId]
  );

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
    setRefinePrompt("");
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
      if (!incoming && hasLocalDraft) {
        return prev;
      }
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
      workspace.project.hasSavedAiSecret || workspace.project.hasSavedSerpApiSecret
        ? "API keys saved"
        : "No API keys configured"
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
    if (
      !shouldPersistProjectName({
        selectedProjectId: activeProjectId ?? "",
        projectName,
        persistedProjectName,
      })
    ) {
      return;
    }

    const seq = projectNameSaveSeqRef.current + 1;
    projectNameSaveSeqRef.current = seq;
    setProjectNameSaveState("saving");

    try {
      if (!activeProjectId) {
        setProjectNameSaveState("error");
        setError("No active project selected.");
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
      if (!workspace) {
        throw new Error("Project rename response was invalid.");
      }

      if (projectNameSaveSeqRef.current !== seq) return;
      await applyWorkspace(workspace);
      setProjectNameSaveState("saved");
    } catch (err: unknown) {
      if (projectNameSaveSeqRef.current !== seq) return;
      setProjectNameSaveState("error");
      setError(err instanceof Error ? err.message : "Failed to save project name.");
    }
  }

  async function ensureCanonicalActiveProjectId(): Promise<string | null> {
    if (hasValidActiveProject && activeProjectId) {
      return activeProjectId;
    }

    const candidateProjectId = selectedProjectId || activeProjectIntentRef.current;
    if (!candidateProjectId) {
      setError("No active project selected.");
      return null;
    }

    setError("Selected project is out of sync. Reloading project state.");
    activeProjectIntentRef.current = candidateProjectId;
    const openResult = await openProject(candidateProjectId, "workspace");
    if (!openResult.ok) {
      activeProjectIntentRef.current = null;
      setSelectedProjectId("");
      setError(openResult.message ?? "Active project is no longer available.");
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
    setError(null);

    try {
      setSelectedProjectId(projectId);
      const payload = await fetchJson<unknown>(`/api/siteforge/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        body: JSON.stringify({ markOpened: true }),
      });
      const workspace = normalizeWorkspace(payload);
      if (!workspace) {
        throw new Error("Invalid SiteForge workspace payload.");
      }
      if (openProjectSeqRef.current !== openSeq) return { ok: false, reason: "superseded" };
      await applyWorkspace(workspace);
      return { ok: true };
    } catch (err: unknown) {
      if (openProjectSeqRef.current !== openSeq) return { ok: false, reason: "superseded" };
      const message = err instanceof Error ? err.message : "Failed to load workspace.";
      setError(message);
      setSelectedProjectId("");
      setSessions([]);
      setRunLogs([]);
      setCurrentSessionId(null);
      setSnapshot(null);
      setSavedConnection(null);
      return { ok: false, reason: "failed", message };
    } finally {
      if (openProjectSeqRef.current === openSeq) {
        setBusy(false);
      }
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
    if (
      intendedProjectId &&
      data.projects.some((project) => project.id === intendedProjectId) &&
      selectedProjectId !== intendedProjectId
    ) {
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
    const payload = (await res.json().catch(() => null)) as
      | { summary?: StorageSummary; error?: { message?: string } }
      | null;
    if (payload?.summary) {
      setStorageSummary(payload.summary);
      if (!res.ok && payload.error?.message) {
        setError(payload.error.message);
      }
      return;
    }
    if (!res.ok && payload?.error?.message) {
      setError(payload.error.message);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadStorageSummary();
        await loadProjects();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load SiteForge projects.");
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
        const data = await fetchJson<{ session?: unknown }>(
          `/api/siteforge/sessions/${encodeURIComponent(currentSessionId)}`
        );
        const normalizedSession = normalizeSession(data?.session, activeProject?.id ?? selected.id);
        if (!normalizedSession) return;
        setSessions((prev) => [normalizedSession, ...prev.filter((entry) => entry.id !== normalizedSession.id)]);
      } catch {
        // Polling is best-effort to keep workspace responsive.
      }
    }, 1700);

    return () => window.clearInterval(timer);
  }, [activeProject, currentSessionId, sessions]);

  useEffect(() => {
    if (
      !shouldPersistProjectName({
        selectedProjectId: activeProjectId ?? "",
        projectName,
        persistedProjectName,
      })
    ) {
      return;
    }

    setProjectNameSaveState("idle");
    if (projectNameSaveTimerRef.current) {
      clearTimeout(projectNameSaveTimerRef.current);
    }

    projectNameSaveTimerRef.current = setTimeout(() => {
      void persistProjectNameUpdate();
    }, 500);

    return () => {
      if (projectNameSaveTimerRef.current) {
        clearTimeout(projectNameSaveTimerRef.current);
      }
    };
  }, [activeProjectId, persistedProjectName, projectName]);

  async function createProject() {
    const createName = normalizeNewProjectName(newProjectName);
    if (!createName) {
      setCreateStatus("error");
      setCreateStatusMessage("New Project Name is required.");
      return;
    }

    loadProjectsSeqRef.current += 1;
    setBusy(true);
    setError(null);
    setCreateStatus("creating");
    setCreateStatusMessage(null);

    try {
      const payload = await fetchJson<unknown>("/api/siteforge/projects", {
        method: "POST",
        body: JSON.stringify({
          name: createName,
          description: "Persistent SiteForge workspace",
        }),
      });
      const normalized = normalizeProjectPayload(payload);
      if (!normalized) {
        throw new Error("Project create response was invalid.");
      }

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
      setError(err instanceof Error ? err.message : "Project creation failed.");
      setCreateStatus("error");
      setCreateStatusMessage(err instanceof Error ? err.message : "Project creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAndValidateConnection() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    setError(null);

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
      if (
        err instanceof Error &&
        (err.message === "Project not found." || err.message === "Project not found for current user.")
      ) {
        setError("Selected project could not be loaded.");
      } else {
        setError(err instanceof Error ? err.message : "Connection validation failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function revalidateConnection() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    setError(null);

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
      if (
        err instanceof Error &&
        (err.message === "Project not found." || err.message === "Project not found for current user.")
      ) {
        setError("Selected project could not be loaded.");
      } else {
        setError(err instanceof Error ? err.message : "Revalidation failed.");
      }
    } finally {
      setBusy(false);
    }
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
    return Boolean(
      payload.businessName &&
        payload.businessType &&
        payload.businessDescription &&
        payload.targetAudience &&
        payload.mainOffer
    );
  }

  async function saveWebsiteBrief() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;
    if (!briefIsValid()) {
      setError("Please complete all required Website Brief fields before saving.");
      return;
    }

    setBusy(true);
    setBriefSaveState("saving");
    setError(null);

    try {
      const payload = await fetchJson<unknown>(`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          websiteBrief: briefPayload(),
          currentState: "workspace",
        }),
      });
      const workspace = normalizeWorkspace(payload);
      if (!workspace) {
        throw new Error("Website brief save response was invalid.");
      }
      await applyWorkspace(workspace);
      setBriefSaveState("saved");
    } catch (err: unknown) {
      setBriefSaveState("error");
      setError(err instanceof Error ? err.message : "Failed to save Website Brief.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAiConfig(mode: "save" | "update") {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;
    if (!aiApiKey.trim() && !serpApiKey.trim() && mode === "save") {
      setError("Provide at least one API key (OpenAI or SerpApi).");
      return;
    }

    setBusy(true);
    setError(null);

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
      if (!workspace) {
        throw new Error("AI config response was invalid.");
      }
      await applyWorkspace(workspace);
      setAiApiKey("");
      setSerpApiKey("");
      setAiStatusMessage(data.ai.status === "saved" ? "API keys saved" : "No API keys configured");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save API configuration.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAiKey() {
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    setError(null);

    try {
      const data = await fetchJson<{ workspace: unknown }>(
        `/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/ai`,
        {
          method: "DELETE",
        }
      );
      const workspace = normalizeWorkspace(data.workspace);
      if (!workspace) {
        throw new Error("AI config removal response was invalid.");
      }
      await applyWorkspace(workspace);
      setAiApiKey("");
      setSerpApiKey("");
      setAiStatusMessage("No API keys configured");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove API keys.");
    } finally {
      setBusy(false);
    }
  }

  async function generateSite() {
    if (!briefIsValid()) {
      setError("Please complete the Website Brief before generating.");
      return;
    }
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    setError(null);

    try {
      const data = await fetchJson<{ session: BuildSession }>(
        `/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/build`,
        {
          method: "POST",
          body: JSON.stringify({
            websiteBrief: briefPayload(),
            connectionId: savedConnection?.connectionId,
            homepageStrategy,
            connection: {
              label: connectionLabel,
              baseUrl,
              username,
              appPassword: appPassword || undefined,
              hasThriveHint,
            },
          }),
        }
      );

      setSessions((prev) => [data.session, ...prev.filter((entry) => entry.id !== data.session.id)]);
      setCurrentSessionId(data.session.id);
      setAppPassword("");
      activeProjectIntentRef.current = targetProjectId;
      await openProject(targetProjectId, "workspace");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start SiteForge build.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRefinement() {
    if (!currentSessionId || !refinePrompt.trim()) return;
    const targetProjectId = await ensureCanonicalActiveProjectId();
    if (!targetProjectId) return;

    setBusy(true);
    setError(null);

    try {
      await fetchJson<{ ok: true }>(`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/refine`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: currentSessionId,
          connectionId: savedConnection?.connectionId,
          message: refinePrompt,
          connection: {
            label: connectionLabel,
            baseUrl,
            username,
            appPassword: appPassword || undefined,
            hasThriveHint,
          },
        }),
      });
      setRefinePrompt("");
      setAppPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Refinement request failed.");
    } finally {
      setBusy(false);
    }
  }

  const activity = currentSession?.runState.timeline ?? [];
  const storageStatusMessage =
    storageSummary?.persistenceHealth === "unavailable"
      ? "Persistent storage unavailable. SiteForge is disabled until database storage is restored."
      : storageSummary?.persistenceHealth === "degraded"
        ? "SiteForge is running in memory mode (development/test only). Projects are not durable."
        : "Persistent Postgres storage is healthy.";

  const primaryNavItems: Array<{ key: AgencyNavKey; label: string }> = [
    { key: "settings", label: "Setup" },
    { key: "mission_control", label: "Build" },
    { key: "publish", label: "Publish" },
  ];

  const agencyTeam: AgentRosterEntry[] = [
    {
      id: "strategy_director",
      displayName: "Strategy Director",
      specialty: "Positioning and market strategy",
      mission: "Approve strategic direction and market narrative.",
      currentTask: "Align value proposition and roadmap.",
      status: "Recommended",
      confidence: marketIntelligence?.status === "used" ? "High" : "Medium",
      ownedObjects: ["positioning", "sitemap", "go-to-market"],
      outputs: ["Strategy decisions", "Sitemap recommendation"],
    },
    {
      id: "brand_director",
      displayName: "Brand Director",
      specialty: "Identity and visual system",
      mission: "Define brand rules and token consistency.",
      currentTask: "Finalize brand personality and token set.",
      status: "Drafting",
      confidence: "Medium",
      ownedObjects: ["brand identity", "design tokens"],
      outputs: ["Brand rules", "Theme mapping"],
    },
    {
      id: "theme_shell_architect",
      displayName: "Theme Shell Architect",
      specialty: "Thrive shell templates and layout systems",
      mission: "Map pages to shell templates and layout systems.",
      currentTask: "Recommend homepage shell template.",
      status: "Awaiting approval",
      confidence: thriveIntel ? "High" : "Low",
      ownedObjects: ["shell templates", "layout systems"],
      outputs: ["Shell recommendation"],
    },
    {
      id: "content_architect",
      displayName: "Content Architect",
      specialty: "Section architecture and narrative flow",
      mission: "Structure page section stacks for conversion.",
      currentTask: "Finalize homepage section stack.",
      status: "Recommended",
      confidence: "High",
      ownedObjects: ["section stack", "content hierarchy"],
      outputs: ["Page section briefs"],
    },
    {
      id: "copy_chief",
      displayName: "Copy Chief",
      specialty: "Messaging and CTA language",
      mission: "Craft conversion-oriented copy variants.",
      currentTask: "Refine hero and final CTA variants.",
      status: "Drafting",
      confidence: "Medium",
      ownedObjects: ["headline library", "CTA language"],
      outputs: ["Copy variants", "Objection handling"],
    },
    {
      id: "thrive_asset_librarian",
      displayName: "Thrive Asset Librarian",
      specialty: "Reusable Thrive assets and matching",
      mission: "Recommend reusable blocks and symbols.",
      currentTask: "Audit symbol inventory and confidence matches.",
      status: thriveIntel ? "Researching" : "Blocked",
      confidence: thriveIntel ? "High" : "Low",
      ownedObjects: ["reusable blocks", "section assets", "symbols"],
      outputs: ["Asset recommendations", "Deprecation notes"],
      blockers: thriveIntel ? [] : ["Thrive inventory not available"],
    },
    {
      id: "builder_operations",
      displayName: "Builder Operations Agent",
      specialty: "Build sequencing and operational safety",
      mission: "Coordinate ready-for-build handoff safely.",
      currentTask: "Track section readiness and build queue.",
      status: currentSession?.status === "running" ? "Building" : "Not started",
      confidence: currentSession?.status === "completed" ? "Verified" : "Medium",
      ownedObjects: ["build queue", "readiness checklist"],
      outputs: ["Build package", "run summary"],
    },
    {
      id: "cro_analyst",
      displayName: "CRO Analyst",
      specialty: "Conversion opportunities and experiments",
      mission: "Propose high-impact test hypotheses.",
      currentTask: "Prioritize CTA and trust-strip experiments.",
      status: "Researching",
      confidence: "Medium",
      ownedObjects: ["experiments backlog", "evidence notes"],
      outputs: ["Experiment briefs", "expected lift estimates"],
    },
    {
      id: "qa_publish",
      displayName: "QA / Publish Agent",
      specialty: "Readiness review and release quality",
      mission: "Verify publish checklist and approve release.",
      currentTask: "Monitor publish blockers and unresolved approvals.",
      status: "Awaiting approval",
      confidence: "High",
      ownedObjects: ["publish checklist", "audit log"],
      outputs: ["Readiness score", "publish recommendation"],
    },
  ];

  const fallbackTimelineAt = snapshot?.lastSyncedAt ?? currentSession?.createdAt ?? "1970-01-01T00:00:00.000Z";

  const approvalQueue = [
    {
      itemName: "Homepage hero direction",
      ownerAgent: "Strategy Director",
      level: "Directional approval",
      confidence: "High" as ConfidenceLevel,
      affectedPages: ["Home"],
      changeSummary: "Refined primary promise and audience targeting.",
    },
    {
      itemName: "Shell recommendation",
      ownerAgent: "Theme Shell Architect",
      level: "Structural approval",
      confidence: thriveIntel ? ("High" as ConfidenceLevel) : ("Low" as ConfidenceLevel),
      affectedPages: ["Home", "Contact"],
      changeSummary: "Map homepage to canonical shell template and content pages to standard shell.",
    },
    {
      itemName: "CTA stack",
      ownerAgent: "Copy Chief",
      level: "Content approval",
      confidence: "Medium" as ConfidenceLevel,
      affectedPages: ["Home"],
      changeSummary: "Primary CTA and secondary reassurance CTA aligned to funnel goal.",
    },
    {
      itemName: "Ready for build package",
      ownerAgent: "Builder Operations Agent",
      level: "Build approval",
      confidence: currentSession?.status === "completed" ? ("Verified" as ConfidenceLevel) : ("Medium" as ConfidenceLevel),
      affectedPages: currentSession?.buildSpec?.pages.map((page) => page.title) ?? ["Home"],
      changeSummary: "Section stack locked and quality checks prepared.",
    },
  ];

  const workstreamBoard = [
    {
      stream: "Positioning",
      owner: "Strategy Director",
      progress: marketIntelligence?.status === "used" ? 82 : 56,
      nextMilestone: "Approve strategic narrative",
      blocker: marketIntelligence?.status === "used" ? null : "Market intelligence not configured",
    },
    {
      stream: "Site Shell",
      owner: "Theme Shell Architect",
      progress: thriveIntel ? 76 : 34,
      nextMilestone: "Approve shell template map",
      blocker: thriveIntel ? null : "Thrive inventory unavailable",
    },
    {
      stream: "Homepage",
      owner: "Content Architect",
      progress: currentSession?.buildSpec ? 78 : 24,
      nextMilestone: "Approve section stack",
      blocker: null,
    },
    {
      stream: "Lead Funnel",
      owner: "Builder Operations Agent",
      progress: currentSession?.executionResult ? 61 : 20,
      nextMilestone: "Connect lead magnet path",
      blocker: "Awaiting structural approval",
    },
    {
      stream: "Blog Engine",
      owner: "Brand Director",
      progress: 28,
      nextMilestone: "Approve editorial taxonomy",
      blocker: null,
    },
    {
      stream: "Conversion System",
      owner: "CRO Analyst",
      progress: 44,
      nextMilestone: "Launch first experiment set",
      blocker: "Evidence baseline pending",
    },
  ];

  const latestDeliverables = [
    {
      title: "Homepage strategy blueprint",
      owner: "Strategy Director",
      status: "Awaiting approval" as AgencyStatus,
      at: currentSession?.createdAt ?? fallbackTimelineAt,
    },
    {
      title: "Section stack recommendation",
      owner: "Content Architect",
      status: "Recommended" as AgencyStatus,
      at: currentSession?.createdAt ?? fallbackTimelineAt,
    },
    {
      title: "Thrive reusable asset shortlist",
      owner: "Thrive Asset Librarian",
      status: thriveIntel ? ("Recommended" as AgencyStatus) : ("Blocked" as AgencyStatus),
      at: snapshot?.lastSyncedAt ?? fallbackTimelineAt,
    },
  ];

  const pageRows =
    currentSession?.buildSpec?.pages?.map((page) => {
      const resolutionCount = thriveSectionResolutions.filter((entry) => entry.pageSlug === page.slug).length;
      const approved = approvalQueue.filter((item) => item.affectedPages.includes(page.title)).length > 0;
      const pageRole = page.slug === "home" || page.slug === "" ? "homepage" : "generic";
      return {
        slug: page.slug,
        pageName: page.title,
        pageType: pageRole === "homepage" ? "Landing page" : "Standard page",
        goal: pageRole === "homepage" ? "Primary conversion" : "Support intent",
        shell: "Layout System candidate pending",
        contentStatus: page.sections.length ? "Recommended" : "Not started",
        buildStatus: currentSession?.status === "completed" ? "Built" : "Awaiting approval",
        approvalStatus: approved ? "Awaiting approval" : "Not started",
        ownerAgent: pageRole === "homepage" ? "Content Architect" : "Theme Shell Architect",
        funnel: pageRole === "homepage" ? "Primary funnel" : "Support flow",
        resolutionCount,
      };
    }) ?? [];

  const selectedPageRow = pageRows.find((page) => page.slug === pageStudioSlug) ?? pageRows[0] ?? null;
  const selectedBuildPage =
    currentSession?.buildSpec?.pages.find((page) => page.slug === (selectedPageRow?.slug ?? "")) ?? null;
  const symbolInventory = thriveIntel?.symbolInventory ?? [];
  const templateCount = thriveIntel?.primitiveCounts.thriveTemplate ?? 0;
  const layoutCount = thriveIntel?.primitiveCounts.thriveLayout ?? 0;
  const sectionCount = thriveIntel?.primitiveCounts.thriveSection ?? 0;
  const symbolCount = thriveIntel?.symbolSummary.total ?? 0;
  const hasMeaningfulAssetData = symbolCount + templateCount + layoutCount + sectionCount > 0;
  const projectSelected = Boolean(selectedProjectId && activeProject);
  const briefCompleted = briefIsValid();
  const aiConfigured = Boolean(activeProject?.hasSavedAiSecret || activeProject?.hasSavedSerpApiSecret);
  const connectionValidated = Boolean(connectionResult?.connected || savedConnection?.lastValidationStatus === "valid");
  const assetScanCompleted = hasMeaningfulAssetData;
  const setupCoreComplete = projectSelected && briefCompleted && aiConfigured && connectionValidated;
  const setupAllComplete = setupCoreComplete && assetScanCompleted;
  const connectionNeedsAttention = Boolean(
    savedConnection && savedConnection.lastValidationStatus && savedConnection.lastValidationStatus !== "valid"
  );
  const assetScanNeedsAttention = Boolean(connectionValidated && !hasMeaningfulAssetData);

  const setupSteps: Array<{
    id: string;
    label: string;
    state: "complete" | "incomplete" | "attention";
    actionLabel: string;
    action: () => void;
  }> = [
    {
      id: "project",
      label: "Project selected",
      state: projectSelected ? "complete" : "incomplete",
      actionLabel: "Open Setup",
      action: () => setActiveNav("settings"),
    },
    {
      id: "brief",
      label: "Brief completed",
      state: briefCompleted ? "complete" : "incomplete",
      actionLabel: "Complete Brief",
      action: () => setActiveNav("settings"),
    },
    {
      id: "ai",
      label: "AI configured",
      state: aiConfigured ? "complete" : "incomplete",
      actionLabel: "Configure API Keys",
      action: () => setActiveNav("settings"),
    },
    {
      id: "connection",
      label: "Connection validated",
      state: connectionValidated ? "complete" : connectionNeedsAttention ? "attention" : "incomplete",
      actionLabel: "Validate Connection",
      action: () => setActiveNav("settings"),
    },
    {
      id: "assets",
      label: "Asset scan completed",
      state: assetScanCompleted ? "complete" : assetScanNeedsAttention ? "attention" : "incomplete",
      actionLabel: connectionValidated ? "Scan Thrive Assets" : "Validate Connection",
      action: () => {
        if (connectionValidated) {
          void loadProjects();
          return;
        }
        setActiveNav("settings");
      },
    },
  ];

  const primaryThriveAction: { label: string; action: () => void } = !connectionValidated
    ? { label: "Validate Connection", action: () => setActiveNav("settings") }
    : !hasMeaningfulAssetData
      ? { label: "Scan Thrive Assets", action: () => void loadProjects() }
      : { label: "View Reusable Assets", action: () => setActiveNav("global_assets") };

  const overviewNextAction: { label: string; helper: string; action: () => void } = !projectSelected || !briefCompleted || !aiConfigured
    ? {
        label: "Complete Setup",
        helper: "Finish project details, brief, and API keys first.",
        action: () => setActiveNav("settings"),
      }
    : !connectionValidated
      ? {
          label: "Validate Connection",
          helper: "Confirm WordPress + Thrive access before scanning assets.",
          action: () => setActiveNav("settings"),
        }
      : !assetScanCompleted
        ? {
            label: "Scan Thrive Assets",
            helper: "Discover reusable templates, blocks, and layouts.",
            action: () => {
              setActiveNav("thrive_intelligence");
              void loadProjects();
            },
          }
        : !currentSession?.buildSpec
          ? {
              label: "Review Plan",
              helper: "Confirm what SiteForge intends to build.",
              action: () => setActiveNav("strategy"),
            }
          : {
              label: "Build Site Draft",
              helper: "Generate your latest draft from approved setup and plan.",
              action: generateSite,
            };

  const [pagesReviewed, setPagesReviewed] = useState(false);

  useEffect(() => {
    setPagesReviewed(false);
  }, [selectedProjectId, currentSession?.id]);

  type BuilderStepId = 1 | 2 | 3 | 4 | 5;
  type BuilderCanvasMode = "website" | "connect" | "plan" | "pages" | "build";

  const currentBuilderStep: BuilderStepId =
    !projectSelected || !briefCompleted
      ? 1
      : !aiConfigured || !connectionValidated
        ? 2
        : !currentSession?.buildSpec
          ? 3
          : !pagesReviewed
            ? 4
            : 5;

  const builderSteps: Array<{ id: BuilderStepId; label: string; description: string }> = [
    {
      id: 1,
      label: "1. Tell us about your website",
      description: "Share your business, audience, and what you want your site to do.",
    },
    {
      id: 2,
      label: "2. Connect your site",
      description: "Add your WordPress and Thrive details so SiteForge can work with your site.",
    },
    {
      id: 3,
      label: "3. Review your plan",
      description: "See the pages and structure SiteForge recommends.",
    },
    {
      id: 4,
      label: "4. Review your pages",
      description: "Check the pages, sections, and content before building.",
    },
    {
      id: 5,
      label: "5. Build your draft",
      description: "Let SiteForge create your first website draft.",
    },
  ];
  const [builderWorkspaceStep, setBuilderWorkspaceStep] = useState<BuilderStepId | null>(null);
  const maxUnlockedBuilderStep: BuilderStepId =
    !projectSelected || !briefCompleted
      ? 1
      : !aiConfigured || !connectionValidated
        ? 2
        : !currentSession?.buildSpec
          ? 3
          : !pagesReviewed
            ? 4
            : 5;

  const activeBuilderStep: BuilderStepId =
    builderWorkspaceStep && builderWorkspaceStep <= maxUnlockedBuilderStep ? builderWorkspaceStep : currentBuilderStep;

  useEffect(() => {
    if (!builderWorkspaceStep || builderWorkspaceStep > maxUnlockedBuilderStep) {
      setBuilderWorkspaceStep(currentBuilderStep);
    }
  }, [builderWorkspaceStep, currentBuilderStep, maxUnlockedBuilderStep]);

  const builderCanvasMode: BuilderCanvasMode =
    activeBuilderStep === 1
      ? "website"
      : activeBuilderStep === 2
        ? "connect"
        : activeBuilderStep === 3
          ? "plan"
          : activeBuilderStep === 4
            ? "pages"
            : "build";

  const currentStepMeta = builderSteps.find((step) => step.id === currentBuilderStep) ?? builderSteps[0];
  const activeStepMeta = builderSteps.find((step) => step.id === activeBuilderStep) ?? builderSteps[0];

  const stepTabMeta: Array<{ id: BuilderStepId; shortLabel: string; state: "done" | "current" | "locked"; unlocked: boolean }> = [
    { id: 1, shortLabel: "1. Website", state: currentBuilderStep > 1 ? "done" : "current", unlocked: true },
    {
      id: 2,
      shortLabel: "2. Connect",
      state: currentBuilderStep > 2 ? "done" : currentBuilderStep === 2 ? "current" : "locked",
      unlocked: maxUnlockedBuilderStep >= 2,
    },
    {
      id: 3,
      shortLabel: "3. Plan",
      state: currentBuilderStep > 3 ? "done" : currentBuilderStep === 3 ? "current" : "locked",
      unlocked: maxUnlockedBuilderStep >= 3,
    },
    {
      id: 4,
      shortLabel: "4. Pages",
      state: currentBuilderStep > 4 ? "done" : currentBuilderStep === 4 ? "current" : "locked",
      unlocked: maxUnlockedBuilderStep >= 4,
    },
    {
      id: 5,
      shortLabel: "5. Build",
      state: currentBuilderStep === 5 ? "current" : "locked",
      unlocked: maxUnlockedBuilderStep >= 5,
    },
  ];

  const jumpToBuilderStep = (stepId: BuilderStepId) => {
    if (stepId > maxUnlockedBuilderStep) return;
    setBuilderWorkspaceStep(stepId);
    if (stepId === 4) setPagesReviewed(false);
    if (stepId === 5) setPagesReviewed(true);
  };

  const primaryBuilderAction: { label: string; action: () => void; disabled?: boolean } =
    activeBuilderStep === 1
      ? {
          label: projectSelected ? "Save and Continue" : "Continue",
          action: () => {
            if (!projectSelected) {
              setActiveNav("settings");
              return;
            }
            void saveWebsiteBrief();
          },
          disabled: busy,
        }
      : activeBuilderStep === 2
        ? {
            label: "Check Connection",
            action: () => {
              void saveAndValidateConnection();
            },
            disabled: !selectedProjectId || busy,
          }
        : activeBuilderStep === 3
          ? {
              label: "Looks Good, Continue",
              action: () => {
                if (!currentSession?.buildSpec) {
                  void generateSite();
                  return;
                }
                jumpToBuilderStep(4);
              },
              disabled: !selectedProjectId || busy || !briefIsValid(),
            }
          : activeBuilderStep === 4
            ? {
                label: "Continue to Build",
                action: () => {
                  jumpToBuilderStep(5);
                },
              }
            : {
                label: "Build Draft",
                action: () => {
                  void generateSite();
                },
                disabled: !selectedProjectId || busy || !briefIsValid(),
              };

  const secondaryBuilderAction: { label: string; action: () => void } | null =
    activeBuilderStep > 1
      ? {
          label: "Back",
          action: () => {
            if (activeBuilderStep === 2) {
              jumpToBuilderStep(1);
              return;
            }
            if (activeBuilderStep === 3) {
              jumpToBuilderStep(2);
              return;
            }
            if (activeBuilderStep === 4) {
              jumpToBuilderStep(3);
              return;
            }
            jumpToBuilderStep(4);
          },
        }
      : null;

  const builderFeed = [
    !projectSelected
      ? "Let's start by creating or selecting a project."
      : "Let's start with your business and website goal.",
    connectionValidated
      ? "Connection validated. WordPress / Thrive access looks good."
      : "I'm validating your WordPress / Thrive connection.",
    assetScanCompleted
      ? "I found reusable Thrive assets."
      : "I'll scan for reusable Thrive assets once connection is validated.",
    currentSession?.buildSpec
      ? "Here's the plan I recommend based on your setup."
      : "I'll prepare your recommended plan after setup is complete.",
    currentSession?.status === "completed"
      ? "Your latest site draft is ready for review."
      : "I'm preparing your first site draft once pages are approved.",
  ];

  const friendlyWarnings: string[] = [];
  if (connectionValidated && !savedConnection?.thriveDetected) {
    friendlyWarnings.push("Your site is connected, but Thrive could not be detected yet.");
  }
  if (connectionValidated && !hasMeaningfulAssetData) {
    friendlyWarnings.push("We connected successfully, but no reusable Thrive assets were found yet.");
  }
  if (connectionValidated && !thriveIntel?.activeSkin?.name) {
    friendlyWarnings.push("Your site is connected, but the active skin could not be identified.");
  }
  if (thriveExecutionMode === "wp_safe_mode") {
    friendlyWarnings.push("SiteForge is currently in safe mode, so advanced Thrive-native composition is staged only.");
  }
  if (!thriveNativeGuard?.eligible) {
    friendlyWarnings.push("Native composition remains guarded until eligibility checks pass.");
  }

  const ctaBlockCount = symbolInventory.filter((symbol) =>
    (symbol.keywords ?? []).some((keyword) => keyword.toLowerCase().includes("cta") || keyword.toLowerCase().includes("offer"))
  ).length;
  const faqBlockCount = symbolInventory.filter((symbol) =>
    (symbol.keywords ?? []).some((keyword) => keyword.toLowerCase().includes("faq") || keyword.toLowerCase().includes("question"))
  ).length;
  const testimonialCount = symbolInventory.filter((symbol) =>
    (symbol.keywords ?? []).some((keyword) => keyword.toLowerCase().includes("testimonial") || keyword.toLowerCase().includes("review"))
  ).length;

  const assetPreviewGroups = [
    { name: "Headers", count: thriveIntel?.symbolSummary.headers ?? 0, type: "Header" },
    { name: "Footers", count: thriveIntel?.symbolSummary.footers ?? 0, type: "Footer" },
    { name: "Reusable Blocks", count: symbolCount, type: "Reusable Block" },
    { name: "Templates", count: templateCount, type: "Template" },
    { name: "Layout Systems", count: layoutCount, type: "Layout System" },
    { name: "CTA Blocks", count: ctaBlockCount, type: "CTA Block" },
    { name: "FAQs", count: faqBlockCount, type: "FAQ" },
    { name: "Testimonials", count: testimonialCount, type: "Testimonial" },
  ];

  const statusClass = (status: AgencyStatus | string) => {
    if (status === "Blocked" || status === "Needs revision") return "border-rose-300/50 bg-rose-500/10 text-rose-100";
    if (status === "Approved" || status === "Built") return "border-emerald-300/50 bg-emerald-500/10 text-emerald-100";
    if (status === "Awaiting approval") return "border-amber-300/50 bg-amber-500/10 text-amber-100";
    if (status === "Building" || status === "Researching" || status === "Drafting") return "border-cyan-300/50 bg-cyan-500/10 text-cyan-100";
    return "border-white/20 bg-white/10 text-slate-200";
  };

  const inferSectionType = (heading: string): "hero" | "proof" | "benefits" | "cta" | "faq" | "testimonials" | "generic" => {
    const normalized = heading.toLowerCase();
    if (normalized.includes("hero")) return "hero";
    if (normalized.includes("proof") || normalized.includes("trust")) return "proof";
    if (normalized.includes("benefit") || normalized.includes("feature")) return "benefits";
    if (normalized.includes("faq") || normalized.includes("question")) return "faq";
    if (normalized.includes("testimonial") || normalized.includes("review")) return "testimonials";
    if (normalized.includes("cta") || normalized.includes("offer") || normalized.includes("action")) return "cta";
    return "generic";
  };

  return (
    <div className="ecomviper-hud min-h-screen text-slate-100">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-30" />

      <main className="relative mx-auto max-w-[1600px] px-6 py-8">
        <section className={`${brainTheme.glassCard} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">SiteForge</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">Setup, Build, Publish</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">
                Complete setup once, review what SiteForge will build, then publish your draft with one clear next step each time.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2">
              {primaryNavItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    activeNav === item.key
                      ? "border border-cyan-300/50 bg-cyan-500/15 text-cyan-100"
                      : "border border-transparent bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
                  }`}
                  onClick={() => setActiveNav(item.key)}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                aria-label="Open settings"
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  activeNav === "strategy"
                    ? "border-cyan-300/50 bg-cyan-500/15 text-cyan-100"
                    : "border-white/20 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10"
                }`}
                onClick={() => setActiveNav("strategy")}
              >
                ⚙
              </button>
            </nav>
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        {storageSummary && (storageSummary.persistenceHealth !== "healthy" || storageSummary.fallbackActive) && activeNav !== "thrive_intelligence" ? (
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
            {storageSummary.reason ? <div className="mt-1 text-xs opacity-90">Reason: {storageSummary.reason}</div> : null}
          </section>
        ) : null}

        <section className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className={`${brainTheme.glassCard} h-fit p-3`}>
            <div className="text-xs uppercase tracking-[0.15em] text-slate-400">SiteForge</div>
            <div className="mt-1 text-sm text-slate-200">{activeProject?.name ?? "No project selected"}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-cyan-300/80">Guided assistant</div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Current section</div>
                <div className="mt-2 text-sm text-slate-100">
                  {activeNav === "settings" ? "Setup" : activeNav === "mission_control" ? "Build" : activeNav === "publish" ? "Publish" : "Settings"}
                </div>
                <div className="mt-1 text-xs text-slate-400">{overviewNextAction.helper}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Builder Feed</div>
                <div className="mt-2 space-y-2 text-xs text-slate-300">
                  {builderFeed.slice(0, 3).map((message, index) => (
                    <div key={`${index}-${message}`} className="rounded-lg border border-white/10 bg-white/5 p-2">
                      {message}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                <label htmlFor="builder-prompt" className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  Ask SiteForge
                </label>
                <textarea
                  id="builder-prompt"
                  value={builderPrompt}
                  onChange={(event) => setBuilderPrompt(event.target.value)}
                  placeholder="Tell SiteForge what kind of website you want to build"
                  className="mt-2 h-20 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                />
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    className={`${brainTheme.glowButton} w-full justify-center`}
                    onClick={activeNav === "settings" ? saveWebsiteBrief : activeNav === "publish" ? generateSite : primaryBuilderAction.action}
                    disabled={activeNav === "mission_control" ? primaryBuilderAction.disabled : busy}
                  >
                    {activeNav === "settings" ? "Save and Continue" : activeNav === "publish" ? "Build Draft" : primaryBuilderAction.label}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            {activeNav === "mission_control" ? (
              <section className={`${brainTheme.glassCard} p-5`}>
                <div className="sticky top-2 z-10 rounded-xl border border-white/10 bg-slate-950/85 p-2 backdrop-blur">
                  <div className="grid gap-2 md:grid-cols-3">
                    {([
                      ["plan", "Plan"],
                      ["pages", "Pages"],
                      ["assets", "Assets"],
                    ] as const).map(([tabKey, label]) => (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => setActiveBuildTab(tabKey)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                          activeBuildTab === tabKey
                            ? "border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
                            : "border-white/15 bg-white/5 text-slate-300 hover:border-white/30"
                        }`}
                      >
                        <div className="font-medium">{label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <h2 className="text-xl font-semibold text-slate-100">Build</h2>
                  <p className="mt-1 text-sm text-slate-300">Review your plan, pages, and reusable assets before moving to publish.</p>
                </div>

                {false ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label htmlFor="siteforge-step1-business-name" className="text-xs text-slate-300">Website name</label>
                        <input
                          id="siteforge-step1-business-name"
                          value={briefForm.businessName}
                          onChange={(event) => setBriefForm((prev) => ({ ...prev, businessName: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="siteforge-step1-business-type" className="text-xs text-slate-300">Business type</label>
                        <input
                          id="siteforge-step1-business-type"
                          value={briefForm.businessType}
                          onChange={(event) => setBriefForm((prev) => ({ ...prev, businessType: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="siteforge-step1-audience" className="text-xs text-slate-300">Audience</label>
                        <input
                          id="siteforge-step1-audience"
                          value={briefForm.targetAudience}
                          onChange={(event) => setBriefForm((prev) => ({ ...prev, targetAudience: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="siteforge-step1-goal" className="text-xs text-slate-300">Goal</label>
                        <select
                          id="siteforge-step1-goal"
                          value={briefForm.websiteGoal}
                          onChange={(event) => setBriefForm((prev) => ({ ...prev, websiteGoal: event.target.value as WebsiteBriefForm["websiteGoal"] }))}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        >
                          {websiteGoalOptions.map((goal) => (
                            <option key={goal} value={goal}>{goal}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="siteforge-step1-offer" className="text-xs text-slate-300">Offer</label>
                        <input
                          id="siteforge-step1-offer"
                          value={briefForm.mainOffer}
                          onChange={(event) => setBriefForm((prev) => ({ ...prev, mainOffer: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="siteforge-step1-tone" className="text-xs text-slate-300">Tone</label>
                        <select
                          id="siteforge-step1-tone"
                          value={briefForm.brandTone}
                          onChange={(event) => setBriefForm((prev) => ({ ...prev, brandTone: event.target.value as WebsiteBriefForm["brandTone"] }))}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        >
                          {brandToneOptions.map((tone) => (
                            <option key={tone} value={tone}>{tone}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="siteforge-step1-notes" className="text-xs text-slate-300">Optional notes</label>
                        <textarea
                          id="siteforge-step1-notes"
                          value={briefForm.differentiators}
                          onChange={(event) => setBriefForm((prev) => ({ ...prev, differentiators: event.target.value }))}
                          className="mt-1 h-20 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                {false ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label htmlFor="siteforge-step2-url" className="text-xs text-slate-300">WordPress URL</label>
                        <input
                          id="siteforge-step2-url"
                          value={baseUrl}
                          onChange={(event) => setBaseUrl(event.target.value)}
                          placeholder="https://example.com"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="siteforge-step2-username" className="text-xs text-slate-300">Username</label>
                        <input
                          id="siteforge-step2-username"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="WordPress username"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="siteforge-step2-password" className="text-xs text-slate-300">App password</label>
                        <input
                          id="siteforge-step2-password"
                          type="password"
                          value={appPassword}
                          onChange={(event) => setAppPassword(event.target.value)}
                          placeholder={savedConnection?.hasSavedSecret ? "Update app password (optional)" : "WordPress app password"}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                      <div className="text-sm font-medium text-slate-100">AI Access</div>
                      <div className="mt-2 grid gap-3 md:grid-cols-3">
                        <div>
                          <label htmlFor="siteforge-step2-model" className="text-xs text-slate-300">Model</label>
                          <select
                            id="siteforge-step2-model"
                            value={aiModel}
                            onChange={(event) => setAiModel(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                          >
                            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                            <option value="gpt-4.1">gpt-4.1</option>
                            <option value="gpt-5-mini">gpt-5-mini</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="siteforge-step2-openai" className="text-xs text-slate-300">OpenAI key</label>
                          <input
                            id="siteforge-step2-openai"
                            type="password"
                            value={aiApiKey}
                            onChange={(event) => setAiApiKey(event.target.value)}
                            placeholder={activeProject?.hasSavedAiSecret ? "Enter key to replace saved key" : "sk-..."}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="siteforge-step2-serpapi" className="text-xs text-slate-300">SerpApi key</label>
                          <input
                            id="siteforge-step2-serpapi"
                            type="password"
                            value={serpApiKey}
                            onChange={(event) => setSerpApiKey(event.target.value)}
                            placeholder={activeProject?.hasSavedSerpApiSecret ? "Enter key to replace saved key" : "serpapi-..."}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-300">
                      Connection result: {connectionResult?.connected ? "Connected" : savedConnection?.lastValidationStatus ?? "Not checked"} ·
                      Thrive detected: {connectionResult?.thriveDetected || savedConnection?.thriveDetected ? " Yes" : " No"}
                    </div>
                  </div>
                ) : null}
                {activeBuildTab === "plan" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                      <div>Business: {briefForm.businessName || "Not set"} · Goal: {briefForm.websiteGoal.replaceAll("_", " ")}</div>
                      <div className="mt-1">
                        Pages: {currentSession?.buildSpec?.pages?.map((page) => page.title).join(" · ") || "Build draft to generate a plan."}
                      </div>
                      <div className="mt-1">
                        Messaging: {briefForm.businessDescription || "Add business details to sharpen messaging."}
                      </div>
                      <div className="mt-1">
                        Reusable items found: {hasMeaningfulAssetData ? "Yes" : "Not yet"}
                      </div>
                    </div>
                  </div>
                ) : null}
                {activeBuildTab === "pages" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                      <div>Pages: {pageRows.length || 0}</div>
                      <div className="mt-1">Selected page: {selectedPageRow?.pageName ?? "none"}</div>
                      <div className="mt-1">Purpose: {selectedPageRow?.goal ?? "Support intent"}</div>
                      <div className="mt-1">Sections: {selectedBuildPage?.sections.length ?? 0}</div>
                      <div className="mt-1">Recommended reusable items: {selectedPageRow?.resolutionCount ?? 0}</div>
                    </div>
                    <button
                      type="button"
                      className={brainTheme.glowButton}
                      onClick={() => {
                        setPagesReviewed(true);
                        setActiveNav("publish");
                      }}
                    >
                      Approve Page
                    </button>
                  </div>
                ) : null}
                {activeBuildTab === "assets" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                      <div>Headers: {thriveIntel?.symbolSummary.headers ?? 0}</div>
                      <div className="mt-1">Footers: {thriveIntel?.symbolSummary.footers ?? 0}</div>
                      <div className="mt-1">CTA blocks: {ctaBlockCount}</div>
                      <div className="mt-1">Templates: {templateCount}</div>
                      <div className="mt-1">Layouts: {layoutCount}</div>
                    </div>
                    {!hasMeaningfulAssetData ? (
                      <div className="rounded-xl border border-dashed border-white/20 bg-slate-950/40 p-3 text-sm text-slate-300">
                        No reusable assets found yet.
                      </div>
                    ) : null}
                    <button type="button" className={brainTheme.glowButton} onClick={() => void loadProjects()}>
                      Rescan Assets
                    </button>
                  </div>
                ) : null}
                {false ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                      <div>Build status: {currentSession?.status ?? "not started"}</div>
                      <div className="mt-1">Ready now: {setupCoreComplete ? "Yes" : "Not yet"}</div>
                      <div className="mt-1">Needs attention: {setupCoreComplete ? "No blocking setup items." : "Complete setup and connection first."}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={brainTheme.glowButton} onClick={() => void generateSite()} disabled={!selectedProjectId || busy || !briefIsValid()}>
                        Build Draft
                      </button>
                      <button type="button" className={brainTheme.secondaryButton} onClick={() => setPagesReviewed(false)}>
                        Fix Missing Items
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeNav === "strategy" ? (
              <section className="space-y-4">
                <div className={`${brainTheme.glassCard} p-5`}>
                  <h2 className="text-lg font-semibold text-slate-100">Advanced</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Optional workspaces and deeper controls are available here after the guided builder flow starts.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={brainTheme.glowButton} onClick={() => setActiveNav("pages")}>
                      Continue to Pages
                    </button>
                    <button type="button" className={brainTheme.secondaryButton} onClick={() => setActiveNav("mission_control")}>
                      Back to Builder
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Strategy Snapshot</h3>
                    <div className="mt-2 grid gap-2 text-sm text-slate-300">
                      <div>Business: {briefForm.businessName || "Not set"}</div>
                      <div>Goal: {briefForm.websiteGoal.replaceAll("_", " ")}</div>
                      <div>Audience: {briefForm.targetAudience || "Not set"}</div>
                      <div>Main offer: {briefForm.mainOffer || "Not set"}</div>
                      <div>Positioning: {briefForm.businessDescription || "Not set"}</div>
                    </div>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Page Map</h3>
                    <div className="mt-2 text-sm text-slate-300">
                      {currentSession?.buildSpec?.pages?.map((page) => page.title).join(" · ") || "Build a draft to generate the initial page plan."}
                    </div>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Funnel Flow</h3>
                    <div className="mt-2 text-xs text-slate-300">
                      Homepage -&gt; Lead Magnet -&gt; Thank You -&gt; Core Offer -&gt; Follow-up Content
                    </div>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Messaging Notes</h3>
                    <div className="mt-2 text-xs text-slate-300">
                      Tone: {briefForm.brandTone} · Differentiators: {briefForm.differentiators || "Not set"}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Market intelligence: {marketIntelligence?.status === "used" ? "used" : "brief-only"}
                    </div>
                  </div>
                </div>

                <div className={`${brainTheme.glassCard} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-100">Workflow Readiness</h3>
                  <div className="mt-2 grid gap-2 md:grid-cols-2 text-xs text-slate-300">
                    <div>Setup complete: {setupCoreComplete ? "yes" : "no"}</div>
                    <div>Plan approved: {approvalQueue.length ? "in review" : "pending"}</div>
                    <div>Pages reviewed: {pageRows.length ? "in progress" : "not started"}</div>
                    <div>Ready to build: {setupAllComplete ? "yes" : "not yet"}</div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeNav === "brand" ? (
              <section className="grid gap-4 xl:grid-cols-2">
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Brand Identity</h2>
                  <div className="mt-2 text-sm text-slate-300">Tone: {briefForm.brandTone} · Business: {briefForm.businessName || "Not set"}</div>
                </div>
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Design Tokens</h2>
                  <div className="mt-2 text-sm text-slate-300">Token system is inherited from SiteForge visual design defaults and can be overridden per page.</div>
                </div>
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Thrive Theme Mapping</h2>
                  <div className="mt-2 text-sm text-slate-300">Active skin: {thriveIntel?.activeSkin?.name ?? "Unknown"} · Layout candidate: {selectedPageRow?.shell ?? "Pending"}</div>
                </div>
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Brand Rules</h2>
                  <div className="mt-2 text-sm text-slate-300">Preserve tone consistency, CTA hierarchy, and section rhythm across all page deliverables.</div>
                </div>
              </section>
            ) : null}

            {activeNav === "funnels" ? (
              <section className="space-y-4">
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Funnel Overview Board</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                    {["Homepage", "Lead Magnet", "Opt-in Confirmation", "Thank You", "Core Offer", "Follow-up Content"].map((node) => (
                      <div key={node} className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                        <div className="font-medium text-slate-100">{node}</div>
                        <div className="mt-1">Owner: Builder Operations Agent</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Funnel Logic</h3>
                    <p className="mt-2 text-sm text-slate-300">Map CTA hand-offs and approval gates between key funnel nodes.</p>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Offer Stack</h3>
                    <p className="mt-2 text-sm text-slate-300">Primary offer: {briefForm.mainOffer || "Not set"}</p>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Conversion Recommendations</h3>
                    <p className="mt-2 text-sm text-slate-300">Prioritize CTA clarity, trust strips, and FAQ objection handling before build approval.</p>
                  </div>
                </div>
              </section>
            ) : null}

            {activeNav === "pages" ? (
              <section className="space-y-4">
                <div className={`${brainTheme.glassCard} p-5`}>
                  <h2 className="text-lg font-semibold text-slate-100">Pages</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Review each page, confirm section stacks, and approve what should be included in the draft build.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={brainTheme.glowButton} onClick={generateSite} disabled={!selectedProjectId || busy || !briefIsValid()}>
                      Build Site Draft
                    </button>
                    <button type="button" className={brainTheme.secondaryButton} onClick={() => setActiveNav("mission_control")}>
                      Back to Builder
                    </button>
                  </div>
                </div>

                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Pages Index</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-white/20 px-2 py-1">status</span>
                    <span className="rounded-full border border-white/20 px-2 py-1">page type</span>
                    <span className="rounded-full border border-white/20 px-2 py-1">owner agent</span>
                    <span className="rounded-full border border-white/20 px-2 py-1">funnel</span>
                    <span className="rounded-full border border-white/20 px-2 py-1">approved / unapproved</span>
                    <span className="rounded-full border border-white/20 px-2 py-1">built / unbuilt</span>
                  </div>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full text-left text-xs text-slate-300">
                      <thead className="text-[11px] uppercase tracking-[0.08em] text-slate-400">
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
                        {pageRows.map((row) => (
                          <tr key={row.slug} className="border-t border-white/10">
                            <td className="px-2 py-2">{row.pageName}</td>
                            <td className="px-2 py-2">{row.pageType}</td>
                            <td className="px-2 py-2">{row.goal}</td>
                            <td className="px-2 py-2">{row.shell}</td>
                            <td className="px-2 py-2">{row.contentStatus}</td>
                            <td className="px-2 py-2">{row.buildStatus}</td>
                            <td className="px-2 py-2">{row.approvalStatus}</td>
                            <td className="px-2 py-2">{row.ownerAgent}</td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button type="button" className={brainTheme.secondaryButton} onClick={() => setPageStudioSlug(row.slug)}>Open Page Studio</button>
                                <button type="button" className={brainTheme.secondaryButton}>Preview Brief</button>
                                <button type="button" className={brainTheme.secondaryButton}>Compare Versions</button>
                                <button type="button" className={brainTheme.secondaryButton}>Approve</button>
                                <button type="button" className={brainTheme.secondaryButton}>Send to Build</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!pageRows.length ? (
                          <tr>
                            <td className="px-2 py-3 text-slate-400" colSpan={9}>No pages yet. Generate a build package to start page collaboration.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Selected Page Workflow</h2>
                  {selectedBuildPage ? (
                    <div className="mt-3 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_260px]">
                      <aside className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Page overview</div>
                          <div className="mt-2 text-sm text-slate-100">{selectedBuildPage.title}</div>
                          <div className="text-xs text-slate-400">Goal: {selectedPageRow?.goal ?? "Support intent"}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Section navigator</div>
                          <div className="mt-2 space-y-1 text-xs text-slate-300">
                            {selectedBuildPage.sections.map((section, index) => (
                              <div key={`${section.heading}-${index}`}>{section.heading}</div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">Dependencies: shell template, CTA stack, FAQ approval</div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">Linked funnel steps: {selectedPageRow?.funnel ?? "Primary funnel"}</div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">Reusable assets used: {selectedPageRow?.resolutionCount ?? 0}</div>
                      </aside>

                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Page Purpose</div>
                          <div className="mt-2 text-sm text-slate-200">{selectedPageRow?.goal ?? "Support intent"}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Shell Recommendation</div>
                          <div className="mt-2 text-sm text-slate-200">{selectedPageRow?.shell ?? "Pending shell recommendation"}</div>
                        </div>
                        <div className="space-y-2">
                          {selectedBuildPage.sections.map((section, index) => {
                            const inferredType = inferSectionType(section.heading);
                            const sectionResolution = thriveSectionResolutions.find(
                              (entry) => entry.pageSlug === selectedBuildPage.slug && entry.sectionType === inferredType
                            );
                            return (
                              <div key={`${section.heading}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-medium text-slate-100">{section.heading}</div>
                                    <div className="text-xs text-slate-400">Purpose: {inferredType}</div>
                                  </div>
                                  <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClass(sectionResolution?.designIntentSatisfied ? "Approved" : "Awaiting approval")}`}>
                                    {sectionResolution?.designIntentSatisfied ? "Approved" : "Awaiting approval"}
                                  </span>
                                </div>
                                <div className="mt-2 text-xs text-slate-300">Content summary: {section.body}</div>
                                <div className="mt-1 text-xs text-slate-400">Recommended Thrive asset type: {sectionResolution?.selectedVisualPrimitive ?? "wordpress_structured_fallback"}</div>
                                <div className="mt-1 text-xs text-slate-400">Matched reusable asset: {sectionResolution?.matchedSymbolTitle ?? "None"}</div>
                                <div className="mt-1 text-xs text-slate-400">Owner agent: {inferredType === "cta" ? "Copy Chief" : "Content Architect"}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button type="button" className={brainTheme.secondaryButton}>Preview</button>
                                  <button type="button" className={brainTheme.secondaryButton}>Swap Variant</button>
                                  <button type="button" className={brainTheme.secondaryButton}>Approve</button>
                                  <button type="button" className={brainTheme.secondaryButton}>Request Revision</button>
                                  <button type="button" className={brainTheme.secondaryButton}>Lock Section</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200">Copy Summary: Managed by Copy Chief with CTA and objection-handling variants.</div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200">Build Readiness: {currentSession?.status === "completed" ? "Ready" : "Needs review"}</div>
                      </div>

                      <aside className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Collaboration</div>
                          <div className="mt-2 space-y-2 text-xs text-slate-300">
                            <div>Strategy Director: Direction aligned</div>
                            <div>Content Architect: Section stack in review</div>
                            <div>Copy Chief: CTA variants pending approval</div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Version History</div>
                          <div className="mt-2 space-y-1 text-xs text-slate-300">
                            <div>v3 · Awaiting approval · {formatDate(currentSession?.createdAt)}</div>
                            <div>v2 · Recommended · {formatDate(currentSession?.createdAt)}</div>
                          </div>
                        </div>
                      </aside>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-300">Open a page from Pages Index to start Page Studio collaboration.</div>
                  )}
                </div>
              </section>
            ) : null}

            {activeNav === "global_assets" ? (
              <section className="space-y-4">
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-lg font-semibold text-slate-100">Reusable Assets</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Review what SiteForge can reuse from your Thrive site and select assets for the current build.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={brainTheme.glowButton} onClick={() => setActiveNav("pages")}>
                      Use Assets in Pages
                    </button>
                    <button type="button" className={brainTheme.secondaryButton} onClick={() => setActiveNav("thrive_intelligence")}>
                      Back to Thrive Setup
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {([
                      ["headers", "Headers"],
                      ["footers", "Footers"],
                      ["symbols", "Symbols / Reusable Blocks"],
                      ["sections", "Sections"],
                      ["templates", "Templates / Shell Templates"],
                      ["layouts", "Layouts / Layout Systems"],
                      ["cta_blocks", "CTA Blocks"],
                      ["faqs", "FAQs"],
                      ["testimonials", "Testimonials"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAssetsTab(key)}
                        className={`rounded-full border px-3 py-1 ${assetsTab === key ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100" : "border-white/20 bg-white/5 text-slate-300"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                    Recommended for current build:{" "}
                    {(thriveIntel?.symbolInventory ?? [])
                      .slice(0, 3)
                      .map((asset) => asset.title)
                      .join(" · ") || "Run Scan Thrive Assets to find reusable candidates."}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(thriveIntel?.symbolInventory ?? []).slice(0, 9).map((asset) => (
                      <div key={asset.id} className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                        <div className="text-sm font-medium text-slate-100">{asset.title}</div>
                        <div className="mt-1">Type: {assetsTab}</div>
                        <div className="mt-1">Category: {asset.taxonomy.name ?? "unknown"}</div>
                        <div className="mt-1">Usage count: {Math.max(1, Math.round((asset.keywords?.length ?? 1) * 1.4))}</div>
                        <div className="mt-1">Source: Thrive inventory</div>
                        <div className="mt-1">Status: {asset.reusable ? "active" : "review"}</div>
                        <div className="mt-1">Compatible page types: homepage, content</div>
                        <div className="mt-1">Fingerprint / match confidence: {asset.contentHash ?? "n/a"} / {asset.reusable ? "0.88" : "0.51"}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" className={brainTheme.secondaryButton}>Preview</button>
                          <button type="button" className={brainTheme.secondaryButton}>Reuse</button>
                          <button type="button" className={brainTheme.secondaryButton}>Recommend for page</button>
                          <button type="button" className={brainTheme.secondaryButton}>Mark preferred</button>
                          <button type="button" className={brainTheme.secondaryButton}>Mark deprecated</button>
                        </div>
                      </div>
                    ))}
                    {!thriveIntel?.symbolInventory?.length ? (
                      <div className="rounded-xl border border-dashed border-white/20 bg-slate-950/40 p-3 text-xs text-slate-300">
                        No reusable Thrive assets found yet.
                        <div className="mt-2">
                          <button type="button" className={brainTheme.secondaryButton} onClick={() => setActiveNav("thrive_intelligence")}>
                            Scan Thrive Assets
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {activeNav === "thrive_intelligence" ? (
              <section className="space-y-4">
                <div className={`${brainTheme.glassCard} p-5`}>
                  <h2 className="text-lg font-semibold text-slate-100">Thrive Setup &amp; Assets</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Connect your Thrive site, verify access, and scan reusable assets for SiteForge.
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Setup Progress</h3>
                    <div className="mt-3 space-y-2">
                      {setupSteps.map((step) => (
                        <div key={step.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2">
                          <div className="flex items-center gap-2 text-sm text-slate-200">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                step.state === "complete"
                                  ? "bg-emerald-400"
                                  : step.state === "attention"
                                    ? "bg-amber-300"
                                    : "bg-slate-500"
                              }`}
                            />
                            <span>{step.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">
                              {step.state === "complete" ? "complete" : step.state === "attention" ? "attention needed" : "incomplete"}
                            </span>
                            {step.state !== "complete" ? (
                              <button type="button" className={brainTheme.secondaryButton} onClick={step.action}>
                                {step.actionLabel}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Primary Action</h3>
                    <p className="mt-2 text-xs text-slate-300">
                      {connectionValidated
                        ? hasMeaningfulAssetData
                          ? "Your Thrive assets are ready. Continue into reusable assets."
                          : "Connection is valid. Run an asset scan to discover reusable blocks and templates."
                        : "Validate your WordPress connection before asset discovery."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className={brainTheme.glowButton} onClick={primaryThriveAction.action}>
                        {primaryThriveAction.label}
                      </button>
                      <button type="button" className={brainTheme.secondaryButton} onClick={() => setActiveNav("settings")}>
                        Back to Setup
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Connection Status</h3>
                    <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                      <div>Thrive detected: {savedConnection?.thriveDetected ? "Yes" : "No"}</div>
                      <div>Connection validated: {connectionValidated ? "Yes" : "No"}</div>
                      <div>Active skin: {thriveIntel?.activeSkin?.name ?? "Unknown"}</div>
                      <div>Last scan: {formatDate(thriveIntel?.collectedAt)}</div>
                    </div>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Assets Found</h3>
                    <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                      <div>Homepage found: {snapshot?.currentHomepageId ? "Yes" : "No"}</div>
                      <div>Reusable blocks found: {symbolCount}</div>
                      <div>Templates found: {templateCount}</div>
                      <div>Warnings found: {friendlyWarnings.length}</div>
                    </div>
                  </div>
                </div>

                <div className={`${brainTheme.glassCard} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-100">Reusable Assets Preview</h3>
                  {hasMeaningfulAssetData ? (
                    <>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {assetPreviewGroups.map((group) => (
                          <div key={group.name} className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                            <div className="text-sm font-medium text-slate-100">{group.name}</div>
                            <div className="mt-1">Count: {group.count}</div>
                            <div className="mt-1">Type: {group.type}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 overflow-auto">
                        <table className="min-w-full text-left text-xs text-slate-300">
                          <thead className="text-[11px] uppercase tracking-[0.08em] text-slate-400">
                            <tr>
                              <th className="px-2 py-2">Name</th>
                              <th className="px-2 py-2">Type</th>
                              <th className="px-2 py-2">Category</th>
                              <th className="px-2 py-2">Reusable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {symbolInventory.slice(0, 8).map((asset) => (
                              <tr key={asset.id} className="border-t border-white/10">
                                <td className="px-2 py-2">{asset.title}</td>
                                <td className="px-2 py-2">Reusable Block</td>
                                <td className="px-2 py-2">{asset.taxonomy.name ?? "General"}</td>
                                <td className="px-2 py-2">{asset.reusable ? "Yes" : "Review"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-slate-950/40 p-4 text-sm text-slate-300">
                      <div>No reusable Thrive assets found yet.</div>
                      <button type="button" className={`${brainTheme.secondaryButton} mt-3`} onClick={() => void loadProjects()}>
                        Scan Thrive Assets
                      </button>
                    </div>
                  )}
                </div>

                <div className={`${brainTheme.glassCard} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-100">Warnings</h3>
                  <div className="mt-3 space-y-2 text-xs text-slate-300">
                    {friendlyWarnings.length ? (
                      friendlyWarnings.map((warning) => (
                        <div key={warning} className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                          {warning}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                        No warnings. Thrive setup and asset discovery look healthy.
                      </div>
                    )}
                  </div>
                </div>

                <details className={`${brainTheme.glassCard} group p-4`}>
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">
                    Technical Details
                    <span className="ml-2 text-xs font-normal text-slate-400 group-open:hidden">Show advanced diagnostics</span>
                  </summary>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                      <h4 className="text-sm font-semibold text-slate-100">Connection Details</h4>
                      <div className="mt-2 space-y-1">
                        <div>Connection state: {savedConnection?.lastValidationStatus ?? "not_validated"}</div>
                        <div>Homepage mapping: {snapshot?.currentHomepageId ?? "unknown"} / {snapshot?.currentHomepageTitle ?? "unknown"}</div>
                        <div>Front-page WP setting: {thriveIntel?.safeHints.frontPageUsesWpSettings ? "configured" : "unknown"}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                      <h4 className="text-sm font-semibold text-slate-100">Inventory Counts</h4>
                      <div className="mt-2 grid gap-1 md:grid-cols-2">
                        <div>Template count: {templateCount}</div>
                        <div>Layout count: {layoutCount}</div>
                        <div>Section count: {sectionCount}</div>
                        <div>Symbol count: {symbolCount}</div>
                        <div>Header count: {thriveIntel?.symbolSummary.headers ?? 0}</div>
                        <div>Footer count: {thriveIntel?.symbolSummary.footers ?? 0}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                      <h4 className="text-sm font-semibold text-slate-100">Reusable Blocks</h4>
                      <div className="mt-3 overflow-auto">
                        <table className="min-w-full text-left">
                          <thead className="text-[11px] uppercase tracking-[0.08em] text-slate-400">
                            <tr>
                              <th className="px-2 py-2">ID</th>
                              <th className="px-2 py-2">Title</th>
                              <th className="px-2 py-2">Category</th>
                              <th className="px-2 py-2">Payload</th>
                              <th className="px-2 py-2">CSS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {symbolInventory.map((symbol) => (
                              <tr key={symbol.id} className="border-t border-white/10">
                                <td className="px-2 py-2">{symbol.id}</td>
                                <td className="px-2 py-2">{symbol.title}</td>
                                <td className="px-2 py-2">{symbol.taxonomy.name ?? "unknown"}</td>
                                <td className="px-2 py-2">{symbol.hasBuilderContent ? "present" : "none"}</td>
                                <td className="px-2 py-2">{symbol.hasCustomCss ? "present" : "none"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                      <h4 className="text-sm font-semibold text-slate-100">Template Matches</h4>
                      <div className="mt-2 space-y-1">
                        <div>Homepage candidate: {thriveNativeComposition?.shellLayoutCandidate ?? "thrive-homepage-canonical"}</div>
                        <div>Page candidate: thrive-standard-content</div>
                        <div>Post/archive candidates: staged for future mapping</div>
                        <div>Mapped use cases: homepage shell, content shell</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                      <h4 className="text-sm font-semibold text-slate-100">Safety &amp; Mode</h4>
                      <div className="mt-2 space-y-1">
                        <div>Execution mode: {thriveExecutionMode}</div>
                        <div>Native guard eligible: {thriveNativeGuard?.eligible ? "yes" : "no"}</div>
                        <div>Read-only mode: enabled for intelligence-first workflows</div>
                        <div>Unresolved mappings: {thriveSectionResolutions.filter((entry) => !entry.designIntentSatisfied).length}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300">
                      <h4 className="text-sm font-semibold text-slate-100">Advanced Tools</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className={brainTheme.secondaryButton} onClick={() => void loadProjects()}>Scan Thrive Assets</button>
                        <button type="button" className={brainTheme.secondaryButton}>Compare Last Scan</button>
                        <button type="button" className={brainTheme.secondaryButton}>Export Technical Report</button>
                        <button type="button" className={brainTheme.secondaryButton}>View Scan Log</button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300 xl:col-span-2">
                      <h4 className="text-sm font-semibold text-slate-100">Storage &amp; Persistence</h4>
                      {storageSummary ? (
                        <div className="mt-2 space-y-1">
                          <div>Storage mode: {storageSummary.storageMode}</div>
                          <div>Persistence health: {storageSummary.persistenceHealth}</div>
                          <div>Memory fallback active: {storageSummary.fallbackActive ? "yes" : "no"}</div>
                          <div>{storageStatusMessage}</div>
                        </div>
                      ) : (
                        <div className="mt-2">Storage summary unavailable.</div>
                      )}
                    </div>
                  </div>
                </details>
              </section>
            ) : null}

            {activeNav === "experiments" ? (
              <section className="grid gap-4 xl:grid-cols-3">
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-100">Active Experiments</h3>
                  <div className="mt-2 space-y-2 text-xs text-slate-300">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">Variant A: CTA button hierarchy · expected gain 8% · confidence Medium</div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">Variant B: Trust-strip placement · expected gain 5% · confidence Medium</div>
                  </div>
                </div>
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-100">Opportunities Queue</h3>
                  <div className="mt-2 space-y-2 text-xs text-slate-300">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">FAQ compression test · affected pages: Home</div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2">Hero proof-point density test · affected pages: Home, About</div>
                  </div>
                </div>
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-100">Evidence</h3>
                  <div className="mt-2 text-xs text-slate-300">Evidence is seed-backed in this release lane and ready for analytics wiring.</div>
                </div>
              </section>
            ) : null}

            {activeNav === "publish" ? (
              <section className="space-y-4">
                <div className={`${brainTheme.glassCard} p-5`}>
                  <h2 className="text-lg font-semibold text-slate-100">Publish</h2>
                  <p className="mt-2 text-sm text-slate-300">Check readiness and complete the final build action.</p>
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className={`${brainTheme.glassCard} p-4`}>
                    <h3 className="text-sm font-semibold text-slate-100">Ready</h3>
                    <div className="mt-2 text-sm text-slate-300">{currentSession?.status === "completed" ? "Build package complete" : "Awaiting build completion"}</div>
                  </div>
                  <div className={`${brainTheme.glassCard} p-4 xl:col-span-2`}>
                    <h3 className="text-sm font-semibold text-slate-100">Needs attention</h3>
                    <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                      <div>homepage assigned: {snapshot?.currentHomepageId ? "yes" : "no"}</div>
                      <div>core CTA working: {currentSession?.status === "completed" ? "yes" : "no"}</div>
                      <div>lead magnet connected: no</div>
                      <div>thank-you flow complete: no</div>
                      <div>header/footer approved: {thriveIntel?.symbolSummary.headers ? "yes" : "no"}</div>
                      <div>mobile review complete: pending</div>
                      <div>legal pages present: pending</div>
                    </div>
                  </div>
                </div>
                <div className={`${brainTheme.glassCard} p-4`}>
                  <button type="button" className={brainTheme.glowButton} onClick={generateSite} disabled={!selectedProjectId || busy || !briefIsValid()}>
                    Build Draft
                  </button>
                </div>
              </section>
            ) : null}

            {activeNav === "settings" ? (
              <section className="space-y-4">
                <div className={`${brainTheme.glassCard} p-5`}>
                  <h2 className="text-lg font-semibold text-slate-100">Setup</h2>
                  <p className="mt-2 text-sm text-slate-300">Complete website details, connection, and AI access in one place.</p>
                </div>
                <div className={`${brainTheme.glassCard} p-4`}>
                  <h2 className="text-sm font-semibold text-slate-100">Project Details</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
                        {selectedProjectId && !selectedProjectInOptions ? (
                          <option value={selectedProjectId}>Loading selected project...</option>
                        ) : null}
                        {!projects.length ? <option value="">No project selected</option> : null}
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name} · {project.status}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-slate-400">New Project Name</label>
                      <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="e.g. iPetzo" className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
                      <button type="button" className={`${brainTheme.secondaryButton} mt-2`} onClick={createProject} disabled={busy || !normalizeNewProjectName(newProjectName)}>
                        {createStatus === "creating" ? "Creating..." : "Create Project"}
                      </button>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Rename Current Project</label>
                      <input id="siteforge-project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-slate-400">WordPress URL</label>
                      <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  {createStatusMessage ? <div className="mt-2 text-xs text-slate-300">{createStatusMessage}</div> : null}
                  {!activeProject ? (
                    <div className="mt-2 text-xs text-slate-400">Create your first project to get started.</div>
                  ) : null}
                </div>

                {activeProject ? (
                  <>
                    <div className={`${brainTheme.glassCard} p-4`}>
                      <h3 className="text-sm font-semibold text-slate-100">About your website</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <label htmlFor="siteforge-brief-business-name" className="text-xs text-slate-300">Business name</label>
                          <input id="siteforge-brief-business-name" value={briefForm.businessName} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessName: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label htmlFor="siteforge-brief-business-type" className="text-xs text-slate-300">Business type / category</label>
                          <input id="siteforge-brief-business-type" value={briefForm.businessType} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessType: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="siteforge-brief-business-description" className="text-xs text-slate-300">What does the business do?</label>
                          <textarea id="siteforge-brief-business-description" value={briefForm.businessDescription} onChange={(event) => setBriefForm((prev) => ({ ...prev, businessDescription: event.target.value }))} className="mt-1 h-20 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label htmlFor="siteforge-brief-target-audience" className="text-xs text-slate-300">Who is the target audience?</label>
                          <input id="siteforge-brief-target-audience" value={briefForm.targetAudience} onChange={(event) => setBriefForm((prev) => ({ ...prev, targetAudience: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label htmlFor="siteforge-brief-goal" className="text-xs text-slate-300">Main goal of website</label>
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
                          <label htmlFor="siteforge-brief-main-offer" className="text-xs text-slate-300">Main offer / service / product</label>
                          <input id="siteforge-brief-main-offer" value={briefForm.mainOffer} onChange={(event) => setBriefForm((prev) => ({ ...prev, mainOffer: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label htmlFor="siteforge-brief-market-location" className="text-xs text-slate-300">Location / market (optional)</label>
                          <input id="siteforge-brief-market-location" value={briefForm.marketLocation} onChange={(event) => setBriefForm((prev) => ({ ...prev, marketLocation: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label htmlFor="siteforge-brief-competitors" className="text-xs text-slate-300">Competitors / inspiration (optional)</label>
                          <input id="siteforge-brief-competitors" value={briefForm.competitors} onChange={(event) => setBriefForm((prev) => ({ ...prev, competitors: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="siteforge-brief-differentiators" className="text-xs text-slate-300">Notes / differentiators (optional)</label>
                          <textarea id="siteforge-brief-differentiators" value={briefForm.differentiators} onChange={(event) => setBriefForm((prev) => ({ ...prev, differentiators: event.target.value }))} className="mt-1 h-20 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                      </div>
                      <div className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-300">Brief: {briefSaveState}</div>
                    </div>

                    <div className={`${brainTheme.glassCard} p-4`}>
                      <h3 className="text-sm font-semibold text-slate-100">AI access</h3>
                      <p className="mt-1 text-xs text-slate-300">Save API credentials server-side for this project. Plaintext keys are not returned to the browser after save.</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div>
                          <label htmlFor="siteforge-ai-model" className="text-xs text-slate-300">Model</label>
                          <select id="siteforge-ai-model" value={aiModel} onChange={(event) => setAiModel(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm">
                            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                            <option value="gpt-4.1">gpt-4.1</option>
                            <option value="gpt-5-mini">gpt-5-mini</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="siteforge-ai-key" className="text-xs text-slate-300">OpenAI API key</label>
                          <input id="siteforge-ai-key" type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} placeholder={activeProject.hasSavedAiSecret ? "Enter key to replace saved key" : "sk-..."} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label htmlFor="siteforge-serpapi-key" className="text-xs text-slate-300">SerpApi API key</label>
                          <input id="siteforge-serpapi-key" type="password" value={serpApiKey} onChange={(event) => setSerpApiKey(event.target.value)} placeholder={activeProject.hasSavedSerpApiSecret ? "Enter key to replace saved key" : "serpapi-..."} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className={brainTheme.secondaryButton} onClick={() => saveAiConfig("save")} disabled={busy}>Save API Keys</button>
                        <button type="button" className={brainTheme.secondaryButton} onClick={removeAiKey} disabled={busy || (!activeProject.hasSavedAiSecret && !activeProject.hasSavedSerpApiSecret)}>Remove Saved Keys</button>
                      </div>
                      <div className="mt-2 text-xs text-slate-300">Status: OpenAI={activeProject.hasSavedAiSecret ? "saved" : "not saved"} | SerpApi={activeProject.hasSavedSerpApiSecret ? "saved" : "not saved"}{aiStatusMessage ? ` · ${aiStatusMessage}` : ""}</div>
                    </div>

                    <div className={`${brainTheme.glassCard} p-4`}>
                      <h3 className="text-sm font-semibold text-slate-100">Connect your site</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <input value={connectionLabel} onChange={(event) => setConnectionLabel(event.target.value)} placeholder="Connection label" className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
                        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="WordPress username" className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
                        <input type="password" value={appPassword} onChange={(event) => setAppPassword(event.target.value)} placeholder={savedConnection?.hasSavedSecret ? "Update application password (optional)" : "WordPress application password"} className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className={brainTheme.secondaryButton} onClick={saveAndValidateConnection} disabled={busy || !selectedProjectId}>Check Connection</button>
                        <label className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs">
                          <input type="checkbox" checked={hasThriveHint} onChange={(event) => setHasThriveHint(event.target.checked)} />
                          Thrive Installed
                        </label>
                      </div>
                      <div className="mt-2 text-xs text-slate-300">Generation key path: {activeProject.hasSavedAiSecret ? "user-provided OpenAI key" : "platform OpenAI key if configured"} | Market intelligence: {activeProject.hasSavedSerpApiSecret ? "SerpApi enabled" : "SerpApi not configured"}</div>
                    </div>

                    <div className={`${brainTheme.glassCard} p-4`}>
                      <h3 className="text-sm font-semibold text-slate-100">Connection result</h3>
                      <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                        <div>Connection: {connectionResult?.connected ? "connected" : savedConnection?.lastValidationStatus ?? "not validated"}</div>
                        <div>Can write pages: {connectionResult?.canWritePages ? "yes" : "unknown"}</div>
                        <div>Thrive detected: {connectionResult?.thriveDetected || savedConnection?.thriveDetected ? "yes" : "no"}</div>
                        <div>Signals: {connectionResult?.thriveSignals?.join(", ") || "none yet"}</div>
                      </div>
                    </div>

                    <div className={`${brainTheme.glassCard} sticky bottom-3 z-10 border border-cyan-300/30 bg-slate-950/85 p-4 backdrop-blur`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-300">Next action is based on what is already complete.</div>
                        <button
                          type="button"
                          className={brainTheme.glowButton}
                          onClick={() => {
                            if (!setupCoreComplete) {
                              void saveWebsiteBrief();
                              return;
                            }
                            if (!connectionValidated) {
                              void saveAndValidateConnection();
                              return;
                            }
                            setActiveNav("mission_control");
                          }}
                          disabled={!selectedProjectId || busy}
                        >
                          {!briefCompleted || !aiConfigured ? "Save and Continue" : !connectionValidated ? "Check Connection" : "Continue to Build"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`${brainTheme.glassCard} p-6`}>
                    <div className="text-sm font-medium text-slate-100">No Active Project</div>
                    <p className="mt-2 text-sm text-slate-300">Create a project at the top of the page to unlock rename and generation controls.</p>
                    <p className="mt-2 text-xs text-slate-400">Rename the active project after creation.</p>
                  </div>
                )}
              </section>
            ) : null}

            {activeNav === "strategy" ? (
              <section className={`${brainTheme.glassCard} p-4`}>
                <div className="text-xs uppercase tracking-[0.15em] text-slate-400">Run History</div>
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  {sessions.map((session) => (
                    <button key={session.id} type="button" onClick={() => setCurrentSessionId(session.id)} className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-left text-xs text-slate-200">
                      {new Date(session.createdAt).toLocaleString()} · {session.type} · {session.status} · {session.runState.currentStage}
                    </button>
                  ))}
                  {!sessions.length ? <div className="text-xs text-slate-400">No run history yet.</div> : null}
                </div>

                {currentSession ? (
                  <div className="mt-4 space-y-3">
                    <Stepper stage={currentSession.runState.currentStage ?? "planning"} />
                    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
                      Status: {currentSession.status} · Stage: {currentSession.runState.currentStage} · Progress: {currentSession.runState.progressPct}%
                    </div>
                    <label htmlFor="siteforge-refine" className="text-xs uppercase tracking-[0.18em] text-slate-300/75">Refinement Request</label>
                    <div className="flex flex-wrap gap-2">
                      <input id="siteforge-refine" value={refinePrompt} onChange={(event) => setRefinePrompt(event.target.value)} placeholder="Request revision" className="min-w-[260px] flex-1 rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
                      <button type="button" className={brainTheme.secondaryButton} onClick={submitRefinement} disabled={busy || !refinePrompt.trim()}>Request Revision</button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
