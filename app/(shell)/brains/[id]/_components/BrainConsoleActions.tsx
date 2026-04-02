"use client";

import { useMemo, useState } from "react";
import { Radar, Search, Sparkles } from "lucide-react";
import StartRunDialog from "@/app/(shell)/_components/StartRunDialog";

type ConsoleAction = "discovery" | "retrieval" | "answer";

type BrainConsoleActionsProps = {
  brainId: string;
  brainName: string;
  initialAction?: string;
};

type ActionResult = {
  status: "success" | "error";
  title: string;
  message: string;
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
      const normalized = nested.toLowerCase();
      if (normalized.includes("x-api-key") || normalized.includes("api authorization")) {
        return serviceDownMessage;
      }
      return nested;
    }
  }
  if (status === 401) {
    return serviceDownMessage;
  }
  if (status >= 500) {
    return serviceDownMessage;
  }
  return `Request failed with HTTP ${status}.`;
}

export default function BrainConsoleActions({ brainId, brainName, initialAction }: BrainConsoleActionsProps) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const [isRunning, setIsRunning] = useState<ConsoleAction | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const selectedAction = useMemo<ConsoleAction>(() => {
    if (initialAction === "answer") return "answer";
    if (initialAction === "retrieval") return "retrieval";
    return "discovery";
  }, [initialAction]);

  const [activeAction, setActiveAction] = useState<ConsoleAction>(selectedAction);

  async function runDiscovery() {
    setIsRunning("discovery");
    setResult(null);
    try {
      const res = await fetch(`/api/brains/${brainId}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false }),
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
      setResult({
        status: "success",
        title: "Discovery run started",
        message: "Discovery completed and new source signals were returned by the platform.",
        payload,
      });
    } catch (error) {
      setResult({
        status: "error",
        title: "Unable to run discovery",
        message: error instanceof Error ? error.message : "Unknown discovery error.",
      });
    } finally {
      setIsRunning(null);
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
        body: JSON.stringify({ query: trimmed, limit }),
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
        message: mode === "retrieval"
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

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Operations</div>
          <h3 className="mt-2 text-xl font-semibold text-white">{brainName} Action Console</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Trigger core brain operations directly from iBrains.
          </p>
        </div>
        <StartRunDialog brainId={brainId} brainName={brainName} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveAction("discovery")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            activeAction === "discovery"
              ? "border-cyan-300/45 bg-cyan-400/20 text-cyan-100"
              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          }`}
        >
          Run Discovery
        </button>
        <button
          type="button"
          onClick={() => setActiveAction("retrieval")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
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
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            activeAction === "answer"
              ? "border-cyan-300/45 bg-cyan-400/20 text-cyan-100"
              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          }`}
        >
          Test Answering
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        {activeAction === "discovery" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <Radar className="h-4 w-4 text-cyan-200" />
              Discovery scans fresh knowledge sources for this brain.
            </div>
            <button
              type="button"
              onClick={runDiscovery}
              disabled={isRunning === "discovery"}
              className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-60"
            >
              {isRunning === "discovery" ? "Running discovery..." : "Run Discovery"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-xs uppercase tracking-[0.16em] text-slate-400/80">
              Query
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. How should I improve my Brilliant Directories listing schema?"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.16em] text-slate-400/80">
              Result limit
              <input
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={(event) => setLimit(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
                className="mt-2 w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>

            <button
              type="button"
              onClick={() => runKnowledgeTest(activeAction)}
              disabled={isRunning === activeAction}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-60"
            >
              {activeAction === "retrieval" ? <Search className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isRunning === activeAction
                ? "Running..."
                : activeAction === "retrieval"
                  ? "Test Retrieval"
                  : "Test Answering"}
            </button>
          </div>
        )}
      </div>

      {result ? (
        <div
          className={`mt-4 rounded-2xl border p-4 ${
            result.status === "success"
              ? "border-emerald-400/30 bg-emerald-400/10"
              : "border-rose-400/30 bg-rose-400/10"
          }`}
        >
          <h4 className="text-sm font-semibold text-white">{result.title}</h4>
          <p className="mt-1 text-sm text-slate-200">{result.message}</p>
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
