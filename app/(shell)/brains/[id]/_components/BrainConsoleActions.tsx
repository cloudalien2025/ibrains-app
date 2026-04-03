"use client";

import { useMemo, useState } from "react";
import { FileUp, Globe, Radar, Search, Sparkles, Video } from "lucide-react";

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

type SourceTotals = {
  web_search: number | null;
  website_url: number | null;
  document_upload: number | null;
  youtube: number | null;
};

type IngestSummary = {
  sourceType: SourceMode;
  requestedMaxResults: number | null;
  candidatesFound: number | null;
  newItemsAdded: number | null;
  duplicatesSkipped: number | null;
  updatedItems: number | null;
  versionedItems: number | null;
  eligibleForProcessing: number | null;
  failedItems: number | null;
  sourceTotals: SourceTotals;
};

type ActionResult = {
  status: "success" | "error";
  title: string;
  message: string;
  runId?: string;
  payload?: unknown;
  ingestSummary?: IngestSummary;
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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(candidate: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = toFiniteNumber(candidate[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function pickTotals(payload: unknown): SourceTotals {
  const root = asRecord(payload) ?? {};
  const summary = asRecord(root.summary) ?? {};
  const totals = asRecord(summary.source_totals) ?? asRecord(root.source_totals) ?? {};
  return {
    web_search: pickNumber(totals, ["web_search"]),
    website_url: pickNumber(totals, ["website_url"]),
    document_upload: pickNumber(totals, ["document_upload"]),
    youtube: pickNumber(totals, ["youtube"]),
  };
}

function normalizeIngestSummary(
  payload: unknown,
  sourceType: SourceMode,
  requestedMaxResults: number | null
): IngestSummary {
  const root = asRecord(payload) ?? {};
  const summary = asRecord(root.summary) ?? {};
  const counters = asRecord(root.counters) ?? {};
  const combined = {
    ...root,
    ...summary,
    ...counters,
  };

  return {
    sourceType,
    requestedMaxResults,
    candidatesFound: pickNumber(combined, ["candidates_found", "candidatesFound"]),
    newItemsAdded: pickNumber(combined, ["new_items_added", "newItemsAdded", "added_this_run"]),
    duplicatesSkipped: pickNumber(combined, ["duplicates_skipped", "duplicatesSkipped", "already_known"]),
    updatedItems: pickNumber(combined, ["updated_items", "updatedItems"]),
    versionedItems: pickNumber(combined, ["versioned_items", "versionedItems"]),
    eligibleForProcessing: pickNumber(combined, ["eligible_for_processing", "eligibleForProcessing"]),
    failedItems: pickNumber(combined, ["failed_items", "failedItems"]),
    sourceTotals: pickTotals(payload),
  };
}

function formatMaybe(value: number | null): string {
  return value == null ? "Not reported" : value.toLocaleString();
}

function sourceButtonClass(active: boolean): string {
  if (active) return "border-cyan-300/45 bg-cyan-400/20 text-cyan-100";
  return "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";
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
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteMaxPages, setWebsiteMaxPages] = useState(5);
  const [websiteCrawlDepth, setWebsiteCrawlDepth] = useState(0);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
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
      return "Select a source and ingest your first items. Dedupe and version decisions run before post-ingest processing.";
    }
    if (hasRuns && (!latestRunStatus || latestRunStatus.toLowerCase() !== "completed")) {
      return "A prior run is still in progress or recently interrupted. Monitor activity, then continue ingest.";
    }
    return "Knowledge reservoir is active. Repeat ingest safely to skip unchanged items and process only net-new changes.";
  }, [hasRuns, latestRunStatus, totalItems]);

  const apiSnippet = useMemo(() => {
    if (sourceMode === "web_search") {
      return `curl -X POST http://127.0.0.1:3001/api/brains/${brainId}/ingest -H "Content-Type: application/json" -d '{"source_type":"web_search","query":"${discoveryTopic.replace(/"/g, '\\"')}","max_candidates":${discoveryLimit}}'`;
    }
    if (sourceMode === "website_url") {
      return `curl -X POST http://127.0.0.1:3001/api/brains/${brainId}/ingest -H "Content-Type: application/json" -d '{"source_type":"website_url","url":"${websiteUrl.replace(/"/g, '\\"')}","max_pages":${websiteMaxPages},"crawl_depth":${websiteCrawlDepth}}'`;
    }
    if (sourceMode === "youtube") {
      return `curl -X POST http://127.0.0.1:3001/api/brains/${brainId}/ingest -H "Content-Type: application/json" -d '{"source_type":"youtube","url":"${youtubeUrl.replace(/"/g, '\\"')}"}'`;
    }
    return `curl -X POST http://127.0.0.1:3001/api/brains/${brainId}/ingest -F 'source_type=document_upload' -F 'title=${documentTitle.replace(/'/g, "")}' -F 'file=@/path/to/file.txt'`;
  }, [
    brainId,
    discoveryLimit,
    discoveryTopic,
    documentTitle,
    sourceMode,
    websiteCrawlDepth,
    websiteMaxPages,
    websiteUrl,
    youtubeUrl,
  ]);

  async function runDiscovery() {
    setIsRunningDiscovery(true);
    setResult(null);

    let requestedMaxResults: number | null = null;

    try {
      let res: Response;
      if (sourceMode === "web_search") {
        const trimmedTopic = discoveryTopic.trim();
        if (!trimmedTopic) {
          setResult({
            status: "error",
            title: "Topic required",
            message: "Enter a topic before running Web Search ingest.",
          });
          return;
        }

        requestedMaxResults = discoveryLimit;
        res = await fetch(`/api/brains/${brainId}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: "web_search",
            query: trimmedTopic,
            max_candidates: discoveryLimit,
          }),
        });
      } else if (sourceMode === "website_url") {
        const trimmedUrl = websiteUrl.trim();
        if (!trimmedUrl) {
          setResult({
            status: "error",
            title: "Website URL required",
            message: "Enter a URL before running Website ingest.",
          });
          return;
        }

        requestedMaxResults = websiteMaxPages;
        res = await fetch(`/api/brains/${brainId}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: "website_url",
            url: trimmedUrl,
            max_pages: websiteMaxPages,
            crawl_depth: websiteCrawlDepth,
          }),
        });
      } else if (sourceMode === "youtube") {
        const trimmedUrl = youtubeUrl.trim();
        if (!trimmedUrl) {
          setResult({
            status: "error",
            title: "YouTube URL required",
            message: "Enter a YouTube URL before running ingest.",
          });
          return;
        }

        requestedMaxResults = 1;
        res = await fetch(`/api/brains/${brainId}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: "youtube",
            url: trimmedUrl,
          }),
        });
      } else {
        if (!documentFile) {
          setResult({
            status: "error",
            title: "Document required",
            message: "Choose a supported text document before running ingest.",
          });
          return;
        }

        requestedMaxResults = 1;
        const formData = new FormData();
        formData.append("source_type", "document_upload");
        formData.append("file", documentFile);
        if (documentTitle.trim()) {
          formData.append("title", documentTitle.trim());
        }

        res = await fetch(`/api/brains/${brainId}/ingest`, {
          method: "POST",
          body: formData,
        });
      }

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMessage = resolveMessage(payload, res.status);
        setResult({
          status: "error",
          title: errorMessage,
          message: errorMessage,
          payload,
        });
        return;
      }

      const runId: string | undefined = payload?.run_id || payload?.id;
      const ingestSummary = normalizeIngestSummary(payload, sourceMode, requestedMaxResults);
      setResult({
        status: "success",
        title: "Ingest run complete",
        message:
          `${ingestSummary.candidatesFound ?? 0} candidates found. ` +
          `${ingestSummary.newItemsAdded ?? 0} new items added. ` +
          `${ingestSummary.duplicatesSkipped ?? 0} unchanged skipped. ` +
          `${ingestSummary.updatedItems ?? 0} updated. ` +
          `${ingestSummary.versionedItems ?? 0} versioned.`,
        runId,
        payload,
        ingestSummary,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown ingest error.";
      setResult({
        status: "error",
        title: errorMessage,
        message: errorMessage,
      });
    } finally {
      setIsRunningDiscovery(false);
    }
  }

  async function runKnowledgeTest(mode: ConsoleAction) {
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
            Ingest from Web Search, Website URL, Document Upload, or YouTube with contract-level dedupe.
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
            aria-pressed={sourceMode === "web_search"}
            className={`rounded-full border px-3 py-1 text-xs transition ${sourceButtonClass(sourceMode === "web_search")}`}
          >
            <span className="inline-flex items-center gap-1">
              <Radar className="h-3.5 w-3.5" />
              Web Search
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("website_url")}
            aria-pressed={sourceMode === "website_url"}
            className={`rounded-full border px-3 py-1 text-xs transition ${sourceButtonClass(sourceMode === "website_url")}`}
          >
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              Website URL
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("document_upload")}
            aria-pressed={sourceMode === "document_upload"}
            className={`rounded-full border px-3 py-1 text-xs transition ${sourceButtonClass(sourceMode === "document_upload")}`}
          >
            <span className="inline-flex items-center gap-1">
              <FileUp className="h-3.5 w-3.5" />
              Document Upload
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("youtube")}
            aria-pressed={sourceMode === "youtube"}
            className={`rounded-full border px-3 py-1 text-xs transition ${sourceButtonClass(sourceMode === "youtube")}`}
          >
            <span className="inline-flex items-center gap-1">
              <Video className="h-3.5 w-3.5" />
              YouTube
            </span>
          </button>
        </div>
      </div>

      {sourceMode === "web_search" ? (
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
            Max candidates this run
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
              {isRunningDiscovery ? "Running ingest..." : "Run Ingest"}
            </button>
          </div>
        </div>
      ) : null}

      {sourceMode === "website_url" ? (
        <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_auto]">
          <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400 md:col-span-2">
            Website URL
            <input
              type="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Max pages
            <input
              type="number"
              min={1}
              max={20}
              value={websiteMaxPages}
              onChange={(event) => setWebsiteMaxPages(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Crawl depth
            <input
              type="number"
              min={0}
              max={2}
              value={websiteCrawlDepth}
              onChange={(event) => setWebsiteCrawlDepth(Math.max(0, Math.min(2, Number(event.target.value) || 0)))}
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
              <Globe className="h-4 w-4" />
              {isRunningDiscovery ? "Running ingest..." : "Run Ingest"}
            </button>
          </div>
        </div>
      ) : null}

      {sourceMode === "document_upload" ? (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Document title (optional)
            <input
              type="text"
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="Optional display title"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Upload file
            <input
              type="file"
              accept=".txt,.md,.csv,.json,.xml,text/plain,text/markdown,text/csv,application/json,application/xml"
              onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={runDiscovery}
              disabled={isRunningDiscovery}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/30 disabled:opacity-60"
            >
              <FileUp className="h-4 w-4" />
              {isRunningDiscovery ? "Running ingest..." : "Run Ingest"}
            </button>
          </div>
        </div>
      ) : null}

      {sourceMode === "youtube" ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
            YouTube URL
            <input
              type="url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
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
              <Video className="h-4 w-4" />
              {isRunningDiscovery ? "Running ingest..." : "Run Ingest"}
            </button>
          </div>
        </div>
      ) : null}

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
          {result.status === "success" && result.ingestSummary ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Candidates found</div>
                <div className="mt-0.5 text-xs text-slate-100">{formatMaybe(result.ingestSummary.candidatesFound)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">New items added</div>
                <div className="mt-0.5 text-xs text-slate-100">{formatMaybe(result.ingestSummary.newItemsAdded)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Unchanged skipped</div>
                <div className="mt-0.5 text-xs text-slate-100">{formatMaybe(result.ingestSummary.duplicatesSkipped)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Updated</div>
                <div className="mt-0.5 text-xs text-slate-100">{formatMaybe(result.ingestSummary.updatedItems)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Versioned</div>
                <div className="mt-0.5 text-xs text-slate-100">{formatMaybe(result.ingestSummary.versionedItems)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Eligible for processing</div>
                <div className="mt-0.5 text-xs text-slate-100">{formatMaybe(result.ingestSummary.eligibleForProcessing)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-2 sm:col-span-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Source totals by type</div>
                <div className="mt-0.5 text-xs text-slate-100">
                  Web Search: {formatMaybe(result.ingestSummary.sourceTotals.web_search)}
                  {" · "}
                  Website URL: {formatMaybe(result.ingestSummary.sourceTotals.website_url)}
                  {" · "}
                  Document Upload: {formatMaybe(result.ingestSummary.sourceTotals.document_upload)}
                  {" · "}
                  YouTube: {formatMaybe(result.ingestSummary.sourceTotals.youtube)}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
