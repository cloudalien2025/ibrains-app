import Link from "next/link";
import { headers } from "next/headers";
import EmptyState from "../_components/EmptyState";
import RunList, { type RunView } from "./_components/RunList";

type RunRecord = Record<string, unknown>;

function resolveRuns(payload: unknown): RunRecord[] {
  if (Array.isArray(payload)) return payload as RunRecord[];
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const list =
      (candidate.runs as unknown[]) ||
      (candidate.items as unknown[]) ||
      (candidate.data as unknown[]) ||
      [];
    if (Array.isArray(list)) return list as RunRecord[];
  }
  return [];
}

function normalizeRun(run: RunRecord): RunView {
  const id =
    String(
      run.run_id ??
        run.id ??
        run.runId ??
        run.job_id ??
        run.jobId ??
        "unknown_run"
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

async function loadRuns(): Promise<{
  runs: RunView[];
  error?: string;
}> {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  try {
    const res = await fetch(`${baseUrl}/api/runs`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { runs: [], error: `HTTP ${res.status} while loading runs` };
    }
    const payload = await res.json().catch(() => null);
    const list = resolveRuns(payload);
    return { runs: list.map(normalizeRun) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown fetch error";
    return { runs: [], error: message };
  }
}

export default async function RunsPage() {
  const { runs, error } = await loadRuns();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Run telemetry
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">Runs</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Inspect recent runs, monitor pipeline stages, and jump into
              diagnostics with a single click.
            </p>
          </div>
          <Link
            href="/brains"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Browse brains
          </Link>
        </div>
      </section>

      {error ? (
        <EmptyState
          title="Unable to load runs"
          description={`The runs endpoint did not respond as expected (${error}). Check /api/runs and retry.`}
          action={
            <Link
              href="/brains"
              className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
            >
              Start a run
            </Link>
          }
        />
      ) : runs.length === 0 ? (
        <EmptyState
          title="No active runs detected"
          description="Launch a brain run to populate this dashboard with live statuses, counters, and time-to-complete metrics."
          action={
            <Link
              href="/brains"
              className="inline-flex items-center rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/30 transition hover:bg-emerald-400/20"
            >
              Start a run
            </Link>
          }
        />
      ) : (
        <RunList runs={runs} />
      )}
    </div>
  );
}
