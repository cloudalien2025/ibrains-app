import Link from "next/link";
import { Cable, CheckCircle2, CircleDot, Lock } from "lucide-react";
import type { SignalSource } from "@/lib/copy/signalSourcesCatalog";

type SignalSourcesPanelProps = {
  title: string;
  subtitle: string;
  connectors: SignalSource[];
};

const categoryOrder = ["Core", "Recommended", "Optional"] as const;

function statusPill(status: SignalSource["status"]): { label: string; className: string; Icon: typeof CheckCircle2 } {
  if (status === "connected") {
    return {
      label: "Connected",
      className: "border-emerald-300/55 bg-emerald-100 text-emerald-700",
      Icon: CheckCircle2,
    };
  }

  if (status === "locked") {
    return {
      label: "Locked",
      className: "border-amber-300/55 bg-amber-100 text-amber-700",
      Icon: Lock,
    };
  }

  return {
    label: "Disconnected",
    className: "border-[#D9E4F0] bg-white text-[#334155]",
    Icon: CircleDot,
  };
}

export default function SignalSourcesPanel({ title, subtitle, connectors }: SignalSourcesPanelProps) {
  return (
    <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 backdrop-blur-md shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
      <header className="mb-4 border-b border-[#D9E4F0] pb-4">
        <div className="text-xs uppercase tracking-[0.18em] text-[#2563EB]">Signal Sources</div>
        <h2 className="mt-2 text-xl font-semibold text-[#0F172A]">{title}</h2>
        <p className="mt-1 text-sm text-[#334155]">{subtitle}</p>
      </header>

      <div className="space-y-5">
        {categoryOrder.map((category) => {
          const items = connectors.filter((connector) => connector.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category}>
              <div className="mb-2 text-xs uppercase tracking-[0.16em] text-[#64748B]">{category}</div>
              <div className="space-y-2">
                {items.map((connector) => {
                  const pill = statusPill(connector.status);
                  const Icon = pill.Icon;

                  return (
                    <article
                      key={connector.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                            <Cable className="h-4 w-4 text-[#2563EB]" />
                            {connector.name}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${pill.className}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {pill.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#334155]">{connector.description}</p>
                        {connector.disabledReason ? (
                          <p className="mt-1 text-xs text-[#64748B]">{connector.disabledReason}</p>
                        ) : null}
                      </div>

                      {connector.actionHref ? (
                        <Link
                          href={connector.actionHref}
                          className="inline-flex items-center rounded-xl border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-[#F8FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/60"
                        >
                          {connector.actionLabel}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={connector.disabledReason ?? connector.actionLabel}
                          className="inline-flex cursor-not-allowed items-center rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/70 px-3 py-1.5 text-xs font-medium text-[#64748B]"
                        >
                          {connector.actionLabel}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
