import Link from "next/link";
import { headers } from "next/headers";
import type { CSSProperties } from "react";
import { deriveCylinderVisualState } from "@/lib/brains/cylinderVisualState";
import {
  type MissionControlRunView as RunView,
  selectRunsForBrain,
} from "@/lib/brains/missionControlRunSelection";
import { summarizePostIngestProcessing } from "@/lib/brains/postIngestProcessingContract";
import { normalizeBrainRecord } from "@/lib/brains/brainViews";
import BrainConsoleActions from "./_components/BrainConsoleActions";

type BrainDetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ action?: string }>;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatCount(value: number | null): string {
  if (value == null) return "Not reported";
  return value.toLocaleString();
}

export default async function BrainDetailPage({ params, searchParams }: BrainDetailProps) {
  const { id } = await params;
  const brainId = decodeURIComponent(id);
  const encodedBrainId = encodeURIComponent(brainId);

  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  let brainRecord: Record<string, unknown> = { id: brainId };
  let stats: Record<string, unknown> | null = null;
  let runs: RunView[] = [];
  let latestRunPayload: unknown = null;
  let latestRunReportPayload: unknown = null;

  try {
    const [brainRes, statsRes, runsRes] = await Promise.all([
      fetch(`${baseUrl}/api/brains/${encodedBrainId}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      fetch(`${baseUrl}/api/brains/${encodedBrainId}/stats`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      fetch(`${baseUrl}/api/runs`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    ]);

    if (brainRes.ok) {
      const payload = await brainRes.json().catch(() => null);
      if (payload && typeof payload === "object") {
        brainRecord = payload as Record<string, unknown>;
      }
    }

    if (statsRes.ok) {
      stats = await statsRes.json().catch(() => null);
    }

    if (runsRes.ok) {
      const payload = await runsRes.json().catch(() => null);
      runs = selectRunsForBrain(payload, brainId, 6);

      const newestRunId = runs[0]?.id;
      if (newestRunId) {
        const [runDetailRes, runReportRes] = await Promise.all([
          fetch(`${baseUrl}/api/runs/${newestRunId}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
          fetch(`${baseUrl}/api/runs/${newestRunId}/report`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
        ]);
        if (runDetailRes.ok) latestRunPayload = await runDetailRes.json().catch(() => null);
        if (runReportRes.ok) latestRunReportPayload = await runReportRes.json().catch(() => null);
      }
    }
  } catch {
    brainRecord = { id: brainId };
    stats = null;
    runs = [];
    latestRunPayload = null;
    latestRunReportPayload = null;
  }
  const brain = normalizeBrainRecord(brainRecord);

  const totalItems = toNumber(stats?.total_items) ?? 0;
  const youtubeItems = toNumber(stats?.youtube_items) ?? 0;
  const webdocsItems = toNumber(stats?.webdocs_items) ?? 0;
  const fillPctRaw = toNumber(stats?.fill_pct);
  const processingSummary = summarizePostIngestProcessing({
    runPayload: latestRunPayload,
    reportPayload: latestRunReportPayload,
    statsPayload: stats,
    fallbackReadinessPct: fillPctRaw,
    fallbackCollectedCount: totalItems,
  });
  const readinessPct = Math.max(0, Math.min(100, processingSummary.readinessPct ?? 0));

  const latestRun = runs[0];
  const recentDiscovery = latestRun ? formatDate(latestRun.startedAt) : "No discovery activity yet.";
  const recentIngest = latestRun?.status || "No ingest activity yet.";
  const missionStatus = processingSummary.blockingState;
  const readinessTag = processingSummary.blockingState;
  const missionTitle =
    brainId === "directoryiq" ? "DirectoryIQ Mission Control" : `${brain.name} Mission Control`;
  const nextAction = `Next: ${processingSummary.nextStep}`;
  const readinessPctRounded = Math.round(readinessPct);
  const cylinderVisualState = deriveCylinderVisualState({
    collected: processingSummary.counts.collected,
    normalized: processingSummary.counts.normalized,
    classified: processingSummary.counts.classified,
    summarized: processingSummary.counts.summarized,
    processedCount: processingSummary.processedCount,
    activated: processingSummary.counts.activated,
  });
  const baseFillHeight = Math.round(readinessPct * 0.82 * cylinderVisualState.fillMultiplier);
  const cylinderFillHeight = Math.max(cylinderVisualState.minFillPct, baseFillHeight);
  const cylinderGlowOpacity = (0.22 + (readinessPct / 100) * 0.35) * cylinderVisualState.glowBoost;
  const cylinderSignalStrength = (0.55 + (readinessPct / 100) * 0.45) * cylinderVisualState.signalBoost;
  const cylinderFillShadow = `0 0 ${Math.round(34 * cylinderVisualState.glowBoost)}px rgba(80,255,170,${(
    0.22 + cylinderVisualState.glowBoost * 0.13
  ).toFixed(2)})`;

  const initialAction = (await searchParams)?.action;

  return (
    <div className="space-y-3">
      <section className="rounded-[18px] border border-white/10 bg-slate-950/65 px-4 py-3 shadow-[0_16px_32px_rgba(2,6,23,0.55)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/65">iBrains</div>
            <h1 className="mt-0.5 truncate text-2xl font-semibold text-white">{missionTitle}</h1>
            <p className="mt-0.5 text-xs text-slate-300">
              Operational cockpit for discovery, knowledge intake, and run-state monitoring.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
              Live System
            </span>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">
              {readinessPctRounded}% Ready
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
              {readinessTag}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
              {nextAction}
            </span>
            <Link
              href="/brains"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
            >
              Back to Brains
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <BrainConsoleActions
            brainId={brainId}
            brainName={brain.name}
            totalItems={totalItems}
            hasRuns={runs.length > 0}
            latestRunStatus={latestRun?.status}
            initialAction={initialAction}
          />
        </div>

        <section className="rounded-[18px] border border-cyan-300/25 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.1),0_18px_36px_rgba(2,6,23,0.6)]">
          <div className="rounded-2xl border border-cyan-200/15 bg-black/20 px-3 py-3">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/75">Signal Reservoir</div>
              <div className="mt-1 text-xl font-semibold text-cyan-100">{readinessPctRounded}% Ready</div>
              <p className="mt-0.5 text-[11px] text-slate-300">{missionStatus}</p>
              <p className="mt-1 text-[11px] text-slate-400">{processingSummary.blockingReason}</p>
            </div>

            <div className="relative mt-3 flex justify-center">
              <div
                className={`relative h-52 w-32 cylinder-state-${cylinderVisualState.stage}`}
                style={
                  {
                    ["--cyl-drift-duration" as string]: `${cylinderVisualState.driftDurationSec}s`,
                    ["--cyl-breathe-duration" as string]: `${cylinderVisualState.breatheDurationSec}s`,
                    ["--cyl-surface-boost" as string]: cylinderVisualState.surfaceBoost,
                    ["--cyl-shimmer-boost" as string]: cylinderVisualState.shimmerBoost,
                    ["--cyl-pool-boost" as string]: cylinderVisualState.poolBoost,
                  } as CSSProperties
                }
              >
                <div className="absolute bottom-0 left-2 right-2 top-2 rounded-[999px] border border-emerald-200/30 bg-slate-950/70 shadow-[inset_0_0_22px_rgba(80,255,170,0.2),0_0_20px_rgba(80,255,170,0.12)]" />
                <div className="absolute bottom-3 left-4 right-4 top-4 overflow-hidden rounded-[999px] border border-emerald-200/15">
                  <div
                    className="cylinder-signal-inner absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(108,255,178,0.12) 0%, rgba(108,255,178,0.04) 42%, rgba(108,255,178,0) 100%)",
                    }}
                  />
                  <div
                    className="cylinder-signal-fill absolute bottom-0 left-0 right-0 overflow-hidden rounded-[999px] border border-emerald-200/30"
                    style={{
                      height: `${cylinderFillHeight}%`,
                      opacity: cylinderGlowOpacity,
                      ["--signal-strength" as string]: cylinderSignalStrength,
                      background:
                        "linear-gradient(to top, rgba(50,213,131,0.35) 0%, rgba(74,236,154,0.24) 54%, rgba(108,255,178,0.15) 100%)",
                      boxShadow: cylinderFillShadow,
                    }}
                  >
                    <div
                      className="cylinder-signal-surface absolute inset-x-0 top-0 h-4"
                      style={{
                        background:
                          "linear-gradient(to right, rgba(176,255,215,0), rgba(176,255,215,0.35), rgba(176,255,215,0))",
                      }}
                    />
                    <div className="cylinder-signal-meniscus absolute inset-x-0 top-0 h-5" />
                  </div>
                  <div
                    className="cylinder-signal-inner absolute inset-x-0 top-4 h-16"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(176,255,215,0.18) 0%, rgba(176,255,215,0) 100%)",
                    }}
                  />
                </div>
                <div
                  className="cylinder-signal-glow absolute inset-x-4 bottom-2 h-5 rounded-full bg-[rgba(80,255,170,0.24)] blur-md"
                  style={{ ["--signal-strength" as string]: cylinderSignalStrength }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Readiness</div>
              <div className="mt-0.5 text-sm font-semibold text-white">{readinessPctRounded}%</div>
              <div className="mt-1 text-[10px] text-slate-400">
                {processingSummary.readinessSource === "stage_based"
                  ? "Based on post-ingest stage progress."
                  : "Using upstream readiness signal until processing telemetry is complete."}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Items collected</div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {formatCount(processingSummary.counts.collected)}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Items processed</div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {formatCount(processingSummary.processedCount)}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Items activated</div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {formatCount(processingSummary.counts.activated)}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Web items collected</div>
              <div className="mt-0.5 text-sm font-semibold text-white">{webdocsItems.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">YouTube items collected</div>
              <div className="mt-0.5 text-sm font-semibold text-white">{youtubeItems.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2 sm:col-span-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Current blocker</div>
              <div className="mt-0.5 text-xs font-medium text-slate-100">{processingSummary.blockingState}</div>
              <div className="mt-1 text-[11px] text-slate-300">{processingSummary.blockingReason}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2 sm:col-span-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Last operation</div>
              <div className="mt-0.5 text-xs text-slate-100">{formatDate(latestRun?.startedAt)}</div>
            </div>
            <div className="rounded-lg border border-cyan-200/25 bg-cyan-300/5 p-2 sm:col-span-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/80">Post-ingest processing</div>
              <div className="mt-1 grid gap-1 text-[11px] text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Telemetry</span>
                  <span className="font-medium text-cyan-100">{processingSummary.telemetryCompleteness}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Processing status</span>
                  <span className="font-medium text-cyan-100">{processingSummary.processingStatus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current stage</span>
                  <span className="font-medium text-cyan-100">{processingSummary.currentStage}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Items Collected</span>
                  <span>{formatCount(processingSummary.counts.collected)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Items Normalized</span>
                  <span>{formatCount(processingSummary.counts.normalized)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Items Classified</span>
                  <span>{formatCount(processingSummary.counts.classified)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Items Summarized</span>
                  <span>{formatCount(processingSummary.counts.summarized)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Items Activated</span>
                  <span>{formatCount(processingSummary.counts.activated)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Items Processed</span>
                  <span>{formatCount(processingSummary.processedCount)}</span>
                </div>
              </div>
              <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-slate-300">
                Next blocking step: {processingSummary.nextStep}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[16px] border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Recent activity</div>
          <div className="text-xs text-slate-400">Secondary telemetry</div>
        </div>
        <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-white/10 bg-black/25 p-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Recent discovery</div>
            <p className="mt-1 text-xs text-slate-100">{recentDiscovery}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Recent ingest</div>
            <p className="mt-1 text-xs text-slate-100">{recentIngest}</p>
          </div>
        </div>

        <div className="mt-2">
          {runs.length === 0 ? (
            <p className="text-xs text-slate-300">No runs available for this brain yet.</p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-3">
              {runs.slice(0, 6).map((run) => (
                <div key={run.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/runs/${run.id}`}
                      className="truncate text-xs font-medium text-cyan-100 transition hover:text-cyan-50"
                    >
                      {run.id}
                    </Link>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                      {run.status || "unknown"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{formatDate(run.startedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
