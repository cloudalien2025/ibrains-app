import Link from "next/link";
import { headers } from "next/headers";
import EmptyState from "../../_components/EmptyState";
import StartRunDialog from "../../_components/StartRunDialog";

type BrainDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function BrainDetailPage({ params }: BrainDetailProps) {
  const { id } = await params;
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  let stats: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${baseUrl}/api/brains/${id}/stats`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      stats = await res.json().catch(() => null);
    }
  } catch {
    stats = null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Brain profile
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Brain {id}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              This view will summarize configuration, last run status, and
              recommended actions for the selected brain.
            </p>
          </div>
          <Link
            href="/brains"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Back to brains
          </Link>
        </div>
      </section>

      <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Run controls
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Launch a new run for this brain to collect fresh discovery data.
            </p>
          </div>
          <StartRunDialog brainId={id} brainName={`Brain ${id}`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-white/4 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Fill stats</div>
          {stats ? (
            <div className="mt-3 grid gap-2 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>Total items</span>
                <span className="font-mono text-xs text-slate-300">{String(stats.total_items ?? "—")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>YouTube items</span>
                <span className="font-mono text-xs text-slate-300">{String(stats.youtube_items ?? "—")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>WebDocs items</span>
                <span className="font-mono text-xs text-slate-300">{String(stats.webdocs_items ?? "—")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fill %</span>
                <span className="font-mono text-xs text-slate-300">{String(stats.fill_pct ?? "—")}</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-300">
              Fill stats are unavailable from `/api/brains/{id}/stats`.
            </p>
          )}
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/4 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Recent runs
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Recent run history appears here so you can jump straight into
            diagnostics.
          </p>
        </div>
      </div>

      <EmptyState
        title="No runs launched yet"
        description="Start a run from the Brains list to begin collecting discovery and ingestion telemetry."
        action={
          <Link
            href="/brains"
            className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            Launch a run
          </Link>
        }
      />
    </div>
  );
}
