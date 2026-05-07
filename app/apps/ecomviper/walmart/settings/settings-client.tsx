"use client";

import { useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";

interface SettingsClientProps {
  environment: string;
  region: string;
}

async function runDangerAction(action: "disconnect_marketplace" | "clear_products" | "reset_drafts") {
  const response = await fetch("/api/ecomviper/walmart/settings/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return response.ok;
}

export default function WalmartSettingsClient({ environment, region }: SettingsClientProps) {
  const [writeProtectionEnabled, setWriteProtectionEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function guardedAction(action: "disconnect_marketplace" | "clear_products" | "reset_drafts", confirmText: string) {
    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;
    const ok = await runDangerAction(action);
    setMessage(ok ? "Danger action completed." : "Danger action failed.");
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-settings-page">
      <WalmartPageHeader
        title="Settings"
        subtitle="Configure environment preferences, sync rules, and safety defaults."
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Workspace Settings</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-[#334155]">
              Environment mode
              <input value={environment === "production" ? "Production" : environment} readOnly className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2" />
            </label>
            <label className="text-sm text-[#334155]">
              Marketplace region
              <input value={region} readOnly className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2" />
            </label>
            <label className="text-sm text-[#334155]">
              Sync rules
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" defaultValue="Only submit validated drafts. Always show before/after preview." />
            </label>
            <label className="text-sm text-[#334155]">
              Import preferences
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" defaultValue="Import active catalog only. Preserve raw Walmart payload snapshots." />
            </label>
            <label className="text-sm text-[#334155]">
              Feed preferences
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" defaultValue="Use MP_MAINTENANCE for content changes and verify status until completion." />
            </label>
            <label className="flex items-center gap-2 text-sm text-[#334155]">
              <input type="checkbox" checked={writeProtectionEnabled} onChange={(event) => setWriteProtectionEnabled(event.target.checked)} />
              Production write disabled until preview/validation is complete
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-rose-800">Safety / Danger Zone</h2>
          <p className="mt-2 text-sm text-rose-700">These actions require confirmation and should be used only for controlled reset workflows.</p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => guardedAction("disconnect_marketplace", "Disconnect Walmart marketplace now?")}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-sm text-rose-700"
            >
              Disconnect marketplace
            </button>
            <button
              type="button"
              onClick={() => guardedAction("clear_products", "Clear all imported products now?")}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-sm text-rose-700"
            >
              Clear imported products
            </button>
            <button
              type="button"
              onClick={() => guardedAction("reset_drafts", "Reset all drafts now?")}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-sm text-rose-700"
            >
              Reset drafts
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}
        </article>
      </section>
    </div>
  );
}
