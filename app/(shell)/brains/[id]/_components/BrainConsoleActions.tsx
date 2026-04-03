"use client";

import { useMemo, useState } from "react";
import { Radar, Search, Sparkles } from "lucide-react";

type ConsoleAction = "retrieval" | "answer";
type SourceMode = "web_search" | "website_url" | "document_upload" | "youtube";

type BrainConsoleActionsProps = {
  brainId: string;
  brainName: string;
  totalItems: number;
  hasRuns: boolean;
  latestRunStatus?: string | null;
  initialAction?: string;
};

type ActionResult = {
  status: "success" | "error";
  title: string;
  message: string;
  runId?: string;
  payload?: unknown;
};

function formatPayload(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function resolveMessage(payload: unknown, status: number): string {
  const serviceDownMessage =
    "The brain service is unavailable right now. Try again in a moment.";
  if (payload && typeof payload === "object") {
    const candidate = payload as {
      message?: string;
      error?: { message?: string };
    };
    const nested = candidate.error?.message || candidate.message;
    if (nested) {
      return nested;
    }
  }
  if (status === 401) {
    return "Please sign in to run this operation.";
  }
  if (status >= 500) {
    return serviceDownMessage;
  }
  return `Request failed with HTTP ${status}.`;
}

function clampIngestLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.min(200, Math.max(1, Math.floor(value)));
}

export default function BrainConsoleActions({
  brainId,
  brainName,
  totalItems,
  hasRuns,
  latestRunStatus,
  initialAction,
}: BrainConsoleActionsProps) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("web_search");
  const [discoveryTopic, setDiscoveryTopic] = useState(brainName);
  const [discoveryLimit, setDiscoveryLimit] = useState(20);
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);

  const [query, setQuery] = useState("");
  const [testLimit, setTestLimit] = useState(8);
  const [isRunning, setIsRunning] = useState<ConsoleAction | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [activeAction, setActiveAction] = useState<ConsoleAction>(
    initialAction === "answer" ? "answer" : "retrieval"
  );

  const guidance = useMemo(() => {
    if (totalItems <= 0) {
      return "Start by running discovery. Keyword-based web discovery is currently the supported source for this brain.";
    }
    if (hasRuns && (!latestRunStatus || latestRunStatus.toLowerCase() !== "completed")) {
      return "A prior run is still in progress or recently interrupted. Monitor activity, then continue discovery.";
    }
    return "Knowledge reservoir is building. Continue discovery to expand source coverage.";
  }, [hasRuns, latestRunStatus, totalItems]);

  const apiSnippet = useMemo(() => {
    return `curl -X POST http://127.0.0.1:3001/api/brains/${brainId}/ingest -H "Content-Type: application/json" -d '{"keyword":"${discoveryTopic.replace(/"/g, '\\"')}","selected_new":${discoveryLimit},"n_new_videos":${discoveryLimit},"max_candidates":50,"mode":"audio_first"}'`;
  }, [brainId, discoveryLimit, discoveryTopic]);

  async function runDiscovery() {
    const trimmedTopic = discoveryTopic.trim();
    if (!trimmedTopic) {
      setResult({
        status: "error",
        title: "Topic required",
        message: "Enter a topic to search before running discovery.",
      });
      return;
    }

    setIsRunningDiscovery(true);
    setResult(null);
    try {
      const res = await fetch(`/api/brains/${brainId}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: trimmedTopic,
          selected_new: discoveryLimit,
          n_new_videos: discoveryLimit,
          max_candidates: 50,
          mode: "audio_first",
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setResult({
          status: "error",
          title: "Unable to run discovery",
          message: resolveMessage(payload, res.status),
          payload,
        });
        return;
      }

      const runId: string | undefined = payload?.run_id || payload?.id;
      setResult({
        status: "success",
        title: "Discovery run started",
        message:
          "The brain is now searching keyword-based sources and importing new findings into knowledge.",
        runId,
        payload,
      });
    } catch (error) {
      setResult({
        status: "error",
        title: "Unable to run discovery",
        message: error instanceof Error ? error.message : "Unknown discovery error.",
      });
    } finally {
      setIsRunningDiscovery(false);
    }
  }

  async function runKnowledgeTest(mode: "retrieval" | "answer") {
    const trimmed = query.trim();
    if (!trimmed) {
      setResult({
        status: "error",
        title: mode === "retrieval" ? "Query required for retrieval" : "Query required for answer test",
        message: "Enter a question or intent before running this test.",
      });
      return;
    }

    setIsRunning(mode);
    setResult(null);
    try {
      const endpoint = mode === "retrieval" ? "retrieve" : "answer-orchestrate";
      const res = await fetch(`/api/brains/${brainId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, limit: testLimit }),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setResult({
          status: "error",
          title: mode === "retrieval" ? "Retrieval test failed" : "Answer test failed",
          message: resolveMessage(payload, res.status),
          payload,
        });
        return;
      }

      setResult({
        status: "success",
        title: mode === "retrieval" ? "Retrieval test complete" : "Answer test complete",
        message:
          mode === "retrieval"
            ? "The brain returned retrieval evidence for the query."
            : "The brain returned an orchestrated answer response.",
        payload,
      });
    } catch (error) {
      setResult({
        status: "error",
        title: mode === "retrieval" ? "Retrieval test failed" : "Answer test failed",
        message: error instanceof Error ? error.message : "Unknown action error.",
      });
    } finally {
      setIsRunning(null);
    }
  }

  function copySnippet() {
    void navigator.clipboard?.writeText(apiSnippet);
  }

  return (
    <section className="space-y-3 rounded-[18px] border border-cyan-300/25 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.12),0_18px_36px_rgba(2,6,23,0.6)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Primary workflow</div>
          <h3 className="mt-1 text-lg font-semibold text-white">Add Knowledge</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            Run discovery to find and pull new knowledge into this brain.
          </p>
        </div>
        <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100">
          Inline workflow
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
        <p className="text-xs text-slate-200">{guidance}</p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Source selector</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSourceMode("web_search")}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              sourceMode === "web_search"
                ? "border-cyan-300/45 bg-cyan-400/20 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            Web Search
          </button>
          <button
            type="button"
            disabled
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-500"
          >
            Website URL (coming soon)
          </button>
          <button
            type="button"
            disabled
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-500"
          >
            Document Upload (coming soon)
          </button>
          <button
            type="button"
            disabled
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-500"
          >
            YouTube (coming soon)
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
        <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Topic to search for
          <input
            type="text"
            value={discoveryTopic}
            onChange={(event) => setDiscoveryTopic(event.target.value)}
            placeholder="e.g. brilliant directories SEO optimization"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Max results
          <input
            type="number"
            min={1}
            max={200}
            value={discoveryLimit}
            onChange={(event) => setDiscoveryLimit(clampIngestLimit(Number(event.target.value)))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={runDiscovery}
            disabled={isRunningDiscovery}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/30 disabled:opacity-60"
          >
            <Radar className="h-4 w-4" />
            {isRunningDiscovery ? "Running discovery..." : "Run Discovery"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
        <p className="text-xs text-slate-300">
          Supported today: keyword-based web search discovery and ingest through the existing brain contract.
        </p>
      </div>

      <details className="rounded-xl border border-white/10 bg-black/25 p-3">
        <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-slate-300/85">
          Advanced
        </summary>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Request payload</div>
              <button
                type="button"
                onClick={copySnippet}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
              >
                Copy request
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto text-xs text-slate-200">{apiSnippet}</pre>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Quality checks</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveAction("retrieval")}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  activeAction === "retrieval"
                    ? "border-cyan-300/45 bg-cyan-400/20 text-cyan-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                Test Retrieval
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("answer")}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  activeAction === "answer"
                    ? "border-cyan-300/45 bg-cyan-400/20 text-cyan-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                Test Answering
              </button>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_130px_auto]">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter query for retrieval/answer checks"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                min={1}
                max={20}
                value={testLimit}
                onChange={(event) =>
                  setTestLimit(Math.min(20, Math.max(1, Number(event.target.value) || 1)))
                }
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => runKnowledgeTest(activeAction)}
                disabled={isRunning === activeAction}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-60"
              >
                {activeAction === "retrieval" ? (
                  <Search className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isRunning === activeAction ? "Running..." : "Run Test"}
              </button>
            </div>
          </div>
        </div>
      </details>

      {result ? (
        <div
          className={`rounded-2xl border p-4 ${
            result.status === "success"
              ? "border-emerald-400/30 bg-emerald-400/10"
              : "border-rose-400/30 bg-rose-400/10"
          }`}
        >
          <h4 className="text-sm font-semibold text-white">{result.title}</h4>
          <p className="mt-1 text-sm text-slate-200">{result.message}</p>
          {result.runId ? (
            <a
              href={`/runs/${result.runId}`}
              className="mt-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
            >
              Open run {result.runId}
            </a>
          ) : null}
          {result.payload != null ? (
            <details className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
              <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-slate-300/80">
                Developer details
              </summary>
              <pre className="mt-2 overflow-x-auto text-xs text-slate-200">{formatPayload(result.payload)}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
