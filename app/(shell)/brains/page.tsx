import BrainsTable, { type BrainView } from "./_components/BrainsTable";
import { brainCatalogById } from "@/lib/brains/brainCatalog";

const launcherBrainIds = [
  "ecomviper",
  "optibay",
  "optizon",
  "directoryiq",
  "casaflix",
  "pagebolt",
] as const;

export default async function BrainsPage() {
  const brains: BrainView[] = launcherBrainIds.map((id) => ({
    ...brainCatalogById[id],
    entitled: true,
    lastUpdated: null,
    readinessPct: null,
    totalItems: null,
  }));

  return (
    <div className="space-y-4" data-testid="ibrains-dashboard-page">
      <section className="rounded-2xl border border-[#D2E3F8] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1D4ED8]">iBrains Platform</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0F172A]">iBrains Dashboard</h1>
        <p className="mt-1 text-sm text-[#475569]">
          Launch each brain workspace from one shared operator shell.
        </p>
      </section>

      <BrainsTable brains={brains} />
    </div>
  );
}
