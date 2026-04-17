"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { brainTheme } from "@/components/brain-dock/brainTheme";

type CapabilityCheck = {
  connected: boolean;
  canWritePages: boolean;
  canManageSettings: boolean;
  thriveDetected: boolean;
  thriveSignals: string[];
  message: string;
};

type BuildStage =
  | "planning"
  | "writing"
  | "building"
  | "reviewing"
  | "finalizing"
  | "executing"
  | "completed"
  | "failed";

type SiteForgeProject = {
  id: string;
  name: string;
  description: string;
  latestSessionId: string | null;
  updatedAt: string;
};

type BuildSession = {
  id: string;
  projectId: string;
  prompt: string;
  createdAt: string;
  status: "queued" | "running" | "completed" | "failed";
  runState: {
    currentStage: BuildStage;
    progressPct: number;
    timeline: Array<{
      at: string;
      stage: BuildStage;
      message: string;
      level: "info" | "warning" | "error";
    }>;
  };
  buildSpec: {
    siteTitle: string;
    pages: Array<{ title: string; slug: string; sections: Array<{ heading: string; body: string }> }>;
  } | null;
  executionResult: {
    success: boolean;
    createdPages: Array<{ slug: string; status: string; url: string | null }>;
    homepage: { success: boolean; message: string };
    menu: { success: boolean; message: string };
    thrive: { enabled: boolean; appliedMappings: string[]; fallbackUsed: boolean };
    warnings: string[];
    errors: string[];
  } | null;
  revisionHistory: Array<{ id: string; at: string; request: { message: string } }>;
};

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

export default function SiteForgeAppPage() {
  const [projects, setProjects] = useState<SiteForgeProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [sessions, setSessions] = useState<BuildSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("SiteForge Project");
  const [projectDescription] = useState("Conversion-focused AI website build");
  const [prompt, setPrompt] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");

  const [connectionLabel, setConnectionLabel] = useState("Primary WordPress Site");
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [hasThriveHint, setHasThriveHint] = useState(false);
  const [connectionResult, setConnectionResult] = useState<CapabilityCheck | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    const data = await fetchJson<{ projects: SiteForgeProject[] }>("/api/siteforge/projects");
    setProjects(data.projects);

    if (!data.projects.length) {
      const created = await fetchJson<{ project: SiteForgeProject }>("/api/siteforge/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectName, description: projectDescription }),
      });
      setProjects([created.project]);
      setSelectedProjectId(created.project.id);
      return created.project.id;
    }

    const fallback = selectedProjectId || data.projects[0].id;
    setSelectedProjectId(fallback);
    return fallback;
  }

  async function loadSessions(projectId: string) {
    if (!projectId) return;
    const data = await fetchJson<{ project: SiteForgeProject; sessions: BuildSession[] }>(
      `/api/siteforge/projects/${encodeURIComponent(projectId)}`
    );
    setSessions(data.sessions);

    if (!currentSessionId && data.sessions.length) {
      setCurrentSessionId(data.sessions[0].id);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const projectId = await loadProjects();
        if (projectId) {
          await loadSessions(projectId);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load SiteForge projects.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSession = useMemo(
    () => sessions.find((entry) => entry.id === currentSessionId) ?? null,
    [sessions, currentSessionId]
  );

  useEffect(() => {
    if (!currentSessionId) return;
    const selected = sessions.find((entry) => entry.id === currentSessionId);
    if (!selected || !["queued", "running"].includes(selected.status)) return;

    const timer = window.setInterval(async () => {
      try {
        const data = await fetchJson<{ session: BuildSession }>(
          `/api/siteforge/sessions/${encodeURIComponent(currentSessionId)}`
        );
        setSessions((prev) => [data.session, ...prev.filter((entry) => entry.id !== data.session.id)]);
      } catch {
        // Preserve current UI while transient polling errors recover.
      }
    }, 1700);

    return () => window.clearInterval(timer);
  }, [currentSessionId, sessions]);

  async function validateConnection() {
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJson<{ result: CapabilityCheck }>("/api/siteforge/connection/validate", {
        method: "POST",
        body: JSON.stringify({ label: connectionLabel, baseUrl, username, appPassword, hasThriveHint }),
      });
      setConnectionResult(data.result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection validation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function generateSite() {
    setBusy(true);
    setError(null);

    try {
      const projectId = selectedProjectId || (await loadProjects());
      if (!projectId) throw new Error("Unable to resolve SiteForge project.");

      if (!selectedProjectId) setSelectedProjectId(projectId);

      const data = await fetchJson<{ session: BuildSession }>(
        `/api/siteforge/projects/${encodeURIComponent(projectId)}/build`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt,
            projectName,
            projectDescription,
            connection: {
              label: connectionLabel,
              baseUrl,
              username,
              appPassword,
              hasThriveHint,
            },
          }),
        }
      );

      setSessions((prev) => [data.session, ...prev.filter((entry) => entry.id !== data.session.id)]);
      setCurrentSessionId(data.session.id);
      await loadSessions(projectId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start SiteForge build.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRefinement() {
    if (!selectedProjectId || !currentSessionId || !refinePrompt.trim()) return;

    setBusy(true);
    setError(null);

    try {
      await fetchJson<{ ok: true }>(`/api/siteforge/projects/${encodeURIComponent(selectedProjectId)}/refine`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: refinePrompt,
          connection: {
            label: connectionLabel,
            baseUrl,
            username,
            appPassword,
            hasThriveHint,
          },
        }),
      });
      setRefinePrompt("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Refinement request failed.");
    } finally {
      setBusy(false);
    }
  }

  const buildMode = Boolean(currentSession);
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
                Describe your site, connect WordPress, generate pages, and refine with guided AI revisions.
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
                const id = event.target.value;
                setSelectedProjectId(id);
                void loadSessions(id);
              }}
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className={`${brainTheme.glassCard} p-3`}>
            <label className="text-xs uppercase tracking-[0.18em] text-slate-400">WordPress URL</label>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://example.com"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
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
              placeholder="WordPress application password"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" className={brainTheme.secondaryButton} onClick={validateConnection} disabled={busy}>
                Validate
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
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        {!buildMode ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className={`${brainTheme.glassCard} p-6`}>
              <label htmlFor="siteforge-project-name" className="text-sm font-medium text-slate-100">
                Project Name
              </label>
              <input
                id="siteforge-project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
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
                className="mt-3 h-48 w-full rounded-2xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/35"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {quickSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setPrompt(
                        `Build a ${suggestion.toLowerCase()} website with clear offers and strong calls to action.`
                      )
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
                disabled={busy || !prompt.trim()}
                className={`${brainTheme.glowButton} mt-6 w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Generate My Website
              </button>
            </div>

            <aside className={`${brainTheme.glassCard} h-fit p-5`}>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300/75">Connection Status</div>
              <p className="mt-2 text-sm text-slate-200">
                {connectionResult
                  ? connectionResult.connected
                    ? connectionResult.message
                    : "Connection failed"
                  : "Not validated"}
              </p>
              {connectionResult ? (
                <div className="mt-2 text-xs text-slate-400">
                  Write access: {connectionResult.canWritePages ? "Yes" : "No"} | Thrive: {connectionResult.thriveDetected ? "Detected" : "Not detected"}
                </div>
              ) : null}
            </aside>
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            <Stepper stage={currentSession?.runState.currentStage ?? "planning"} />

            <div className={`${brainTheme.glassCard} p-4 text-sm text-slate-200`}>
              Status: {currentSession?.status} · Stage: {currentSession?.runState.currentStage} · Progress: {currentSession?.runState.progressPct}%
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
                  {currentSession?.buildSpec?.pages?.length ? (
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

            {currentSession?.executionResult ? (
              <section className={`${brainTheme.glassCard} p-4`}>
                <h3 className="text-sm font-semibold text-white">Execution Summary</h3>
                <p className="mt-2 text-xs text-slate-300">
                  Pages created: {currentSession.executionResult.createdPages.filter((entry) => entry.status === "created").length} · Homepage: {currentSession.executionResult.homepage.message}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Thrive mode: {currentSession.executionResult.thrive.enabled ? "Enabled" : "Fallback WordPress"}
                </p>
              </section>
            ) : null}

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

            <section className={`${brainTheme.glassCard} p-4`}>
              <h3 className="text-sm font-semibold text-white">Run History</h3>
              <ul className="mt-2 space-y-2">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentSessionId(session.id)}
                      className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-left text-xs text-slate-200"
                    >
                      {new Date(session.createdAt).toLocaleString()} · {session.status} · {session.runState.currentStage}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
