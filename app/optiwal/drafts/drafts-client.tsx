"use client";

import Link from "next/link";
import { useState } from "react";
import WalmartPageHeader from "@/app/optiwal/_components/page-header";
import StatusBadge from "@/app/optiwal/_components/status-badge";
import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface DraftsClientProps {
  initialDrafts: WalmartDraftRecord[];
  loadError?: string;
}

export default function WalmartDraftsClient({ initialDrafts, loadError }: DraftsClientProps) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [message, setMessage] = useState<string | null>(loadError ?? null);

  async function mutateDraft(id: string, method: "PATCH" | "DELETE", action?: "validate" | "submit") {
    const response = await fetch(`/api/ecomviper/walmart/drafts/${encodeURIComponent(id)}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ action }) : undefined,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      setMessage(payload.error?.message ?? "Draft action failed.");
      return;
    }

    const payload = (await response.json()) as {
      draft: WalmartDraftRecord;
      blocked?: boolean;
      violations?: string[];
      warnings?: string[];
    };

    if (method === "DELETE") {
      setDrafts((current) => current.map((draft) => (draft.id === payload.draft.id ? payload.draft : draft)));
      setMessage("Draft discarded.");
      return;
    }

    setDrafts((current) => current.map((draft) => (draft.id === payload.draft.id ? payload.draft : draft)));
    if (action === "submit" && payload.blocked) {
      const firstIssue = payload.violations?.[0] ?? payload.warnings?.[0] ?? "Resolve validation issues before submitting.";
      setMessage(`Draft submit blocked: ${firstIssue}`);
      return;
    }

    setMessage(action === "validate" ? "Draft validated." : "Draft submitted.");
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-drafts-page">
      <WalmartPageHeader
        title="Drafts"
        subtitle="Review staged edits before submitting updates."
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        {message ? <p className="mb-3 text-sm text-[#334155]">{message}</p> : null}
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2">Draft ID</th>
                <th className="py-2">SKU</th>
                <th className="py-2">Product title</th>
                <th className="py-2">Change summary</th>
                <th className="py-2">Updated time</th>
                <th className="py-2">Validation status</th>
                <th className="py-2">Publish status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.id} className="border-t border-[#E2E8F0] align-top">
                  <td className="py-2 pr-2 font-mono text-xs text-[#334155]">{draft.id}</td>
                  <td className="py-2 pr-2 font-medium text-[#0F172A]">{draft.sku}</td>
                  <td className="py-2 pr-2 text-[#334155]">{draft.productTitle}</td>
                  <td className="py-2 pr-2 text-[#334155]">{draft.changeSummary}</td>
                  <td className="py-2 pr-2 text-[#334155]">{draft.updatedAt}</td>
                  <td className="py-2 pr-2">
                    <StatusBadge status={draft.validationResult.valid ? "validated" : "warning"} />
                  </td>
                  <td className="py-2 pr-2"><StatusBadge status={draft.publishStatus} /></td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/optiwal/products/${encodeURIComponent(draft.sku)}`} className="text-xs text-[#2563EB]">
                        Preview
                      </Link>
                      <button type="button" onClick={() => mutateDraft(draft.id, "PATCH", "validate")} className="text-xs text-[#2563EB]">
                        Validate
                      </button>
                      <button type="button" onClick={() => mutateDraft(draft.id, "PATCH", "submit")} className="text-xs text-[#2563EB]">
                        Submit
                      </button>
                      <button type="button" onClick={() => mutateDraft(draft.id, "DELETE")} className="text-xs text-rose-700">
                        Discard
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!drafts.length && !loadError ? (
                <tr className="border-t border-[#E2E8F0]">
                  <td colSpan={8} className="py-6 text-center text-sm text-[#64748B]">
                    No staged drafts yet.
                  </td>
                </tr>
              ) : null}
              {!drafts.length && loadError ? (
                <tr className="border-t border-[#E2E8F0]">
                  <td colSpan={8} className="py-6 text-center text-sm text-rose-700">
                    {loadError}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
