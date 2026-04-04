import Link from "next/link";
import { Clapperboard, Lock, Map, Zap } from "lucide-react";
import { type BrainCatalogEntry, brainRoute } from "@/lib/brains/brainCatalog";
import { brainTheme } from "@/components/brain-dock/brainTheme";

const icons = {
  map: Map,
  zap: Zap,
  clapperboard: Clapperboard,
};

type BrainDockCardProps = {
  brain: BrainCatalogEntry;
  entitled: boolean;
  lastUpdated?: string | null;
  readinessPct?: number | null;
  totalItems?: number | null;
};

export default function BrainDockCard({
  brain,
  entitled,
  lastUpdated,
  readinessPct,
  totalItems,
}: BrainDockCardProps) {
  const Icon = icons[brain.iconKey];
  const href = brainRoute(brain.id);
  const hasReadiness = typeof readinessPct === "number" && Number.isFinite(readinessPct);
  const clampedReadiness = hasReadiness ? Math.max(0, Math.min(100, readinessPct)) : 0;
  const readinessHeight = `${clampedReadiness}%`;
  const signalStrength = 0.55 + (clampedReadiness / 100) * 0.45;
  const displayReadiness = hasReadiness ? `${Math.round(clampedReadiness)}%` : "N/A";
  const totalItemsLabel =
    typeof totalItems === "number" && Number.isFinite(totalItems)
      ? totalItems.toLocaleString()
      : "Not reported";

  return (
    <article
      className={`${brainTheme.glassCard} relative p-5 transition ${
        entitled ? "hover:border-cyan-200/35" : "opacity-85 hover:opacity-100"
      }`}
    >
      {!entitled ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/10 via-transparent to-transparent" />
      ) : null}

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Brain</div>
          <h3 className="mt-2 flex items-center gap-2 text-xl font-semibold text-slate-100">
            <Icon className="h-5 w-5 text-cyan-200" />
            {brain.name}
          </h3>
          <p className="mt-2 text-sm text-slate-300">{brain.shortDescription}</p>
        </div>

        {entitled ? (
          <span className={brainTheme.badge}>Ready</span>
        ) : (
          <span className={brainTheme.badgeLocked}>
            <Lock className="h-3.5 w-3.5" />
            Locked
          </span>
        )}
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {brain.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 text-xs text-slate-400">
        Last signal sync: <span className="text-slate-200">{lastUpdated || "Not reported"}</span>
      </div>

      <section className="mt-4 rounded-2xl border border-cyan-300/20 bg-slate-950/50 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">Signal reservoir</div>
          <div className="text-xs font-semibold text-cyan-100">{displayReadiness}</div>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="relative h-16 w-10 overflow-hidden rounded-[999px] border border-cyan-200/30 bg-slate-900/80 p-1.5 shadow-[inset_0_0_16px_rgba(34,211,238,0.2)]">
            <div
              className="absolute inset-x-1.5 top-1.5 h-1.5 rounded-full blur-[1px]"
              style={{
                background:
                  "linear-gradient(to right, rgba(176,255,215,0.15), rgba(176,255,215,0.35), rgba(176,255,215,0.15))",
              }}
            />
            <div
              className="cylinder-signal-inner absolute inset-x-1.5 bottom-1.5 top-1.5 rounded-[999px]"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(108,255,178,0.12) 0%, rgba(108,255,178,0.04) 42%, rgba(108,255,178,0) 100%)",
              }}
            />
            <div
              className="cylinder-signal-fill absolute bottom-1.5 left-1.5 right-1.5 overflow-hidden rounded-[999px] border border-emerald-200/25"
              style={{
                height: readinessHeight,
                ["--signal-strength" as string]: signalStrength,
                background:
                  "linear-gradient(to top, rgba(50,213,131,0.35) 0%, rgba(74,236,154,0.24) 54%, rgba(108,255,178,0.15) 100%)",
                boxShadow: "0 0 40px rgba(80,255,170,0.35)",
              }}
            >
              <div
                className="cylinder-signal-surface absolute inset-x-0 top-0 h-2"
                style={{
                  background:
                    "linear-gradient(to right, rgba(176,255,215,0), rgba(176,255,215,0.35), rgba(176,255,215,0))",
                }}
              />
            </div>
            <div
              className="cylinder-signal-glow absolute inset-x-2 bottom-1.5 h-2.5 rounded-full bg-[rgba(80,255,170,0.24)] blur-sm"
              style={{ ["--signal-strength" as string]: signalStrength }}
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="text-slate-300">
              Readiness: <span className="font-medium text-white">{displayReadiness}</span>
            </div>
            <div className="text-slate-300">
              Items: <span className="font-medium text-white">{totalItemsLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {!entitled ? (
        <p className="mt-3 text-sm text-amber-100/90">{brain.upsellMessage}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={href} className={brainTheme.glowButton}>
          {entitled ? "Open Console" : "Unlock"}
        </Link>
      </div>
    </article>
  );
}
