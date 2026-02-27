"use client";

import { useEffect, useMemo, useState } from "react";

type DiagnosticsPayload = Record<string, unknown>;

type VideoDiagnostic = Record<string, unknown>;

type ErrorEntry = Record<string, unknown> | string;

type DiagnosticsState = {
  summary: Record<string, unknown> | null;
  videos: VideoDiagnostic[];
  errors: ErrorEntry[];
};

type DiagnosticsClientProps = {
  runId: string;
};

function extractList(payload: DiagnosticsPayload, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function extractSummary(payload: DiagnosticsPayload): Record<string, unknown> | null {
  const candidates = ["summary", "discovery_summary", "discoverySummary", "overview"];
  for (const key of candidates) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getVideoId(item: VideoDiagnostic): string {
  return (
    (item.video_id as string | undefined) ||
    (item.videoId as string | undefined) ||
    (item.id as string | undefined) ||
    (item.slug as string | undefined) ||
    "unknown_video"
  );
}

function getVideoStatus(item: VideoDiagnostic): string {
  return (
    (item.status as string | undefined) ||
    (item.state as string | undefined) ||
    (item.phase as string | undefined) ||
    (item.result as string | undefined) ||
    "unknown"
  );
}

function isFailure(item: VideoDiagnostic): boolean {
  const status = getVideoStatus(item).toLowerCase();
  const hasError =
    Boolean(item.error) ||
    Boolean(item.errors) ||
    Boolean(item.failure_reason) ||
    Boolean(item.failureReason);
  return hasError || ["failed", "error", "errored", "timeout"].includes(status);
}

function formatTimestamp(value: unknown): string {
  if (!value) return "—";
  const raw = String(value);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

export default function DiagnosticsClient({ runId }: DiagnosticsClientProps) {
  const [payload, setPayload] = useState<DiagnosticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/diagnostics`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const text = await res.text();
        if (!active) return;

        if (!res.ok) {
          setError(`HTTP ${res.status} while loading diagnostics`);
          return;
        }

        let data: DiagnosticsPayload = {};
        try {
          data = text ? (JSON.parse(text) as DiagnosticsPayload) : {};
        } catch {
          data = {};
        }
        setPayload(data);
        setError(null);
      } catch (e) {
        if (!active) return;
        const message =
          e instanceof Error ? e.message : "Unable to load diagnostics";
        setError(message);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [runId]);

  const state: DiagnosticsState = useMemo(() => {
    if (!payload) return { summary: null, videos: [], errors: [] };
    const summary = extractSummary(payload);
    const videos = extractList(payload, ["videos", "items", "results", "diagnostics"]).map(
      (item) => (item && typeof item === "object" ? (item as VideoDiagnostic) : {})
    );
    const errors = extractList(payload, ["errors", "failures", "issues"]).map(
      (item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return item as ErrorEntry;
        return String(item ?? "");
      }
    );
    return { summary, videos, errors };
  }, [payload]);

  const filteredVideos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.videos.filter((item) => {
      if (onlyFailures && !isFailure(item)) return false;
      if (!term) return true;
      const id = getVideoId(item).toLowerCase();
      return id.includes(term);
    });
  }, [state.videos, onlyFailures, search]);

  function copyError(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
        {error}
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        Loading diagnostics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Filters
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Narrow diagnostics to the videos you need.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={onlyFailures}
                onChange={(event) => setOnlyFailures(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/50"
              />
              Show only failures
            </label>
            <input
              type="search"
              placeholder="Search by video_id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-56 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>
      </div>

      <details className="rounded-[24px] border border-white/10 bg-white/5 p-5" open>
        <summary className="cursor-pointer text-sm font-semibold text-white">
          Discovery summary
        </summary>
        <div className="mt-4 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
          {state.summary ? (
            Object.entries(state.summary).map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl border border-white/10 bg-black/40 p-3"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/70">
                  {key.replace(/_/g, " ")}
                </div>
                <div className="mt-2 text-sm text-slate-100">
                  {toStringValue(value)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-300">
              Summary data is not available for this run.
            </div>
          )}
        </div>
      </details>

      <details className="rounded-[24px] border border-white/10 bg-white/5 p-5" open>
        <summary className="cursor-pointer text-sm font-semibold text-white">
          Per-video diagnostics ({filteredVideos.length})
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm text-slate-200">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
              <tr>
                <th className="px-4 py-3">Video ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredVideos.length > 0 ? (
                filteredVideos.map((item) => (
                  <tr key={getVideoId(item)} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {getVideoId(item)}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {getVideoStatus(item)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {toStringValue(
                        item.message ?? item.error ?? item.reason ?? item.detail
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatTimestamp(
                        item.updated_at ?? item.updatedAt ?? item.timestamp
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-300" colSpan={4}>
                    No diagnostics match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <details className="rounded-[24px] border border-white/10 bg-white/5 p-5" open>
        <summary className="cursor-pointer text-sm font-semibold text-white">
          Errors list ({state.errors.length})
        </summary>
        <div className="mt-4 space-y-3">
          {state.errors.length > 0 ? (
            state.errors.map((entry, index) => {
              const text =
                typeof entry === "string" ? entry : toStringValue(entry);
              return (
                <div
                  key={`${index}-${text.slice(0, 12)}`}
                  className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-rose-200/80">
                      Error {index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyError(text)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-rose-100">
                    {text}
                  </pre>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-slate-300">
              No errors reported for this run.
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
