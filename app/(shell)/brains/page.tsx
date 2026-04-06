import Link from "next/link";
import { headers } from "next/headers";
import BrainsTable, { type BrainView } from "./_components/BrainsTable";
import EmptyState from "../_components/EmptyState";
import CreateBrainDialog from "../_components/CreateBrainDialog";
import {
  isProductionVisibleBrain,
  normalizeBrainRecord,
  resolveBrainRecordId,
  resolveBrains,
} from "@/lib/brains/brainViews";

type BrainRecord = Record<string, unknown>;
type BrainStatsRecord = Record<string, unknown>;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBrain(brain: BrainRecord): BrainView {
  const view = normalizeBrainRecord(brain);
  const id = resolveBrainRecordId(brain);
  const lastUpdated =
    (brain.last_updated as string | undefined) ??
    (brain.updated_at as string | undefined) ??
    (brain.last_run_at as string | undefined) ??
    (brain.created_at as string | undefined) ??
    null;
  const entitled = Boolean(brain.entitled ?? true);

  return {
    ...view,
    id,
    entitled,
    lastUpdated,
    readinessPct: null,
    totalItems: null,
  };
}

async function loadBrains(): Promise<{
  brains: BrainView[];
  error?: string;
}> {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  try {
    const res = await fetch(`${baseUrl}/api/brains`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { brains: [], error: `HTTP ${res.status} while loading brains` };
    }
    const payload = await res.json().catch(() => null);
    const list = resolveBrains(payload);
    const normalized = list.filter(isProductionVisibleBrain).map(normalizeBrain);
    const uniqueBrains = Array.from(
      new Map(normalized.map((brain) => [brain.id, brain])).values()
    );

    const statEntries = await Promise.all(
      uniqueBrains.map(async (brain) => {
        try {
          const statsRes = await fetch(`${baseUrl}/api/brains/${brain.id}/stats`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          if (!statsRes.ok) return [brain.id, null] as const;
          const stats = (await statsRes.json().catch(() => null)) as BrainStatsRecord | null;
          return [brain.id, stats] as const;
        } catch {
          return [brain.id, null] as const;
        }
      })
    );

    const statsByBrain = new Map(statEntries);
    const withReadiness = uniqueBrains.map((brain) => {
      const stats = statsByBrain.get(brain.id);
      const readinessRaw = toNumber(stats?.fill_pct ?? stats?.readiness_pct ?? stats?.readiness);
      const readinessPct =
        readinessRaw == null ? null : Math.max(0, Math.min(100, readinessRaw));
      const totalItems = toNumber(
        stats?.total_items ?? stats?.items_total ?? stats?.source_count ?? stats?.sources_total
      );
      return {
        ...brain,
        readinessPct,
        totalItems,
      };
    });

    return { brains: withReadiness };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown fetch error";
    return { brains: [], error: message };
  }
}

export default async function BrainsPage() {
  const { brains, error } = await loadBrains();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Brain Operations
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">Manage Brains</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Open each brain console, monitor knowledge readiness, and run discovery,
              ingest, retrieval, and answering workflows from one operational surface.
            </p>
          </div>
          <CreateBrainDialog />
          <Link
            href="/runs"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            View latest runs
          </Link>
        </div>
      </section>

      {error ? (
        <EmptyState
          title="Unable to load brains"
          description={`The registry endpoint did not respond as expected (${error}). Check /api/brains and retry.`}
          action={
            <Link
              href="/"
              className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
            >
              Review system health
            </Link>
          }
        />
      ) : brains.length === 0 ? (
        <EmptyState
          title="Awaiting first brain sync"
          description="Once the worker connection returns brains, they will appear here with operational console actions for discovery, ingest, retrieval, and answering."
          action={
            <Link
              href="/"
              className="inline-flex items-center rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/30 transition hover:bg-emerald-400/20"
            >
              Review system health
            </Link>
          }
        />
      ) : (
        <BrainsTable brains={brains} />
      )}
    </div>
  );
}
