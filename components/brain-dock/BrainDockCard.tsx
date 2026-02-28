import Link from "next/link";
import { Clapperboard, ExternalLink, Lock, Map, Zap } from "lucide-react";
import StartRunDialog from "@/app/(shell)/_components/StartRunDialog";
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
};

export default function BrainDockCard({ brain, entitled, lastUpdated }: BrainDockCardProps) {
  const Icon = icons[brain.iconKey];
  const href = brainRoute(brain.id);

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
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Selection Engine</div>
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

      {!entitled ? (
        <p className="mt-3 text-sm text-amber-100/90">{brain.upsellMessage}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={href} className={brainTheme.glowButton}>
          {entitled ? "Open" : "Unlock"}
        </Link>

        <Link href={href} target="_blank" rel="noopener" className={brainTheme.secondaryButton}>
          Open in new tab
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>

        {entitled ? <StartRunDialog brainId={brain.id} brainName={brain.name} /> : null}
      </div>
    </article>
  );
}
