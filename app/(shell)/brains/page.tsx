import Link from "next/link";
import { headers } from "next/headers";
import BrainsTable, { type BrainView } from "./_components/BrainsTable";
import EmptyState from "../_components/EmptyState";
import { brainCatalogById, isBrainId } from "@/lib/brains/brainCatalog";

type BrainRecord = Record<string, unknown>;

function resolveBrains(payload: unknown): BrainRecord[] {
  if (Array.isArray(payload)) return payload as BrainRecord[];
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const list =
      (candidate.brains as unknown[]) ||
      (candidate.items as unknown[]) ||
      (candidate.data as unknown[]) ||
      [];
    if (Array.isArray(list)) return list as BrainRecord[];
  }
  return [];
}

function normalizeBrain(brain: BrainRecord): BrainView {
  const rawId =
    String(
      brain.brain_id ??
        brain.id ??
        brain.slug ??
        brain.key ??
        "unknown_brain"
    ) || "unknown_brain";
  const id = isBrainId(rawId) ? rawId : "directoryiq";
  const name =
    String(
      brain.name ??
        brain.title ??
        brain.brain_name ??
        brain.display_name ??
        "Unnamed brain"
    ) || "Unnamed brain";
  const lastUpdated =
    (brain.last_updated as string | undefined) ??
    (brain.updated_at as string | undefined) ??
    (brain.last_run_at as string | undefined) ??
    (brain.created_at as string | undefined) ??
    null;
  const entitled = Boolean(brain.entitled ?? true);

  return {
    ...brainCatalogById[id],
    name: name || brainCatalogById[id].name,
    entitled,
    lastUpdated,
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
    return { brains: list.map(normalizeBrain) };
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
              Brains catalog
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">Brains</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Track every configured brain, monitor readiness, and launch runs
              directly from the console.
            </p>
          </div>
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
          description="Once the worker connection returns brains, they will appear here with quick actions for run launches and diagnostics."
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
