import Link from "next/link";
import HubFeedControlCenter from "@/app/apps/ecomviper/hub/_components/hub-feed-control-center";

const foundationCards = [
  {
    label: "Shell Status",
    value: "Initial",
    description: "Static command-center shell aligned to planning docs.",
  },
  {
    label: "Planning Source",
    value: "Canonical",
    description: "Source of truth: planning/apps/ecomviper/hub/.",
  },
  {
    label: "Marketplace Scope",
    value: "Walmart · Shopify · eBay · Amazon",
    description: "Future expansion path includes Etsy, TikTok Shop, and WooCommerce.",
  },
  {
    label: "Execution Posture",
    value: "Deferred",
    description: "No feed ingestion, routing dispatch, persistence, or AI scoring in this sprint.",
  },
] as const;

const workflowSteps = [
  "Monitor feed and canonical intelligence health",
  "Review weak mappings, semantic gaps, and trust pressure",
  "Prioritize routing recommendations and queued actions",
  "Return channel outcomes to Hub for continuous optimization",
] as const;

const roadmapItems = [
  {
    phase: "Phase 1",
    title: "App shell and navigation entry",
    detail: "Establish lightweight workspace shell and section navigation for /apps/ecomviper/hub.",
  },
  {
    phase: "Phase 2",
    title: "Canonical feed aggregation",
    detail: "Define intake contracts, validation diagnostics, and queue-first intake monitoring.",
  },
  {
    phase: "Phase 3+",
    title: "Graph, routing, and agentic visibility",
    detail: "Introduce canonical graph workflows, routing decisions, and trust-aware intelligence surfaces.",
  },
] as const;

export default function HubWorkspaceClient() {
  return (
    <div className="space-y-4" data-testid="ecomviper-hub-workspace">
      <header id="overview" className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
              EcomViper Hub
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A]">AI-Native Commerce Intelligence Command Center</h1>
            <p className="mt-1 text-sm text-[#475569]">
              Hub is the canonical-first orchestration and product intelligence control plane for EcomViper, not a listing database.
            </p>
            <p className="mt-2 text-xs text-[#64748B]">
              This is the initial Hub shell only. Live marketplace ingestion, routing execution, persistence, and AI scoring are intentionally deferred.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/apps/ecomviper"
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              EcomViper Apps
            </Link>
            <Link
              href="/apps/ecomviper/walmart"
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              Open Walmart Workspace
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="ecomviper-hub-foundation-cards">
        {foundationCards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{card.label}</p>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">{card.value}</p>
            <p className="mt-1 text-xs text-[#475569]">{card.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]" data-testid="ecomviper-hub-overview-panel">
          <h2 className="text-lg font-semibold text-[#0F172A]">Hub Overview</h2>
          <p className="mt-2 text-sm text-[#334155]">
            EcomViper Hub is the cross-channel control plane for canonical product intelligence, feed aggregation posture, routing decisions,
            trust-aware review, and AI-native discovery readiness.
          </p>
          <p className="mt-2 text-sm text-[#334155]">
            Hub will aggregate optimized marketplace feed intelligence across Walmart, Shopify, eBay, Amazon, and future marketplace apps.
          </p>
        </article>

        <article
          id="canonical-product-manager"
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="ecomviper-hub-canonical-product-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Canonical Product Intelligence Graph</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Canonical product entities are first-class. Marketplace listings and offers are mapped artifacts with provenance, confidence,
            and conflict-aware review pathways.
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            Listing-first and channel-duplicated product modeling is intentionally out of scope for Hub.
          </p>
        </article>
      </section>

      <HubFeedControlCenter />

      <section className="grid gap-4 xl:grid-cols-2">
        <article
          id="marketplace-routing"
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="ecomviper-hub-marketplace-routing-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Marketplace Routing</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Planned for queue-first routing decisions that push prioritized actions back into marketplace workspaces after canonicalization and visibility approvals.
          </p>
          <p className="mt-2 text-xs text-[#64748B]">No dispatch execution, queue APIs, or channel-side automation is implemented in this sprint.</p>
        </article>

        <article
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="ecomviper-hub-publication-model-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Public Visibility Model</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Private Hub controls canonical intelligence publication approvals before anything can flow to the preferred public discovery surface at ecomviper.com.
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            No public routes are implemented in this sprint. This is static control-plane messaging only.
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article
          id="agentic-visibility"
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="ecomviper-hub-agentic-visibility-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Agentic Visibility</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Planned for semantic discovery diagnostics, retrieval readiness context, recommendation support, and action queue linkage.
          </p>
          <p className="mt-2 text-xs text-[#64748B]">No live visibility scoring contract execution is implemented in this shell sprint.</p>
        </article>

        <article
          id="trust-and-verification"
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="ecomviper-hub-trust-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Trust and Verification</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Planned for provenance-aware trust signals, review thresholds, and auditable decision context across canonical merge and routing workflows.
          </p>
          <p className="mt-2 text-xs text-[#64748B]">Trust scoring and compliance integrations are deferred.</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article
          id="operator-workflows"
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="ecomviper-hub-operator-workflows-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Operator Workflows</h2>
          <ol className="mt-3 space-y-2 text-sm text-[#334155]">
            {workflowSteps.map((step, index) => (
              <li key={step} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </article>

        <article
          id="roadmap"
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="ecomviper-hub-roadmap-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Roadmap / Coming Next</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#334155]">
            {roadmapItems.map((item) => (
              <li key={item.phase} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{item.phase}</p>
                <p className="mt-1 font-medium text-[#0F172A]">{item.title}</p>
                <p className="mt-1 text-sm text-[#475569]">{item.detail}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
