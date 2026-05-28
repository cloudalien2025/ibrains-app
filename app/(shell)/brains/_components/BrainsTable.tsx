"use client";

import BrainDockCard from "@/components/brain-dock/BrainDockCard";
import { brainsDockCopy, type BrainViewEntry } from "@/lib/brains/brainCatalog";
import { useEffect, useMemo, useState } from "react";

type BrainDockState = {
  entitled: boolean;
  lastUpdated?: string | null;
  readinessPct?: number | null;
  totalItems?: number | null;
};

export type BrainDockView = BrainViewEntry & BrainDockState;
export type BrainView = BrainDockView;

type BrainsTableProps = {
  brains: BrainDockView[];
};

type BrainStatsRecord = Record<string, unknown>;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default function BrainsTable({ brains }: BrainsTableProps) {
  const [enrichedById, setEnrichedById] = useState<Record<string, Partial<BrainDockView>>>({});
  const canonicalBrainIds = useMemo(() => brains.map((brain) => brain.id), [brains]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateStats() {
      const updates = await Promise.all(
        canonicalBrainIds.map(async (brainId) => {
          try {
            const response = await fetch(`/api/brains/${encodeURIComponent(brainId)}/stats`, {
              method: "GET",
              headers: { Accept: "application/json" },
              cache: "no-store",
            });
            if (!response.ok) return [brainId, null] as const;

            const stats = (await response.json().catch(() => null)) as BrainStatsRecord | null;
            if (!stats) return [brainId, null] as const;

            const readinessRaw = toNumber(
              stats.fill_pct ?? stats.readiness_pct ?? stats.readiness
            );
            const readinessPct =
              readinessRaw == null ? null : Math.max(0, Math.min(100, readinessRaw));
            const totalItems = toNumber(
              stats.total_items ?? stats.items_total ?? stats.source_count ?? stats.sources_total
            );
            const lastUpdated =
              (stats.last_updated as string | undefined) ??
              (stats.updated_at as string | undefined) ??
              (stats.last_run_at as string | undefined) ??
              null;
            return [
              brainId,
              {
                readinessPct,
                totalItems,
                ...(lastUpdated ? { lastUpdated } : {}),
              } as Partial<BrainDockView>,
            ] as const;
          } catch {
            return [brainId, null] as const;
          }
        })
      );

      if (cancelled) return;
      const next: Record<string, Partial<BrainDockView>> = {};
      for (const [brainId, partial] of updates) {
        if (!partial) continue;
        next[brainId] = partial;
      }
      setEnrichedById(next);
    }

    void hydrateStats();
    return () => {
      cancelled = true;
    };
  }, [canonicalBrainIds]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#2563EB]">{brainsDockCopy.eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold text-[#0F172A]">{brainsDockCopy.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-[#334155]">
          {brainsDockCopy.subtitle}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {brains.map((brain) => {
          const hydrated = enrichedById[brain.id];
          return (
            <BrainDockCard
              key={brain.id}
              brain={brain}
              entitled={brain.entitled}
              lastUpdated={(hydrated?.lastUpdated as string | null | undefined) ?? brain.lastUpdated}
              readinessPct={
                typeof hydrated?.readinessPct === "number" || hydrated?.readinessPct === null
                  ? (hydrated.readinessPct as number | null)
                  : brain.readinessPct
              }
              totalItems={
                typeof hydrated?.totalItems === "number" || hydrated?.totalItems === null
                  ? (hydrated.totalItems as number | null)
                  : brain.totalItems
              }
            />
          );
        })}
      </section>
    </div>
  );
}
