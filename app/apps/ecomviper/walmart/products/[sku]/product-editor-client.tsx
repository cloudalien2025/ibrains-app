"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import {
  assessWalmartListingQuality,
  buildDeterministicOptimizationProposal,
} from "@/lib/ecomviper/walmart/walmart-listing-quality";
import {
  readOptimizerProposalFromDraft,
  toOptimizerDraftPayload,
} from "@/lib/ecomviper/walmart/walmart-optimizer-staging";
import type {
  WalmartAiSuggestion,
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
  "Content",
  "Media",
  "Pricing & Inventory",
  "Walmart Attributes",
  "Sync History",
] as const;

const OPENAI_OPTIMIZE_REQUIRED_MESSAGE =
  "Connect your OpenAI API key first to optimize this product.";
const SHOW_DEVELOPER_DIAGNOSTICS =
  process.env.NEXT_PUBLIC_ECOMVIPER_PRODUCT_EDITOR_DIAGNOSTICS === "1";

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

type GenerateSuggestionResponse = {
  ok: boolean;
  suggestion?: WalmartAiSuggestion;
  error?: {
    message?: string;
  };
};

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

function firstNonEmptyString(
  source: Array<Record<string, unknown> | null>,
  keys: string[]
): string {
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

function firstNonEmptyNumber(
  source: Array<Record<string, unknown> | null>,
  keys: string[]
): number | null {
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
        const direct =
          asText(objectEntry.url) ??
          asText(objectEntry.value) ??
          asText(objectEntry.name);
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

function readLatestDraftPayload(
  stagedDrafts: WalmartDraftRecord[]
): Record<string, unknown> | null {
  return (
    [...stagedDrafts]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((draft) => asObject(draft.draftPayload))
      .find((draft): draft is Record<string, unknown> => draft !== null) ?? null
  );
}

function readDraftString(
  draft: Record<string, unknown> | null,
  keys: string[]
): string | null {
  if (!draft) return null;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    const value = asText(draft[key]);
    if (value !== null) return value;
  }
  return null;
}

function readDraftNumber(
  draft: Record<string, unknown> | null,
  keys: string[]
): number | null {
  if (!draft) return null;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    const value = asNumber(draft[key]);
    if (value !== null) return value;
  }
  return null;
}

function readDraftList(
  draft: Record<string, unknown> | null,
  keys: string[],
  imageList = false
): string[] | null {
  if (!draft) return null;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    const parsed = imageList
      ? imageListFromUnknown(draft[key])
      : listFromUnknown(draft[key]);
    return parsed;
  }
  return null;
}

function readDraftAttributes(
  draft: Record<string, unknown> | null
): Record<string, string> | null {
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

function hydrateEditorForm(
  product: WalmartProductRecord,
  stagedDrafts: WalmartDraftRecord[]
): ProductEditorFormState {
  const draft = readLatestDraftPayload(stagedDrafts);
  const normalized = asObject(product.normalizedPayload);
  const raw = asObject(product.rawPayload);
  const rawProduct = asObject(raw?.product);
  const rawContent = asObject(raw?.content);

  const sources = [
    normalized,
    product as unknown as Record<string, unknown>,
    raw,
    rawProduct,
    rawContent,
  ];

  const draftTitle = readDraftString(draft, ["title"]);
  const draftShortDescription = readDraftString(draft, [
    "shortDescription",
    "short_desc",
  ]);
  const draftLongDescription = readDraftString(draft, [
    "longDescription",
    "description",
    "productDescription",
  ]);
  const draftBrand = readDraftString(draft, ["brand", "brandName"]);
  const draftImageUrl = readDraftString(draft, ["imageUrl", "primaryImageUrl"]);
  const draftPrice = readDraftNumber(draft, ["price"]);
  const draftInventory = readDraftNumber(draft, ["inventoryQuantity"]);
  const draftBullets = readDraftList(draft, ["bulletPoints", "keyFeatures", "bullets"]);
  const draftAdditionalImages = readDraftList(
    draft,
    [
      "additionalImageUrls",
      "galleryImageUrls",
      "imageUrls",
      "additionalImages",
      "variantImageUrls",
    ],
    true
  );
  const draftAttributes = readDraftAttributes(draft);

  const title =
    draftTitle !== null
      ? draftTitle
      : firstNonEmptyString(sources, ["title", "productName", "name"]) ||
        product.title;
  const shortDescription =
    draftShortDescription ??
    firstNonEmptyString(sources, [
      "shortDescription",
      "short_desc",
      "synopsis",
      "shortDesc",
    ]);
  const longDescription =
    draftLongDescription ??
    firstNonEmptyString(sources, [
      "longDescription",
      "description",
      "productDescription",
      "long_desc",
    ]);
  const brandCandidate =
    draftBrand !== null
      ? draftBrand
      : firstNonEmptyString(sources, ["brand", "brandName", "manufacturer"]) ||
        product.brand;
  const normalizedBrand = brandCandidate.trim();
  const brand =
    normalizedBrand && normalizedBrand.toLowerCase() !== "unknown"
      ? normalizedBrand
      : firstNonEmptyString([raw, rawProduct, rawContent], [
          "brand",
          "brandName",
          "manufacturer",
        ]) || normalizedBrand;
  const imageUrl =
    draftImageUrl !== null
      ? draftImageUrl
      : firstNonEmptyString(sources, [
          "imageUrl",
          "primaryImageUrl",
          "productImageUrl",
          "mainImageUrl",
          "itemImageUrl",
        ]) || product.imageUrl;
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
    draftPrice ?? firstNonEmptyNumber(sources, ["price", "amount"]) ?? product.price;
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
    brand,
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
  if (product.imageSyncStatus === "not_found")
    return "Item Search returned no usable image.";
  if (product.imageSyncStatus === "ambiguous")
    return "Multiple Walmart Item Search candidates matched this product.";
  if (product.imageSyncStatus === "failed")
    return "Item Search request failed after retry.";
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

function changedProposalFields(
  product: WalmartProductRecord,
  proposal: WalmartOptimizationProposalRecord
): string[] {
  const changed: string[] = [];

  if (
    proposal.proposedTitle.trim() &&
    proposal.proposedTitle.trim() !== product.title.trim()
  ) {
    changed.push("Title");
  }

  if (
    proposal.proposedDescription.trim() &&
    proposal.proposedDescription.trim() !== product.longDescription.trim()
  ) {
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

  if (
    proposal.proposedImageAction !== "keep" ||
    proposal.proposedImageUrl.trim() !== product.imageUrl.trim()
  ) {
    changed.push("Image strategy");
  }

  return changed;
}

function readAttributesFromForm(attributesJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(attributesJson) as unknown;
    const parsedObject = asObject(parsed);
    if (!parsedObject) return {};

    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsedObject)) {
      const text = asText(value)?.trim() ?? "";
      if (text) mapped[key] = text;
    }
    return mapped;
  } catch {
    return {};
  }
}

function inferShortDescriptionFromAi(suggestedDescription: string): string {
  const trimmed = suggestedDescription.trim();
  if (!trimmed) return "";
  const firstSentence = trimmed.split(/[.!?]/).find((chunk) => chunk.trim().length > 0);
  const compact = (firstSentence ?? trimmed).trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

export default function ProductEditorClient({
  product,
  stagedDrafts,
  aiProviderConnected,
}: ProductEditorClientProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Content");
  const initialForm = useMemo(() => hydrateEditorForm(product, stagedDrafts), [product, stagedDrafts]);
  const [form, setForm] = useState<ProductEditorFormState>(() => initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [savedSuggestions, setSavedSuggestions] = useState<string[]>([]);
  const [stagingRecommendation, setStagingRecommendation] = useState(false);
  const [approvingProposalId, setApprovingProposalId] = useState<string | null>(null);
  const [localStatusOverrides, setLocalStatusOverrides] = useState<
    Record<string, WalmartOptimizationProposalStatus>
  >({});
  const [localStagedProposal, setLocalStagedProposal] =
    useState<WalmartOptimizationProposalRecord | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(() => {
    return [...stagedDrafts]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.updatedAt ?? null;
  });

  const [optimizingWithAi, setOptimizingWithAi] = useState(false);
  const [inlineAiMessage, setInlineAiMessage] = useState<string | null>(null);
  const [inlineAiSuggestion, setInlineAiSuggestion] =
    useState<WalmartAiSuggestion | null>(null);

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

  const complianceValidation = useMemo(
    () => evaluateWalmartListingCompliance(preview),
    [preview]
  );

  const validationViolations = useMemo(() => {
    const violations: string[] = [];
    if (!preview.title) violations.push("Title is required");
    if (!Number.isFinite(preview.price) || preview.price <= 0) {
      violations.push("Price must be greater than zero");
    }
    if (
      !Number.isFinite(preview.inventoryQuantity) ||
      preview.inventoryQuantity < 0
    ) {
      violations.push("Inventory must be 0 or greater");
    }
    return Array.from(new Set([...violations, ...complianceValidation.violations]));
  }, [preview, complianceValidation]);

  const validationWarnings = useMemo(
    () => complianceValidation.warnings,
    [complianceValidation]
  );

  const canSubmit = validationViolations.length === 0 && !formDirty;
  const readinessLabel = canSubmit ? "Ready to submit" : "Needs review";
  const readinessNote = canSubmit
    ? "Draft is valid and saved. Submit Update remains human-controlled and approval-gated."
    : formDirty
    ? "Draft has unsaved changes. Save Draft before Submit Update."
    : "Resolve validation blockers before Submit Update.";

  const displayTitle = form.title.trim() || product.title;
  const displayBrand = form.brand.trim() || product.brand.trim() || "Unknown";

  function patchForm(patch: Partial<ProductEditorFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setFormDirty(true);
  }

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
    setFormDirty(false);
    setLastDraftSavedAt(payload.draft?.updatedAt ?? new Date().toISOString());

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

  async function runInlineOptimization() {
    if (!aiProviderConnected) {
      setInlineAiMessage(OPENAI_OPTIMIZE_REQUIRED_MESSAGE);
      return;
    }

    try {
      setOptimizingWithAi(true);
      setInlineAiMessage(null);
      const response = await fetch("/api/ecomviper/walmart/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: product.sku }),
      });

      const payload =
        (await response.json().catch(() => null)) as GenerateSuggestionResponse | null;

      if (!response.ok || !payload?.suggestion) {
        setInlineAiMessage(
          payload?.error?.message ?? "Failed to generate AI suggestions."
        );
        return;
      }

      setInlineAiSuggestion(payload.suggestion);
      setInlineAiMessage("AI suggestions are ready. Review and apply to your draft.");
    } catch {
      setInlineAiMessage("Failed to generate AI suggestions.");
    } finally {
      setOptimizingWithAi(false);
    }
  }

  function handleApplyInlineAiSuggestion() {
    if (!inlineAiSuggestion) {
      setInlineAiMessage("Generate AI suggestions first.");
      return;
    }

    const attributeMap = readAttributesFromForm(form.attributesJson);
    for (const attribute of inlineAiSuggestion.missingAttributes) {
      const key = attribute.trim();
      if (key && !hasOwn(attributeMap as unknown as Record<string, unknown>, key)) {
        attributeMap[key] = "";
      }
    }

    patchForm({
      title: inlineAiSuggestion.suggestedTitle,
      longDescription: inlineAiSuggestion.suggestedDescription,
      shortDescription:
        form.shortDescription.trim() ||
        inferShortDescriptionFromAi(inlineAiSuggestion.suggestedDescription),
      bulletPoints: inlineAiSuggestion.suggestedBullets.join("\n"),
      attributesJson: JSON.stringify(attributeMap, null, 2),
    });
    setInlineAiMessage("AI suggestions applied to draft fields. Save Draft when ready.");
  }

  function handleDismissInlineAiSuggestion() {
    setInlineAiSuggestion(null);
    setInlineAiMessage("AI suggestions dismissed. Your current draft remains unchanged.");
  }

  async function handleStageNonAiRecommendations() {
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
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setMessage(
          payload?.error?.message ?? "Failed to stage non-AI recommendations."
        );
        return;
      }

      setLocalStagedProposal(stagedProposal);
      setLocalStatusOverrides((current) => ({
        ...current,
        [stagedProposal.id]: "staged",
      }));
      setMessage(
        "Non-AI recommendations staged. No live Walmart feed submission was performed."
      );
    } catch {
      setMessage("Failed to stage non-AI recommendations.");
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
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setMessage(
          payload?.error?.message ??
            "Failed to approve proposal for future submission."
        );
        return;
      }

      setLocalStagedProposal(approvedProposal);
      setLocalStatusOverrides((current) => ({
        ...current,
        [proposal.id]: "approved",
      }));
      setMessage(
        "Proposal approved locally. Not submitted to Walmart. Human approval required before feed submission."
      );
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
        subtitle="Current Walmart listing and draft changes in one workspace."
      />

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-product-optimizer-summary"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Product</p>
            <p className="mt-1 text-sm font-medium text-[#0F172A]">{displayTitle}</p>
            <p className="mt-1 text-xs text-[#64748B]">SKU: {product.sku}</p>
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
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Listing quality</p>
            <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{listingQuality.score}/100</p>
            <p className="mt-1 text-xs text-[#64748B]">{formatImageStatus(product)}</p>
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Image</p>
            <div className="mt-1 flex items-center gap-2">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={`${product.sku} primary image`}
                  className="h-12 w-12 rounded border border-[#D9E4F0] bg-white object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">
                  N/A
                </span>
              )}
              <div className="space-y-0.5 text-xs text-[#64748B]">
                <p>{formatImageSource(product)}</p>
                <p>{product.imageSyncStatus ?? "not_synced"}</p>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Status summary</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={canSubmit ? "validated" : "warning"} />
              <p className="text-sm font-medium text-[#0F172A]">{readinessLabel}</p>
            </div>
            <p className="mt-1 text-sm text-[#475569]">{readinessNote}</p>
            {lastDraftSavedAt ? (
              <p className="mt-1 text-xs text-[#64748B]">Last draft save: {lastDraftSavedAt}</p>
            ) : (
              <p className="mt-1 text-xs text-[#64748B]">No saved draft yet.</p>
            )}
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Current issues</p>
            <p className="mt-1 text-sm text-[#334155]">{product.issues.join(", ") || "None"}</p>
            <p className="mt-2 text-xs text-[#64748B]">Quality factors: {listingQuality.factors.join(", ") || "No major blockers."}</p>
          </article>
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-primary-actions"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runInlineOptimization}
            disabled={optimizingWithAi}
            className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {optimizingWithAi ? "Optimizing..." : "Optimize with AI"}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Submit Update
          </button>
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Not submitted to Walmart. Human approval required before feed submission.
        </p>
        {message ? <p className="mt-2 text-sm text-[#334155]">{message}</p> : null}
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-inline-ai-panel"
      >
        <h2 className="text-lg font-semibold text-[#0F172A]">Inline AI optimization</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Optimize title, descriptions, bullets, and listing attributes for this SKU without leaving the page.
        </p>

        {!aiProviderConnected ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {OPENAI_OPTIMIZE_REQUIRED_MESSAGE}
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#475569]">
            OpenAI provider connected. Run optimization and review suggestions before applying.
          </p>
        )}

        {optimizingWithAi ? (
          <p className="mt-3 rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
            Optimizing this Walmart listing with AI...
          </p>
        ) : null}

        {inlineAiSuggestion ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2" data-testid="ecomviper-walmart-inline-ai-results">
            <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">AI suggestions</p>
              <h3 className="mt-2 text-sm font-semibold text-[#0F172A]">Title</h3>
              <p className="mt-1 text-sm text-[#334155]">{inlineAiSuggestion.suggestedTitle}</p>

              <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">Long description</h3>
              <p className="mt-1 text-sm text-[#334155]">{inlineAiSuggestion.suggestedDescription}</p>

              <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">Bullet / key features</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                {inlineAiSuggestion.suggestedBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleApplyInlineAiSuggestion}
                  className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
                >
                  Apply suggestions to draft
                </button>
                <button
                  type="button"
                  onClick={runInlineOptimization}
                  disabled={optimizingWithAi}
                  className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handleDismissInlineAiSuggestion}
                  className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                >
                  Dismiss
                </button>
              </div>
            </article>

            <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Quality & compliance</p>
              <p className="mt-2 text-sm text-[#334155]">Suggested listing quality score: {inlineAiSuggestion.qualityScore}/100</p>

              <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">Suggested Walmart attributes</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                {inlineAiSuggestion.missingAttributes.length ? (
                  inlineAiSuggestion.missingAttributes.map((attribute) => (
                    <li key={attribute}>{attribute}</li>
                  ))
                ) : (
                  <li>No additional attribute suggestions.</li>
                )}
              </ul>

              <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">Compliance notes</h3>
              <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                {inlineAiSuggestion.complianceWarnings.length ? (
                  inlineAiSuggestion.complianceWarnings.map((warning) => (
                    <li
                      key={warning}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1"
                    >
                      {warning}
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg border border-[#D9E4F0] bg-white px-2 py-1">
                    No compliance warnings from the AI response.
                  </li>
                )}
              </ul>
            </article>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Non-AI suggestions</p>
            <p className="mt-1 text-sm text-[#475569]">
              Use these deterministic recommendations when AI is unavailable or before running AI optimization.
            </p>
            <ul className="mt-3 space-y-2">
              {listingQuality.recommendations.length ? (
                listingQuality.recommendations.map(
                  (recommendation: WalmartListingRecommendation) => (
                    <li
                      key={recommendation.id}
                      className="rounded-lg border border-[#E2E8F0] bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[#0F172A]">{recommendation.title}</p>
                        <StatusBadge status={recommendation.severity} />
                      </div>
                      <p className="mt-1 text-sm text-[#475569]">{recommendation.reason}</p>
                    </li>
                  )
                )
              ) : (
                <li className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm text-[#475569]">
                  No non-AI suggestions at the moment.
                </li>
              )}
            </ul>
            <div className="mt-3">
              <button
                type="button"
                onClick={handleStageNonAiRecommendations}
                disabled={stagingRecommendation}
                className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {stagingRecommendation
                  ? "Staging..."
                  : "Stage non-AI recommendations"}
              </button>
            </div>
          </div>
        )}

        {inlineAiMessage ? (
          <p className="mt-3 text-sm text-[#334155]">{inlineAiMessage}</p>
        ) : null}

        <p className="mt-2 text-xs text-[#64748B]">
          AI output is review-only until you apply it and save the draft. No direct publish action.
        </p>
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

        <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="ecomviper-walmart-product-form">
          <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
            Content
          </h2>
          <label className="text-sm text-[#334155] md:col-span-2">
            Title
            <input
              value={form.title}
              onChange={(event) => patchForm({ title: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Short description
            <textarea
              value={form.shortDescription}
              onChange={(event) => patchForm({ shortDescription: event.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Long description
            <textarea
              value={form.longDescription}
              onChange={(event) => patchForm({ longDescription: event.target.value })}
              className="mt-1 min-h-28 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Bullet / key features (one per line)
            <textarea
              value={form.bulletPoints}
              onChange={(event) => patchForm({ bulletPoints: event.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[#334155]">
            Brand
            <input
              value={form.brand}
              onChange={(event) => patchForm({ brand: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[#334155] md:col-span-2">
            Key attributes (JSON)
            <textarea
              value={form.attributesJson}
              onChange={(event) => patchForm({ attributesJson: event.target.value })}
              className="mt-1 min-h-24 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 font-mono text-xs"
            />
          </label>

          <h2 className="md:col-span-2 mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
            Media
          </h2>
          <label className="text-sm text-[#334155]">
            Primary image URL
            <input
              value={form.imageUrl}
              onChange={(event) => patchForm({ imageUrl: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[#334155]">
            Additional image URLs (one per line)
            <textarea
              value={form.additionalImageUrls}
              onChange={(event) => patchForm({ additionalImageUrls: event.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-xs text-[#475569] md:col-span-2">
            <p>Image sync status: {formatImageStatus(product)}</p>
            <p className="mt-1">Source: {formatImageSource(product)}</p>
            <p className="mt-1">Gallery images: {product.galleryImageUrls?.length ?? 0}</p>
            <p className="mt-1">Variant images: {product.variantImageUrls?.length ?? 0}</p>
          </div>

          <h2 className="md:col-span-2 mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
            Pricing & inventory
          </h2>
          <label className="text-sm text-[#334155]">
            Price
            <input
              value={form.price}
              onChange={(event) => patchForm({ price: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[#334155]">
            Inventory quantity
            <input
              value={form.inventoryQuantity}
              onChange={(event) => patchForm({ inventoryQuantity: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
            />
          </label>
        </div>

        {SHOW_DEVELOPER_DIAGNOSTICS ? (
          <details className="mt-4 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
              Developer diagnostics
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border border-[#D9E4F0] bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Original payload snapshot
                </h2>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#F8FBFF] p-3 text-xs text-[#334155]">
                  {JSON.stringify(product.rawPayload, null, 2)}
                </pre>
              </article>
              <article className="rounded-xl border border-[#D9E4F0] bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Normalized draft preview
                </h2>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#F8FBFF] p-3 text-xs text-[#334155]">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </article>
            </div>
          </details>
        ) : null}
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-readiness"
      >
        <h2 className="text-lg font-semibold text-[#0F172A]">Readiness & validation</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Validation is checked continuously and before Submit Update.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">Validation warnings</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {validationWarnings.length ? (
                validationWarnings.map((warning) => <li key={warning}>{warning}</li>)
              ) : (
                <li>No validation warnings.</li>
              )}
            </ul>
          </article>

          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">Blocking issues</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {validationViolations.length ? (
                validationViolations.map((violation) => <li key={violation}>{violation}</li>)
              ) : (
                <li>No blocking policy issues.</li>
              )}
            </ul>
          </article>
        </div>

        {savedSuggestions.length ? (
          <article className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">Draft suggestions</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {savedSuggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-staged-changes"
      >
        <h2 className="text-lg font-semibold text-[#0F172A]">Staged changes</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Not submitted to Walmart. Human approval required before feed submission.
        </p>
        {stagedOptimizations.length ? (
          <div className="mt-3 space-y-2">
            {stagedOptimizations.map((proposal) => (
              <article
                key={proposal.id}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0F172A]">
                    {proposal.source === "ai" ? "AI proposal" : "Non-AI proposal"}
                  </p>
                  <StatusBadge status={proposal.status} />
                </div>
                <p className="mt-1 text-xs text-[#64748B]">
                  Reason: {proposal.recommendationReason}
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Changed fields: {changedProposalFields(product, proposal).join(", ") || "No field changes detected"}
                </p>
                <p className="mt-1 text-sm text-[#334155]">
                  Title: {proposal.proposedTitle || "None"}
                </p>
                <p className="mt-1 text-sm text-[#334155]">
                  Description: {proposal.proposedDescription || "None"}
                </p>
                <p className="mt-1 text-sm text-[#334155]">
                  Bullets: {proposal.proposedBullets.length ? proposal.proposedBullets.join(" | ") : "None"}
                </p>
                <p className="mt-1 text-sm text-[#334155]">
                  Image action: {proposal.proposedImageAction}
                </p>
                {proposal.status !== "approved" && proposal.status !== "submitted" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleApproveProposal(proposal)}
                      disabled={approvingProposalId === proposal.id}
                      className="rounded border border-[#0F172A] bg-[#0F172A] px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      {approvingProposalId === proposal.id
                        ? "Approving..."
                        : "Approve for future submit"}
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
    </div>
  );
}
