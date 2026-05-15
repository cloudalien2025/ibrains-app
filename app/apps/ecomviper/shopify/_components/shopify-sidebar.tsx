"use client";

import { shopifyWorkspaceNavItems } from "@/lib/ecomviper/shopify/shopify-nav";
import type { ShopifyWorkspaceLaneId } from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifySidebarProps {
  activeLane: ShopifyWorkspaceLaneId;
  onSelectLane: (lane: ShopifyWorkspaceLaneId) => void;
}

export default function ShopifySidebar({ activeLane, onSelectLane }: ShopifySidebarProps) {
  return (
    <aside className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">ECOMVIPER</p>
        <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Shopify Agentic Workspace</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          AI storefront, Knowledge Base, and referral readiness lanes
        </p>
      </div>

      <nav className="grid gap-1" data-testid="ecomviper-shopify-sidebar">
        {shopifyWorkspaceNavItems.map((item) => {
          const active = item.id === activeLane;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectLane(item.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                active
                  ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#0F172A]"
                  : "border-transparent text-[#334155] hover:border-[#D9E4F0] hover:bg-white"
              }`}
              data-testid={`ecomviper-shopify-nav-${item.id}`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-3 rounded-lg border border-dashed border-[#D9E4F0] bg-[#F8FBFF] p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#64748B]">Automation</p>
        <p className="mt-1 text-xs text-[#475569]">
          Prioritize MCP, Knowledge Base, and semantic readiness actions that improve AI referrals.
        </p>
      </div>
    </aside>
  );
}
