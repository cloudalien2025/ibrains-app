"use client";

import { useMemo, useRef, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import {
  assessWalmartListingQuality,
  buildDeterministicOptimizationProposal,
  mergeWalmartAiSuggestionIntoProduct,
  mergeWalmartDraftPayloadIntoProduct,
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
  serpApiProviderConnected: boolean;
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
  publicWalmartUrl: string;
  publicWalmartProductId: string;
  imageSource: string;
  imageMatchMethod: string;
  imageSyncStatus: string;
  imageSyncReason: string;
  lastImageSyncedAt: string;
  price: string;
  inventoryQuantity: string;
  brand: string;
  attributesJson: string;
}

type GenerateSuggestionResponse = {
  ok: boolean;
  suggestion?: WalmartAiSuggestion;
  error?: {
    code?: string;
    message?: string;
  };
};

type PublicListingResolveResponse = {
  ok: boolean;
  sku: string;
  resolved?: {
    imageSyncStatus: string;
    imageSource: string;
    imageSourceLabel: string;
    imageMatchMethod: string | null;
    publicWalmartUrl: string;
    publicWalmartProductId: string;
    primaryImageUrl: string;
    galleryImageUrls: string[];
    variantImageUrls: string[];
    imageCount: number;
    imageSyncReason: string;
    lastImageSyncedAt: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type InlineAiState = "idle" | "loading" | "success" | "error" | "missing_key";
type InlineAiOutcome = "improved" | "unchanged" | "worse";

const INLINE_AI_LOADING_MESSAGE = "Generating AI improvements...";

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

function firstNonEmptyStringValue(...values: Array<unknown>): string {
  for (const value of values) {
    const text = asText(value);
    if (text && text.trim()) {
      return text.trim();
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
  const draftPublicWalmartUrl = readDraftString(draft, ["publicWalmartUrl"]);
  const draftPublicWalmartProductId = readDraftString(draft, ["publicWalmartProductId"]);
  const draftImageSource = readDraftString(draft, ["imageSource"]);
  const draftImageMatchMethod = readDraftString(draft, ["imageMatchMethod"]);
  const draftImageSyncStatus = readDraftString(draft, ["imageSyncStatus"]);
  const draftImageSyncReason = readDraftString(draft, ["imageSyncReason"]);
  const draftLastImageSyncedAt = readDraftString(draft, ["lastImageSyncedAt"]);
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
  const publicWalmartUrl =
    draftPublicWalmartUrl ??
    firstNonEmptyStringValue(
      product.publicWalmartUrl,
      normalized?.publicWalmartUrl,
      raw?.publicWalmartUrl
    );
  const publicWalmartProductId =
    draftPublicWalmartProductId ??
    firstNonEmptyStringValue(
      product.publicWalmartProductId,
      normalized?.publicWalmartProductId,
      raw?.publicWalmartProductId
    );
  const imageSource =
    draftImageSource ??
    firstNonEmptyStringValue(
      product.imageSource,
      normalized?.imageSource,
      raw?.imageSource
    );
  const imageMatchMethod =
    draftImageMatchMethod ??
    firstNonEmptyStringValue(
      product.imageMatchMethod,
      normalized?.imageMatchMethod,
      raw?.imageMatchMethod
    );
  const imageSyncStatus =
    draftImageSyncStatus ??
    firstNonEmptyStringValue(
      product.imageSyncStatus,
      normalized?.imageSyncStatus,
      raw?.imageSyncStatus
    );
  const imageSyncReason =
    draftImageSyncReason ??
    firstNonEmptyStringValue(
      product.imageSyncReason,
      product.imageStatusMessage,
      normalized?.imageSyncReason,
      raw?.imageSyncReason
    );
  const lastImageSyncedAt =
    draftLastImageSyncedAt ??
    firstNonEmptyStringValue(
      product.lastImageSyncedAt,
      normalized?.lastImageSyncedAt,
      raw?.lastImageSyncedAt
    );
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
    publicWalmartUrl,
    publicWalmartProductId,
    imageSource,
    imageMatchMethod,
    imageSyncStatus,
    imageSyncReason,
    lastImageSyncedAt,
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
  if (product.imageSyncStatus === "not_found") {
    if (product.imageSource === "walmart_item_report")
      return "No matching row found in Walmart Item Report.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "No public Walmart listing images found via SerpApi.";
    if (product.imageSource === "manual") return "Manual image URL not provided.";
    return "Item Search returned no usable image.";
  }
  if (product.imageSyncStatus === "ambiguous") {
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing image match is ambiguous.";
    return "Multiple Walmart Item Search candidates matched this product.";
  }
  if (product.imageSyncStatus === "failed") {
    if (product.imageSource === "walmart_item_report")
      return "Walmart Item Report request failed.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing image lookup failed.";
    return "Item Search request failed after retry.";
  }
  if (product.imageSyncStatus === "not_synced") {
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing images not synced.";
    if (product.imageSource === "manual") return "Manual image URL not provided.";
    return "Image enrichment not synced.";
  }
  if (product.imageUrl) return "Image available";
  return "Image enrichment not synced.";
}

function formatImageSource(product: WalmartProductRecord): string {
  if (product.imageSource === "walmart_item_report") return "Walmart Item Report";
  if (product.imageSource === "walmart_catalog") return "Walmart Seller Catalog Search";
  if (product.imageSource === "walmart_item_search") return "Walmart Item Search";
  if (product.imageSource === "public_walmart_listing_serpapi")
    return "Public Walmart listing via SerpApi";
  if (product.imageSource === "manual") return "Manual image URL";
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
  serpApiProviderConnected,
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

  const inlineAiPanelRef = useRef<HTMLElement | null>(null);
  const [inlineAiState, setInlineAiState] = useState<InlineAiState>("idle");
  const [inlineAiMessage, setInlineAiMessage] = useState<string | null>(null);
  const [inlineAiSuggestion, setInlineAiSuggestion] =
    useState<WalmartAiSuggestion | null>(null);
  const [aiSuggestionApplied, setAiSuggestionApplied] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [draftEditorOpen, setDraftEditorOpen] = useState(false);
  const [resolvingPublicImages, setResolvingPublicImages] = useState(false);
  const [resolvedPublicImages, setResolvedPublicImages] =
    useState<PublicListingResolveResponse["resolved"] | null>(() => {
      if (
        initialForm.imageSource === "public_walmart_listing_serpapi" &&
        (initialForm.imageUrl.trim() || initialForm.additionalImageUrls.trim())
      ) {
        const galleryImageUrls = unique([
          initialForm.imageUrl.trim(),
          ...initialForm.additionalImageUrls
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        ]);
        return {
          imageSyncStatus: initialForm.imageSyncStatus || "found",
          imageSource: "public_walmart_listing_serpapi",
          imageSourceLabel: "Public Walmart listing via SerpApi",
          imageMatchMethod: initialForm.imageMatchMethod || null,
          publicWalmartUrl: initialForm.publicWalmartUrl,
          publicWalmartProductId: initialForm.publicWalmartProductId,
          primaryImageUrl: initialForm.imageUrl.trim(),
          galleryImageUrls,
          variantImageUrls: [],
          imageCount: galleryImageUrls.length,
          imageSyncReason:
            initialForm.imageSyncReason || "Public Walmart listing images found via SerpApi.",
          lastImageSyncedAt: initialForm.lastImageSyncedAt || new Date().toISOString(),
        };
      }
      return null;
    });
  const [publicImageMessage, setPublicImageMessage] = useState<string | null>(null);
  const optimizingWithAi = inlineAiState === "loading";

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
        const mapped: Record<string, string> = {};
        for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
          const normalizedKey = key.trim();
          const normalizedValue = asText(raw)?.trim() ?? "";
          if (!normalizedKey || !normalizedValue) continue;
          mapped[normalizedKey] = normalizedValue;
        }
        parsedAttributes = mapped;
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
      publicWalmartUrl: form.publicWalmartUrl.trim() || undefined,
      publicWalmartProductId: form.publicWalmartProductId.trim() || undefined,
      imageSource: form.imageSource.trim() || undefined,
      imageMatchMethod: form.imageMatchMethod.trim() || undefined,
      imageSyncStatus: form.imageSyncStatus.trim() || undefined,
      imageSyncReason: form.imageSyncReason.trim() || undefined,
      lastImageSyncedAt: form.lastImageSyncedAt.trim() || undefined,
      price: Number(form.price),
      inventoryQuantity: Number(form.inventoryQuantity),
      brand: form.brand.trim(),
      attributes: parsedAttributes,
    };
  }, [form]);

  const scoringProduct = useMemo(
    () => mergeWalmartDraftPayloadIntoProduct(product, preview),
    [product, preview]
  );
  const listingQuality = useMemo(
    () => assessWalmartListingQuality(scoringProduct),
    [scoringProduct]
  );
  const deterministicProposal = useMemo(
    () => buildDeterministicOptimizationProposal(scoringProduct, listingQuality),
    [scoringProduct, listingQuality]
  );
  const projectedQuality = useMemo(() => {
    if (!inlineAiSuggestion) return null;
    const projectedProduct = mergeWalmartAiSuggestionIntoProduct(
      scoringProduct,
      inlineAiSuggestion
    );
    return assessWalmartListingQuality(projectedProduct);
  }, [inlineAiSuggestion, scoringProduct]);
  const projectedQualityDelta = projectedQuality
    ? projectedQuality.score - listingQuality.score
    : 0;
  const inlineAiOutcome: InlineAiOutcome | null = projectedQuality
    ? projectedQualityDelta > 0
      ? "improved"
      : projectedQualityDelta < 0
        ? "worse"
        : "unchanged"
    : null;

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
    try {
      if (form.attributesJson.trim()) {
        const parsed = JSON.parse(form.attributesJson) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setMessage("Draft could not be saved because attributes are not valid JSON.");
          return;
        }
      }
    } catch {
      setMessage("Draft could not be saved because attributes are not valid JSON.");
      return;
    }

    const response = await fetch("/api/ecomviper/walmart/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: product.sku, draftPayload: preview }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { code?: string; message?: string } }
        | null;
      const code = payload?.error?.code?.trim().toUpperCase() ?? "";
      if (code === "PRODUCT_NOT_FOUND") {
        setMessage("Draft could not be saved because the product record was not found.");
        return;
      }
      if (code === "BAD_REQUEST" && payload?.error?.message?.toLowerCase().includes("draftpayload")) {
        setMessage("Draft could not be saved because the draft payload is invalid.");
        return;
      }
      if (payload?.error?.message?.trim()) {
        setMessage(`Draft could not be saved. ${payload.error.message.trim()}`);
        return;
      }
      setMessage("Draft could not be saved. Please try again.");
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

    setMessage("Draft saved. Open Drafts to review and submit when ready.");
  }

  function toPublicImageErrorMessage(code: string, fallback: string): string {
    if (code === "SERPAPI_NOT_CONNECTED") {
      return "Connect your SerpApi key to fetch public Walmart listing images.";
    }
    if (code === "INVALID_PUBLIC_WALMART_URL") {
      return "Public Walmart listing URL is invalid. Use a valid walmart.com product URL.";
    }
    if (code === "INVALID_PUBLIC_WALMART_PRODUCT_ID") {
      return "Public Walmart product ID is invalid.";
    }
    if (code === "SERPAPI_AUTH_FAILED") {
      return "SerpApi authentication failed. Verify your SerpApi key on the Connect page.";
    }
    if (code === "SERPAPI_RATE_LIMITED") {
      return "SerpApi rate limited this request. Retry in a moment.";
    }
    if (code === "SERPAPI_AMBIGUOUS_MATCH") {
      return "Multiple public Walmart listing candidates matched this product. Provide a direct public Walmart URL.";
    }
    if (code === "SERPAPI_NOT_FOUND" || code === "SERPAPI_NO_IMAGES_FOUND") {
      return "No public Walmart listing images were found for this product.";
    }
    return fallback || "Could not fetch public Walmart listing images.";
  }

  async function handleFindPublicListingImages() {
    setResolvedPublicImages(null);
    setPublicImageMessage(null);
    setResolvingPublicImages(true);

    try {
      const response = await fetch(
        `/api/ecomviper/walmart/products/${encodeURIComponent(product.sku)}/images/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicWalmartUrl: form.publicWalmartUrl.trim(),
            publicWalmartProductId: form.publicWalmartProductId.trim(),
          }),
        }
      );

      const payload = (await response.json().catch(() => null)) as PublicListingResolveResponse | null;
      if (!response.ok || !payload?.resolved) {
        const code = payload?.error?.code?.trim().toUpperCase() ?? "";
        const fallback = payload?.error?.message?.trim() ?? "Could not fetch public Walmart listing images.";
        setPublicImageMessage(toPublicImageErrorMessage(code, fallback));
        return;
      }

      setResolvedPublicImages(payload.resolved);
      setPublicImageMessage("Public Walmart listing images found. Click Use Images in Draft to apply them.");
      setForm((current) => ({
        ...current,
        publicWalmartUrl: payload.resolved?.publicWalmartUrl || current.publicWalmartUrl,
        publicWalmartProductId:
          payload.resolved?.publicWalmartProductId || current.publicWalmartProductId,
      }));
    } catch {
      setPublicImageMessage("Provider request failed. Could not fetch public Walmart listing images.");
    } finally {
      setResolvingPublicImages(false);
    }
  }

  function handleUseResolvedImagesInDraft() {
    if (!resolvedPublicImages) {
      setPublicImageMessage("Find images first, then use them in draft.");
      return;
    }

    const primaryImageUrl = resolvedPublicImages.primaryImageUrl.trim();
    const galleryImageUrls = unique(
      resolvedPublicImages.galleryImageUrls
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
    const additionalImageUrls = galleryImageUrls.filter((entry) => entry !== primaryImageUrl);

    patchForm({
      imageUrl: primaryImageUrl,
      additionalImageUrls: additionalImageUrls.join("\n"),
      publicWalmartUrl: resolvedPublicImages.publicWalmartUrl || form.publicWalmartUrl,
      publicWalmartProductId:
        resolvedPublicImages.publicWalmartProductId || form.publicWalmartProductId,
      imageSource: resolvedPublicImages.imageSource || "public_walmart_listing_serpapi",
      imageMatchMethod: resolvedPublicImages.imageMatchMethod ?? "",
      imageSyncStatus: resolvedPublicImages.imageSyncStatus || "found",
      imageSyncReason: resolvedPublicImages.imageSyncReason || "Public Walmart listing images found via SerpApi.",
      lastImageSyncedAt: resolvedPublicImages.lastImageSyncedAt || new Date().toISOString(),
    });
    setPublicImageMessage("Images added to draft. Save Draft before submitting.");
  }

  function revealInlineAiPanel() {
    if (!inlineAiPanelRef.current) return;
    inlineAiPanelRef.current.focus();
    if (typeof inlineAiPanelRef.current.scrollIntoView === "function") {
      inlineAiPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  async function runInlineOptimization() {
    revealInlineAiPanel();
    setShowAiDetails(false);
    setAiSuggestionApplied(false);

    if (!aiProviderConnected) {
      setInlineAiState("missing_key");
      setInlineAiMessage(OPENAI_OPTIMIZE_REQUIRED_MESSAGE);
      return;
    }

    try {
      setInlineAiState("loading");
      setInlineAiMessage(INLINE_AI_LOADING_MESSAGE);
      setInlineAiSuggestion(null);
      const response = await fetch("/api/ecomviper/walmart/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: product.sku,
          draftPayload: preview,
        }),
      });

      const payload =
        (await response.json().catch(() => null)) as GenerateSuggestionResponse | null;

      if (!response.ok || !payload?.suggestion) {
        const errorCode = payload?.error?.code?.trim().toUpperCase() ?? "";
        const errorMessage = payload?.error?.message?.trim() ?? "";
        const missingKey =
          errorCode === "OPENAI_NOT_CONNECTED" ||
          /openai api key/i.test(errorMessage);

        setInlineAiState(missingKey ? "missing_key" : "error");
        setInlineAiMessage(
          missingKey
            ? OPENAI_OPTIMIZE_REQUIRED_MESSAGE
            : errorMessage || "Failed to generate AI suggestions. Try again."
        );
        return;
      }

      setInlineAiSuggestion(payload.suggestion);
      setInlineAiState("success");
      setInlineAiMessage("AI suggestions are ready. Compare score impact before applying.");
    } catch {
      setInlineAiState("error");
      setInlineAiMessage("Failed to generate AI suggestions. Try again.");
    }
  }

  function handleApplyInlineAiSuggestion() {
    if (!inlineAiSuggestion) {
      setInlineAiState("error");
      setInlineAiMessage("Generate AI suggestions first.");
      return;
    }

    const attributeMap = readAttributesFromForm(form.attributesJson);
    const aiAttributeMap = inlineAiSuggestion.suggestedAttributes ?? {};
    for (const [key, value] of Object.entries(aiAttributeMap)) {
      const normalizedKey = key.trim();
      const normalizedValue = value.trim();
      if (!normalizedKey) continue;
      if (normalizedValue) {
        attributeMap[normalizedKey] = normalizedValue;
      } else if (!hasOwn(attributeMap as unknown as Record<string, unknown>, normalizedKey)) {
        attributeMap[normalizedKey] = "";
      }
    }
    for (const attribute of inlineAiSuggestion.missingAttributes) {
      const key = attribute.trim();
      if (key && !hasOwn(attributeMap as unknown as Record<string, unknown>, key)) {
        attributeMap[key] = "";
      }
    }

    const suggestedBrand = inlineAiSuggestion.suggestedBrand?.trim() ?? "";
    const safeBrand =
      suggestedBrand && suggestedBrand.toLowerCase() !== "unknown"
        ? suggestedBrand
        : form.brand;

    patchForm({
      title: inlineAiSuggestion.suggestedTitle,
      longDescription: inlineAiSuggestion.suggestedDescription,
      shortDescription:
        inlineAiSuggestion.suggestedShortDescription?.trim() ||
        form.shortDescription.trim() ||
        inferShortDescriptionFromAi(inlineAiSuggestion.suggestedDescription),
      bulletPoints: inlineAiSuggestion.suggestedBullets.join("\n"),
      brand: safeBrand,
      attributesJson: JSON.stringify(attributeMap, null, 2),
    });
    setAiSuggestionApplied(true);
    setDraftEditorOpen(true);
    setActiveTab("Content");
    setShowAiDetails(false);
    setInlineAiState("success");
    setInlineAiMessage("AI improvements applied to draft fields. Save Draft when ready.");
  }

  function handleDismissInlineAiSuggestion() {
    setInlineAiSuggestion(null);
    setInlineAiState("idle");
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

  function handleViewAllIssues() {
    const readiness = document.getElementById("walmart-product-readiness");
    if (!readiness) return;
    readiness.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleReviewAiChanges() {
    setShowAiDetails(true);
    revealInlineAiPanel();
  }

  const topIssues = product.issues.filter((issue) => issue.trim().length > 0).slice(0, 3);
  const aiResultHeaderCopy =
    inlineAiOutcome === "improved"
      ? "Optimization improved listing"
      : inlineAiOutcome === "worse"
        ? "Suggestions need review - not recommended"
        : "Suggestions available";

  const aiResultMessage =
    inlineAiOutcome === "improved"
      ? "These suggestions increase listing quality and are ready to apply."
      : inlineAiOutcome === "worse"
        ? "These suggestions would lower the listing quality score, so EcomViper did not recommend applying them."
        : "These suggestions keep listing quality flat. Review changes before applying.";
  const projectedScore = projectedQuality?.score ?? inlineAiSuggestion?.qualityScore ?? listingQuality.score;
  const scoreDelta = projectedScore - listingQuality.score;
  const scoreDeltaLabel = scoreDelta > 0 ? `+${scoreDelta}` : String(scoreDelta);
  const workflowStep = aiSuggestionApplied || draftEditorOpen ? 3 : inlineAiSuggestion || inlineAiState !== "idle" ? 2 : 1;
  const draftEditorIsActive = aiSuggestionApplied || draftEditorOpen;
  const hasExistingDraft = Boolean(lastDraftSavedAt);

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-product-editor-page">
      <WalmartPageHeader
        title="Product Editor"
        subtitle="Review, improve, and submit approved Walmart listing updates."
        actions={
          <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
            SKU: {product.sku}
          </span>
        }
      />

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-3 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-workflow-steps"
      >
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {["1 Review", "2 Improve", "3 Submit"].map((label, index) => {
            const stepNumber = index + 1;
            const active = workflowStep === stepNumber;
            const completed = workflowStep > stepNumber;
            return (
              <li
                key={label}
                className={`inline-flex items-center rounded-full border px-3 py-1 ${
                  active
                    ? "border-[#0F172A] bg-[#0F172A] text-white"
                    : completed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-[#D9E4F0] bg-[#F8FBFF] text-[#475569]"
                }`}
              >
                {label}
              </li>
            );
          })}
        </ol>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-product-optimizer-summary"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="shrink-0">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={`${product.sku} primary image`}
                  className="h-20 w-20 rounded-xl border border-[#D9E4F0] bg-white object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FBFF] text-xs text-[#64748B]">
                  N/A
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Step 1 · Current listing</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-[#0F172A]">{displayTitle}</h2>
              <p className="mt-1 text-sm text-[#475569]">SKU: {product.sku}</p>
              <div className="mt-3 grid gap-2 text-sm text-[#334155] sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  <span className="text-[#64748B]">Brand:</span> {displayBrand}
                </p>
                <p>
                  <span className="text-[#64748B]">Price:</span> ${product.price.toFixed(2)}
                </p>
                <p>
                  <span className="text-[#64748B]">Inventory:</span> {formatInventory(product)}
                </p>
                <p>
                  <span className="text-[#64748B]">Listing quality:</span> {listingQuality.score}/100
                </p>
                <p className="sm:col-span-2 lg:col-span-1">
                  <span className="text-[#64748B]">Status:</span>{" "}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      canSubmit
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {readinessLabel}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <article className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-3 xl:max-w-[320px]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Top issues</p>
              <button
                type="button"
                onClick={handleViewAllIssues}
                className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
              >
                View all issues
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-[#334155]">
              {topIssues.length ? (
                topIssues.map((issue) => (
                  <li key={issue} className="rounded-md bg-white px-2 py-1">
                    {issue}
                  </li>
                ))
              ) : (
                <li className="rounded-md bg-white px-2 py-1">No major issues detected.</li>
              )}
            </ul>
          </article>
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-primary-actions"
        ref={inlineAiPanelRef}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Step 2 · Improve listing with AI</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">
              {inlineAiSuggestion ? aiResultHeaderCopy : "Improve this listing with AI"}
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              EcomViper will improve title, descriptions, bullets, and attributes. Nothing is submitted to Walmart until you approve it.
            </p>
          </div>
          <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
            Current score: {listingQuality.score}/100
          </span>
        </div>

        <div
          className="mt-3 rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]"
          data-testid="ecomviper-walmart-inline-ai-panel"
        >
          {inlineAiState === "loading" ? "Generating AI Improvements..." : null}
          {inlineAiState === "success"
            ? inlineAiOutcome === "worse"
              ? "Suggestions need review - not recommended."
              : inlineAiOutcome === "improved"
                ? "AI Improvements Ready."
                : "Suggestions available."
            : null}
          {inlineAiState === "error" ? "Optimization failed. Review the message below and try again." : null}
          {inlineAiState === "missing_key" ? OPENAI_OPTIMIZE_REQUIRED_MESSAGE : null}
          {inlineAiState === "idle"
            ? "Optimize title, descriptions, bullets, and attributes without leaving this page."
            : null}
        </div>

        {!inlineAiSuggestion ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runInlineOptimization}
                disabled={optimizingWithAi}
                data-testid="ecomviper-walmart-optimize-button"
                className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {optimizingWithAi ? "Generating AI Improvements..." : "Generate AI Improvements"}
              </button>
            </div>

            {inlineAiState === "missing_key" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p>{OPENAI_OPTIMIZE_REQUIRED_MESSAGE}</p>
                <a
                  href="/apps/ecomviper/walmart/connect"
                  className="mt-2 inline-flex rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800"
                >
                  Connect OpenAI key
                </a>
              </div>
            ) : null}

            {inlineAiState === "error" ? (
              <div className="space-y-2">
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {inlineAiMessage ?? "Failed to generate AI suggestions. Try again."}
                </p>
                <button
                  type="button"
                  onClick={runInlineOptimization}
                  disabled={optimizingWithAi}
                  className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            ) : null}

            <details className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#0F172A]">
                Rule-based suggestions
              </summary>
              <ul className="mt-2 space-y-2">
                {listingQuality.recommendations.length ? (
                  listingQuality.recommendations.map(
                    (recommendation: WalmartListingRecommendation) => (
                      <li
                        key={recommendation.id}
                        className="rounded-lg border border-[#E2E8F0] bg-white p-2"
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
                  <li className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-sm text-[#475569]">
                    No recommendation updates right now.
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={handleStageNonAiRecommendations}
                disabled={stagingRecommendation}
                className="mt-3 rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {stagingRecommendation ? "Staging..." : "Stage rule-based suggestions"}
              </button>
            </details>
          </div>
        ) : (
          <div className="mt-3 space-y-3" data-testid="ecomviper-walmart-inline-ai-results">
            <article
              className={`rounded-xl border p-3 ${
                inlineAiOutcome === "worse"
                  ? "border-amber-200 bg-amber-50"
                  : "border-[#D9E4F0] bg-[#F8FBFF]"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{aiResultHeaderCopy}</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">
                Current: {listingQuality.score}/100 → Projected: {projectedScore}/100
              </p>
              <p className="mt-1 text-sm text-[#334155]">Change: {scoreDeltaLabel}</p>
              <p className="mt-1 text-sm text-[#475569]">{aiResultMessage}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {inlineAiOutcome === "worse" ? (
                  <>
                    <button
                      type="button"
                      onClick={runInlineOptimization}
                      disabled={optimizingWithAi}
                      className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyInlineAiSuggestion}
                      data-testid="ecomviper-walmart-apply-ai-suggestions"
                      className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-800"
                    >
                      Apply Anyway to Draft
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleApplyInlineAiSuggestion}
                      data-testid="ecomviper-walmart-apply-ai-suggestions"
                      className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
                    >
                      Apply to Draft
                    </button>
                    <button
                      type="button"
                      onClick={runInlineOptimization}
                      disabled={optimizingWithAi}
                      className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleDismissInlineAiSuggestion}
                  className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleReviewAiChanges}
                  className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                >
                  Review Changes
                </button>
              </div>
            </article>

            <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3">
              <h3 className="text-sm font-semibold text-[#0F172A]">Change summary</h3>
              <ul className="mt-2 space-y-1 text-sm text-[#334155]">
                <li>
                  Title: {form.title.trim() || "Missing"} → {inlineAiSuggestion.suggestedTitle || "No change"}
                </li>
                <li>
                  Short description:{" "}
                  {form.shortDescription.trim() ? "Current available" : "Current missing"} →{" "}
                  {inlineAiSuggestion.suggestedShortDescription?.trim() ? "Suggested update" : "No change"}
                </li>
                <li>
                  Long description:{" "}
                  {form.longDescription.trim() ? "Current available" : "Current missing"} →{" "}
                  {inlineAiSuggestion.suggestedDescription.trim() ? "Suggested update" : "No change"}
                </li>
                <li>
                  Bullet points: {preview.bulletPoints.length || 0} → {inlineAiSuggestion.suggestedBullets.length}
                </li>
                <li>
                  Attributes: {Object.keys(preview.attributes).length} →{" "}
                  {Object.keys(inlineAiSuggestion.suggestedAttributes ?? {}).length}
                </li>
                {!product.imageUrl ? <li>Image still missing from catalog data.</li> : null}
              </ul>

              <details className="mt-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
                <summary className="cursor-pointer text-sm font-medium text-[#0F172A]">
                  Why did the score change?
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                  {projectedQuality?.recommendations.length ? (
                    projectedQuality.recommendations.slice(0, 5).map((recommendation) => (
                      <li key={recommendation.id}>
                        {recommendation.title}: {recommendation.reason}
                      </li>
                    ))
                  ) : (
                    <li>No major scoring changes detected.</li>
                  )}
                </ul>
              </details>

              {showAiDetails ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">Suggested title</h4>
                    <p className="mt-1 text-sm text-[#334155]">{inlineAiSuggestion.suggestedTitle}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">Suggested short description</h4>
                    <p className="mt-1 text-sm text-[#334155]">
                      {inlineAiSuggestion.suggestedShortDescription?.trim() || "No short description suggestion."}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">Suggested long description</h4>
                    <p className="mt-1 text-sm text-[#334155]">{inlineAiSuggestion.suggestedDescription}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">Suggested bullet points</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                      {inlineAiSuggestion.suggestedBullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">Suggested attributes</h4>
                    {Object.keys(inlineAiSuggestion.suggestedAttributes ?? {}).length ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                        {Object.entries(inlineAiSuggestion.suggestedAttributes ?? {}).map(
                          ([key, value]) => (
                            <li key={key}>
                              {key}: {value}
                            </li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-[#334155]">No attribute updates suggested.</p>
                    )}
                  </div>
                </div>
              ) : null}

              <h4 className="mt-3 text-sm font-semibold text-[#0F172A]">Compliance notes</h4>
              <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                {inlineAiSuggestion.complianceWarnings.length ? (
                  inlineAiSuggestion.complianceWarnings.map((warning) => (
                    <li
                      key={warning}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1"
                    >
                      {warning}
                    </li>
                  ))
                ) : (
                  <li className="rounded-md border border-[#D9E4F0] bg-white px-2 py-1">
                    No compliance warnings from the AI response.
                  </li>
                )}
              </ul>
            </article>
          </div>
        )}

        {inlineAiMessage && inlineAiState !== "error" ? (
          <p className="mt-3 text-sm text-[#334155]">{inlineAiMessage}</p>
        ) : null}
        <p className="mt-2 text-xs text-[#64748B]">
          No auto-submit. Changes remain in draft until approved.
        </p>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-draft-editor-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Step 3 · Edit & submit draft</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Current editable draft</h2>
            <p className="mt-1 text-sm text-[#475569]">
              Review AI improvements, fine-tune fields, then save draft before submission approval.
            </p>
          </div>
          {!draftEditorIsActive ? (
            <button
              type="button"
              onClick={() => setDraftEditorOpen(true)}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
            >
              Open Draft Editor
            </button>
          ) : null}
        </div>

        {!draftEditorIsActive ? (
          <p className="mt-3 rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
            Apply AI improvements first, or open the draft editor to make manual changes.
          </p>
        ) : null}

        <details open={draftEditorIsActive || hasExistingDraft} className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-[#334155]">
            {draftEditorIsActive ? "Draft editor active" : "Show draft editor"}
          </summary>

          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
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
              <p className="text-xs text-[#64748B]">{readinessNote}</p>
            </div>

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

            <div className="grid gap-3 md:grid-cols-2" data-testid="ecomviper-walmart-product-form">
              {activeTab === "Content" ? (
                <>
                  <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Content
                  </h3>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    <span className="flex items-center justify-between gap-2">
                      <span>Title</span>
                      <span className="text-xs text-[#64748B]">{form.title.length}/200</span>
                    </span>
                    <input
                      value={form.title}
                      onChange={(event) => patchForm({ title: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    <span className="flex items-center justify-between gap-2">
                      <span>Short description</span>
                      <span className="text-xs text-[#64748B]">{form.shortDescription.length}/500</span>
                    </span>
                    <textarea
                      value={form.shortDescription}
                      onChange={(event) => patchForm({ shortDescription: event.target.value })}
                      className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    <span className="flex items-center justify-between gap-2">
                      <span>Long description</span>
                      <span className="text-xs text-[#64748B]">{form.longDescription.length}/4000</span>
                    </span>
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
                </>
              ) : null}

              {activeTab === "Media" ? (
                <>
                  <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Media
                  </h3>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm text-[#334155] md:col-span-2">
                    <p className="font-medium text-[#0F172A]">Public Walmart Listing Images</p>
                    <p className="mt-1 text-xs text-[#475569]">
                      Image source: Public Walmart listing via SerpApi
                    </p>
                    {!form.imageUrl.trim() ? (
                      <div className="mt-2 rounded-md border border-[#D9E4F0] bg-white px-2 py-2 text-xs text-[#334155]">
                        <p className="font-medium text-[#0F172A]">Images missing</p>
                        <p className="mt-1">
                          EcomViper could not find images through Walmart Marketplace APIs.
                        </p>
                      </div>
                    ) : null}
                    {!serpApiProviderConnected ? (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
                        <p>Connect your SerpApi key to fetch public Walmart listing images.</p>
                        <a
                          href="/apps/ecomviper/walmart/connect"
                          className="mt-2 inline-flex rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800"
                        >
                          Connect SerpApi
                        </a>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-sm text-[#334155] md:col-span-2">
                        Public Walmart listing URL
                        <input
                          value={form.publicWalmartUrl}
                          onChange={(event) => patchForm({ publicWalmartUrl: event.target.value })}
                          placeholder="https://www.walmart.com/ip/.../18410702298"
                          className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                        />
                      </label>
                      <label className="text-sm text-[#334155]">
                        Public Walmart product ID (optional)
                        <input
                          value={form.publicWalmartProductId}
                          onChange={(event) => patchForm({ publicWalmartProductId: event.target.value })}
                          placeholder="18410702298"
                          className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleFindPublicListingImages}
                          disabled={resolvingPublicImages || !serpApiProviderConnected}
                          className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
                        >
                          {resolvingPublicImages
                            ? "Finding Images..."
                            : "Find Images from Public Walmart Listing"}
                        </button>
                      </div>
                    </div>

                    {publicImageMessage ? (
                      <p className="mt-2 text-xs text-[#334155]">{publicImageMessage}</p>
                    ) : null}

                    {resolvedPublicImages ? (
                      <div
                        className="mt-3 rounded-lg border border-[#BFDBFE] bg-white p-3"
                        data-testid="ecomviper-walmart-public-image-result"
                      >
                        <p className="text-xs text-[#1D4ED8]">
                          Source: {resolvedPublicImages.imageSourceLabel}
                        </p>
                        <p className="mt-1 text-xs text-[#334155]">
                          Public product ID: {resolvedPublicImages.publicWalmartProductId || "Unknown"}
                        </p>
                        <p className="mt-1 text-xs text-[#334155]">
                          Gallery image count: {resolvedPublicImages.imageCount}
                        </p>
                        <p className="mt-1 break-all text-xs text-[#334155]">
                          Primary image URL: {resolvedPublicImages.primaryImageUrl || "Not provided"}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {resolvedPublicImages.galleryImageUrls.slice(0, 4).map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt="Public Walmart listing preview"
                              className="h-14 w-14 rounded border border-[#D9E4F0] bg-white object-cover"
                              loading="lazy"
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleUseResolvedImagesInDraft}
                          className="mt-3 rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white"
                        >
                          Use Images in Draft
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    Primary image URL
                    <input
                      value={form.imageUrl}
                      onChange={(event) => patchForm({ imageUrl: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[#334155] md:col-span-2">
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
                </>
              ) : null}

              {activeTab === "Pricing & Inventory" ? (
                <>
                  <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Pricing & inventory
                  </h3>
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
                </>
              ) : null}

              {activeTab === "Walmart Attributes" ? (
                <>
                  <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Walmart attributes
                  </h3>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    Key attributes (JSON)
                    <textarea
                      value={form.attributesJson}
                      onChange={(event) => patchForm({ attributesJson: event.target.value })}
                      className="mt-1 min-h-40 w-full rounded-lg border border-[#D9E4F0] px-3 py-2 font-mono text-xs"
                    />
                  </label>
                </>
              ) : null}

              {activeTab === "Sync History" ? (
                <>
                  <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Sync history
                  </h3>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm text-[#334155] md:col-span-2">
                    <p>Last product sync: {product.lastSyncedAt}</p>
                    <p className="mt-1">Image source: {formatImageSource(product)}</p>
                    <p className="mt-1">Image status: {formatImageStatus(product)}</p>
                    {lastDraftSavedAt ? (
                      <p className="mt-1">Last draft save: {lastDraftSavedAt}</p>
                    ) : (
                      <p className="mt-1">No saved draft yet.</p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </details>

        {message ? <p className="mt-3 text-sm text-[#334155]">{message}</p> : null}
      </section>

      <section
        id="walmart-product-readiness"
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
        <details>
          <summary className="cursor-pointer text-lg font-semibold text-[#0F172A]">
            Staged changes
          </summary>
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
        </details>
      </section>

      {SHOW_DEVELOPER_DIAGNOSTICS ? (
        <details className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-4">
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
    </div>
  );
}
