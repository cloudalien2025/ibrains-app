"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import { assessWalmartListingQuality, buildDeterministicOptimizationProposal } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import { readOptimizerProposalFromDraft, toOptimizerDraftPayload } from "@/lib/ecomviper/walmart/walmart-optimizer-staging";
import type {
  WalmartDraftRecord,
  WalmartListingRecommendation,
  WalmartOptimizationProposalRecord,
  WalmartOptimizationProposalStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

interface ProductEditorClientProps {
  product: WalmartProductRecord;
  stagedDrafts: WalmartDraftRecord[];
  aiProviderConnected: boolean;
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

const OPENAI_OPTIMIZE_REQUIRED_MESSAGE = "Connect your OpenAI API key first to optimize this product.";
const SHOW_DEVELOPER_DIAGNOSTICS = process.env.NEXT_PUBLIC_ECOMVIPER_PRODUCT_EDITOR_DIAGNOSTICS === "1";

interface ProductEditorFormState {
  title: string;
  shortDescription: string;
  longDescription: string;
  bulletPoints: string;
  imageUrl: string;
  additionalImageUrls: string;
  price: string;
  inventoryQuantity: string;
  brand: string;
  attributesJson: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstNonEmptyString(source: Array<Record<string, unknown> | null>, keys: string[]): string {
  for (const record of source) {
    if (!record) continue;
    for (const key of keys) {
      const value = asText(record[key]);
      if (value && value.trim()) {
        return value.trim();
      }
    }
  }
  return "";
}

function firstNonEmptyNumber(source: Array<Record<string, unknown> | null>, keys: string[]): number | null {
  for (const record of source) {
    if (!record) continue;
    for (const key of keys) {
      const value = asNumber(record[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function listFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        const objectEntry = asObject(entry);
        if (!objectEntry) return "";
        const direct = asText(objectEntry.url) ?? asText(objectEntry.value) ?? asText(objectEntry.name);
        return direct?.trim() ?? "";
      })
      .filter(Boolean);
  }

  const asString = asText(value)?.trim() ?? "";
  if (!asString) return [];
  return asString
    .split(/\r?\n|[;|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function imageListFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => imageListFromUnknown(entry))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const objectValue = asObject(value);
  if (objectValue) {
    return imageListFromUnknown(
      objectValue.url ??
      objectValue.imageUrl ??
      objectValue.primaryImageUrl ??
      objectValue.src ??
      objectValue.value ??
      ""
    );
  }

  const asString = asText(value)?.trim() ?? "";
  if (!asString) return [];
  return asString
    .split(/\r?\n|[;,|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function readLatestDraftPayload(stagedDrafts: WalmartDraftRecord[]): Record<string, unknown> | null {
  return [...stagedDrafts]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((draft) => asObject(draft.draftPayload))
    .find((draft): draft is Record<string, unknown> => draft !== null) ?? null;
}

function readDraftString(draft: Record<string, unknown> | null, keys: string[]): string | null {
  if (!draft) return null;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    const value = asText(draft[key]);
    if (value !== null) return value;
  }
  return null;
}

function readDraftNumber(draft: Record<string, unknown> | null, keys: string[]): number | null {
  if (!draft) return null;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    const value = asNumber(draft[key]);
    if (value !== null) return value;
  }
  return null;
}

function readDraftList(draft: Record<string, unknown> | null, keys: string[], imageList = false): string[] | null {
  if (!draft) return null;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    const parsed = imageList ? imageListFromUnknown(draft[key]) : listFromUnknown(draft[key]);
    return parsed;
  }
  return null;
}

function readDraftAttributes(draft: Record<string, unknown> | null): Record<string, string> | null {
  if (!draft || !hasOwn(draft, "attributes")) return null;
  const value = draft.attributes;
  const objectValue = asObject(value);
  if (objectValue) {
    const result: Record<string, string> = {};
    for (const [key, attributeValue] of Object.entries(objectValue)) {
      const text = asText(attributeValue)?.trim() ?? "";
      if (text) result[key] = text;
    }
    return result;
  }

  const stringValue = asText(value)?.trim();
  if (!stringValue) return {};
  try {
    const parsed = JSON.parse(stringValue) as unknown;
    const parsedObject = asObject(parsed);
    if (!parsedObject) return {};
    const result: Record<string, string> = {};
    for (const [key, attributeValue] of Object.entries(parsedObject)) {
      const text = asText(attributeValue)?.trim() ?? "";
      if (text) result[key] = text;
    }
    return result;
  } catch {
    return {};
  }
}

function hydrateEditorForm(product: WalmartProductRecord, stagedDrafts: WalmartDraftRecord[]): ProductEditorFormState {
  const draft = readLatestDraftPayload(stagedDrafts);
  const normalized = asObject(product.normalizedPayload);
  const raw = asObject(product.rawPayload);
  const rawProduct = asObject(raw?.product);
  const rawContent = asObject(raw?.content);

  const sources = [normalized, product as unknown as Record<string, unknown>, raw, rawProduct, rawContent];

  const draftTitle = readDraftString(draft, ["title"]);
  const draftShortDescription = readDraftString(draft, ["shortDescription", "short_desc"]);
  const draftLongDescription = readDraftString(draft, ["longDescription", "description", "productDescription"]);
  const draftBrand = readDraftString(draft, ["brand", "brandName"]);
  const draftImageUrl = readDraftString(draft, ["imageUrl", "primaryImageUrl"]);
  const draftPrice = readDraftNumber(draft, ["price"]);
  const draftInventory = readDraftNumber(draft, ["inventoryQuantity"]);
  const draftBullets = readDraftList(draft, ["bulletPoints", "keyFeatures", "bullets"]);
  const draftAdditionalImages = readDraftList(
    draft,
    ["additionalImageUrls", "galleryImageUrls", "imageUrls", "additionalImages", "variantImageUrls"],
    true
  );
  const draftAttributes = readDraftAttributes(draft);

  const title = draftTitle !== null
    ? draftTitle
    : (firstNonEmptyString(sources, ["title", "productName", "name"]) || product.title);
  const shortDescription =
    draftShortDescription ??
    firstNonEmptyString(sources, ["shortDescription", "short_desc", "synopsis", "shortDesc"]);
  const longDescription =
    draftLongDescription ??
    firstNonEmptyString(sources, ["longDescription", "description", "productDescription", "long_desc"]);
  const brandCandidate = draftBrand !== null
    ? draftBrand
    : (firstNonEmptyString(sources, ["brand", "brandName", "manufacturer"]) || product.brand);
  const normalizedBrand = brandCandidate.trim();
  const brand =
    normalizedBrand && normalizedBrand.toLowerCase() !== "unknown"
      ? normalizedBrand
      : firstNonEmptyString([raw, rawProduct, rawContent], ["brand", "brandName", "manufacturer"]) || normalizedBrand;
  const imageUrl = draftImageUrl !== null
    ? draftImageUrl
    : (
        firstNonEmptyString(sources, ["imageUrl", "primaryImageUrl", "productImageUrl", "mainImageUrl", "itemImageUrl"]) ||
        product.imageUrl
      );
  const additionalImageUrls =
    draftAdditionalImages ??
    unique([
      ...imageListFromUnknown(normalized?.galleryImageUrls),
      ...imageListFromUnknown(normalized?.additionalImageUrls),
      ...imageListFromUnknown(raw?.additionalImageUrls),
      ...imageListFromUnknown(raw?.galleryImageUrls),
      ...imageListFromUnknown(raw?.imageUrls),
      ...(product.galleryImageUrls ?? []),
      ...(product.variantImageUrls ?? []),
    ]);
  const normalizedBullets = listFromUnknown(normalized?.bulletPoints);
  const rawBullets = listFromUnknown(raw?.bulletPoints);
  const rawKeyFeatures = listFromUnknown(raw?.keyFeatures);
  const bulletPoints =
    draftBullets ??
    (normalizedBullets.length
      ? normalizedBullets
      : rawBullets.length
        ? rawBullets
        : rawKeyFeatures.length
          ? rawKeyFeatures
          : product.bulletPoints);
  const price =
    draftPrice ??
    firstNonEmptyNumber(sources, ["price", "amount"]) ??
    product.price;
  const inventoryQuantity =
    draftInventory ??
    firstNonEmptyNumber(sources, ["inventoryQuantity", "quantity", "inventory"]) ??
    (product.inventoryStatus === "unknown" ? null : product.inventoryQuantity);

  const attributesSource =
    draftAttributes ??
    asObject(normalized?.attributes) ??
    asObject(raw?.attributes) ??
    asObject(raw?.keyAttributes) ??
    product.attributes;

  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributesSource ?? {})) {
    const text = asText(value)?.trim() ?? "";
    if (text) attributes[key] = text;
  }

  return {
    title,
    shortDescription,
    longDescription,
    bulletPoints: bulletPoints.join("\n"),
    imageUrl,
    additionalImageUrls: unique(additionalImageUrls).join("\n"),
    price: Number.isFinite(price) ? String(price) : "",
    inventoryQuantity: inventoryQuantity === null ? "" : String(inventoryQuantity),
    brand: brand,
    attributesJson: JSON.stringify(attributes, null, 2),
  };
}

function formatInventory(product: WalmartProductRecord): string {
  if (product.inventoryStatus === "unknown") return "Unknown (Not synced)";
  if (product.inventoryStatus === "out_of_stock") return "Out of stock (0)";
  return `Known (${product.inventoryQuantity})`;
}

function formatImageStatus(product: WalmartProductRecord): string {
  if (product.imageStatusMessage?.trim()) return product.imageStatusMessage;
  if (product.imageSyncStatus === "not_found") return "Item Search returned no usable image.";
  if (product.imageSyncStatus === "ambiguous") return "Multiple Walmart Item Search candidates matched this product.";
  if (product.imageSyncStatus === "failed") return "Item Search request failed after retry.";
  if (product.imageSyncStatus === "not_synced") return "Image enrichment not synced.";
  if (product.imageUrl) return "Image available";
  return "Image enrichment not synced.";
}

function formatImageSource(product: WalmartProductRecord): string {
  if (product.imageSource === "walmart_item_report") return "Walmart Item Report";
  if (product.imageSource === "walmart_catalog") return "Walmart Seller Catalog Search";
  if (product.imageSource === "walmart_item_search") return "Walmart Item Search";
  return "Not synced";
}

function changedProposalFields(product: WalmartProductRecord, proposal: WalmartOptimizationProposalRecord): string[] {
  const changed: string[] = [];

  if (proposal.proposedTitle.trim() && proposal.proposedTitle.trim() !== product.title.trim()) {
    changed.push("Title");
  }

  if (proposal.proposedDescription.trim() && proposal.proposedDescription.trim() !== product.longDescription.trim()) {
    changed.push("Description");
  }

  if (
    proposal.proposedBullets.length > 0 &&
    JSON.stringify(proposal.proposedBullets) !== JSON.stringify(product.bulletPoints)
  ) {
    changed.push("Bullets");
  }

  if (
    Object.keys(proposal.proposedKeyAttributes).length > 0 &&
    JSON.stringify(proposal.proposedKeyAttributes) !== JSON.stringify(product.attributes)
  ) {
    changed.push("Key attributes");
  }

  if (proposal.proposedImageAction !== "keep" || proposal.proposedImageUrl.trim() !== product.imageUrl.trim()) {
    changed.push("Image strategy");
  }

  return changed;
}

export default function ProductEditorClient({
  product,
  stagedDrafts,
  aiProviderConnected,
}: ProductEditorClientProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const initialForm = useMemo(() => hydrateEditorForm(product, stagedDrafts), [product, stagedDrafts]);
  const [form, setForm] = useState<ProductEditorFormState>(() => initialForm);
  const [validated, setValidated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedSuggestions, setSavedSuggestions] = useState<string[]>([]);
  const [stagingRecommendation, setStagingRecommendation] = useState(false);
  const [approvingProposalId, setApprovingProposalId] = useState<string | null>(null);
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, WalmartOptimizationProposalStatus>>({});
  const [localStagedProposal, setLocalStagedProposal] = useState<WalmartOptimizationProposalRecord | null>(null);

  const listingQuality = useMemo(() => assessWalmartListingQuality(product), [product]);
  const deterministicProposal = useMemo(
    () => buildDeterministicOptimizationProposal(product, listingQuality),
    [product, listingQuality]
  );
  const stagedOptimizations = useMemo(() => {
    const indexed = new Map<string, WalmartOptimizationProposalRecord>();
    for (const draft of stagedDrafts) {
      const proposal = readOptimizerProposalFromDraft(draft);
      if (!proposal) continue;
      indexed.set(proposal.id, proposal);
    }

    if (localStagedProposal) {
      indexed.set(localStagedProposal.id, localStagedProposal);
    }

    return Array.from(indexed.values())
      .map((proposal) => ({
        ...proposal,
        status: localStatusOverrides[proposal.id] ?? proposal.status,
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [stagedDrafts, localStagedProposal, localStatusOverrides]);

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
    return Array.from(new Set([...violations, ...complianceValidation.violations]));
  }, [preview, complianceValidation]);

  const validationWarnings = useMemo(() => complianceValidation.warnings, [complianceValidation]);

  const displayTitle = form.title.trim() || product.title;
  const displayBrand = form.brand.trim() || (product.brand.trim() || "Unknown");
  const aiOptimizerHref = `/apps/ecomviper/walmart/ai-optimizer?sku=${encodeURIComponent(product.sku)}`;

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

  function handleOptimizeWithAi() {
    if (aiProviderConnected) return;
    setMessage(OPENAI_OPTIMIZE_REQUIRED_MESSAGE);
  }

  async function handleStageDeterministicRecommendation() {
    const timestamp = new Date().toISOString();
    const stagedProposal: WalmartOptimizationProposalRecord = {
      ...deterministicProposal,
      status: "staged",
      updatedAt: timestamp,
    };

    try {
      setStagingRecommendation(true);
      const response = await fetch("/api/ecomviper/walmart/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: product.sku,
          draftPayload: toOptimizerDraftPayload(stagedProposal),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setMessage(payload?.error?.message ?? "Failed to stage deterministic recommendations.");
        return;
      }

      setLocalStagedProposal(stagedProposal);
      setLocalStatusOverrides((current) => ({ ...current, [stagedProposal.id]: "staged" }));
      setMessage("Deterministic recommendations staged. No live Walmart feed submission was performed.");
    } catch {
      setMessage("Failed to stage deterministic recommendations.");
    } finally {
      setStagingRecommendation(false);
    }
  }

  async function handleApproveProposal(proposal: WalmartOptimizationProposalRecord) {
    const timestamp = new Date().toISOString();
    const approvedProposal: WalmartOptimizationProposalRecord = {
      ...proposal,
      status: "approved",
      updatedAt: timestamp,
    };

    try {
      setApprovingProposalId(proposal.id);
      const response = await fetch("/api/ecomviper/walmart/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: product.sku,
          draftPayload: toOptimizerDraftPayload(approvedProposal),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setMessage(payload?.error?.message ?? "Failed to approve proposal for future submission.");
        return;
      }

      setLocalStagedProposal(approvedProposal);
      setLocalStatusOverrides((current) => ({ ...current, [proposal.id]: "approved" }));
      setMessage("Proposal approved locally. Not submitted to Walmart. Human approval required before feed submission.");
    } catch {
      setMessage("Failed to approve proposal for future submission.");
    } finally {
      setApprovingProposalId(null);
    }
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-product-editor-page">
      <WalmartPageHeader
        title={`Product Editor • ${product.sku}`}
        subtitle="Stage content, pricing, and inventory changes before any submit flow."
      />

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-product-optimizer-summary"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">SKU</p>
            <p className="mt-1 text-sm font-medium text-[#0F172A]">{product.sku}</p>
            <p className="mt-1 text-xs text-[#64748B]">{displayTitle}</p>
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Brand / Price</p>
            <p className="mt-1 text-sm font-medium text-[#0F172A]">{displayBrand}</p>
            <p className="mt-1 text-xs text-[#64748B]">${product.price.toFixed(2)}</p>
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Inventory</p>
            <p className="mt-1 text-sm font-medium text-[#0F172A]">{formatInventory(product)}</p>
            <p className="mt-1 text-xs text-[#64748B]">Status: {product.inventoryStatus}</p>
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Listing Quality Score</p>
            <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{listingQuality.score}/100</p>
            <p className="mt-1 text-xs text-[#64748B]">Image: {formatImageStatus(product)}</p>
          </article>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Current Issues</p>
            <p className="mt-1 text-sm text-[#334155]">{product.issues.join(", ") || "None"}</p>
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Quality Factors</p>
            <p className="mt-1 text-sm text-[#334155]">{listingQuality.factors.join(", ") || "No quality blockers detected."}</p>
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-white p-3 xl:col-span-2">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Image Sync Status</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={`${product.sku} primary image`}
                  className="h-14 w-14 rounded border border-[#D9E4F0] bg-[#F8FBFF] object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="inline-flex h-14 w-14 items-center justify-center rounded border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">
                  N/A
                </span>
              )}
              <div className="space-y-1 text-xs text-[#475569]">
                <p>Status: {formatImageStatus(product)}</p>
                <p>Sync: {product.imageSyncStatus ?? "not_synced"}</p>
                <p>Source: {formatImageSource(product)}</p>
                <p>Match method: {product.imageMatchMethod ?? "N/A"}</p>
                <p>Matched itemId: {product.matchedItemId ?? "N/A"}</p>
                <p>Gallery images: {product.galleryImageUrls?.length ?? 0}</p>
                <p>Variant images: {product.variantImageUrls?.length ?? 0}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-primary-actions"
      >
        <div className="flex flex-wrap gap-2">
          {aiProviderConnected ? (
            <Link
              href={aiOptimizerHref}
              className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white"
            >
              Optimize with AI
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleOptimizeWithAi}
              className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white"
            >
              Optimize with AI
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveDraft}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
          >
            Save Draft
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
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
        {!aiProviderConnected ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {OPENAI_OPTIMIZE_REQUIRED_MESSAGE}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[#64748B]">
            OpenAI provider connected. Use Optimize with AI to open this SKU in the optimizer workflow.
          </p>
        )}
        <p className="mt-1 text-xs text-[#64748B]">
          Not submitted to Walmart. Human approval required before feed submission.
        </p>
        {message ? <p className="mt-2 text-sm text-[#334155]">{message}</p> : null}
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-ai-recommendations"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#0F172A]">Recommendations</h2>
        </div>
        {!aiProviderConnected ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            AI recommendation unavailable until provider is connected. Connect your OpenAI API key first to optimize this product.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#475569]">
            AI provider connected. Deterministic recommendations below can be staged immediately.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {listingQuality.recommendations.length ? (
            listingQuality.recommendations.map((recommendation: WalmartListingRecommendation) => (
              <li key={recommendation.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Deterministic recommendation</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0F172A]">{recommendation.title}</p>
                  <StatusBadge status={recommendation.severity} />
                </div>
                <p className="mt-1 text-sm text-[#475569]">{recommendation.reason}</p>
              </li>
            ))
          ) : (
            <li className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm text-[#475569]">
              No deterministic recommendations at the moment.
            </li>
          )}
        </ul>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleStageDeterministicRecommendation}
            disabled={stagingRecommendation}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {stagingRecommendation ? "Staging..." : "Stage Deterministic Recommendations"}
          </button>
          <p className="mt-2 text-xs text-[#64748B]">
            Not submitted to Walmart. Human approval required before feed submission.
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Workflow: import -&gt; inspect -&gt; optimize -&gt; stage -&gt; approve later -&gt; submit later.
          </p>
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-staged-changes"
      >
        <h2 className="text-lg font-semibold text-[#0F172A]">Staged changes</h2>
        <p className="mt-1 text-xs text-[#64748B]">Not submitted to Walmart. Human approval required before feed submission.</p>
        {stagedOptimizations.length ? (
          <div className="mt-3 space-y-2">
            {stagedOptimizations.map((proposal) => (
              <article key={proposal.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0F172A]">{proposal.source === "ai" ? "AI proposal" : "Deterministic proposal"}</p>
                  <StatusBadge status={proposal.status} />
                </div>
                <p className="mt-1 text-xs text-[#64748B]">Reason: {proposal.recommendationReason}</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Changed fields: {changedProposalFields(product, proposal).join(", ") || "No field changes detected"}
                </p>
                <p className="mt-1 text-sm text-[#334155]">Title: {proposal.proposedTitle || "None"}</p>
                <p className="mt-1 text-sm text-[#334155]">Description: {proposal.proposedDescription || "None"}</p>
                <p className="mt-1 text-sm text-[#334155]">
                  Bullets: {proposal.proposedBullets.length ? proposal.proposedBullets.join(" | ") : "None"}
                </p>
                <p className="mt-1 text-sm text-[#334155]">Image action: {proposal.proposedImageAction}</p>
                {proposal.status !== "approved" && proposal.status !== "submitted" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleApproveProposal(proposal)}
                      disabled={approvingProposalId === proposal.id}
                      className="rounded border border-[#0F172A] bg-[#0F172A] px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      {approvingProposalId === proposal.id ? "Approving..." : "Approve for future submit"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#64748B]">No staged optimization proposals yet.</p>
        )}
      </section>

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

        {SHOW_DEVELOPER_DIAGNOSTICS ? (
          <details className="mt-4 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
              Developer diagnostics
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border border-[#D9E4F0] bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Original payload snapshot</h2>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#F8FBFF] p-3 text-xs text-[#334155]">{JSON.stringify(product.rawPayload, null, 2)}</pre>
              </article>
              <article className="rounded-xl border border-[#D9E4F0] bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Normalized draft preview</h2>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#F8FBFF] p-3 text-xs text-[#334155]">{JSON.stringify(preview, null, 2)}</pre>
              </article>
            </div>
          </details>
        ) : null}

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
