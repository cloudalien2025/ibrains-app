"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import type { WalmartAiSuggestion, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface AiOptimizerClientProps {
  products: WalmartProductRecord[];
  suggestions: WalmartAiSuggestion[];
  mode: string;
}

export default function WalmartAiOptimizerClient({ products, suggestions, mode }: AiOptimizerClientProps) {
  const [sku, setSku] = useState(products[0]?.sku ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const suggestion = useMemo(
    () => suggestions.find((entry) => entry.sku === sku) ?? suggestions[0],
    [suggestions, sku]
  );

  async function applySuggestion() {
    if (!suggestion) return;

    const response = await fetch("/api/ecomviper/walmart/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: suggestion.sku,
        draftPayload: {
          title: suggestion.suggestedTitle,
          longDescription: suggestion.suggestedDescription,
          bulletPoints: suggestion.suggestedBullets,
        },
      }),
    });

    if (!response.ok) {
      setMessage("Failed to apply AI suggestion.");
      return;
    }

    setMessage("AI suggestion applied to draft (not published). ");
  }

  if (!suggestion) {
    return (
      <div className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">No products available for AI optimizer.</div>
    );
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-ai-optimizer-page">
      <WalmartPageHeader
        title="AI Optimizer"
        subtitle="Generate compliant listing improvements and apply to drafts only."
        mode={mode}
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
          <label className="text-sm text-[#334155]">
            Select product / SKU
            <select value={sku} onChange={(event) => setSku(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2">
              {products.map((product) => (
                <option key={product.sku} value={product.sku}>
                  {product.sku}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Listing quality score</p>
            <p className="mt-1 text-3xl font-semibold text-[#0F172A]">{suggestion.qualityScore}/100</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Suggested title</h2>
            <p className="mt-2 text-sm text-[#334155]">{suggestion.suggestedTitle}</p>

            <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Suggested description</h2>
            <p className="mt-2 text-sm text-[#334155]">{suggestion.suggestedDescription}</p>

            <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Suggested bullets</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {suggestion.suggestedBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Missing attributes</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {suggestion.missingAttributes.length ? suggestion.missingAttributes.map((attr) => <li key={attr}>{attr}</li>) : <li>None</li>}
            </ul>

            <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Compliance warnings</h2>
            <ul className="mt-2 space-y-1 text-sm text-[#334155]">
              {suggestion.complianceWarnings.map((warning) => (
                <li key={warning} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span>{warning}</span>
                  <StatusBadge status="warning" />
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={applySuggestion} className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white">
            Apply to draft
          </button>
          <span className="inline-flex items-center rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-xs text-[#64748B]">
            AI output is staged only. No direct publish action.
          </span>
        </div>
        {message ? <p className="mt-3 text-sm text-[#334155]">{message}</p> : null}
      </section>
    </div>
  );
}
