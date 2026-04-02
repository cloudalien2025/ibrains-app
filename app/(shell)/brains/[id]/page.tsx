import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { brainCatalogById, isBrainId, type BrainId } from "@/lib/brains/brainCatalog";
import BrainConsoleActions from "./_components/BrainConsoleActions";

type BrainDetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ action?: string }>;
};

type RunView = {
  id: string;
  brainId?: string | null;
  status?: string | null;
  startedAt?: string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resolveRuns(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const list =
      (candidate.runs as unknown[]) ||
      (candidate.items as unknown[]) ||
      (candidate.data as unknown[]) ||
      [];
    if (Array.isArray(list)) return list as Record<string, unknown>[];
  }
  return [];
}

function normalizeRun(run: Record<string, unknown>): RunView {
  const id =
    String(
      run.run_id ?? run.id ?? run.runId ?? run.job_id ?? run.jobId ?? "unknown_run"
    ) || "unknown_run";
  const brainId =
    (run.brain_id as string | undefined) ??
    (run.brainId as string | undefined) ??
    (run.brain as string | undefined) ??
    null;
  const status =
    (run.status as string | undefined) ??
    (run.state as string | undefined) ??
    (run.phase as string | undefined) ??
    null;
  const startedAt =
    (run.started_at as string | undefined) ??
    (run.created_at as string | undefined) ??
    (run.startedAt as string | undefined) ??
    null;
  return { id, brainId, status, startedAt };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default async function BrainDetailPage({ params, searchParams }: BrainDetailProps) {
  const { id } = await params;
  if (!isBrainId(id)) {
    notFound();
  }

  const brainId = id as BrainId;
  const brain = brainCatalogById[brainId];

  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  let stats: Record<string, unknown> | null = null;
  let runs: RunView[] = [];

  try {
    const [statsRes, runsRes] = await Promise.all([
      fetch(`${baseUrl}/api/brains/${brainId}/stats`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      fetch(`${baseUrl}/api/runs`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    ]);

    if (statsRes.ok) {
      stats = await statsRes.json().catch(() => null);
    }

    if (runsRes.ok) {
      const payload = await runsRes.json().catch(() => null);
      runs = resolveRuns(payload)
        .map(normalizeRun)
        .filter((run) => run.brainId === brainId)
        .slice(0, 6);
    }
  } catch {
    stats = null;
    runs = [];
  }

  const totalItems = toNumber(stats?.total_items) ?? 0;
  const youtubeItems = toNumber(stats?.youtube_items) ?? 0;
  const webdocsItems = toNumber(stats?.webdocs_items) ?? 0;
  const fillPctRaw = toNumber(stats?.fill_pct);
  const readinessPct = Math.max(0, Math.min(100, fillPctRaw ?? 0));

  const latestRun = runs[0];
  const recentDiscovery = latestRun ? formatDate(latestRun.startedAt) : "No discovery activity yet.";
  const recentIngest = latestRun?.status || "No ingest activity yet.";
  const missionStatus = totalItems > 0 ? "Reservoir active" : "Cold start";
  const readinessTag =
    readinessPct >= 70 ? "Operational" : readinessPct >= 30 ? "Building" : "Needs knowledge";

  const initialAction = (await searchParams)?.action;

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.6)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300/70">
              DirectoryIQ Mission Control
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-white">{brain.name}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Operate discovery, knowledge intake, and run-state monitoring from one command surface.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/35 bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">
              {Math.round(readinessPct)}% Ready
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
              {readinessTag}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
              {missionStatus}
            </span>
            <Link
              href="/brains"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
            >
              Back
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <section className="space-y-3 rounded-[20px] border border-white/10 bg-white/5 p-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400/80">System state</div>
            <div className="mt-2 flex items-end justify-between">
              <div className="text-3xl font-semibold text-cyan-100">{Math.round(readinessPct)}%</div>
              <div className="text-xs text-slate-300">Readiness</div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-900">
              <div
                className="h-2 rounded-full bg-cyan-300/80 transition-all"
                style={{ width: `${Math.round(readinessPct)}%` }}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Total items</div>
              <div className="mt-1 text-lg font-semibold text-white">{totalItems.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Web sources</div>
              <div className="mt-1 text-lg font-semibold text-white">{webdocsItems.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">YouTube sources</div>
              <div className="mt-1 text-lg font-semibold text-white">{youtubeItems.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Last operation</div>
              <div className="mt-1 text-xs text-slate-100">{formatDate(latestRun?.startedAt)}</div>
            </div>
          </div>
        </section>

        <BrainConsoleActions
          brainId={brainId}
          brainName={brain.name}
          totalItems={totalItems}
          hasRuns={runs.length > 0}
          latestRunStatus={latestRun?.status}
          initialAction={initialAction}
        />

        <section className="space-y-3 rounded-[20px] border border-white/10 bg-white/5 p-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Recent discovery</div>
            <p className="mt-1 text-xs text-slate-100">{recentDiscovery}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Recent ingest</div>
            <p className="mt-1 text-xs text-slate-100">{recentIngest}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Run timeline</div>
            {runs.length === 0 ? (
              <p className="mt-2 text-xs text-slate-300">No runs available for this brain yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {runs.slice(0, 6).map((run) => (
                  <div key={run.id} className="rounded-lg border border-white/10 bg-black/25 p-2">
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
    </div>
  );
}
