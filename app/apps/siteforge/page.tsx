"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { brainTheme } from "@/components/brain-dock/brainTheme";
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

type CreateStatus = "idle" | "creating" | "created" | "error";
type OpenProjectResult =
  | { ok: true }
  | { ok: false; reason: "superseded" | "failed"; message?: string };

const quickSuggestions = ["Health & Wellness", "Ecommerce", "Coaching", "SaaS"];
const visibleSteps: BuildStage[] = ["planning", "writing", "building", "reviewing", "finalizing"];

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
  const [prompt, setPrompt] = useState("");
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
    setPrompt("");
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
    setPrompt(workspace.project.primaryPrompt ?? "");
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

  useEffect(() => {
    void (async () => {
      try {
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
          primaryPrompt: prompt,
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

  async function generateSite() {
    if (!prompt.trim()) return;
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
            prompt,
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

        <section className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Current Site State</div>
            <div className="mt-2 text-sm text-slate-200">URL: {savedConnection?.wordpressUrl ?? "Not connected"}</div>
            <div className="mt-1 text-sm text-slate-200">Connection: {savedConnection?.label ?? "Not set"}</div>
            <div className="mt-1 text-sm text-slate-200">Validation: {savedConnection?.lastValidationStatus ?? "not_validated"}</div>
            <div className="mt-1 text-sm text-slate-200">Thrive: {savedConnection?.thriveDetected ? "Detected" : "Not detected"}</div>
            <div className="mt-1 text-sm text-slate-200">Current homepage: {snapshot?.currentHomepageTitle ?? "Unknown"}</div>
            <div className="mt-1 text-sm text-slate-200">Strategy: {snapshot?.homepageStrategy ?? homepageStrategy}</div>
            <div className="mt-1 text-sm text-slate-200">Last sync: {formatDate(snapshot?.lastSyncedAt)}</div>
          </div>

          <div className={`${brainTheme.glassCard} p-4`}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Latest Run</div>
            <div className="mt-2 text-sm text-slate-200">Status: {sessions[0]?.status ?? "No runs yet"}</div>
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
            <div className="mt-2 text-xs text-slate-400">Last validated: {formatDate(savedConnection?.lastValidatedAt)}</div>
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

              <label htmlFor="siteforge-prompt" className="mt-4 block text-sm font-medium text-slate-100">
                Website Prompt
              </label>
              <textarea
                id="siteforge-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the website you want…"
                className="mt-3 h-40 w-full rounded-2xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/35"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {quickSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setPrompt(`Build a ${suggestion.toLowerCase()} website with clear offers and strong calls to action.`)
                    }
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={generateSite}
                disabled={!selectedProjectId || busy || !prompt.trim()}
                className={`${brainTheme.glowButton} mt-6 w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Generate My Website
              </button>
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
