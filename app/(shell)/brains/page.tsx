import Link from "next/link";
import { headers } from "next/headers";
import BrainsTable, { type BrainView } from "./_components/BrainsTable";
import EmptyState from "../_components/EmptyState";
import CreateBrainDialog from "../_components/CreateBrainDialog";
import {
  isProductionVisibleBrain,
  normalizeBrainRecord,
  resolveBrains,
} from "@/lib/brains/brainViews";
import { brainCatalogById, brainIds } from "@/lib/brains/brainCatalog";

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
  const lastUpdated =
    (brain.last_updated as string | undefined) ??
    (brain.updated_at as string | undefined) ??
    (brain.last_run_at as string | undefined) ??
    (brain.created_at as string | undefined) ??
    null;
  const entitled = Boolean(brain.entitled ?? true);

  return {
    ...view,
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
    const canonicalFallbacks = brainIds.map((id) => ({
      id,
      name: brainCatalogById[id].name,
    }));
    const normalized = [...canonicalFallbacks, ...list]
      .filter(isProductionVisibleBrain)
      .map(normalizeBrain);
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
      <section className="rounded-[28px] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
              Brain Operations
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-[#0F172A]">Manage Brains</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#334155]">
              Open each brain console, monitor knowledge readiness, and run discovery,
              ingest, retrieval, and answering workflows from one operational surface.
            </p>
          </div>
          <CreateBrainDialog />
          <Link
            href="/runs"
            className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
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
              className="inline-flex items-center rounded-full bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D4ED8]"
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
              className="inline-flex items-center rounded-full bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D4ED8]"
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
