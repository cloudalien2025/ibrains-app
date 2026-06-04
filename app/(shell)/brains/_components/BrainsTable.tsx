import BrainDockCard from "@/components/brain-dock/BrainDockCard";
import { type BrainViewEntry } from "@/lib/brains/brainCatalog";

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
  const safeBrains = Array.isArray(brains) ? brains.filter(Boolean) : [];

  return (
    <section className="grid gap-4 lg:grid-cols-3" data-testid="ibrains-launcher-grid">
      {safeBrains.map((brain) => (
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
  );
}
