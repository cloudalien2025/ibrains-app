"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildEditableShopifyDraft,
  buildOptimizedShopifyProposal,
  summarizeDraftChanges,
  type ShopifyEditableDraftDocket,
  type ShopifyOptimizedProposalDocket,
} from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

type EditorTabKey = "current" | "optimize" | "review";

const editorTabs: Array<{ key: EditorTabKey; label: string; testId: string }> = [
  {
    key: "current",
    label: "Step 1 - Current Shopify Listing",
    testId: "ecomviper-shopify-tab-current-listing",
  },
  {
    key: "optimize",
    label: "Step 2 - Optimize Listing with AI",
    testId: "ecomviper-shopify-tab-optimize-ai",
  },
  {
    key: "review",
    label: "Step 3 - Review and Publish",
    testId: "ecomviper-shopify-tab-review-publish",
  },
];

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString();
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

interface DocketSectionProps {
  title: string;
  children: React.ReactNode;
}

function DocketSection({ title, children }: DocketSectionProps) {
  return (
    <section className="rounded-xl border border-[#D9E4F0] bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#334155]">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-[#334155]">{children}</div>
    </section>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
      {label}
    </span>
  );
}

export default function ShopifyProductEditorClient({
  initialState,
}: {
  initialState: ShopifyProductEditorInitialState;
}) {
  const [activeTab, setActiveTab] = useState<EditorTabKey>("current");
  const [proposal, setProposal] = useState<ShopifyOptimizedProposalDocket | null>(
    initialState.optimizedShopifyProposal
  );
  const [draft, setDraft] = useState<ShopifyEditableDraftDocket | null>(initialState.editableShopifyDraft);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const current = initialState.currentShopifyListing;
  const draftChanges = useMemo(() => {
    if (!current || !draft) return [];
    return summarizeDraftChanges(current, draft);
  }, [current, draft]);

  function applyProposalToDraft() {
    if (!current || !proposal) return;
    setDraft(buildEditableShopifyDraft(current, proposal));
    setFeedback("Applied optimized proposal to the editable draft.");
  }

  function saveDraft() {
    if (!draft) return;
    const iso = new Date().toISOString();
    setSavedAt(iso);
    setFeedback(`Draft saved locally at ${iso}.`);
  }

  function prepareUpdate() {
    setFeedback(
      "Draft prepared for update review. Nothing is published unless explicitly approved."
    );
  }

  function generateOptimization() {
    if (!current) return;
    if (!initialState.openAiConnected) {
      setFeedback("OpenAI connection required to generate AI optimization.");
      return;
    }
    const nextProposal = buildOptimizedShopifyProposal(current, {
      openAiConnected: initialState.openAiConnected,
    });
    setProposal(nextProposal);
    setFeedback("AI optimization proposal generated from current Shopify listing.");
  }

  if (!initialState.productFound || !current) {
    return (
      <main
        className="space-y-4"
        data-testid="ecomviper-shopify-product-editor"
      >
        <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">Shopify Product Editor</p>
          <h1 className="mt-2 text-xl font-semibold text-[#0F172A]">Product unavailable</h1>
          <p className="mt-2 text-sm text-[#475569]">
            {initialState.notFoundMessage || "The selected Shopify product could not be loaded."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label={`Source: ${initialState.sourceLabel}`} />
            <StatusBadge label={`OpenAI: ${initialState.openAiStatusLabel}`} />
          </div>
          <div className="mt-4">
            <Link href="/apps/ecomviper/shopify" className="text-sm text-[#1D4ED8] hover:text-[#1E40AF] hover:underline">
              Back to Shopify Products
            </Link>
          </div>
        </header>
      </main>
    );
  }

  return (
    <main className="space-y-4" data-testid="ecomviper-shopify-product-editor">
      <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
        <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">Shopify Product Editor</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">{current.title}</h1>
        <p className="mt-2 text-sm text-[#475569]">
          Product docket workflow: current listing, AI optimization proposal, and review-ready editable draft.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge label={`Source: ${initialState.sourceLabel}`} />
          <StatusBadge label={`Mode: ${initialState.hydrationMode}`} />
          <StatusBadge label={`OpenAI: ${initialState.openAiStatusLabel}`} />
          <StatusBadge label={`Last synced: ${formatTimestamp(initialState.lastSyncedAt)}`} />
        </div>
        <div className="mt-4">
          <Link href="/apps/ecomviper/shopify" className="text-sm text-[#1D4ED8] hover:text-[#1E40AF] hover:underline">
            Back to Shopify Products
          </Link>
        </div>
      </header>

      {initialState.warnings.length > 0 ? (
        <article className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {initialState.warnings.join(" ")}
        </article>
      ) : null}

      {feedback ? (
        <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] px-4 py-3 text-sm text-[#334155]">
          {feedback}
        </article>
      ) : null}

      <nav className="flex flex-wrap gap-2" data-testid="ecomviper-shopify-editor-tabs">
        {editorTabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              data-testid={tab.testId}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-[#1D4ED8] bg-[#1D4ED8] text-white"
                  : "border-[#D9E4F0] bg-white text-[#334155] hover:border-[#93C5FD]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <section
        data-testid="ecomviper-shopify-current-docket"
        className={activeTab === "current" ? "space-y-4" : "hidden"}
      >
        <article className="rounded-2xl border border-[#D9E4F0] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#0F172A]">Step 1 - Current Shopify Listing</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Live/current listing source view of Shopify product information. This layer is read-only and does not apply AI rewriting.
          </p>
        </article>

        <div className="grid gap-3 lg:grid-cols-2">
          <DocketSection title="Content">
            <p><strong>Title:</strong> {current.title}</p>
            <p><strong>Handle:</strong> {current.handle || "Not available"}</p>
            <p><strong>Status:</strong> {current.status}</p>
            <p><strong>Vendor:</strong> {current.vendor}</p>
            <p><strong>Product type:</strong> {current.productType}</p>
            <p><strong>Tags:</strong> {current.tags.join(", ") || "Not available"}</p>
            <p><strong>Collections:</strong> {current.collections.join(", ") || "Not available"}</p>
            <p><strong>Description:</strong> {current.descriptionText || "Not available"}</p>
            <p><strong>SEO title:</strong> {current.seoTitle || "Not available"}</p>
            <p><strong>SEO description:</strong> {current.seoDescription || "Not available"}</p>
            <p><strong>Source:</strong> {current.sourceLabel}</p>
          </DocketSection>

          <DocketSection title="Media">
            <p><strong>Primary image:</strong> {current.images[0]?.url || "Not available"}</p>
            <p><strong>Gallery images:</strong> {current.images.length}</p>
            <ul className="list-disc space-y-1 pl-5">
              {current.images.map((image) => (
                <li key={image.id}>
                  <span className="font-medium">{image.url}</span>
                  <span className="text-[#64748B]"> · Alt: {image.altText || "Not available"}</span>
                </li>
              ))}
              {!current.images.length ? <li>No images available.</li> : null}
            </ul>
            <p><strong>Product URL:</strong> {current.productUrl || "Not available"}</p>
          </DocketSection>

          <DocketSection title="Pricing & Inventory">
            <p><strong>Variants:</strong> {current.variants.length}</p>
            <ul className="list-disc space-y-1 pl-5">
              {current.variants.map((variant) => (
                <li key={variant.id}>
                  {variant.title || "Default"} · SKU: {variant.sku || "N/A"} · GTIN/Barcode: {variant.barcode || "N/A"} · Price:{" "}
                  {variant.price ?? "N/A"} · Compare-at: {variant.compareAtPrice ?? "N/A"} · Inventory: {variant.inventoryQuantity ?? "N/A"}
                </li>
              ))}
              {!current.variants.length ? <li>No variants available.</li> : null}
            </ul>
          </DocketSection>

          <DocketSection title="Search & Browse">
            <p><strong>Metafields:</strong> {current.metafields.length}</p>
            <ul className="list-disc space-y-1 pl-5">
              {current.metafields.map((metafield) => (
                <li key={metafield.id || `${metafield.namespace}.${metafield.key}`}>
                  {metafield.namespace}.{metafield.key}: {metafield.value || "Not available"}
                </li>
              ))}
              {!current.metafields.length ? <li>No metafields available.</li> : null}
            </ul>
            <p><strong>Source/provenance:</strong> {current.sourceLabel}</p>
            <p><strong>Last synced:</strong> {formatTimestamp(current.lastSyncedAt)}</p>
            <p className="text-xs text-[#64748B]">No FAQ is shown here unless it exists in actual Shopify content.</p>
          </DocketSection>
        </div>
      </section>

      <section
        data-testid="ecomviper-shopify-optimized-docket"
        className={activeTab === "optimize" ? "space-y-4" : "hidden"}
      >
        <article className="rounded-2xl border border-[#D9E4F0] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#0F172A]">Step 2 - Optimize Listing with AI</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Generate an AI-optimized proposal from the current Shopify listing docket. Proposals are read-only and never auto-published.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateOptimization}
              className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={!initialState.openAiConnected}
            >
              Generate AI Optimization
            </button>
            {!initialState.openAiConnected ? (
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                OpenAI connection required to generate AI optimization.
              </span>
            ) : null}
          </div>
        </article>

        {proposal ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <DocketSection title="Content">
              <p><strong>Optimized title:</strong> {proposal.title}</p>
              <p><strong>Optimized description:</strong> {proposal.descriptionText || "Not available"}</p>
              <p><strong>Optimized SEO title:</strong> {proposal.seoTitle || "Not available"}</p>
              <p><strong>Optimized SEO description:</strong> {proposal.seoDescription || "Not available"}</p>
              <p><strong>Source:</strong> {proposal.sourceLabel}</p>
            </DocketSection>

            <DocketSection title="Media">
              <p><strong>Image alt text recommendations:</strong></p>
              <ul className="list-disc space-y-1 pl-5">
                {Object.entries(proposal.imageAltTextByImageId).map(([imageId, altText]) => (
                  <li key={imageId}>
                    {imageId}: {altText || "Not available"}
                  </li>
                ))}
              </ul>
            </DocketSection>

            <DocketSection title="Pricing & Inventory">
              <p>No pricing or inventory values are invented by AI. Review current variant values in Step 1 and Step 3.</p>
            </DocketSection>

            <DocketSection title="Search & Browse">
              <p><strong>Tag suggestions:</strong> {proposal.tags.join(", ") || "Not available"}</p>
              <p><strong>Product type suggestion:</strong> {proposal.productTypeSuggestion || "Not available"}</p>
              <p><strong>Collection suggestions:</strong> {proposal.collectionSuggestions.join(", ") || "Not available"}</p>
              <p><strong>Metafield suggestions:</strong> {proposal.metafieldSuggestions.length}</p>
              <ul className="list-disc space-y-1 pl-5">
                {proposal.metafieldSuggestions.map((metafield) => (
                  <li key={metafield.id}>
                    {metafield.namespace}.{metafield.key}: {metafield.value}
                  </li>
                ))}
              </ul>
            </DocketSection>

            <article className="rounded-xl border border-[#D9E4F0] bg-white p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#334155]">Before/After Summary</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                {proposal.beforeAfterSummary.map((row) => (
                  <li key={`${row.field}:${row.before}`}>
                    <strong>{row.field}</strong>: {row.before} → {row.after}
                  </li>
                ))}
                {!proposal.beforeAfterSummary.length ? <li>No material changes proposed.</li> : null}
              </ul>
              <p className="mt-3 text-xs text-[#64748B]">
                Compliance-safe supplement guardrails: {proposal.complianceSafeSupplementGuardrails.join(" | ")}
              </p>
            </article>
          </div>
        ) : (
          <article className="rounded-xl border border-[#D9E4F0] bg-white px-4 py-3 text-sm text-[#475569]">
            No optimization proposal generated yet.
          </article>
        )}
      </section>

      <section
        data-testid="ecomviper-shopify-editable-draft"
        className={activeTab === "review" ? "space-y-4" : "hidden"}
      >
        <article className="rounded-2xl border border-[#D9E4F0] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#0F172A]">Step 3 - Review and Publish</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Review and edit a publish-prep draft. Nothing is published unless explicitly approved.
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            If Shopify write scopes are not configured, use Save draft / Prepare update and submit through your approved publish workflow.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveDraft}
              data-testid="ecomviper-shopify-save-draft"
              className="rounded-lg border border-[#0F766E] bg-[#0F766E] px-3 py-2 text-sm font-medium text-white"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={prepareUpdate}
              data-testid="ecomviper-shopify-prepare-update"
              className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white"
            >
              Prepare update
            </button>
            {proposal ? (
              <button
                type="button"
                onClick={applyProposalToDraft}
                className="rounded-lg border border-[#334155] bg-[#334155] px-3 py-2 text-sm font-medium text-white"
              >
                Apply proposal to draft
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[#64748B]">
            Last local draft save: {formatTimestamp(savedAt)}
          </p>
        </article>

        {draft ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <DocketSection title="Content">
              <label className="block text-xs font-medium text-[#334155]">
                Title
                <input
                  className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                />
              </label>
              <label className="block text-xs font-medium text-[#334155]">
                Description
                <textarea
                  className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                  rows={5}
                  value={draft.descriptionText}
                  onChange={(event) =>
                    setDraft((prev) => (prev ? { ...prev, descriptionText: event.target.value } : prev))
                  }
                />
              </label>
              <label className="block text-xs font-medium text-[#334155]">
                SEO title
                <input
                  className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                  value={draft.seoTitle}
                  onChange={(event) => setDraft((prev) => (prev ? { ...prev, seoTitle: event.target.value } : prev))}
                />
              </label>
              <label className="block text-xs font-medium text-[#334155]">
                SEO description
                <textarea
                  className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                  rows={3}
                  value={draft.seoDescription}
                  onChange={(event) =>
                    setDraft((prev) => (prev ? { ...prev, seoDescription: event.target.value } : prev))
                  }
                />
              </label>
            </DocketSection>

            <DocketSection title="Media">
              {(current.images || []).map((image) => (
                <label key={image.id} className="block text-xs font-medium text-[#334155]">
                  Alt text ({image.id})
                  <input
                    className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                    value={draft.imageAltTextByImageId[image.id] || ""}
                    onChange={(event) =>
                      setDraft((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          imageAltTextByImageId: {
                            ...prev.imageAltTextByImageId,
                            [image.id]: event.target.value,
                          },
                        };
                      })
                    }
                  />
                </label>
              ))}
              {!current.images.length ? <p>No image records available.</p> : null}
            </DocketSection>

            <DocketSection title="Pricing & Inventory">
              <p className="text-xs text-[#64748B]">Variant basics are editable where write support exists.</p>
              {draft.variants.map((variant) => (
                <article key={variant.id} className="rounded-lg border border-[#E2E8F0] p-3">
                  <p className="font-medium text-[#0F172A]">{variant.title || "Default variant"}</p>
                  <p>SKU: {variant.sku || "N/A"}</p>
                  <p>Barcode/GTIN: {variant.barcode || "N/A"}</p>
                  <p>Price: {variant.price ?? "N/A"} · Compare-at: {variant.compareAtPrice ?? "N/A"}</p>
                  <p>Inventory: {variant.inventoryQuantity ?? "N/A"}</p>
                </article>
              ))}
              {!draft.variants.length ? <p>No variant data available.</p> : null}
            </DocketSection>

            <DocketSection title="Search & Browse">
              <label className="block text-xs font-medium text-[#334155]">
                Tags (comma separated)
                <input
                  className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                  value={draft.tagsText}
                  onChange={(event) => setDraft((prev) => (prev ? { ...prev, tagsText: event.target.value } : prev))}
                />
              </label>
              <p className="text-xs text-[#64748B]">Parsed tags: {splitTags(draft.tagsText).join(", ") || "None"}</p>
              <label className="block text-xs font-medium text-[#334155]">
                Product type
                <input
                  className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
                  value={draft.productType}
                  onChange={(event) => setDraft((prev) => (prev ? { ...prev, productType: event.target.value } : prev))}
                />
              </label>
              <p><strong>Collection suggestions:</strong> {draft.collectionSuggestions.join(", ") || "Not available"}</p>
              <p><strong>Metafields:</strong> {draft.metafields.length}</p>
            </DocketSection>
          </div>
        ) : (
          <article className="rounded-xl border border-[#D9E4F0] bg-white px-4 py-3 text-sm text-[#475569]">
            Editable draft is unavailable.
          </article>
        )}

        <article className="rounded-xl border border-[#D9E4F0] bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#334155]">Staged changes</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#334155]">
            {draftChanges.map((change) => (
              <li key={`${change.field}:${change.before}`}>
                <strong>{change.field}</strong>: {change.before} → {change.after} (
                {change.apiPushable ? "API-pushable" : "Recommendation-only"})
              </li>
            ))}
            {!draftChanges.length ? <li>No staged changes yet.</li> : null}
          </ul>
        </article>
      </section>
    </main>
  );
}

