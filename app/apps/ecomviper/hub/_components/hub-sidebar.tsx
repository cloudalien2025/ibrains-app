import Link from "next/link";

const hubSidebarItems = [
  { label: "Overview", href: "/apps/ecomviper/hub#overview" },
  { label: "Feed Control Center", href: "/apps/ecomviper/hub#feed-control-center" },
  { label: "Canonical Product Manager", href: "/apps/ecomviper/hub#canonical-product-manager" },
  { label: "Agentic Visibility", href: "/apps/ecomviper/hub#agentic-visibility" },
  { label: "Marketplace Routing", href: "/apps/ecomviper/hub#marketplace-routing" },
  { label: "Trust & Verification", href: "/apps/ecomviper/hub#trust-and-verification" },
  { label: "Operations", href: "/apps/ecomviper/hub#operator-workflows" },
  { label: "Roadmap", href: "/apps/ecomviper/hub#roadmap" },
] as const;

export default function HubSidebar() {
  return (
    <aside className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">ECOMVIPER</p>
        <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Hub Control Plane</h2>
        <p className="mt-1 text-xs text-[#64748B]">Canonical intelligence and orchestration zones</p>
      </div>

      <nav className="grid gap-1" data-testid="ecomviper-hub-sidebar">
        {hubSidebarItems.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              index === 0
                ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#0F172A]"
                : "border-transparent text-[#334155] hover:border-[#D9E4F0] hover:bg-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-3 rounded-lg border border-dashed border-[#D9E4F0] bg-[#F8FBFF] p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#64748B]">Shell Status</p>
        <p className="mt-1 text-xs text-[#475569]">
          Feed Control Center is a static foundation in this sprint. Live sync, ingestion, routing execution, and scoring remain deferred.
        </p>
      </div>
    </aside>
  );
}
