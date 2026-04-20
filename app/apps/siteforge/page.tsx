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

  return (
    <div className="ecomviper-hud min-h-screen text-slate-100">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-35" />

      <main className="relative mx-auto max-w-7xl px-6 py-10">
        <section className={`${brainTheme.glassCard} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/75">Apps</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">SiteForge</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Persistent project workspace for connected WordPress site generation and refinement.
              </p>
            </div>
            <Link href="/" className={brainTheme.secondaryButton}>
              Back to iBrains
            </Link>
          </div>
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <div className={`${brainTheme.glassCard} p-3`}>
            <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Project</label>
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
              {!projects.length ? (
                <option value="">No project selected</option>
              ) : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {project.status}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-slate-400">
              Last opened: {formatDate(activeProject?.lastOpenedAt)}
            </div>
            <label className="mt-2 block text-xs uppercase tracking-[0.18em] text-slate-400">New Project Name</label>
            <input
              value={newProjectName}
              onChange={(event) => {
                setNewProjectName(event.target.value);
                if (createStatus !== "creating") {
                  setCreateStatus("idle");
                  setCreateStatusMessage(null);
                }
              }}
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
            {createStatusMessage ? (
              <div
                className={`mt-2 text-xs ${createStatus === "error" ? "text-rose-200" : createStatus === "created" ? "text-emerald-200" : "text-slate-300"}`}
              >
                {createStatusMessage}
              </div>
            ) : null}
            {!activeProject ? (
              <div className="mt-2 text-xs text-slate-400">Create your first project to get started.</div>
            ) : null}
          </div>

          <div className={`${brainTheme.glassCard} p-3`}>
            <label className="text-xs uppercase tracking-[0.18em] text-slate-400">WordPress URL</label>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://example.com"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
            <label className="mt-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Homepage Strategy</label>
            <select
              value={homepageStrategy}
              onChange={(event) => setHomepageStrategy(event.target.value as HomepageStrategy)}
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            >
              <option value="use_existing">Use Existing</option>
              <option value="replace_existing">Replace Existing</option>
              <option value="create_new">Create New</option>
              <option value="draft_only">Draft Only</option>
            </select>
          </div>

          <div className={`${brainTheme.glassCard} p-3`}>
            <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Connection</label>
            <input
              value={connectionLabel}
              onChange={(event) => setConnectionLabel(event.target.value)}
              placeholder="Connection label"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="WordPress username"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={appPassword}
              onChange={(event) => setAppPassword(event.target.value)}
              placeholder={savedConnection?.hasSavedSecret ? "Update application password (optional)" : "WordPress application password"}
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={brainTheme.secondaryButton}
                onClick={saveAndValidateConnection}
                disabled={busy || !selectedProjectId}
              >
                Save + Validate
              </button>
              <button
                type="button"
                className={brainTheme.secondaryButton}
                onClick={revalidateConnection}
                disabled={busy || !selectedProjectId}
              >
                Revalidate
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={hasThriveHint}
                  onChange={(event) => setHasThriveHint(event.target.checked)}
                />
                Thrive Installed
              </label>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Credentials: {savedConnection?.hasSavedSecret ? "saved" : "need update"}
            </div>
            {!selectedProjectId ? (
              <div className="mt-2 text-xs text-amber-200">Select a valid active project to validate this connection.</div>
            ) : !hasValidActiveProject ? (
              <div className="mt-2 text-xs text-amber-200">
                Selected project is out of sync. Connection actions will reload project state before continuing.
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        {storageSummary ? (
          <section
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              storageSummary.persistenceHealth === "healthy"
                ? "border border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                : "border border-amber-300/35 bg-amber-500/10 text-amber-100"
            }`}
          >
            <div className="font-medium">Storage mode: {storageSummary.storageMode}</div>
            <div className="mt-1">
              Persistence health: {storageSummary.persistenceHealth} | Memory fallback active:{" "}
              {storageSummary.fallbackActive ? "yes" : "no"}
            </div>
            <div className="mt-1">{storageStatusMessage}</div>
            {storageSummary.reason ? <div className="mt-1 text-xs opacity-90">Reason: {storageSummary.reason}</div> : null}
          </section>
        ) : null}

        <section className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Current Site State</div>
            <div className="mt-2 text-sm text-slate-200">URL: {savedConnection?.wordpressUrl ?? "Not connected"}</div>
            <div className="mt-1 text-sm text-slate-200">Connection: {savedConnection?.label ?? "Not set"}</div>
            <div className="mt-1 text-sm text-slate-200">Validation: {savedConnection?.lastValidationStatus ?? "not_validated"}</div>
            <div className="mt-1 text-sm text-slate-200">Thrive: {savedConnection?.thriveDetected ? "Detected" : "Not detected"}</div>
            <div className="mt-1 text-sm text-slate-200">
              Thrive Mode:{" "}
              {thriveCurrentMode === "thrive_native_staging_mode"
                ? "Thrive-native approved-target mode"
                : thriveCurrentMode === "blocked_native_mode"
                  ? "Blocked native mode"
                  : thriveCurrentMode === "thrive_intel_mode"
                    ? "Thrive-aware safe mode"
                    : thriveExecutionMode === "wp_safe_mode"
                      ? "WP safe mode"
                      : "Future Thrive-native mode"}
            </div>
            <div className="mt-1 text-sm text-slate-200">Active Thrive skin: {thriveIntel?.activeSkin?.name ?? "Unknown"}</div>
            <div className="mt-1 text-sm text-slate-200">
              Thrive symbols: {thriveIntel?.symbolSummary.total ?? 0} (headers {thriveIntel?.symbolSummary.headers ?? 0}, footers {thriveIntel?.symbolSummary.footers ?? 0})
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Thrive primitives: templates {thriveIntel?.primitiveCounts.thriveTemplate ?? 0}, layouts {thriveIntel?.primitiveCounts.thriveLayout ?? 0}, sections {thriveIntel?.primitiveCounts.thriveSection ?? 0}
            </div>
            <div className="mt-1 text-sm text-slate-200">Current homepage: {snapshot?.currentHomepageTitle ?? "Unknown"}</div>
            <div className="mt-1 text-sm text-slate-200">Strategy: {snapshot?.homepageStrategy ?? homepageStrategy}</div>
            <div className="mt-1 text-sm text-slate-200">Last sync: {formatDate(snapshot?.lastSyncedAt)}</div>
          </div>

          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Latest Run</div>
            <div className="mt-2 text-sm text-slate-200">Status: {sessions[0]?.status ?? "No runs yet"}</div>
            <div className="mt-1 text-sm text-slate-200">
              Generation path:{" "}
              {sessions[0]
                ? sessions[0].generationSource === "user_key"
                  ? "user-provided key"
                  : sessions[0].generationSource === "platform_key"
                    ? "platform key"
                    : "deterministic fallback"
                : "N/A"}
            </div>
            <div className="mt-1 text-sm text-slate-200">Model: {sessions[0]?.aiModel ?? "N/A"}</div>
            <div className="mt-1 text-sm text-slate-200">Summary: {snapshot?.lastRunSummary ?? "No summary yet"}</div>
            <div className="mt-1 text-sm text-slate-200">Pages affected: {snapshot?.pagesAffected ?? 0}</div>
            <div className="mt-1 text-sm text-slate-200">Run logs: {runLogs.length}</div>
          </div>

          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Connection Status</div>
            <p className="mt-2 text-sm text-slate-200">
              {connectionResult
                ? connectionResult.connected
                  ? connectionResult.message
                  : "Connection invalid"
                : "Not validated"}
            </p>
            <div className="mt-2 text-xs text-slate-400">
              Write access: {connectionResult?.canWritePages ? "Yes" : "No"} | Thrive: {connectionResult?.thriveDetected ? "Detected" : "Not detected"}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Thrive intel available: {currentSession?.executionResult?.thrive.intelligenceAvailable ? "Yes" : "No"} | Symbol inventory:{" "}
              {currentSession?.executionResult?.thrive.symbolInventoryPresent ? "Present" : "Not captured"}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Runtime modes: wp_safe_mode={thriveRuntime.wpSafeMode ? "on" : "off"} | thrive_intel_mode={thriveRuntime.thriveIntelMode ? "on" : "off"} | staging_native_mode={thriveRuntime.stagingNativeMode ? "on" : "off"}
            </div>
            <div className="mt-2 text-xs text-slate-400">Last validated: {formatDate(savedConnection?.lastValidatedAt)}</div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Thrive Intelligence</div>
            <div className="mt-2 text-sm text-slate-200">Active Thrive skin: {thriveIntel?.activeSkin?.name ?? "Unknown"}</div>
            <div className="mt-1 text-sm text-slate-200">Skin slug: {thriveIntel?.activeSkin?.slug ?? "Unknown"}</div>
            <div className="mt-1 text-sm text-slate-200">
              Symbol inventory by role: headers {thriveIntel?.symbolSummary.headers ?? 0}, footers {thriveIntel?.symbolSummary.footers ?? 0}, sections {thriveIntel?.symbolSummary.sections ?? 0}, unknown {thriveIntel?.symbolSummary.unknown ?? 0}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Reusable now: {reusableSummary.reusableNow} | Safely writable now: {reusableSummary.safeWritableNow} | Future staged-native only: {reusableSummary.stagedOnly}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Homepage targeting truth: {snapshot?.currentHomepageTitle ?? "Unknown"} ({snapshot?.currentHomepageSource ?? "unknown"})
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Warnings: {thriveIntel?.warnings.length ? thriveIntel.warnings.join(" | ") : "None"}
            </div>
          </div>
          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Section Visual Mapping</div>
            <div className="mt-2 text-xs text-slate-300">
              Deterministic visual pattern and Thrive primitive resolution per section.
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
              {thriveSectionResolutions.length ? (
                thriveSectionResolutions.map((entry) => (
                  <div key={`${entry.pageSlug}:${entry.sectionId}`} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-xs text-slate-200">
                    <div>
                      {entry.pageSlug} / {entry.sectionType} {"->"} {entry.visualPattern}
                    </div>
                    <div className="mt-1 text-slate-300">
                      primitive={entry.selectedVisualPrimitive} ({entry.primitiveSelectionSource}) | matched=
                      {entry.matchedSymbolTitle ?? "none"} | confidence={entry.confidence.toFixed(2)}
                    </div>
                    <div className="mt-1 text-slate-400">
                      target={entry.preferredRenderTarget} | designIntent={entry.designIntentSatisfied ? "satisfied" : "fallback"}
                      {entry.fallbackReason ? ` | fallback=${entry.fallbackReason}` : ""}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/20 bg-slate-950/40 p-3 text-xs text-slate-300">
                  No section resolution data yet. Run Generate to compute Thrive-aware section mapping.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3">
          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Visual Composition</div>
            <div className="mt-2 text-sm text-slate-200">
              hero={visualCompositionSummary.hero} | features={visualCompositionSummary.features} | cta={visualCompositionSummary.cta}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              faq={visualCompositionSummary.faq} | testimonials={visualCompositionSummary.testimonial} | trust={visualCompositionSummary.trust}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              reused={visualCompositionSummary.reused} | created={visualCompositionSummary.created} | fallback={visualCompositionSummary.fallback}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {visualCompositionSummary.lowDesignWarnings.length
                ? `Low-design warnings: ${visualCompositionSummary.lowDesignWarnings.join(" | ")}`
                : "No low-design fallback warnings recorded."}
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3">
          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Market Intelligence</div>
            <div className="mt-2 text-sm text-slate-200">
              Status: {marketIntelligence?.status ?? "not_configured"} | Source: {marketIntelligence?.source ?? "none"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Planner enriched: {marketIntelligence?.plannerEnriched ? "yes" : "no"} | Content enriched:{" "}
              {marketIntelligence?.contentEnriched ? "yes" : "no"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Pattern counts: competitors={marketIntelligence?.competitorPatterns.length ?? 0}, sections=
              {marketIntelligence?.commonPageSections.length ?? 0}, cta={marketIntelligence?.ctaPatterns.length ?? 0},
              faq={marketIntelligence?.faqThemes.length ?? 0}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {marketIntelligence?.summary ?? "No structured market brief captured for this run."}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              fingerprint={marketIntelligence?.fingerprint ?? "none"}
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Native Target Panel</div>
            <div className="mt-2 text-sm text-slate-200">
              Eligibility: {thriveNativeGuard?.eligible ? "Eligible" : "Blocked"}{" "}
              {thriveNativeGuard?.blockedReason ? `(${thriveNativeGuard.blockedReason})` : ""}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Target mode: {thriveNativeGuard?.nativeTargetMode ?? "blocked"} | classification:{" "}
              {thriveNativeGuard?.targetClassification ?? "unknown_target"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Approved target: {thriveNativeGuard?.approvedTargetHost ?? "none"} | approval source:{" "}
              {thriveNativeGuard?.approvalSource ?? "none"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Contract schema: {thriveNativeGuard?.schemaContractVersion ?? "missing"} | Host:{" "}
              {thriveNativeGuard?.connectionHost ?? "unknown"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Approved native operations: {thriveNativeGuard?.allowlistedOperations.join(", ") || "none"}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Runtime mode states: wp_safe_mode, thrive_intel_mode, thrive_native_staging_mode, blocked_native_mode
            </div>
          </div>

          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Native Composition & Verification</div>
            <div className="mt-2 text-sm text-slate-200">
              Plan mode: {thriveNativeComposition?.mode ?? "not generated"} | Homepage post id:{" "}
              {thriveNativeComposition?.homepagePostId ?? "unknown"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Reuse {thriveNativeComposition?.summary.reusedExisting ?? 0} | Native create{" "}
              {thriveNativeComposition?.summary.createdNative ?? 0} | WP fallback{" "}
              {thriveNativeComposition?.summary.wpFallback ?? 0}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Verification status:{" "}
              {thriveNativeExecution
                ? thriveNativeExecution.success
                  ? "verified"
                  : "verification issues"
                : "not executed"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Rollback/reset availability: {thriveNativeExecution?.rollback.available ? "available" : "not available"}
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">Native Validation</div>
            <div className="mt-1 text-sm text-slate-200">
              Validation mode: {thriveNativeValidation?.mode ?? "not_run"} | status: {thriveNativeValidation?.status ?? "unknown"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              verification: steps={thriveNativeValidation?.verification.stepsTotal ?? 0} verified=
              {thriveNativeValidation?.verification.verifiedSteps ?? 0} failed=
              {thriveNativeValidation?.verification.failedSteps ?? 0}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              render status: {thriveNativeValidation?.verification.renderability.status ?? "unknown_render_failure"} |
              http={thriveNativeValidation?.verification.renderability.httpStatus ?? "n/a"}
            </div>
            <div className="mt-1 text-sm text-slate-200 break-all">
              checked URL: {thriveNativeValidation?.verification.renderability.checkedUrl ?? "none"}
            </div>
            <div className="mt-1 text-sm text-slate-200 break-all">
              final URL: {thriveNativeValidation?.verification.renderability.finalUrl ?? "none"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              rollback result:{" "}
              {thriveNativeValidation
                ? thriveNativeValidation.rollbackVerification.attempted
                  ? thriveNativeValidation.rollbackVerification.success
                    ? "completed"
                    : "incomplete"
                  : "not attempted"
                : "unknown"}
            </div>
            <div className="mt-1 text-sm text-slate-200">
              promotion candidate:{" "}
              {thriveNativeValidation?.promotionCandidateSummary.ready ? "ready" : "not ready"} (
              {thriveNativeValidation?.promotionCandidateSummary.reason ?? "unknown"})
            </div>
            <div className="mt-2 max-h-40 space-y-2 overflow-auto pr-1 text-xs">
              {(thriveNativeExecution?.steps ?? []).length ? (
                (thriveNativeExecution?.steps ?? []).map((step, idx) => (
                  <div key={`${step.operation}-${idx}`} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-slate-200">
                    <div>
                      {step.operation} {"->"} {step.objectType} {step.targetId ?? "n/a"}
                    </div>
                    <div className="mt-1 text-slate-400">
                      verified={step.verificationPassed ? "yes" : "no"} | rollbackReady={step.rollbackReady ? "yes" : "no"} |
                      status={step.responseStatus ?? "n/a"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/20 bg-slate-950/40 p-3 text-slate-300">
                  No native execution recorded for this run.
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-slate-300">Native validation outcomes</div>
            <div className="mt-2 max-h-32 space-y-2 overflow-auto pr-1 text-xs">
              {(thriveNativeValidation?.sectionOutcomes ?? []).length ? (
                (thriveNativeValidation?.sectionOutcomes ?? []).map((entry) => (
                  <div
                    key={`${entry.pageSlug}:${entry.sectionId}:validation`}
                    className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-slate-200"
                  >
                    <div>
                      {entry.sectionType} {"->"} {entry.outcome} ({entry.operation ?? "none"}) id=
                      {entry.targetId ?? "n/a"}
                    </div>
                    <div className="mt-1 text-slate-400">reason={entry.reason}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/20 bg-slate-950/40 p-3 text-slate-300">
                  No native validation summary recorded yet.
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-slate-300">Render diagnostics</div>
            <div className="mt-2 rounded-lg border border-white/10 bg-slate-950/50 p-2 text-xs text-slate-200">
              <div>legacy page link: {thriveNativeValidation?.verification.renderability.legacyPageLink ?? "none"}</div>
              <div>redirect hops: {thriveNativeValidation?.verification.renderability.redirectChain.length ?? 0}</div>
              <div className="mt-1 text-slate-400 break-all">
                body snippet: {thriveNativeValidation?.verification.renderability.bodySnippet ?? "n/a"}
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300">Section-native mapping</div>
            <div className="mt-2 max-h-36 space-y-2 overflow-auto pr-1 text-xs">
              {(thriveNativeComposition?.sections ?? []).length ? (
                (thriveNativeComposition?.sections ?? []).map((entry) => (
                  <div
                    key={`${entry.pageSlug}:${entry.sectionId}:native`}
                    className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-slate-200"
                  >
                    <div>
                      {entry.sectionType} {"->"} {entry.intent} ({entry.selectedOperation ?? "none"})
                    </div>
                    <div className="mt-1 text-slate-400">reason={entry.reason}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/20 bg-slate-950/40 p-3 text-slate-300">
                  No native section mapping computed yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          {activeProject ? (
            <div className={`${brainTheme.glassCard} p-6`}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="siteforge-project-name" className="text-sm font-medium text-slate-100">
                  Rename Current Project
                </label>
                <span className="text-xs uppercase tracking-[0.12em] text-slate-300">
                  Name: {projectNameSaveState}
                </span>
              </div>
              <input
                id="siteforge-project-name"
                value={projectName}
                onChange={(event) => {
                  setProjectName(event.target.value);
                  if (projectNameSaveState === "saved" || projectNameSaveState === "error") {
                    setProjectNameSaveState("idle");
                  }
                }}
                onBlur={() => {
                  if (
                    shouldPersistProjectName({
                      selectedProjectId: activeProjectId ?? "",
                      projectName,
                      persistedProjectName,
                    })
                  ) {
                    void persistProjectNameUpdate();
                  }
                }}
                className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
              />

              <div className="mt-6 rounded-2xl border border-white/15 bg-slate-950/45 p-4">
                <h3 className="text-sm font-semibold text-slate-100">Website Strategy Brief</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Tell SiteForge about your business, who you serve, and what you want your website to achieve.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="siteforge-brief-business-name" className="text-xs text-slate-300">Business name</label>
                    <input
                      id="siteforge-brief-business-name"
                      value={briefForm.businessName}
                      onChange={(event) => setBriefForm((prev) => ({ ...prev, businessName: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-business-type" className="text-xs text-slate-300">Business type / category</label>
                    <input
                      id="siteforge-brief-business-type"
                      value={briefForm.businessType}
                      onChange={(event) => setBriefForm((prev) => ({ ...prev, businessType: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="siteforge-brief-business-description" className="text-xs text-slate-300">What does the business do?</label>
                    <textarea
                      id="siteforge-brief-business-description"
                      value={briefForm.businessDescription}
                      onChange={(event) =>
                        setBriefForm((prev) => ({ ...prev, businessDescription: event.target.value }))
                      }
                      className="mt-1 h-24 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="siteforge-brief-target-audience" className="text-xs text-slate-300">Who is the target audience?</label>
                    <input
                      id="siteforge-brief-target-audience"
                      value={briefForm.targetAudience}
                      onChange={(event) => setBriefForm((prev) => ({ ...prev, targetAudience: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-goal" className="text-xs text-slate-300">Main goal of website</label>
                    <select
                      id="siteforge-brief-goal"
                      value={briefForm.websiteGoal}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          websiteGoal: event.target.value as WebsiteBriefForm["websiteGoal"],
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    >
                      <option value="book_calls">Book calls</option>
                      <option value="capture_leads">Capture leads</option>
                      <option value="sell_products">Sell products</option>
                      <option value="drive_demos_trials">Drive demos/trials</option>
                      <option value="build_authority">Build authority</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-tone" className="text-xs text-slate-300">Brand tone</label>
                    <select
                      id="siteforge-brief-tone"
                      value={briefForm.brandTone}
                      onChange={(event) =>
                        setBriefForm((prev) => ({ ...prev, brandTone: event.target.value as WebsiteBriefForm["brandTone"] }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    >
                      <option value="premium">Premium</option>
                      <option value="friendly">Friendly</option>
                      <option value="expert">Expert</option>
                      <option value="bold">Bold</option>
                      <option value="modern">Modern</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="siteforge-brief-main-offer" className="text-xs text-slate-300">Main offer / service / product</label>
                    <input
                      id="siteforge-brief-main-offer"
                      value={briefForm.mainOffer}
                      onChange={(event) => setBriefForm((prev) => ({ ...prev, mainOffer: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-market-location" className="text-xs text-slate-300">Location / market (optional)</label>
                    <input
                      id="siteforge-brief-market-location"
                      value={briefForm.marketLocation}
                      onChange={(event) => setBriefForm((prev) => ({ ...prev, marketLocation: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="siteforge-brief-competitors" className="text-xs text-slate-300">Competitors / inspiration (optional)</label>
                    <input
                      id="siteforge-brief-competitors"
                      value={briefForm.competitors}
                      onChange={(event) => setBriefForm((prev) => ({ ...prev, competitors: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="siteforge-brief-differentiators" className="text-xs text-slate-300">Notes / differentiators (optional)</label>
                    <textarea
                      id="siteforge-brief-differentiators"
                      value={briefForm.differentiators}
                      onChange={(event) =>
                        setBriefForm((prev) => ({ ...prev, differentiators: event.target.value }))
                      }
                      className="mt-1 h-24 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" className={brainTheme.secondaryButton} onClick={saveWebsiteBrief} disabled={busy}>
                    Save Website Brief
                  </button>
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-300">Brief: {briefSaveState}</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/15 bg-slate-950/45 p-4">
                <h3 className="text-sm font-semibold text-slate-100">AI & Research API Configuration</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Save API credentials server-side for this project. Plaintext keys are not returned to the browser after save.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor="siteforge-ai-model" className="text-xs text-slate-300">Model</label>
                    <select
                      id="siteforge-ai-model"
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
                    <label htmlFor="siteforge-ai-key" className="text-xs text-slate-300">OpenAI API key</label>
                    <input
                      id="siteforge-ai-key"
                      type="password"
                      value={aiApiKey}
                      onChange={(event) => setAiApiKey(event.target.value)}
                      placeholder={activeProject.hasSavedAiSecret ? "Enter key to replace saved key" : "sk-..."}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="siteforge-serpapi-key" className="text-xs text-slate-300">SerpApi API key</label>
                    <input
                      id="siteforge-serpapi-key"
                      type="password"
                      value={serpApiKey}
                      onChange={(event) => setSerpApiKey(event.target.value)}
                      placeholder={activeProject.hasSavedSerpApiSecret ? "Enter key to replace saved key" : "serpapi-..."}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className={brainTheme.secondaryButton} onClick={() => saveAiConfig("save")} disabled={busy}>
                    Save API Keys
                  </button>
                  <button type="button" className={brainTheme.secondaryButton} onClick={() => saveAiConfig("update")} disabled={busy}>
                    Update Model / Keys
                  </button>
                  <button
                    type="button"
                    className={brainTheme.secondaryButton}
                    onClick={removeAiKey}
                    disabled={busy || (!activeProject.hasSavedAiSecret && !activeProject.hasSavedSerpApiSecret)}
                  >
                    Remove Saved Keys
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  Status: OpenAI={activeProject.hasSavedAiSecret ? "saved" : "not saved"} | SerpApi=
                  {activeProject.hasSavedSerpApiSecret ? "saved" : "not saved"}
                  {aiStatusMessage ? ` · ${aiStatusMessage}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={generateSite}
                disabled={!selectedProjectId || busy || !briefIsValid()}
                className={`${brainTheme.glowButton} mt-6 w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Generate My Website
              </button>
              <div className="mt-2 text-xs text-slate-300">
                Generation key path: {activeProject.hasSavedAiSecret ? "user-provided OpenAI key" : "platform OpenAI key if configured"} |
                Market intelligence: {activeProject.hasSavedSerpApiSecret ? "SerpApi enabled" : "SerpApi not configured"}
              </div>
            </div>
          ) : (
            <div className={`${brainTheme.glassCard} p-6`}>
              <div className="text-sm font-medium text-slate-100">No Active Project</div>
              <p className="mt-2 text-sm text-slate-300">
                Create a project at the top of the page to unlock rename and generation controls.
              </p>
              <p className="mt-2 text-xs text-slate-400">Rename the active project after creation.</p>
            </div>
          )}

          <aside className={`${brainTheme.glassCard} h-fit p-5`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-300/75">Run History</div>
            <ul className="mt-2 space-y-2">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentSessionId(session.id)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-left text-xs text-slate-200"
                  >
                    {new Date(session.createdAt).toLocaleString()} · {session.type} · {session.status}
                  </button>
                </li>
              ))}
              {!sessions.length ? <li className="text-xs text-slate-400">No run history yet.</li> : null}
            </ul>
          </aside>
        </section>

        {currentSession ? (
          <section className="mt-6 space-y-4">
            <Stepper stage={currentSession.runState.currentStage ?? "planning"} />

            <div className={`${brainTheme.glassCard} p-4 text-sm text-slate-200`}>
              Status: {currentSession.status} · Stage: {currentSession.runState.currentStage} · Progress: {currentSession.runState.progressPct}%
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <article className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-lg font-semibold text-white">Build Activity</h2>
                <ul className="mt-4 space-y-3">
                  {activity.map((update, index) => (
                    <li
                      key={`${update.at}-${index}`}
                      className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200"
                    >
                      {update.message}
                    </li>
                  ))}
                </ul>
              </article>

              <aside className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-lg font-semibold text-white">Live Preview</h2>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  {currentSession.buildSpec?.pages?.length ? (
                    <ul className="space-y-2 text-xs text-slate-300">
                      {currentSession.buildSpec.pages.map((page) => (
                        <li key={page.slug} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <div className="font-semibold text-white">/{page.slug}</div>
                          <div>{page.sections.length} sections</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">Preview will populate as build artifacts become available.</p>
                  )}
                </div>
              </aside>
            </div>

            <div className={`${brainTheme.glassCard} p-4`}>
              <label htmlFor="siteforge-refine" className="text-xs uppercase tracking-[0.18em] text-slate-300/75">
                Refine
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="siteforge-refine"
                  type="text"
                  value={refinePrompt}
                  onChange={(event) => setRefinePrompt(event.target.value)}
                  placeholder="Make changes or refine your site…"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/35"
                />
                <button
                  type="button"
                  onClick={submitRefinement}
                  className={brainTheme.secondaryButton}
                  disabled={busy || !refinePrompt.trim()}
                >
                  Apply
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
