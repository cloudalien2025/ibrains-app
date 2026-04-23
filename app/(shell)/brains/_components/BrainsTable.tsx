import BrainDockCard from "@/components/brain-dock/BrainDockCard";
import { brainsDockCopy, type BrainViewEntry } from "@/lib/brains/brainCatalog";

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

export default function BrainsTable({ brains }: BrainsTableProps) {
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
        {brains.map((brain) => (
          <BrainDockCard
            key={brain.id}
            brain={brain}
            entitled={brain.entitled}
            lastUpdated={brain.lastUpdated}
            readinessPct={brain.readinessPct}
            totalItems={brain.totalItems}
          />
        ))}
      </section>
    </div>
  );
}
