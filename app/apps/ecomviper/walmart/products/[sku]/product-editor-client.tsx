"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface ProductEditorClientProps {
  product: WalmartProductRecord;
}

const tabs = [
  "Overview",
  "Content",
  "Pricing",
  "Inventory",
  "Images",
  "Walmart Attributes",
  "AI Optimization",
  "Sync History",
] as const;

export default function ProductEditorClient({ product }: ProductEditorClientProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const [form, setForm] = useState({
    title: product.title,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    bulletPoints: product.bulletPoints.join("\n"),
    imageUrl: product.imageUrl,
    additionalImageUrls: "",
    price: String(product.price),
    inventoryQuantity: product.inventoryStatus === "unknown" ? "" : String(product.inventoryQuantity),
    brand: product.brand,
    attributesJson: JSON.stringify(product.attributes, null, 2),
  });
  const [validated, setValidated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedSuggestions, setSavedSuggestions] = useState<string[]>([]);

  const preview = useMemo(() => {
    let parsedAttributes: Record<string, string> = {};
    try {
      const parsed = JSON.parse(form.attributesJson);
      if (parsed && typeof parsed === "object") {
        parsedAttributes = parsed as Record<string, string>;
      }
    } catch {
      parsedAttributes = {};
    }

    return {
      title: form.title.trim(),
      shortDescription: form.shortDescription.trim(),
      longDescription: form.longDescription.trim(),
      bulletPoints: form.bulletPoints
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      imageUrl: form.imageUrl.trim(),
      additionalImageUrls: form.additionalImageUrls
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      price: Number(form.price),
      inventoryQuantity: Number(form.inventoryQuantity),
      brand: form.brand.trim(),
      attributes: parsedAttributes,
    };
  }, [form]);

  const complianceValidation = useMemo(() => evaluateWalmartListingCompliance(preview), [preview]);

  const validationViolations = useMemo(() => {
    const violations: string[] = [];
    if (!preview.title) violations.push("Title is required");
    if (!Number.isFinite(preview.price) || preview.price <= 0) violations.push("Price must be greater than zero");
    if (!Number.isFinite(preview.inventoryQuantity) || preview.inventoryQuantity < 0) violations.push("Inventory must be 0 or greater");
    if (!preview.imageUrl) violations.push("Primary image URL is missing");
    return Array.from(new Set([...violations, ...complianceValidation.violations]));
  }, [preview, complianceValidation]);

  const validationWarnings = useMemo(() => complianceValidation.warnings, [complianceValidation]);

  async function handleSaveDraft() {
    const response = await fetch("/api/ecomviper/walmart/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: product.sku, draftPayload: preview }),
    });

    if (!response.ok) {
      setMessage("Failed to save draft.");
      return;
    }

    const payload = (await response.json()) as { draft?: WalmartDraftRecord };
    const validation = payload.draft?.validationResult;
    const violations = validation?.violations ?? [];
    const warnings = validation?.warnings ?? [];
    setSavedSuggestions(validation?.suggestions ?? []);

    if (violations.length > 0) {
      setMessage(`Draft saved with policy blockers: ${violations[0]}`);
      return;
    }
    if (warnings.length > 0) {
      setMessage(`Draft saved with compliance warnings: ${warnings[0]}`);
      return;
    }

    setMessage("Draft saved and passed policy checks.");
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-product-editor-page">
      <WalmartPageHeader
        title={`Product Editor • ${product.sku}`}
        subtitle="Stage content, pricing, and inventory changes before any submit flow."
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                activeTab === tab
                  ? "border-[#93C5FD] bg-[#EAF1F8] text-[#0F172A]"
                  : "border-[#D9E4F0] bg-white text-[#334155]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[#334155] md:col-span-2">
            Title
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Short description
            <textarea value={form.shortDescription} onChange={(event) => setForm((current) => ({ ...current, shortDescription: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Long description
            <textarea value={form.longDescription} onChange={(event) => setForm((current) => ({ ...current, longDescription: event.target.value }))} className="mt-1 min-h-28 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Bullet/key features (one per line)
            <textarea value={form.bulletPoints} onChange={(event) => setForm((current) => ({ ...current, bulletPoints: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155]">
            Primary image URL
            <input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155]">
            Additional image URLs (one per line)
            <textarea value={form.additionalImageUrls} onChange={(event) => setForm((current) => ({ ...current, additionalImageUrls: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155]">
            Price
            <input value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155]">
            Inventory quantity
            <input value={form.inventoryQuantity} onChange={(event) => setForm((current) => ({ ...current, inventoryQuantity: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155]">
            Brand
            <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2" />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Key attributes (JSON)
            <textarea value={form.attributesJson} onChange={(event) => setForm((current) => ({ ...current, attributesJson: event.target.value }))} className="mt-1 min-h-24 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 font-mono text-xs" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={handleSaveDraft} className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white">
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => setValidated(true)}
            className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
          >
            Preview + Validate
          </button>
          <button
            type="button"
            disabled={!validated || validationViolations.length > 0}
            className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Submit Update
          </button>
        </div>

        {message ? <p className="mt-3 text-sm text-[#334155]">{message}</p> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Before / Original payload snapshot</h2>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-3 text-xs text-[#334155]">{JSON.stringify(product.rawPayload, null, 2)}</pre>
          </article>
          <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">After / Normalized draft preview</h2>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-3 text-xs text-[#334155]">{JSON.stringify(preview, null, 2)}</pre>
          </article>
        </div>

        <article className="mt-4 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Validation status</h2>
          <div className="mt-2">
            {validationViolations.length ? <StatusBadge status="warning" /> : <StatusBadge status="validated" />}
          </div>
          <div className="mt-2 space-y-3 text-sm text-[#334155]">
            <ul className="list-disc space-y-1 pl-5">
              {validationViolations.length ? validationViolations.map((violation) => <li key={violation}>{violation}</li>) : <li>No blocking policy violations.</li>}
            </ul>
            <ul className="list-disc space-y-1 pl-5">
              {validationWarnings.length ? validationWarnings.map((warning) => <li key={warning}>{warning}</li>) : <li>No compliance warnings.</li>}
            </ul>
            {savedSuggestions.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {savedSuggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
