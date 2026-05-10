"use client";

import { useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";

interface SettingsClientProps {
  environment: string;
  region: string;
}

type DangerAction = "disconnect_marketplace" | "clear_products" | "reset_drafts";

interface DangerActionResponse {
  ok: boolean;
  action?: DangerAction;
  clearedProductCount?: number;
  clearedImportStateCount?: number;
  clearedImageMetadataCount?: number;
  blockedDraftCount?: number;
  error?: {
    code?: string;
    message?: string;
  };
}

async function runDangerAction(action: DangerAction): Promise<DangerActionResponse> {
  const response = await fetch("/api/ecomviper/walmart/settings/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json().catch(() => ({}))) as DangerActionResponse;
  if (response.ok) {
    return {
      ...payload,
      action,
      ok: true,
    };
  }
  return {
    ...payload,
    action,
    ok: false,
  };
}

export default function WalmartSettingsClient({ environment, region }: SettingsClientProps) {
  const [writeProtectionEnabled, setWriteProtectionEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [clearProductsModalOpen, setClearProductsModalOpen] = useState(false);
  const [dangerActionPending, setDangerActionPending] = useState<DangerAction | null>(null);

  async function guardedAction(action: DangerAction, confirmText: string) {
    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;
    setDangerActionPending(action);
    const result = await runDangerAction(action);
    setDangerActionPending(null);
    if (!result.ok) {
      setMessage(result.error?.message ?? "Danger action failed.");
      return;
    }

    if (action === "disconnect_marketplace") {
      setMessage("Walmart marketplace disconnected.");
      return;
    }

    if (action === "reset_drafts") {
      setMessage("Drafts were reset.");
      return;
    }

    setMessage("Danger action completed.");
  }

  async function confirmClearImportedProducts() {
    setDangerActionPending("clear_products");
    const result = await runDangerAction("clear_products");
    setDangerActionPending(null);
    setClearProductsModalOpen(false);

    if (result.ok) {
      const clearedProductCount = result.clearedProductCount ?? 0;
      setMessage(`Cleared ${clearedProductCount} imported products from EcomViper.`);
      return;
    }

    if (result.error?.code === "ACTIVE_DRAFTS_BLOCK_CLEAR") {
      const blockedDraftCount = result.blockedDraftCount ?? 0;
      setMessage(
        `Cannot clear imported products while ${blockedDraftCount} active drafts exist. Reset or discard drafts first.`
      );
      return;
    }

    setMessage(result.error?.message ?? "Clear failed. Please try again.");
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
              disabled={dangerActionPending !== null}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-sm text-rose-700"
            >
              Disconnect marketplace
            </button>
            <button
              type="button"
              onClick={() => setClearProductsModalOpen(true)}
              disabled={dangerActionPending !== null}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-sm text-rose-700"
            >
              Clear imported products
            </button>
            <button
              type="button"
              onClick={() => guardedAction("reset_drafts", "Reset all drafts now?")}
              disabled={dangerActionPending !== null}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-sm text-rose-700"
            >
              Reset drafts
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}
        </article>
      </section>

      {clearProductsModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F172A]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-2xl border border-[#D9E4F0] bg-white p-5 shadow-[0_22px_48px_rgba(15,23,42,0.28)]">
            <h2 className="text-lg font-semibold text-[#0F172A]">Clear imported products from EcomViper?</h2>
            <p className="mt-2 text-sm text-[#334155]">
              This removes imported product rows and local image enrichment metadata from your EcomViper workspace only. It will not delete, retire, unpublish, or change products on Walmart.
            </p>
            <p className="mt-2 text-sm text-[#9A3412]">
              If active drafts exist, clear will be blocked. Reset or discard drafts before clearing imported products.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearProductsModalOpen(false)}
                disabled={dangerActionPending === "clear_products"}
                className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#334155]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmClearImportedProducts()}
                disabled={dangerActionPending === "clear_products"}
                className="rounded-lg border border-rose-700 bg-rose-700 px-3 py-2 text-sm text-white"
              >
                {dangerActionPending === "clear_products" ? "Clearing..." : "Clear imported products"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
