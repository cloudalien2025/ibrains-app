"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import WalmartPageHeader from "@/app/optiwal/_components/page-header";
import StatusBadge from "@/app/optiwal/_components/status-badge";
import type { WalmartAiSuggestion, WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface AiOptimizerClientProps {
  products: WalmartProductRecord[];
}

type OpenAiConnectionResponse = {
  ok: boolean;
  connected: boolean;
};

type GenerateSuggestionResponse = {
  ok: boolean;
  suggestion?: WalmartAiSuggestion;
  error?: {
    message?: string;
  };
};

const OPENAI_REQUIRED_MESSAGE = "Connect your OpenAI API key first to generate product content.";

export default function WalmartAiOptimizerClient({ products }: AiOptimizerClientProps) {
  const searchParams = useSearchParams();
  const requestedSku = searchParams?.get("sku")?.trim() ?? "";
  const defaultSku =
    (requestedSku && products.some((product) => product.sku === requestedSku) ? requestedSku : products[0]?.sku) ?? "";
  const [sku, setSku] = useState(defaultSku);
  const [message, setMessage] = useState<string | null>(null);
  const [openAiConnected, setOpenAiConnected] = useState(false);
  const [openAiChecked, setOpenAiChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestionsBySku, setSuggestionsBySku] = useState<Record<string, WalmartAiSuggestion>>({});

  const suggestion = useMemo(() => suggestionsBySku[sku] ?? null, [suggestionsBySku, sku]);

  useEffect(() => {
    if (!defaultSku) return;
    setSku(defaultSku);
  }, [defaultSku]);

  useEffect(() => {
    let cancelled = false;

    async function loadOpenAiStatus() {
      try {
        const response = await fetch("/api/ecomviper/walmart/connect/openai", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setOpenAiConnected(false);
            setOpenAiChecked(true);
          }
          return;
        }

        const payload = (await response.json()) as OpenAiConnectionResponse;
        if (cancelled) return;
        setOpenAiConnected(Boolean(payload.connected));
      } catch {
        if (!cancelled) {
          setOpenAiConnected(false);
        }
      } finally {
        if (!cancelled) {
          setOpenAiChecked(true);
        }
      }
    }

    void loadOpenAiStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function generateSuggestion() {
    if (!sku) return;

    if (!openAiConnected) {
      setMessage(OPENAI_REQUIRED_MESSAGE);
      return;
    }

    try {
      setGenerating(true);
      const response = await fetch("/api/ecomviper/walmart/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });

      const payload = (await response.json().catch(() => null)) as GenerateSuggestionResponse | null;
      if (!response.ok || !payload?.suggestion) {
        const apiMessage = payload?.error?.message;
        setMessage(apiMessage || "Failed to generate AI suggestion.");
        return;
      }

      setSuggestionsBySku((current) => ({ ...current, [sku]: payload.suggestion as WalmartAiSuggestion }));
      setMessage("AI suggestion generated. Review and apply to draft.");
    } catch {
      setMessage("Failed to generate AI suggestion.");
    } finally {
      setGenerating(false);
    }
  }

  async function applySuggestion() {
    if (!suggestion) {
      setMessage(openAiConnected ? "Generate AI content first, then apply it to draft." : OPENAI_REQUIRED_MESSAGE);
      return;
    }

    try {
      setApplying(true);
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
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setMessage(payload?.error?.message ?? "Failed to apply AI suggestion.");
        return;
      }

      const payload = (await response.json()) as { draft?: WalmartDraftRecord };
      const violations = payload.draft?.validationResult.violations ?? [];
      const warnings = payload.draft?.validationResult.warnings ?? [];

      if (violations.length > 0) {
        setMessage(`Draft saved with policy blockers: ${violations[0]}`);
        return;
      }

      if (warnings.length > 0) {
        setMessage(`Draft saved with compliance warnings: ${warnings[0]}`);
        return;
      }

      setMessage("AI suggestion applied to draft and passed policy checks.");
    } catch {
      setMessage("Failed to apply AI suggestion.");
    } finally {
      setApplying(false);
    }
  }

  if (!products.length) {
    return (
      <div className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 text-sm text-[#64748B]">
        Import Walmart products first, then select a real SKU to generate optimization suggestions.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-ai-optimizer-page">
      <WalmartPageHeader
        title="AI Optimizer"
        subtitle="Generate compliant listing improvements and apply to drafts only."
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
          <label className="text-sm text-[#334155]">
            Select product / SKU
            <select
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            >
              {products.map((product) => (
                <option key={product.sku} value={product.sku}>
                  {product.sku}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Listing quality score</p>
            <p className="mt-1 text-3xl font-semibold text-[#0F172A]">{suggestion ? `${suggestion.qualityScore}/100` : "--"}</p>
          </div>
        </div>

        {!openAiConnected && openAiChecked ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {OPENAI_REQUIRED_MESSAGE}
          </p>
        ) : null}

        {!openAiChecked ? (
          <p className="mt-4 text-sm text-[#64748B]">Checking OpenAI connection status...</p>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Suggested title</h2>
            <p className="mt-2 text-sm text-[#334155]">{suggestion?.suggestedTitle ?? "Generate content to view suggestion."}</p>

            <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Suggested description</h2>
            <p className="mt-2 text-sm text-[#334155]">{suggestion?.suggestedDescription ?? "Generate content to view suggestion."}</p>

            <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Suggested bullets</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {suggestion?.suggestedBullets.length
                ? suggestion.suggestedBullets.map((bullet) => <li key={bullet}>{bullet}</li>)
                : <li>Generate content to view bullets.</li>}
            </ul>
          </article>

          <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Missing attributes</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {suggestion?.missingAttributes.length
                ? suggestion.missingAttributes.map((attr) => <li key={attr}>{attr}</li>)
                : <li>Generate content to view missing attributes.</li>}
            </ul>

            <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Compliance warnings</h2>
            <ul className="mt-2 space-y-1 text-sm text-[#334155]">
              {suggestion?.complianceWarnings.length ? (
                suggestion.complianceWarnings.map((warning) => (
                  <li
                    key={warning}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span>{warning}</span>
                    <StatusBadge status="warning" />
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2">
                  Generate content to review compliance warnings.
                </li>
              )}
            </ul>
          </article>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateSuggestion}
            disabled={generating || applying}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate AI Content"}
          </button>
          <button
            type="button"
            onClick={applySuggestion}
            disabled={generating || applying || !suggestion}
            className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply to draft"}
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
