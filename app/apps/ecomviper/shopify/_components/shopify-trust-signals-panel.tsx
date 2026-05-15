import type { ShopifyAgenticWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifyTrustSignalsPanelProps {
  state: ShopifyAgenticWorkspaceState;
}

export default function ShopifyTrustSignalsPanel({ state }: ShopifyTrustSignalsPanelProps) {
  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-trust-signals-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Trust Signals</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Brand facts, support paths, marketplace availability, checkout trust, and policy signals.
        </p>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.trustSignals.map((signal) => (
            <div key={signal.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">
              <p className="text-xs uppercase tracking-[0.08em] text-[#64748B]">{signal.label}</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">{signal.value}</p>
              <p className="mt-1 text-xs text-[#64748B]">Impact: {signal.impact}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
