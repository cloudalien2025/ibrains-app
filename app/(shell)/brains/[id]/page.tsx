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
  const readinessHeight = `${readinessPct}%`;

  const latestRun = runs[0];
  const recentDiscovery = latestRun
    ? `Last discovery-linked operation recorded ${formatDate(latestRun.startedAt)}.`
    : "No discovery activity recorded yet.";
  const recentIngest = latestRun
    ? `Latest ingest lifecycle status: ${latestRun.status || "unknown"}.`
    : "No ingest activity recorded yet.";

  const initialAction = (await searchParams)?.action;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Brain Console
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">{brain.name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{brain.shortDescription}</p>
          </div>
          <Link
            href="/brains"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Back to brain operations
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section className="relative overflow-hidden rounded-[24px] border border-cyan-300/25 bg-slate-950/70 p-6 shadow-[inset_0_1px_0_rgba(148,163,184,0.14),0_24px_50px_rgba(2,6,23,0.7),0_0_34px_rgba(34,211,238,0.14)]">
          <div className="pointer-events-none absolute inset-x-6 top-5 h-20 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Knowledge readiness</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Signal Reservoir</h3>
              <p className="mt-2 text-sm text-slate-300">
                Readiness is based on current fill metrics reported by the brain stats endpoint.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold text-cyan-100">{Math.round(readinessPct)}%</div>
              <div className="text-xs uppercase tracking-[0.16em] text-cyan-200/70">Ready</div>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-6">
            <div className="relative h-56 w-36 overflow-hidden rounded-[999px] border border-cyan-200/35 bg-slate-900/80 p-3 shadow-[inset_0_0_28px_rgba(34,211,238,0.22),0_0_24px_rgba(6,182,212,0.2)]">
              <div className="absolute inset-x-2 top-2 h-3 rounded-full bg-cyan-100/35 blur-sm" />
              <div className="absolute bottom-3 left-3 right-3 rounded-[999px] border border-cyan-200/30 bg-cyan-300/15 shadow-[0_0_18px_rgba(34,211,238,0.35)]" style={{ height: readinessHeight }} />
              <div className="absolute inset-x-4 bottom-4 h-2 rounded-full bg-cyan-100/50 blur-[2px]" />
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400/80">Total items</div>
                <div className="mt-2 text-xl font-semibold text-white">{totalItems.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400/80">YouTube items</div>
                <div className="mt-2 text-xl font-semibold text-white">{youtubeItems.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400/80">Webdocs items</div>
                <div className="mt-2 text-xl font-semibold text-white">{webdocsItems.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400/80">Last operation</div>
                <div className="mt-2 text-sm font-medium text-white">{formatDate(latestRun?.startedAt)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Recent discovery</div>
            <p className="mt-2 text-sm text-slate-200">{recentDiscovery}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Recent ingest</div>
            <p className="mt-2 text-sm text-slate-200">{recentIngest}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Recent run IDs</div>
            {runs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-300">No runs available for this brain yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {runs.slice(0, 3).map((run) => (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:bg-white/10"
                  >
                    {run.id}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <BrainConsoleActions brainId={brainId} brainName={brain.name} initialAction={initialAction} />
    </div>
  );
}
