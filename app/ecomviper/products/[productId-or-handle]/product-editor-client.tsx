"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { matchRocktomicBySkus } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import {
  createEmptyShopifyPdpIntelligenceRecord,
  sanitizeShopifyPdpIntelligenceRecord,
  type ShopifyPdpFaqEntry,
  type ShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

type AsyncStatus = "idle" | "loading" | "success" | "error";

interface PdpIntelligenceApiResponse {
  ok?: boolean;
  intelligence?: ShopifyPdpIntelligenceRecord | null;
  generationUnavailable?: boolean;
  message?: string | null;
  error?: {
    message?: string;
  };
}

function asIso(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString();
}

function listToTextarea(values: string[]): string {
  return values.join("\n");
}

function textareaToList(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function upsertFaq(
  faqs: ShopifyPdpFaqEntry[],
  index: number,
  patch: Partial<ShopifyPdpFaqEntry>
): ShopifyPdpFaqEntry[] {
  return faqs.map((faq, faqIndex) => (faqIndex === index ? { ...faq, ...patch } : faq));
}

export default function EcomViperProductEditorClient({ initialState }: { initialState: ShopifyProductEditorInitialState }) {
  const product = initialState.currentShopifyListing;

  if (!product) {
    return (
      <main className="ibrains-shell min-h-screen p-6" data-testid="ecomviper-product-editor-page">
        <article className="mx-auto max-w-4xl rounded-2xl border border-[#D9E4F0] bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Product unavailable</h1>
          <p className="mt-2 text-sm text-[#475569]">{initialState.notFoundMessage || "Product not found for this workspace."}</p>
          <div className="mt-4">
            <Link href="/ecomviper" className="text-sm text-[#1D4ED8] hover:underline">Back to Products</Link>
          </div>
        </article>
      </main>
    );
  }

  const skus = product.variants.map((variant) => variant.sku.trim()).filter(Boolean);
  const supplierMatch = matchRocktomicBySkus(skus);

  const baseRecord = useMemo(() => {
    const fallback = createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: product.productId,
      productHandle: product.handle || null,
      supplier: supplierMatch.product?.supplier ?? null,
      supplierSku: supplierMatch.matchedSku,
    });
    const seeded = initialState.pdpIntelligence
      ? sanitizeShopifyPdpIntelligenceRecord(initialState.pdpIntelligence, fallback)
      : fallback;
    return {
      ...seeded,
      shopify_product_id: product.productId,
      product_handle: product.handle || null,
      supplier: supplierMatch.product?.supplier ?? seeded.supplier,
      supplier_sku: supplierMatch.matchedSku ?? seeded.supplier_sku,
    };
  }, [
    initialState.pdpIntelligence,
    product.handle,
    product.productId,
    supplierMatch.matchedSku,
    supplierMatch.product,
  ]);

  const [record, setRecord] = useState<ShopifyPdpIntelligenceRecord>(baseRecord);
  const [generationStatus, setGenerationStatus] = useState<AsyncStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<AsyncStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const productReference = initialState.productReference || product.handle || product.productId;

  async function postAction(action: "generate" | "save", nextRecord?: ShopifyPdpIntelligenceRecord) {
    const payload =
      action === "save"
        ? { action, productReference, record: nextRecord ?? record }
        : { action, productReference };
    const response = await fetch("/api/ecomviper/pdp-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as PdpIntelligenceApiResponse;
    if (!response.ok || !body.ok || !body.intelligence) {
      throw new Error(body.error?.message || body.message || `PDP intelligence ${action} failed.`);
    }
    return body;
  }

  async function handleGenerate() {
    setGenerationStatus("loading");
    setStatusMessage(null);
    try {
      const body = await postAction("generate");
      setRecord(body.intelligence as ShopifyPdpIntelligenceRecord);
      setGenerationStatus("success");
      setStatusMessage(
        body.generationUnavailable
          ? "generation unavailable: missing server configuration"
          : "PDP intelligence generated. Review and edit before saving."
      );
    } catch (error) {
      setGenerationStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "PDP intelligence generation failed.");
    }
  }

  async function handleSave() {
    setSaveStatus("loading");
    setStatusMessage(null);
    try {
      const body = await postAction("save", record);
      setRecord(body.intelligence as ShopifyPdpIntelligenceRecord);
      setSaveStatus("success");
      setStatusMessage("PDP intelligence saved.");
    } catch (error) {
      setSaveStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "PDP intelligence save failed.");
    }
  }

  return (
    <main className="ibrains-shell min-h-screen p-6" data-testid="ecomviper-product-editor-page">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">Product Editor / PDP Optimizer</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">{product.title}</h1>
          <p className="mt-2 text-sm text-[#475569]">Shopify-first PDP editor foundation with Rocktomic SKU intelligence and editable AI PDP intelligence fields.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#334155]">
            <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1">Source: {initialState.sourceLabel}</span>
            <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1">Last synced: {asIso(initialState.lastSyncedAt)}</span>
            <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1">OpenAI: {initialState.openAiStatusLabel}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/ecomviper" className="text-[#1D4ED8] hover:underline">Back to Products</Link>
            <Link href={`/ecomviper/shopify/products/${encodeURIComponent(initialState.productReference)}`} className="text-[#1D4ED8] hover:underline">
              Open Shopify 3-step editor
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2" data-testid="ecomviper-product-editor-sections">
          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Shopify Product Data</h2>
            <p className="mt-2 text-sm text-[#475569]">Vendor: {product.vendor || "-"}</p>
            <p className="text-sm text-[#475569]">Product type: {product.productType || "-"}</p>
            <p className="text-sm text-[#475569]">Status: {product.status || "-"}</p>
            <p className="text-sm text-[#475569]">Variants: {product.variants.length}</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Supplier Intelligence</h2>
            {supplierMatch.status === "rocktomic" ? (
              <>
                <p className="mt-2 text-sm text-[#475569]">Supplier: {supplierMatch.product?.supplier || "Rocktomic"}</p>
                <p className="text-sm text-[#475569]">SKU: {supplierMatch.matchedSku}</p>
                <p className="text-sm text-[#475569]">Match confidence: {Math.round(supplierMatch.matchConfidence * 100)}%</p>
                <p className="text-sm text-[#475569]">Match reason: {supplierMatch.matchReason}</p>
                <p className="text-sm text-[#475569]">Product Name: {supplierMatch.product?.productName || "-"}</p>
                <p className="text-sm text-[#475569]">Certifications: {(supplierMatch.product?.certifications || []).join(", ") || "-"}</p>
                <p className="text-sm text-[#475569]">COA status: {supplierMatch.product?.coa.status || "-"}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#475569]">No Rocktomic SKU match found. Additional supplier intelligence sources are pending.</p>
            )}
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 md:col-span-2" data-testid="ecomviper-ai-pdp-intelligence-section">
            <h2 className="text-base font-semibold text-[#0F172A]">AI PDP Intelligence</h2>
            <p className="mt-2 text-sm text-[#475569]">Generate, edit, save, and reopen structured PDP intelligence. All generation runs server-side only.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={generationStatus === "loading"}
              >
                {generationStatus === "loading" ? "Generating..." : "Generate PDP Intelligence"}
              </button>
              <button type="button" disabled className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm text-[#64748B]">
                Regenerate Summary (Planned)
              </button>
              <button type="button" disabled className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm text-[#64748B]">
                Regenerate FAQ (Planned)
              </button>
              <button type="button" disabled className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm text-[#64748B]">
                Regenerate Trust Signals (Planned)
              </button>
              <button type="button" disabled className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm text-[#64748B]">
                Regenerate Use Cases (Planned)
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg border border-[#0F766E] bg-[#0F766E] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={saveStatus === "loading"}
              >
                {saveStatus === "loading" ? "Saving..." : "Save Intelligence"}
              </button>
            </div>
            {statusMessage ? <p className="mt-3 text-sm text-[#334155]">{statusMessage}</p> : null}
            <p className="mt-2 text-xs text-[#64748B]">
              Generation status: {record.generation_status} · Last generated: {asIso(record.last_generated_at)} · Last edited: {asIso(record.last_edited_at)}
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-[#334155] md:col-span-2">
                AI Product Summary
                <textarea
                  value={record.ai_product_summary}
                  onChange={(event) => setRecord((current) => ({ ...current, ai_product_summary: event.target.value }))}
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm text-[#334155]">
                Best For
                <textarea
                  value={listToTextarea(record.best_for)}
                  onChange={(event) => setRecord((current) => ({ ...current, best_for: textareaToList(event.target.value) }))}
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155]">
                Not Best For
                <textarea
                  value={listToTextarea(record.not_best_for)}
                  onChange={(event) => setRecord((current) => ({ ...current, not_best_for: textareaToList(event.target.value) }))}
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155]">
                Use Cases
                <textarea
                  value={listToTextarea(record.use_cases)}
                  onChange={(event) => setRecord((current) => ({ ...current, use_cases: textareaToList(event.target.value) }))}
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155]">
                Ingredient Highlights
                <textarea
                  value={listToTextarea(record.ingredient_highlights)}
                  onChange={(event) =>
                    setRecord((current) => ({ ...current, ingredient_highlights: textareaToList(event.target.value) }))
                  }
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155]">
                Trust Signals
                <textarea
                  value={listToTextarea(record.trust_signals)}
                  onChange={(event) => setRecord((current) => ({ ...current, trust_signals: textareaToList(event.target.value) }))}
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155]">
                Certifications
                <textarea
                  value={listToTextarea(record.certifications)}
                  onChange={(event) => setRecord((current) => ({ ...current, certifications: textareaToList(event.target.value) }))}
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155]">
                Compliance-Safe Claims
                <textarea
                  value={listToTextarea(record.compliance_safe_claims)}
                  onChange={(event) =>
                    setRecord((current) => ({ ...current, compliance_safe_claims: textareaToList(event.target.value) }))
                  }
                  rows={3}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155] md:col-span-2">
                Comparison Content
                <textarea
                  value={record.comparison_content}
                  onChange={(event) => setRecord((current) => ({ ...current, comparison_content: event.target.value }))}
                  rows={2}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm text-[#334155] md:col-span-2">
                Agentic Selection Notes
                <textarea
                  value={record.agentic_selection_notes}
                  onChange={(event) =>
                    setRecord((current) => ({ ...current, agentic_selection_notes: event.target.value }))
                  }
                  rows={2}
                  className="rounded-lg border border-[#D9E4F0] px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4 rounded-lg border border-[#D9E4F0] p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#0F172A]">Expanded FAQ</h3>
                <button
                  type="button"
                  className="rounded border border-[#D9E4F0] px-2 py-1 text-xs text-[#334155]"
                  onClick={() =>
                    setRecord((current) => ({
                      ...current,
                      faqs: [
                        ...current.faqs,
                        {
                          question: "",
                          answer: "",
                          category: "general",
                          schema_eligible: false,
                          compliance_status: "review_required",
                        },
                      ],
                    }))
                  }
                >
                  Add FAQ
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {record.faqs.map((faq, index) => (
                  <div key={`${index}-${faq.question}`} className="rounded border border-[#E2E8F0] p-3">
                    <label className="grid gap-1 text-xs text-[#475569]">
                      Question
                      <input
                        value={faq.question}
                        onChange={(event) =>
                          setRecord((current) => ({ ...current, faqs: upsertFaq(current.faqs, index, { question: event.target.value }) }))
                        }
                        className="rounded border border-[#D9E4F0] px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="mt-2 grid gap-1 text-xs text-[#475569]">
                      Answer
                      <textarea
                        value={faq.answer}
                        onChange={(event) =>
                          setRecord((current) => ({ ...current, faqs: upsertFaq(current.faqs, index, { answer: event.target.value }) }))
                        }
                        rows={2}
                        className="rounded border border-[#D9E4F0] px-2 py-1 text-sm"
                      />
                    </label>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <label className="grid gap-1 text-xs text-[#475569]">
                        Category
                        <input
                          value={faq.category}
                          onChange={(event) =>
                            setRecord((current) => ({ ...current, faqs: upsertFaq(current.faqs, index, { category: event.target.value }) }))
                          }
                          className="rounded border border-[#D9E4F0] px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-[#475569]">
                        Compliance status
                        <select
                          value={faq.compliance_status}
                          onChange={(event) =>
                            setRecord((current) => ({
                              ...current,
                              faqs: upsertFaq(current.faqs, index, {
                                compliance_status: event.target.value as ShopifyPdpFaqEntry["compliance_status"],
                              }),
                            }))
                          }
                          className="rounded border border-[#D9E4F0] px-2 py-1 text-sm"
                        >
                          <option value="approved">approved</option>
                          <option value="review_required">review_required</option>
                          <option value="blocked">blocked</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#475569]">
                        <input
                          type="checkbox"
                          checked={faq.schema_eligible}
                          onChange={(event) =>
                            setRecord((current) => ({
                              ...current,
                              faqs: upsertFaq(current.faqs, index, { schema_eligible: event.target.checked }),
                            }))
                          }
                        />
                        Schema eligible
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-4 grid gap-1 text-sm text-[#334155]">
              Compliance Notes
              <textarea
                value={listToTextarea(record.compliance_notes)}
                onChange={(event) => setRecord((current) => ({ ...current, compliance_notes: textareaToList(event.target.value) }))}
                rows={3}
                className="rounded-lg border border-[#D9E4F0] px-3 py-2"
              />
            </label>

            <p className="mt-3 text-xs text-[#64748B]">
              Compliance review risk: {record.compliance_review.risk_level} · risky phrases:{" "}
              {record.compliance_review.risky_phrases_found.join(", ") || "none"}
            </p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Buy Now Links placeholder</h2>
            <p className="mt-2 text-sm text-[#475569]">Marketplace link mapping remains modeled and review-first in this sprint.</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Image Studio placeholder</h2>
            <p className="mt-2 text-sm text-[#475569]">Image Studio execution is deferred to Sprint 009+.</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 md:col-span-2">
            <h2 className="text-base font-semibold text-[#0F172A]">Publish Controls placeholder</h2>
            <p className="mt-2 text-sm text-[#475569]">EcomViper.com public publishing remains a future scope. PDP intelligence is generated and saved for operator review only in Sprint 008.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
