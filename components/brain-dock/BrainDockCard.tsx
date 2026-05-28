import Link from "next/link";
import { Clapperboard, Lock, Map, Zap } from "lucide-react";
import { type BrainViewEntry, brainRoute } from "@/lib/brains/brainCatalog";
import { brainTheme } from "@/components/brain-dock/brainTheme";

const icons = {
  map: Map,
  zap: Zap,
  clapperboard: Clapperboard,
};

type BrainDockCardProps = {
  brain: BrainViewEntry;
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
        entitled ? "hover:border-[#22D3EE]/40" : "opacity-90 hover:opacity-100"
      }`}
    >
      {!entitled ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-100 via-transparent to-transparent" />
      ) : null}

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Brain</div>
          <h3 className="mt-2 flex items-center gap-2 text-xl font-semibold text-[#0F172A]">
            <Icon className="h-5 w-5 text-[#2563EB]" />
            {brain.name}
          </h3>
          <p className="mt-2 text-sm text-[#334155]">{brain.shortDescription}</p>
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
          <span key={tag} className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-2.5 py-1 text-xs text-[#64748B]">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 text-xs text-[#64748B]">
        Last signal sync: <span className="text-[#0F172A]">{lastUpdated || "Not reported"}</span>
      </div>

      <section className="mt-4 rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/70 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.16em] text-[#2563EB]">Signal reservoir</div>
          <div className="text-xs font-semibold text-[#1D4ED8]">{displayReadiness}</div>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="relative h-16 w-10 overflow-hidden rounded-[999px] border border-[#22D3EE]/45 bg-white p-1.5 shadow-[inset_0_0_16px_rgba(34,211,238,0.18)]">
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
            <div className="text-[#334155]">
              Readiness: <span className="font-medium text-[#0F172A]">{displayReadiness}</span>
            </div>
            <div className="text-[#334155]">
              Items: <span className="font-medium text-[#0F172A]">{totalItemsLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {!entitled ? (
        <p className="mt-3 text-sm text-amber-700">{brain.upsellMessage}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={href} className={brainTheme.glowButton}>
          {entitled ? brain.primaryCtaText : "Unlock"}
        </Link>
      </div>
    </article>
  );
}
