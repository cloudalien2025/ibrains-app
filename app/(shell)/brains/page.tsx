import Link from "next/link";
import BrainsTable, { type BrainView } from "./_components/BrainsTable";
import CreateBrainDialog from "../_components/CreateBrainDialog";
import { brainCatalogById, brainIds } from "@/lib/brains/brainCatalog";

function loadBrains(): BrainView[] {
  return brainIds.map((id) => ({
    ...brainCatalogById[id],
    entitled: true,
    lastUpdated: null,
    readinessPct: null,
    totalItems: null,
  }));
}

export default async function BrainsPage() {
  const brains = loadBrains();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
              Brains
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-[#0F172A]">My Brains</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#334155]">
              Open each standalone brain workspace from one index. Every card routes to its
              independent top-level brain.
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
      <BrainsTable brains={brains} />
    </div>
  );
}
