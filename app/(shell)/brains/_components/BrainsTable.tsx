import BrainDockCard from "@/components/brain-dock/BrainDockCard";
import { brainsDockCopy, type BrainCatalogEntry } from "@/lib/brains/brainCatalog";

type BrainDockState = {
  entitled: boolean;
  lastUpdated?: string | null;
};

export type BrainDockView = BrainCatalogEntry & BrainDockState;

type BrainsTableProps = {
  brains: BrainDockView[];
};

export default function BrainsTable({ brains }: BrainsTableProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-6 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(148,163,184,0.14),0_24px_50px_rgba(2,6,23,0.7),0_0_36px_rgba(34,211,238,0.08)]">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">{brainsDockCopy.eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold text-white">{brainsDockCopy.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          {brainsDockCopy.subtitle}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {brains.map((brain) => (
          <BrainDockCard key={brain.id} brain={brain} entitled={brain.entitled} lastUpdated={brain.lastUpdated} />
        ))}
      </section>
    </div>
  );
}
