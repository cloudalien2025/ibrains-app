const dashboardCards = [
  { label: "Source bundles registered", value: "0", note: "Bundle registry scaffolding" },
  { label: "Files processed", value: "0", note: "No extraction runtime in Phase 1.0" },
  { label: "Products normalized", value: "0", note: "Shared DB contract only" },
  { label: "Structured facts", value: "0", note: "Approved canonical facts" },
  { label: "Partial facts", value: "0", note: "Needs enrichment" },
  { label: "Visual-only facts", value: "0", note: "Image evidence pending parse" },
  { label: "Missing facts", value: "0", note: "Validation gap queue" },
  { label: "Open review items", value: "0", note: "Human review backlog" },
] as const;

export default function FileIqDashboardCards() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="fileiq-dashboard-cards">
      {dashboardCards.map((card) => (
        <article
          key={card.label}
          className="rounded-xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]"
        >
          <p className="text-xs uppercase tracking-[0.1em] text-[#64748B]">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{card.value}</p>
          <p className="mt-1 text-xs text-[#64748B]">{card.note}</p>
        </article>
      ))}
    </section>
  );
}
