"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
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
  normalizeDraftImageFields,
  normalizeWalmartImageUrlList,
} from "@/lib/ecomviper/walmart/walmart-image-fields";
import { sanitizeSeoFilename } from "@/lib/ecomviper/walmart/walmart-generated-media-seo";
import {
  isLowConfidenceAiFieldValue,
  pickMeaningfulAiText,
  sanitizeWalmartAiSearchBrowseAttributes,
} from "@/lib/ecomviper/walmart/walmart-ai-field-sanitization";
import {
  appendUnknownSearchBrowseFields,
  buildSearchBrowseAttributesFromSources,
  getSearchBrowseFieldDefinitions,
  isValidNumberUnitValue,
  mergeAttributesWithSearchBrowse,
  searchBrowseGroupLabel,
  type WalmartSearchBrowseFieldDefinition,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import {
  clearAliasGroupValues,
  expandAliasKeys,
  syncAliasGroups,
} from "@/lib/ecomviper/walmart/walmart-field-aliases";
import {
  readOptimizerProposalFromDraft,
  toOptimizerDraftPayload,
} from "@/lib/ecomviper/walmart/walmart-optimizer-staging";
import {
  compareDraftUpdatedAtDesc,
  normalizeWalmartDraftsForEditor,
} from "@/lib/ecomviper/walmart/walmart-product-editor-hardening";
import {
  generateEditableDraftState,
  generateOptimizedProposalState,
  hydrateCurrentWalmartState,
  toNativeStateDraftPayload,
  type WalmartNativeState,
} from "@/lib/ecomviper/walmart/walmart-native-state";
import type {
  WalmartAiSuggestion,
  WalmartDraftRecord,
  WalmartGeneratedImageType,
  WalmartGeneratedMediaAsset,
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
  hydratedCurrentWalmartState?: WalmartNativeState;
}

const tabs = [
  "Content",
  "Media",
  "Pricing & Inventory",
  "Search & Browse",
  "FAQ",
  "Sync History",
] as const;
const workflowTabs = [
  {
    key: "review",
    label: "Current Walmart State",
    testId: "ecomviper-walmart-tab-review-listing",
  },
  {
    key: "improve",
    label: "AI Optimized State",
    testId: "ecomviper-walmart-tab-improve-with-ai",
  },
  {
    key: "edit-submit",
    label: "Editable Draft State",
    testId: "ecomviper-walmart-tab-edit-submit",
  },
] as const;
type WorkflowTabKey = (typeof workflowTabs)[number]["key"];

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
  searchBrowseAttributes: Record<string, string>;
  faqSnippets: string;
  mediaRecommendations: string;
  altText: string;
  complianceNotes: string;
  generatedMediaAssets: WalmartGeneratedMediaAsset[];
  imageVisionExtraction: Record<string, unknown> | null;
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

type GenerateProductImagesResponse = {
  ok: boolean;
  sku?: string;
  imageType?: WalmartGeneratedImageType;
  generated?: WalmartGeneratedMediaAsset[];
  generationDiagnostics?: {
    imageType?: string | null;
    generationMode?: string | null;
    model?: string | null;
    size?: string | null;
    promptLength?: number | null;
    referenceCount?: number | null;
    referenceMimeTypes?: string[];
    referenceByteSizes?: number[];
    layoutMode?: string | null;
    userGuidanceIncluded?: boolean | null;
    layoutPreservationInstruction?: boolean | null;
    productFactsSource?: string | null;
    width?: number | null;
    height?: number | null;
    isSquare?: boolean | null;
    squareNormalized?: boolean | null;
  };
  error?: {
    code?: string;
    category?: string;
    statusCode?: number;
    message?: string;
    recommendation?: string;
    provider?: {
      type?: string | null;
      param?: string | null;
    };
    requestDiagnostics?: {
      imageType?: string | null;
      quantity?: number | null;
      referenceCount?: number | null;
      referenceMimeTypes?: string[];
      referenceByteSizes?: number[];
      styleGuidanceLength?: number | null;
      promptLength?: number | null;
      model?: string | null;
      size?: string | null;
      generationMode?: string | null;
      layoutMode?: string | null;
      userGuidanceIncluded?: boolean | null;
      layoutPreservationInstruction?: boolean | null;
      productFactsSource?: string | null;
      routePhase?: string | null;
      width?: number | null;
      height?: number | null;
      isSquare?: boolean | null;
      squareNormalized?: boolean | null;
    };
  };
};

type ExtractLabelFactsResponse = {
  ok: boolean;
  sku?: string;
  extraction?: {
    status?: string;
    message?: string;
    extractedAt?: string;
  };
  visionFactPayload?: Record<string, unknown>;
  mappedSearchBrowseAttributes?: Record<string, string>;
  error?: {
    code?: string;
    message?: string;
  };
};

interface WalmartGeneratedReferenceImage {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  source: "uploaded";
  byteSize: number;
}

type InlineAiState = "idle" | "loading" | "success" | "error" | "missing_key";
type InlineAiOutcome = "improved" | "unchanged" | "worse";

const INLINE_AI_LOADING_MESSAGE = "Generating AI improvements...";
const DEFAULT_SUPPLEMENT_DIRECTIONS = "Use as directed on product label.";
const DEFAULT_SUPPLEMENT_WARNINGS =
  "Consult your healthcare professional before use if you are pregnant, nursing, taking medication, or have a medical condition. Keep out of reach of children.";
const DEFAULT_GENERATED_IMAGE_TYPE: WalmartGeneratedImageType = "lifestyle";
const MAX_GENERATED_REFERENCE_IMAGES = 4;
const MAX_GENERATED_REFERENCE_IMAGE_BYTES = 450 * 1024;
const MAX_GENERATED_REFERENCE_TOTAL_BYTES = 900 * 1024;
const ALLOWED_GENERATED_REFERENCE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const GENERATED_IMAGE_TYPE_OPTIONS: Array<{
  value: WalmartGeneratedImageType;
  label: string;
  description: string;
}> = [
  {
    value: "lifestyle",
    label: "Lifestyle",
    description: "Create a contextual lifestyle product image.",
  },
  {
    value: "supplement_facts",
    label: "Supplement Facts",
    description: "Create a clean supplement-facts-style informational image.",
  },
  {
    value: "ingredient_spotlight",
    label: "Ingredient Spotlight",
    description: "Create an ingredient/benefits spotlight image with compliant language.",
  },
  {
    value: "product_hero",
    label: "Product Hero",
    description: "Create a clean studio hero product image.",
  },
];

const DEFAULT_INLINE_AI_APPLY_DIAGNOSTICS = {
  factsUpdated: [] as string[],
  factsSources: [] as string[],
  staleFieldsReplaced: [] as string[],
  staleFieldsCleared: [] as string[],
  copyFieldsUpdated: [] as string[],
  searchBrowseFieldsUpdated: [] as string[],
  searchBrowseFieldsReplaced: [] as string[],
  complianceChanges: [] as string[],
  skippedProtectedFields: [] as string[],
  skippedLowConfidenceFields: [] as string[],
  rejectedClaims: [] as string[],
  imageFactsStatus: "unknown",
  imageFactsMessage: "",
  manufacturerSource: "unknown",
  manufacturerConfidence: "unknown",
  manufacturerNeedsReview: false,
  faqGenerationState: "final",
  disclaimerStatus: "unknown",
  finalDecision: "accepted",
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

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
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

function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asText(entry)?.trim() ?? "")
    .filter(Boolean);
}

function isGeneratedImageType(value: string): value is WalmartGeneratedImageType {
  return (
    value === "lifestyle" ||
    value === "supplement_facts" ||
    value === "ingredient_spotlight" ||
    value === "product_hero"
  );
}

function normalizeGeneratedMediaAsset(value: unknown): WalmartGeneratedMediaAsset | null {
  const row = asObject(value);
  if (!row) return null;

  const id = asText(row.id)?.trim() ?? "";
  let url = normalizeWalmartImageUrlList([row.url])[0] ?? "";
  const rawPreviewUrl = asText(row.previewUrl)?.trim() ?? "";
  const previewUrl =
    rawPreviewUrl.startsWith("/api/ecomviper/walmart/generated-media/")
      ? rawPreviewUrl
      : (() => {
          if (!url) return "";
          try {
            const parsed = new URL(url);
            if (!parsed.pathname.startsWith("/api/ecomviper/walmart/generated-media/")) {
              return "";
            }
            const host = parsed.hostname.toLowerCase();
            if (
              host === "localhost" ||
              host === "127.0.0.1" ||
              host === "::1" ||
              host.endsWith(".localhost")
            ) {
              return parsed.pathname;
            }
          } catch {
            return "";
          }
          return "";
        })();
  if (url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (
        parsed.pathname.startsWith("/api/ecomviper/walmart/generated-media/") &&
        (host === "localhost" ||
          host === "127.0.0.1" ||
          host === "::1" ||
          host.endsWith(".localhost")) &&
        typeof window !== "undefined" &&
        window.location.origin
      ) {
        url = `${window.location.origin}${parsed.pathname}`;
      }
    } catch {
      // Keep original normalized URL when parsing fails.
    }
  }
  const imageTypeRaw = asText(row.imageType)?.trim() ?? "";
  const imageType = isGeneratedImageType(imageTypeRaw)
    ? imageTypeRaw
    : DEFAULT_GENERATED_IMAGE_TYPE;
  const createdAt = asText(row.createdAt)?.trim() || new Date().toISOString();
  const promptSummary = asText(row.promptSummary)?.trim() ?? "";
  const guidance = asText(row.guidance)?.trim() ?? "";
  const seoFilenameRaw = asText(row.seoFilename)?.trim() ?? "";
  const altText = asText(row.altText)?.trim() ?? "";
  const productSku = asText(row.productSku)?.trim() ?? "";
  const brand = asText(row.brand)?.trim() ?? "";
  const width = asNumber(row.width);
  const height = asNumber(row.height);
  const isSquare = asBoolean(row.isSquare);
  const squareNormalized = asBoolean(row.squareNormalized);
  const approvedForWalmart = asBoolean(row.approvedForWalmart);
  const approved = asBoolean(row.approved) ?? false;

  if (!id || !url) return null;

  return {
    id,
    url,
    previewUrl: previewUrl || undefined,
    source: "openai_generated",
    imageType,
    createdAt,
    promptSummary: promptSummary || undefined,
    guidance: guidance || undefined,
    seoFilename: seoFilenameRaw ? sanitizeSeoFilename(seoFilenameRaw, "image/png") : undefined,
    altText: altText || undefined,
    productSku: productSku || undefined,
    brand: brand || undefined,
    approvedForWalmart: approvedForWalmart ?? (approved ? true : undefined),
    width: width !== null && width >= 0 ? Math.floor(width) : undefined,
    height: height !== null && height >= 0 ? Math.floor(height) : undefined,
    isSquare:
      isSquare ??
      (width !== null && width >= 0 && height !== null && height >= 0
        ? Math.floor(width) === Math.floor(height)
        : undefined),
    squareNormalized: squareNormalized ?? undefined,
    approved,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read selected file."));
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.trim()) {
        resolve(reader.result.trim());
        return;
      }
      reject(new Error("Selected file could not be read as an image."));
    };
    reader.readAsDataURL(file);
  });
}

function normalizeImageMimeType(value: string): string {
  const normalized = value.trim().toLowerCase().split(";")[0] || "";
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.floor(value)} B`;
}

function estimateDataUrlByteSize(dataUrl: string): number {
  const match = dataUrl.match(/^data:[^;]+;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return 0;
  const payload = match[1].replace(/\s+/g, "");
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function readGeneratedMediaAssetsFromDraft(
  draft: Record<string, unknown> | null
): WalmartGeneratedMediaAsset[] {
  if (!draft) return [];
  const candidates = draft.generatedMediaAssets ?? draft.openAiGeneratedImages ?? [];
  if (!Array.isArray(candidates)) return [];

  const seen = new Set<string>();
  const normalized: WalmartGeneratedMediaAsset[] = [];
  for (const candidate of candidates) {
    const parsed = normalizeGeneratedMediaAsset(candidate);
    if (!parsed) continue;
    if (seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    normalized.push(parsed);
  }
  return normalized;
}

function countMalformedGeneratedMediaAssetsFromDraft(
  draft: Record<string, unknown> | null
): number {
  if (!draft) return 0;
  const candidates = draft.generatedMediaAssets ?? draft.openAiGeneratedImages ?? [];
  if (!Array.isArray(candidates)) return 0;
  let malformed = 0;
  for (const candidate of candidates) {
    const parsed = normalizeGeneratedMediaAsset(candidate);
    if (parsed) continue;
    const row = asObject(candidate);
    if (!row) {
      malformed += 1;
      continue;
    }
    if (Object.keys(row).length > 0) {
      malformed += 1;
    }
  }
  return malformed;
}

function normalizeInlineAiApplyDiagnostics(
  value: WalmartAiSuggestion["applyDiagnostics"] | null | undefined
) {
  const diagnostics = asObject(value);
  if (!diagnostics) {
    return DEFAULT_INLINE_AI_APPLY_DIAGNOSTICS;
  }

  const disclaimerStatusRaw = asText(diagnostics.disclaimerStatus)?.trim().toLowerCase() ?? "";
  const finalDecisionRaw = asText(diagnostics.finalDecision)?.trim().toLowerCase() ?? "";
  const imageFactsStatusRaw = asText(diagnostics.imageFactsStatus)?.trim().toLowerCase() ?? "";
  const imageFactsMessage = asText(diagnostics.imageFactsMessage)?.trim() ?? "";
  const manufacturerSource = asText(diagnostics.manufacturerSource)?.trim().toLowerCase() || "unknown";
  const manufacturerConfidence =
    asText(diagnostics.manufacturerConfidence)?.trim().toLowerCase() || "unknown";
  const manufacturerNeedsReview = diagnostics.manufacturerNeedsReview === true;
  const faqGenerationStateRaw = asText(diagnostics.faqGenerationState)?.trim().toLowerCase() ?? "";

  const disclaimerStatus =
    disclaimerStatusRaw === "inserted" ||
    disclaimerStatusRaw === "preserved" ||
    disclaimerStatusRaw === "deduped" ||
    disclaimerStatusRaw === "repaired" ||
    disclaimerStatusRaw === "missing"
      ? disclaimerStatusRaw
      : "unknown";

  const finalDecision =
    finalDecisionRaw === "accepted" ||
    finalDecisionRaw === "accepted_with_changes" ||
    finalDecisionRaw === "rejected"
      ? finalDecisionRaw
      : "accepted";
  const imageFactsStatus =
    imageFactsStatusRaw === "available" ||
    imageFactsStatusRaw === "extracted" ||
    imageFactsStatusRaw === "unavailable" ||
    imageFactsStatusRaw === "needs_vision_extraction" ||
    imageFactsStatusRaw === "low_confidence"
      ? imageFactsStatusRaw
      : "unknown";
  const faqGenerationState =
    faqGenerationStateRaw === "pending" || faqGenerationStateRaw === "final"
      ? faqGenerationStateRaw
      : "final";

  return {
    factsUpdated: toSafeStringArray(diagnostics.factsUpdated),
    factsSources: toSafeStringArray(diagnostics.factsSources),
    staleFieldsReplaced: toSafeStringArray(diagnostics.staleFieldsReplaced),
    staleFieldsCleared: toSafeStringArray(diagnostics.staleFieldsCleared),
    copyFieldsUpdated: toSafeStringArray(diagnostics.copyFieldsUpdated),
    searchBrowseFieldsUpdated: toSafeStringArray(diagnostics.searchBrowseFieldsUpdated),
    searchBrowseFieldsReplaced: toSafeStringArray(diagnostics.searchBrowseFieldsReplaced),
    complianceChanges: toSafeStringArray(diagnostics.complianceChanges),
    skippedProtectedFields: toSafeStringArray(diagnostics.skippedProtectedFields),
    skippedLowConfidenceFields: toSafeStringArray(diagnostics.skippedLowConfidenceFields),
    rejectedClaims: toSafeStringArray(diagnostics.rejectedClaims),
    imageFactsStatus,
    imageFactsMessage,
    manufacturerSource,
    manufacturerConfidence,
    manufacturerNeedsReview,
    faqGenerationState,
    disclaimerStatus,
    finalDecision,
  };
}

function readLatestDraftPayload(
  stagedDrafts: WalmartDraftRecord[]
): Record<string, unknown> | null {
  return (
    [...stagedDrafts]
      .sort(compareDraftUpdatedAtDesc)
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

function readDraftObject(
  draft: Record<string, unknown> | null,
  keys: string[]
): Record<string, unknown> | null {
  if (!draft) return null;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    const value = asObject(draft[key]);
    if (value) return value;
  }
  return null;
}

function readDraftAttributes(
  draft: Record<string, unknown> | null,
  keys: string[] = ["attributes"]
): Record<string, string> | null {
  if (!draft) return null;
  let value: unknown = undefined;
  for (const key of keys) {
    if (!hasOwn(draft, key)) continue;
    value = draft[key];
    break;
  }
  if (typeof value === "undefined") return null;
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
  const normalizedDraftImages = normalizeDraftImageFields(draft ?? {});
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
  const draftAdditionalFromNormalized =
    normalizedDraftImages.additionalImageUrls ??
    normalizedDraftImages.galleryImageUrls?.filter(
      (entry) => entry !== (normalizedDraftImages.imageUrl ?? "")
    ) ??
    null;
  const generatedMediaAssets = readGeneratedMediaAssetsFromDraft(draft);
  const approvedGeneratedUrls = generatedMediaAssets
    .filter((asset) => asset.approved)
    .map((asset) => asset.url);
  const draftAttributes = readDraftAttributes(draft, ["attributes"]);
  const draftSearchBrowseAttributes = readDraftAttributes(draft, [
    "searchBrowseAttributes",
    "suggestedAttributes",
  ]);

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
  const fallbackGalleryImageUrls = normalizeWalmartImageUrlList([
    normalized?.galleryImageUrls,
    normalized?.additionalImageUrls,
    raw?.additionalImageUrls,
    raw?.galleryImageUrls,
    raw?.imageUrls,
    product.galleryImageUrls ?? [],
    product.variantImageUrls ?? [],
  ]);
  const preferredImageUrl =
    normalizedDraftImages.imageUrl ??
    (readDraftString(draft, ["imageUrl", "primaryImageUrl"]) ?? null) ??
    firstNonEmptyString(sources, [
      "imageUrl",
      "primaryImageUrl",
      "productImageUrl",
      "mainImageUrl",
      "itemImageUrl",
    ]);
  const imageUrl = preferredImageUrl || product.imageUrl;
  const imageSource =
    normalizedDraftImages.imageSource ??
    draftImageSource ??
    firstNonEmptyStringValue(
      product.imageSource,
      normalized?.imageSource,
      raw?.imageSource
    );
  const fallbackAdditionalImageUrls = fallbackGalleryImageUrls.filter(
    (entry) => entry !== imageUrl
  );
  const shouldUseShopifyGalleryFallback =
    (imageSource === "shopify_product" || imageSource === "shopify_variant") &&
    fallbackAdditionalImageUrls.length > 0 &&
    (!draftAdditionalImages || draftAdditionalImages.length === 0);
  const additionalImageUrls =
    draftAdditionalFromNormalized ??
    (draftAdditionalImages && draftAdditionalImages.length > 0
      ? draftAdditionalImages
      : shouldUseShopifyGalleryFallback
      ? fallbackAdditionalImageUrls
      : draftAdditionalImages ??
        fallbackAdditionalImageUrls);
  const mergedAdditionalImageUrls = normalizeWalmartImageUrlList([
    additionalImageUrls,
    approvedGeneratedUrls,
  ]).filter((entry) => entry !== imageUrl);
  const publicWalmartUrl =
    normalizedDraftImages.publicWalmartUrl ??
    draftPublicWalmartUrl ??
    firstNonEmptyStringValue(
      product.publicWalmartUrl,
      normalized?.publicWalmartUrl,
      raw?.publicWalmartUrl
    );
  const publicWalmartProductId =
    normalizedDraftImages.publicWalmartProductId ??
    draftPublicWalmartProductId ??
    firstNonEmptyStringValue(
      product.publicWalmartProductId,
      normalized?.publicWalmartProductId,
      raw?.publicWalmartProductId
    );
  const imageMatchMethod =
    normalizedDraftImages.imageMatchMethod ??
    draftImageMatchMethod ??
    firstNonEmptyStringValue(
      product.imageMatchMethod,
      normalized?.imageMatchMethod,
      raw?.imageMatchMethod
    );
  const imageSyncStatus =
    normalizedDraftImages.imageSyncStatus ??
    draftImageSyncStatus ??
    firstNonEmptyStringValue(
      product.imageSyncStatus,
      normalized?.imageSyncStatus,
      raw?.imageSyncStatus
    );
  const imageSyncReason =
    normalizedDraftImages.imageSyncReason ??
    draftImageSyncReason ??
    firstNonEmptyStringValue(
      product.imageSyncReason,
      product.imageStatusMessage,
      normalized?.imageSyncReason,
      raw?.imageSyncReason
    );
  const lastImageSyncedAt =
    normalizedDraftImages.lastImageSyncedAt ??
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

  const baseSearchBrowseAttributes = buildSearchBrowseAttributesFromSources({
    product,
    draftPayload: draft ?? {},
  });
  const searchBrowseAttributes = {
    ...baseSearchBrowseAttributes,
    ...(draftSearchBrowseAttributes ?? {}),
  };
  const mediaRecommendations =
    readDraftList(draft, ["mediaRecommendations"])?.join("\n") ??
    readDraftList(draft, ["media_recommendations"])?.join("\n") ??
    "";
  const faqSnippets =
    readDraftList(draft, ["faqSnippets", "faq_snippets", "faqs", "faq"])?.join("\n") ?? "";
  const altText =
    readDraftString(draft, ["altText", "imageAltText", "image_alt_text"]) ?? "";
  const complianceNotes =
    readDraftList(draft, ["complianceNotes"])?.join("\n") ??
    readDraftList(draft, ["compliance_notes"])?.join("\n") ??
    "";
  const imageVisionExtraction =
    readDraftObject(draft, [
      "imageVisionExtraction",
      "image_vision_extraction",
      "visionFactPayload",
    ]) ?? null;

  return {
    title,
    shortDescription,
    longDescription,
    bulletPoints: bulletPoints.join("\n"),
    imageUrl,
    additionalImageUrls: mergedAdditionalImageUrls.join("\n"),
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
    searchBrowseAttributes,
    faqSnippets,
    mediaRecommendations,
    altText,
    complianceNotes,
    generatedMediaAssets,
    imageVisionExtraction,
  };
}

function formatImageStatus(product: WalmartProductRecord): string {
  if (product.imageStatusMessage?.trim()) return product.imageStatusMessage;
  if (product.imageSyncStatus === "not_found") {
    if (product.imageSource === "walmart_item_report")
      return "No matching row found in Walmart Item Report.";
    if (product.imageSource === "serpapi_walmart_brand_search")
      return "No confident public listing match from SerpApi brand search.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "No public Walmart listing images found via SerpApi.";
    if (product.imageSource === "manual") return "Manual image URL not provided.";
    return "Item Search returned no usable image.";
  }
  if (product.imageSyncStatus === "ambiguous") {
    if (product.imageSource === "serpapi_walmart_brand_search")
      return "SerpApi brand-search listing match is ambiguous.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing image match is ambiguous.";
    return "Multiple Walmart Item Search candidates matched this product.";
  }
  if (product.imageSyncStatus === "failed") {
    if (product.imageSource === "walmart_item_report")
      return "Walmart Item Report request failed.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing image lookup failed.";
    if (product.imageSource === "serpapi_walmart_brand_search")
      return "SerpApi brand-search listing discovery failed.";
    return "Item Search request failed after retry.";
  }
  if (product.imageSyncStatus === "not_synced") {
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing images not synced.";
    if (product.imageSource === "serpapi_walmart_brand_search")
      return "SerpApi brand-search listing discovery not synced.";
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
  if (product.imageSource === "serpapi_walmart_brand_search")
    return "SerpApi Walmart brand search";
  if (product.imageSource === "public_walmart_listing_serpapi")
    return "Public Walmart listing via SerpApi";
  if (product.imageSource === "shopify_variant") return "Shopify variant image";
  if (product.imageSource === "shopify_product") return "Shopify product image";
  if (product.imageSource === "openai_generated") return "OpenAI generated image";
  if (product.imageSource === "manual") return "Manual image URL";
  return "Not synced";
}

function formatGeneratedImageTypeLabel(imageType: WalmartGeneratedImageType): string {
  if (imageType === "lifestyle") return "Lifestyle";
  if (imageType === "supplement_facts") return "Supplement Facts";
  if (imageType === "ingredient_spotlight") return "Ingredient Spotlight";
  return "Product Hero";
}

function isShopifyImageSource(source: WalmartProductRecord["imageSource"] | string | undefined): boolean {
  return source === "shopify_product" || source === "shopify_variant";
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

function shouldBackfillSearchBrowseValue(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return true;
  return isLowConfidenceAiFieldValue(trimmed);
}

export default function ProductEditorClient({
  product,
  stagedDrafts,
  aiProviderConnected,
  serpApiProviderConnected,
  hydratedCurrentWalmartState,
}: ProductEditorClientProps) {
  const draftHardening = useMemo(
    () => normalizeWalmartDraftsForEditor(stagedDrafts),
    [stagedDrafts]
  );
  const safeStagedDrafts = draftHardening.drafts;
  const [workflowTab, setWorkflowTab] = useState<WorkflowTabKey>("review");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Content");
  const initialForm = useMemo(
    () => hydrateEditorForm(product, safeStagedDrafts),
    [product, safeStagedDrafts]
  );
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
    return [...safeStagedDrafts].sort(compareDraftUpdatedAtDesc)[0]?.updatedAt ?? null;
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
        (initialForm.imageSource === "public_walmart_listing_serpapi" ||
          initialForm.imageSource === "serpapi_walmart_brand_search") &&
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
          imageSource:
            initialForm.imageSource === "serpapi_walmart_brand_search"
              ? "serpapi_walmart_brand_search"
              : "public_walmart_listing_serpapi",
          imageSourceLabel:
            initialForm.imageSource === "serpapi_walmart_brand_search"
              ? "SerpApi Walmart brand search"
              : "Public Walmart listing via SerpApi",
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
  const [generatedImageType, setGeneratedImageType] =
    useState<WalmartGeneratedImageType>(DEFAULT_GENERATED_IMAGE_TYPE);
  const [generatedImageGuidance, setGeneratedImageGuidance] = useState("");
  const [generatedImageQuantity, setGeneratedImageQuantity] = useState("1");
  const [generatedReferenceImages, setGeneratedReferenceImages] = useState<
    WalmartGeneratedReferenceImage[]
  >([]);
  const [generatedReferenceMessage, setGeneratedReferenceMessage] = useState<string | null>(null);
  const [generatedPreviewErrors, setGeneratedPreviewErrors] = useState<Record<string, string>>({});
  const [generatingProductImages, setGeneratingProductImages] = useState(false);
  const [productImageGenerationMessage, setProductImageGenerationMessage] = useState<
    string | null
  >(null);
  const [productImageGenerationError, setProductImageGenerationError] =
    useState<GenerateProductImagesResponse["error"] | null>(null);
  const [extractingLabelFacts, setExtractingLabelFacts] = useState(false);
  const [labelFactsMessage, setLabelFactsMessage] = useState<string | null>(null);
  const [focusedGeneratedAssetId, setFocusedGeneratedAssetId] = useState<string | null>(() => {
    const firstPending = initialForm.generatedMediaAssets.find((asset) => !asset.approved);
    return firstPending?.id ?? initialForm.generatedMediaAssets[0]?.id ?? null;
  });
  const referenceFileInputRef = useRef<HTMLInputElement | null>(null);
  const optimizingWithAi = inlineAiState === "loading";

  const stagedOptimizations = useMemo(() => {
    const indexed = new Map<string, WalmartOptimizationProposalRecord>();
    for (const draft of safeStagedDrafts) {
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
      .sort((left, right) => compareDraftUpdatedAtDesc(left, right));
  }, [safeStagedDrafts, localStagedProposal, localStatusOverrides]);
  const latestDraftPayload = useMemo(
    () => readLatestDraftPayload(safeStagedDrafts),
    [safeStagedDrafts]
  );
  const malformedGeneratedMediaCount = useMemo(
    () => countMalformedGeneratedMediaAssetsFromDraft(latestDraftPayload),
    [latestDraftPayload]
  );

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

    const normalizedImageFields = normalizeDraftImageFields({
      imageUrl: form.imageUrl,
      primaryImageUrl: form.imageUrl,
      additionalImageUrls: form.additionalImageUrls,
      galleryImageUrls: form.additionalImageUrls,
      imageSource: form.imageSource,
      imageMatchMethod: form.imageMatchMethod,
      imageSyncStatus: form.imageSyncStatus,
      imageSyncReason: form.imageSyncReason,
      publicWalmartUrl: form.publicWalmartUrl,
      publicWalmartProductId: form.publicWalmartProductId,
      lastImageSyncedAt: form.lastImageSyncedAt,
    });
    const normalizedImageSource = normalizedImageFields.imageSource ?? form.imageSource;
    const shouldBackfillShopifyGallery =
      isShopifyImageSource(normalizedImageSource) &&
      (normalizedImageFields.additionalImageUrls?.length ?? 0) === 0;
    const resolvedVariantImageUrls = shouldBackfillShopifyGallery
      ? normalizeWalmartImageUrlList([
          normalizedImageFields.variantImageUrls ?? [],
          product.variantImageUrls ?? [],
        ])
      : normalizedImageFields.variantImageUrls;
    const resolvedGalleryImageUrls = shouldBackfillShopifyGallery
      ? normalizeWalmartImageUrlList([
          normalizedImageFields.primaryImageUrl ?? normalizedImageFields.imageUrl ?? form.imageUrl,
          product.galleryImageUrls ?? [],
          resolvedVariantImageUrls ?? [],
        ])
      : normalizedImageFields.galleryImageUrls;
    const resolvedPrimaryImageUrl =
      normalizedImageFields.primaryImageUrl ||
      normalizedImageFields.imageUrl ||
      resolvedGalleryImageUrls?.[0] ||
      "";
    const resolvedAdditionalImageUrls = shouldBackfillShopifyGallery
      ? (resolvedGalleryImageUrls ?? []).filter((entry) => entry !== resolvedPrimaryImageUrl)
      : normalizedImageFields.additionalImageUrls;
    const approvedGeneratedMediaAssets = (form.generatedMediaAssets ?? []).filter(
      (asset) => asset.approved
    );
    const approvedGeneratedUrls = normalizeWalmartImageUrlList(
      approvedGeneratedMediaAssets.map((asset) => asset.url)
    );
    const finalPrimaryImageUrl = resolvedPrimaryImageUrl || approvedGeneratedUrls[0] || "";
    const finalAdditionalImageUrls = normalizeWalmartImageUrlList([
      ...(resolvedAdditionalImageUrls ?? []),
      approvedGeneratedUrls,
    ]).filter((entry) => entry !== finalPrimaryImageUrl);
    const finalGalleryImageUrls = normalizeWalmartImageUrlList([
      finalPrimaryImageUrl,
      finalAdditionalImageUrls,
      resolvedVariantImageUrls ?? [],
    ]);
    const resolvedImageSource =
      finalPrimaryImageUrl && approvedGeneratedUrls.includes(finalPrimaryImageUrl)
        ? "openai_generated"
        : normalizedImageFields.imageSource;

    const mergedSearchBrowseAttributes = mergeAttributesWithSearchBrowse({
      baseAttributes: parsedAttributes,
      searchBrowseAttributes: form.searchBrowseAttributes,
    });

    return {
      title: form.title.trim(),
      shortDescription: form.shortDescription.trim(),
      longDescription: form.longDescription.trim(),
      bulletPoints: form.bulletPoints
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      imageUrl: finalPrimaryImageUrl || normalizedImageFields.imageUrl || undefined,
      primaryImageUrl: finalPrimaryImageUrl || undefined,
      additionalImageUrls:
        finalAdditionalImageUrls.length > 0 ? finalAdditionalImageUrls : undefined,
      galleryImageUrls: finalGalleryImageUrls.length > 0 ? finalGalleryImageUrls : undefined,
      variantImageUrls: resolvedVariantImageUrls,
      publicWalmartUrl: normalizedImageFields.publicWalmartUrl,
      publicWalmartProductId: normalizedImageFields.publicWalmartProductId,
      imageSource: resolvedImageSource,
      imageMatchMethod: normalizedImageFields.imageMatchMethod,
      imageSyncStatus: normalizedImageFields.imageSyncStatus,
      imageSyncReason: normalizedImageFields.imageSyncReason,
      lastImageSyncedAt: normalizedImageFields.lastImageSyncedAt,
      price: Number(form.price),
      inventoryQuantity: Number(form.inventoryQuantity),
      brand: form.brand.trim(),
      attributes: mergedSearchBrowseAttributes,
      searchBrowseAttributes: form.searchBrowseAttributes,
      faqSnippets: form.faqSnippets
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      mediaRecommendations: form.mediaRecommendations
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      altText: form.altText.trim(),
      complianceNotes: form.complianceNotes
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      generatedMediaAssets:
        form.generatedMediaAssets.length > 0 ? form.generatedMediaAssets : undefined,
      imageVisionExtraction: form.imageVisionExtraction ?? undefined,
      visionFactPayload: form.imageVisionExtraction ?? undefined,
    };
  }, [form, product.galleryImageUrls, product.variantImageUrls]);

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
  const searchBrowseFieldDefinitions = useMemo<WalmartSearchBrowseFieldDefinition[]>(() => {
    const known = getSearchBrowseFieldDefinitions(scoringProduct);
    const unknown = appendUnknownSearchBrowseFields({
      product: scoringProduct,
      attributes: form.searchBrowseAttributes,
    });
    return [...known, ...unknown];
  }, [form.searchBrowseAttributes, scoringProduct]);
  const searchBrowseFieldsByGroup = useMemo(() => {
    const grouped = new Map<string, WalmartSearchBrowseFieldDefinition[]>();
    for (const field of searchBrowseFieldDefinitions) {
      const existing = grouped.get(field.group) ?? [];
      existing.push(field);
      grouped.set(field.group, existing);
    }
    return grouped;
  }, [searchBrowseFieldDefinitions]);
  const searchBrowseNumberWarnings = useMemo(() => {
    return searchBrowseFieldDefinitions
      .filter((field) => field.type === "number-unit")
      .map((field) => ({
        key: field.key,
        valid: isValidNumberUnitValue(form.searchBrowseAttributes[field.key] ?? ""),
      }))
      .filter((entry) => !entry.valid)
      .map((entry) => entry.key);
  }, [form.searchBrowseAttributes, searchBrowseFieldDefinitions]);
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
  const fallbackCurrentWalmartState = useMemo(
    () => hydrateCurrentWalmartState({ product }),
    [product]
  );
  const currentWalmartState = useMemo(
    () => hydratedCurrentWalmartState ?? fallbackCurrentWalmartState,
    [hydratedCurrentWalmartState, fallbackCurrentWalmartState]
  );
  const projectedScoreFromSuggestion =
    projectedQuality?.score ?? inlineAiSuggestion?.qualityScore;
  const optimizedProposalLayer = useMemo(
    () =>
      generateOptimizedProposalState({
        currentWalmartState,
        suggestion: inlineAiSuggestion,
        currentScore: listingQuality.score,
        projectedScore: projectedScoreFromSuggestion,
      }),
    [
      currentWalmartState,
      inlineAiSuggestion,
      listingQuality.score,
      projectedScoreFromSuggestion,
    ]
  );
  const editableDraftLayer = useMemo(
    () =>
      generateEditableDraftState({
        currentWalmartState,
        optimizedProposalState: optimizedProposalLayer.optimizedProposalState,
        draftPayload: preview as Record<string, unknown>,
      }),
    [
      currentWalmartState,
      optimizedProposalLayer.optimizedProposalState,
      preview,
    ]
  );
  const currentWalmartStateDraftPayload = useMemo(
    () => toNativeStateDraftPayload(currentWalmartState),
    [currentWalmartState]
  );
  const optimizedProposalState = optimizedProposalLayer.optimizedProposalState;
  const editableDraftState = editableDraftLayer.editableDraftState;

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
    () => [
      ...complianceValidation.warnings,
      ...searchBrowseNumberWarnings.map(
        (key) => `${key} should use a number or number+unit value.`
      ),
    ],
    [complianceValidation, searchBrowseNumberWarnings]
  );
  const validationInfos = useMemo(
    () => complianceValidation.suggestions ?? [],
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
  const displayBrand = form.brand.trim() || product.brand.trim() || "";
  const displayPrimaryImageUrl = scoringProduct.imageUrl?.trim() || "";
  const fallbackShopifyVariantPreviewUrls = useMemo(
    () =>
      isShopifyImageSource(scoringProduct.imageSource) &&
      (scoringProduct.variantImageUrls?.length ?? 0) === 0
        ? normalizeWalmartImageUrlList([product.variantImageUrls ?? []])
        : [],
    [scoringProduct.imageSource, scoringProduct.variantImageUrls, product.variantImageUrls]
  );
  const displayVariantPreviewUrls = useMemo(
    () =>
      normalizeWalmartImageUrlList([
        scoringProduct.variantImageUrls ?? [],
        fallbackShopifyVariantPreviewUrls,
      ]),
    [scoringProduct.variantImageUrls, fallbackShopifyVariantPreviewUrls]
  );
  const fallbackShopifyGalleryPreviewUrls = useMemo(
    () =>
      isShopifyImageSource(scoringProduct.imageSource) &&
      (scoringProduct.galleryImageUrls?.length ?? 0) <= 1
        ? normalizeWalmartImageUrlList([
            product.galleryImageUrls ?? [],
            product.variantImageUrls ?? [],
          ])
        : [],
    [
      scoringProduct.imageSource,
      scoringProduct.galleryImageUrls,
      product.galleryImageUrls,
      product.variantImageUrls,
    ]
  );
  const displayGalleryPreviewUrls = useMemo(
    () =>
      normalizeWalmartImageUrlList([
        displayPrimaryImageUrl,
        scoringProduct.galleryImageUrls ?? [],
        displayVariantPreviewUrls,
        fallbackShopifyGalleryPreviewUrls,
      ]),
    [
      displayPrimaryImageUrl,
      scoringProduct.galleryImageUrls,
      displayVariantPreviewUrls,
      fallbackShopifyGalleryPreviewUrls,
    ]
  );
  const persistedDraftImagePreview = useMemo(() => {
    if (resolvedPublicImages || displayGalleryPreviewUrls.length === 0) return null;
    return {
      imageSourceLabel:
        scoringProduct.imageSource === "public_walmart_listing_serpapi" ||
        scoringProduct.imageSource === "serpapi_walmart_brand_search"
          ? "Public Walmart listing via SerpApi"
          : formatImageSource(scoringProduct),
      publicWalmartProductId: form.publicWalmartProductId.trim(),
      imageCount: displayGalleryPreviewUrls.length,
      primaryImageUrl: displayPrimaryImageUrl || displayGalleryPreviewUrls[0] || "",
      galleryImageUrls: displayGalleryPreviewUrls,
    };
  }, [
    resolvedPublicImages,
    displayGalleryPreviewUrls,
    scoringProduct,
    form.publicWalmartProductId,
    displayPrimaryImageUrl,
  ]);
  const isShopifyMediaSource = isShopifyImageSource(scoringProduct.imageSource);
  const importedShopifyMediaImageCount = isShopifyMediaSource
    ? displayGalleryPreviewUrls.length
    : 0;
  const missingShopifyAdditionalImageReason =
    isShopifyMediaSource && importedShopifyMediaImageCount <= 1
      ? "Shopify returned no additional attached product media."
      : null;
  const approvedGeneratedMediaAssets = useMemo(
    () => (form.generatedMediaAssets ?? []).filter((asset) => asset.approved),
    [form.generatedMediaAssets]
  );
  const pendingGeneratedMediaAssets = useMemo(
    () => (form.generatedMediaAssets ?? []).filter((asset) => !asset.approved),
    [form.generatedMediaAssets]
  );
  const focusedGeneratedMediaAsset = useMemo(() => {
    const allAssets = form.generatedMediaAssets ?? [];
    if (allAssets.length === 0) return null;
    if (focusedGeneratedAssetId) {
      const focused = allAssets.find((asset) => asset.id === focusedGeneratedAssetId);
      if (focused) return focused;
    }
    return allAssets.find((asset) => !asset.approved) ?? allAssets[0];
  }, [focusedGeneratedAssetId, form.generatedMediaAssets]);
  const approvedGeneratedMediaUrls = useMemo(
    () =>
      normalizeWalmartImageUrlList(
        approvedGeneratedMediaAssets.map((asset) => asset.url)
      ),
    [approvedGeneratedMediaAssets]
  );
  const inlineAiDiagnostics = inlineAiSuggestion
    ? normalizeInlineAiApplyDiagnostics(inlineAiSuggestion.applyDiagnostics)
    : DEFAULT_INLINE_AI_APPLY_DIAGNOSTICS;
  const draftImageFactsStatus =
    asText(asObject(form.imageVisionExtraction)?.status)?.trim().toLowerCase() ?? "";
  const draftImageFactsMessage = asText(asObject(form.imageVisionExtraction)?.message) ?? "";
  const resolvedImageFactsStatus =
    draftImageFactsStatus ||
    inlineAiDiagnostics.imageFactsStatus ||
    "needs_vision_extraction";
  const resolvedImageFactsMessage =
    draftImageFactsMessage ||
    inlineAiDiagnostics.imageFactsMessage ||
    "Images are available, but label text has not been extracted yet.";

  function patchForm(patch: Partial<ProductEditorFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setFormDirty(true);
  }

  function patchSearchBrowseField(key: string, value: string) {
    setForm((current) => ({
      ...current,
      searchBrowseAttributes: (() => {
        const next = {
          ...current.searchBrowseAttributes,
          [key]: value,
        };
        syncAliasGroups({ attributes: next });
        return next;
      })(),
      attributesJson: (() => {
        const nextSearchBrowse = {
          ...current.searchBrowseAttributes,
          [key]: value,
        };
        syncAliasGroups({ attributes: nextSearchBrowse });
        return JSON.stringify(
          mergeAttributesWithSearchBrowse({
            baseAttributes: readAttributesFromForm(current.attributesJson),
            searchBrowseAttributes: nextSearchBrowse,
          }),
          null,
          2
        );
      })(),
    }));
    setFormDirty(true);
  }

  async function handleSaveDraft() {
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
      return "SerpApi key missing. Connect SerpApi to enable automated public Walmart image enrichment.";
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
    if (code === "SERPAPI_INVALID_KEY") {
      return "SerpApi key was rejected. Verify your key on the Connect page.";
    }
    if (code === "SERPAPI_FORBIDDEN") {
      return "SerpApi account does not have permission for this request.";
    }
    if (code === "SERPAPI_BAD_REQUEST") {
      return fallback.trim() || "SerpApi bad request.";
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

  function toGeneratedImageErrorMessage(
    error: GenerateProductImagesResponse["error"] | null | undefined
  ): string {
    const code = error?.code?.trim().toUpperCase() ?? "";
    const fallback = error?.message?.trim() ?? "Could not generate product images.";
    const recommendation = error?.recommendation?.trim() ?? "";

    const withRecommendation = (message: string): string =>
      recommendation && !message.includes(recommendation)
        ? `${message} ${recommendation}`
        : message;

    if (code === "OPENAI_NOT_CONNECTED") {
      return withRecommendation("Connect your OpenAI API key first to generate product images.");
    }
    if (code === "INSUFFICIENT_SUPPLEMENT_FACTS") {
      return withRecommendation(
        fallback ||
        "Supplement facts generation needs serving size and ingredient details. Add product facts, then try again."
      );
    }
    if (code === "SUPPLEMENT_FACTS_REFERENCE_REQUIRED") {
      return withRecommendation(
        fallback ||
          "Upload a bottle supplement-facts image or back-label reference before generating this image type."
      );
    }
    if (code === "OPENAI_UNSUPPORTED_PARAMETER") {
      return withRecommendation(
        "OpenAI rejected the image request: unsupported parameter for the selected generation mode."
      );
    }
    if (code === "OPENAI_UNSUPPORTED_SIZE") {
      return withRecommendation(
        "OpenAI rejected the image request: unsupported size for the selected model."
      );
    }
    if (code === "OPENAI_MODEL_UNAVAILABLE") {
      return withRecommendation(
        "OpenAI rejected the image request: this image model is not available for your key/project."
      );
    }
    if (code === "OPENAI_BAD_REQUEST") {
      return withRecommendation(
        "OpenAI rejected the image request. Check guidance text/model access and try again."
      );
    }
    if (code === "OPENAI_REFERENCE_INVALID") {
      return withRecommendation(
        "OpenAI rejected the selected reference image. Use a clear PNG/JPG reference and try again."
      );
    }
    if (code === "REFERENCE_IMAGE_UNSUPPORTED_TYPE") {
      return withRecommendation(
        "Reference image type is unsupported. Use PNG or JPEG and retry."
      );
    }
    if (code === "REFERENCE_IMAGE_TOO_LARGE") {
      return withRecommendation(
        "Reference image is too large for generation. Upload a smaller image and retry."
      );
    }
    if (code === "INVALID_REFERENCE_IMAGE") {
      return withRecommendation(
        "Reference image could not be parsed. Re-upload a valid PNG/JPEG image."
      );
    }
    if (code === "GENERATED_MEDIA_STORAGE_FAILED") {
      return withRecommendation(
        "Generated image storage failed after provider success. Retry generation."
      );
    }
    if (code === "REQUEST_BODY_TOO_LARGE") {
      return withRecommendation(
        "Reference image payload is too large for this request. Upload smaller images and retry."
      );
    }
    if (code === "OPENAI_UNAUTHORIZED") {
      return withRecommendation(
        "OpenAI image generation failed with unauthorized response. Reconnect your OpenAI key."
      );
    }
    if (code === "OPENAI_FORBIDDEN") {
      return withRecommendation(
        "OpenAI image generation was forbidden. Check OpenAI project permissions."
      );
    }
    if (code === "OPENAI_RATE_LIMITED") {
      return withRecommendation("OpenAI image generation is rate-limited right now. Retry shortly.");
    }
    if (error?.statusCode === 400) {
      return withRecommendation(
        "OpenAI rejected the image request. Verify your OpenAI model access and generation settings."
      );
    }
    return withRecommendation(fallback || "Could not generate product images.");
  }

  function buildSyntheticGenerationError(
    status: number,
    rawBody: string
  ): GenerateProductImagesResponse["error"] {
    if (status === 413) {
      return {
        code: "REQUEST_BODY_TOO_LARGE",
        category: "request_too_large",
        statusCode: status,
        message: "Reference image payload is too large for generation.",
        recommendation:
          "Upload smaller PNG/JPEG references (around 450KB each, total under 900KB).",
        requestDiagnostics: {
          generationMode: generatedReferenceImages.length > 0 ? "reference_image_edit" : "text_to_image",
          referenceCount: generatedReferenceImages.length,
          referenceMimeTypes: generatedReferenceImages.map((entry) =>
            normalizeImageMimeType(entry.mimeType)
          ),
          referenceByteSizes: generatedReferenceImages.map((entry) => entry.byteSize),
          layoutMode:
            generatedImageType === "supplement_facts" && generatedReferenceImages.length > 0
              ? "reference_layout"
              : generatedImageType === "supplement_facts"
                ? "standard"
                : null,
          userGuidanceIncluded: generatedImageGuidance.trim().length > 0,
          layoutPreservationInstruction:
            generatedImageType === "supplement_facts" && generatedReferenceImages.length > 0,
          productFactsSource: generatedImageType === "supplement_facts" ? "product_data" : null,
          routePhase: "request_body",
          imageType: generatedImageType,
          quantity: Math.max(1, Math.min(3, Number.parseInt(generatedImageQuantity, 10) || 1)),
          styleGuidanceLength: generatedImageGuidance.trim().length,
        },
      };
    }
    if (status === 415) {
      return {
        code: "UNSUPPORTED_MEDIA_TYPE",
        category: "invalid_request",
        statusCode: status,
        message: "Server rejected reference media type.",
        recommendation: "Use PNG or JPEG reference images and retry.",
      };
    }
    const clipped = rawBody.trim().slice(0, 160);
    return {
      code: "IMAGE_GENERATION_FAILED",
      category: "server_error",
      statusCode: status || 502,
      message:
        clipped ||
        `Image generation failed with HTTP ${status || 502}.`,
      recommendation:
        "Retry generation. If this persists, verify OpenAI connection and image model access.",
    };
  }

  function formatGenerationMode(value: string | null | undefined): string {
    if (!value) return "Unknown";
    if (value === "reference_image_edit") return "Reference image edit";
    if (value === "reference_fallback_text_to_image") {
      return "Reference fallback to text-to-image";
    }
    if (value === "text_to_image") return "Text-to-image";
    return value.replace(/_/g, " ");
  }

  function formatLayoutMode(value: string | null | undefined): string {
    if (!value) return "Unknown";
    if (value === "reference_layout") return "Reference layout";
    if (value === "standard") return "Standard";
    return value.replace(/_/g, " ");
  }

  function formatProductFactsSource(value: string | null | undefined): string {
    if (!value) return "Unknown";
    if (value === "product_data") return "Product data";
    if (value === "reference") return "Reference";
    if (value === "fallback") return "Fallback";
    return value.replace(/_/g, " ");
  }

  async function handleAttachReferenceImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const remainingSlots = Math.max(
      0,
      MAX_GENERATED_REFERENCE_IMAGES - generatedReferenceImages.length
    );
    if (remainingSlots <= 0) {
      setGeneratedReferenceMessage(
        `You can add up to ${MAX_GENERATED_REFERENCE_IMAGES} reference images. Remove one to add another.`
      );
      return;
    }

    const nextFiles = files.slice(0, remainingSlots);
    const loaded: WalmartGeneratedReferenceImage[] = [];
    const uploadErrors: string[] = [];
    for (const file of nextFiles) {
      const normalizedMimeType = normalizeImageMimeType(file.type || "");
      if (!normalizedMimeType.startsWith("image/")) continue;
      if (!ALLOWED_GENERATED_REFERENCE_MIME_TYPES.has(normalizedMimeType)) {
        uploadErrors.push(
          `${file.name || "reference-image"} skipped: unsupported format. Use PNG, JPEG, or WEBP.`
        );
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const estimatedBytes = estimateDataUrlByteSize(dataUrl);
        if (!estimatedBytes) {
          uploadErrors.push(
            `${file.name || "reference-image"} skipped: invalid image data.`
          );
          continue;
        }
        if (estimatedBytes > MAX_GENERATED_REFERENCE_IMAGE_BYTES) {
          uploadErrors.push(
            `${file.name || "reference-image"} is ${formatBytes(
              estimatedBytes
            )}; max per reference is ${formatBytes(MAX_GENERATED_REFERENCE_IMAGE_BYTES)}.`
          );
          continue;
        }
        const randomId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        loaded.push({
          id: `ref_${randomId}`,
          name: file.name || "reference-image",
          mimeType: normalizedMimeType || "image/png",
          dataUrl,
          source: "uploaded",
          byteSize: estimatedBytes,
        });
      } catch {
        uploadErrors.push(`${file.name || "reference-image"} could not be read.`);
      }
    }

    if (loaded.length === 0) {
      setGeneratedReferenceMessage(
        uploadErrors[0] ?? "No valid image files were selected."
      );
      return;
    }

    setGeneratedReferenceImages((current) => {
      const seen = new Set(current.map((entry) => entry.dataUrl));
      const deduped = loaded.filter((entry) => !seen.has(entry.dataUrl));
      const merged = [...current, ...deduped].slice(0, MAX_GENERATED_REFERENCE_IMAGES);
      let totalBytes = merged.reduce((sum, entry) => sum + entry.byteSize, 0);
      while (merged.length > 0 && totalBytes > MAX_GENERATED_REFERENCE_TOTAL_BYTES) {
        const removed = merged.pop();
        if (!removed) break;
        totalBytes -= removed.byteSize;
      }
      return merged;
    });
    const acceptedBytes = loaded.reduce((sum, entry) => sum + entry.byteSize, 0);
    const successMessage = `${loaded.length} reference image${
      loaded.length === 1 ? "" : "s"
    } ready for generation (${formatBytes(acceptedBytes)}).`;
    setGeneratedReferenceMessage(
      uploadErrors.length > 0
        ? `${successMessage} ${uploadErrors[0]}`
        : successMessage
    );
  }

  function handleRemoveReferenceImage(referenceId: string) {
    setGeneratedReferenceImages((current) =>
      current.filter((reference) => reference.id !== referenceId)
    );
    setGeneratedReferenceMessage("Reference image removed.");
  }

  function handleGeneratedPreviewLoadError(asset: WalmartGeneratedMediaAsset) {
    const previewTarget = asset.previewUrl || asset.url;
    setGeneratedPreviewErrors((current) => ({
      ...current,
      [asset.id]:
        `Preview could not load from ${previewTarget}. Save Draft still retains the asset URL.`,
    }));
  }

  async function handleGenerateProductImages(params?: {
    replaceAssetId?: string;
    overrideImageType?: WalmartGeneratedImageType;
    overrideGuidance?: string;
    overrideQuantity?: number;
  }) {
    if (!aiProviderConnected) {
      setProductImageGenerationError(null);
      setProductImageGenerationMessage(
        "Connect your OpenAI API key first to generate product images."
      );
      return;
    }

    const imageType = params?.overrideImageType ?? generatedImageType;
    const styleGuidance = (params?.overrideGuidance ?? generatedImageGuidance).trim();
    const quantity =
      params?.overrideQuantity ??
      Math.max(1, Math.min(3, Number.parseInt(generatedImageQuantity, 10) || 1));

    try {
      setGeneratingProductImages(true);
      setProductImageGenerationMessage("Generating product image preview...");
      setProductImageGenerationError(null);
      const response = await fetch("/api/ecomviper/walmart/ai/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: product.sku,
          imageType,
          styleGuidance,
          quantity,
          referenceImages: generatedReferenceImages.map((reference) => ({
            source: reference.source,
            url: reference.dataUrl,
            label: reference.name,
            mimeType: reference.mimeType,
            byteSize: reference.byteSize,
          })),
          draftPayload: preview,
        }),
      });

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      let payload: GenerateProductImagesResponse | null = null;
      let rawBody = "";
      if (contentType.includes("application/json")) {
        payload = (await response.json().catch(() => null)) as GenerateProductImagesResponse | null;
      } else {
        rawBody = await response.text().catch(() => "");
      }

      if (!response.ok || !payload?.generated) {
        const normalizedError = payload?.error ?? buildSyntheticGenerationError(response.status, rawBody);
        setProductImageGenerationError(normalizedError);
        setProductImageGenerationMessage(toGeneratedImageErrorMessage(normalizedError));
        return;
      }

      const nextGeneratedAssets = payload.generated
        .map((entry) => normalizeGeneratedMediaAsset(entry))
        .filter((entry): entry is WalmartGeneratedMediaAsset => entry !== null);
      if (nextGeneratedAssets.length === 0) {
        setProductImageGenerationError({
          code: "NO_VALID_PREVIEW_ASSETS",
          category: "provider_response_invalid",
          statusCode: response.status,
          message: "No valid image previews were returned by the generator.",
          recommendation: "Retry generation. If this persists, adjust guidance/reference images.",
          requestDiagnostics: payload.generationDiagnostics
            ? {
                imageType: payload.generationDiagnostics.imageType ?? null,
                generationMode: payload.generationDiagnostics.generationMode ?? null,
                model: payload.generationDiagnostics.model ?? null,
                size: payload.generationDiagnostics.size ?? null,
                promptLength: payload.generationDiagnostics.promptLength ?? null,
                referenceCount: payload.generationDiagnostics.referenceCount ?? null,
                referenceMimeTypes: payload.generationDiagnostics.referenceMimeTypes ?? [],
                referenceByteSizes: payload.generationDiagnostics.referenceByteSizes ?? [],
                layoutMode: payload.generationDiagnostics.layoutMode ?? null,
                userGuidanceIncluded:
                  payload.generationDiagnostics.userGuidanceIncluded ?? null,
                layoutPreservationInstruction:
                  payload.generationDiagnostics.layoutPreservationInstruction ?? null,
                productFactsSource:
                  payload.generationDiagnostics.productFactsSource ?? null,
                width: payload.generationDiagnostics.width ?? null,
                height: payload.generationDiagnostics.height ?? null,
                isSquare: payload.generationDiagnostics.isSquare ?? null,
                squareNormalized: payload.generationDiagnostics.squareNormalized ?? null,
              }
            : undefined,
        });
        setProductImageGenerationMessage("No valid image previews were returned. Try regenerating.");
        return;
      }

      setForm((current) => {
        const nextAssets = current.generatedMediaAssets.filter(
          (asset) => asset.id !== params?.replaceAssetId
        );
        nextAssets.push(...nextGeneratedAssets);
        return {
          ...current,
          generatedMediaAssets: nextAssets,
        };
      });
      setGeneratedPreviewErrors((current) => {
        const next = { ...current };
        if (params?.replaceAssetId) delete next[params.replaceAssetId];
        for (const asset of nextGeneratedAssets) {
          delete next[asset.id];
        }
        return next;
      });
      setFocusedGeneratedAssetId(nextGeneratedAssets[0]?.id ?? null);
      setFormDirty(true);
      setProductImageGenerationError(null);
      const generationModeSummary = payload.generationDiagnostics?.layoutMode
        ? ` Layout mode: ${formatLayoutMode(payload.generationDiagnostics.layoutMode)}.`
        : "";
      setProductImageGenerationMessage(
        `${nextGeneratedAssets.length} generated image preview${
          nextGeneratedAssets.length === 1 ? "" : "s"
        } ready. Review below, open full size if needed, then click Add to Product Media.${generationModeSummary}`
      );
    } catch (error) {
      const fallback = {
        code: "IMAGE_GENERATION_CLIENT_ERROR",
        category: "network_error",
        message:
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Product image generation request failed before a server response.",
        recommendation:
          "Check your network connection and retry. If this persists, reload and test again.",
      } as GenerateProductImagesResponse["error"];
      setProductImageGenerationError(fallback);
      setProductImageGenerationMessage(toGeneratedImageErrorMessage(fallback));
    } finally {
      setGeneratingProductImages(false);
    }
  }

  function handleApproveGeneratedMediaAsset(assetId: string) {
    const selectedAsset = form.generatedMediaAssets.find((entry) => entry.id === assetId);
    if (!selectedAsset) {
      setProductImageGenerationMessage("Generated image not found.");
      return;
    }
    if (selectedAsset.approved) {
      setProductImageGenerationMessage("Generated image is already approved in this draft.");
      return;
    }

    setForm((current) => {
      const asset = current.generatedMediaAssets.find((entry) => entry.id === assetId);
      if (!asset) return current;

      const currentPrimary = current.imageUrl.trim();
      const currentAdditional = normalizeWalmartImageUrlList([current.additionalImageUrls]);
      let nextPrimary = currentPrimary;
      let nextAdditional = currentAdditional;

      if (!nextPrimary) {
        nextPrimary = asset.url;
      } else if (nextPrimary !== asset.url) {
        nextAdditional = normalizeWalmartImageUrlList([nextAdditional, asset.url]).filter(
          (entry) => entry !== nextPrimary
        );
      }
      if (nextPrimary === asset.url) {
        nextAdditional = nextAdditional.filter((entry) => entry !== asset.url);
      }

      const nextAssets = current.generatedMediaAssets.map((entry) =>
        entry.id === assetId
          ? { ...entry, approved: true, approvedForWalmart: true }
          : entry
      );
      return {
        ...current,
        generatedMediaAssets: nextAssets,
        imageUrl: nextPrimary,
        additionalImageUrls: nextAdditional.join("\n"),
        imageSource: nextPrimary === asset.url ? "openai_generated" : current.imageSource,
        imageSyncStatus: nextPrimary === asset.url ? "found" : current.imageSyncStatus,
        imageSyncReason:
          nextPrimary === asset.url
            ? "Primary image approved from OpenAI generated media."
            : current.imageSyncReason,
        lastImageSyncedAt: new Date().toISOString(),
      };
    });
    setFocusedGeneratedAssetId(assetId);
    setFormDirty(true);
    setProductImageGenerationMessage(
      "Generated image added to product media and approved for Walmart in this editor state. Save Draft to persist."
    );
  }

  function handleRemoveGeneratedMediaAsset(assetId: string) {
    const selectedAsset = form.generatedMediaAssets.find((entry) => entry.id === assetId);
    if (!selectedAsset) return;

    let nextFocusId: string | null = null;
    setForm((current) => {
      const asset = current.generatedMediaAssets.find((entry) => entry.id === assetId);
      if (!asset) return current;

      const remainingAssets = current.generatedMediaAssets.filter((entry) => entry.id !== assetId);
      const currentAdditional = normalizeWalmartImageUrlList([current.additionalImageUrls]).filter(
        (entry) => entry !== asset.url
      );

      let nextPrimary = current.imageUrl.trim();
      let nextAdditional = currentAdditional;
      if (nextPrimary === asset.url) {
        nextPrimary = currentAdditional[0] ?? "";
        nextAdditional = currentAdditional.filter((entry) => entry !== nextPrimary);
      }
      nextFocusId = remainingAssets.find((entry) => !entry.approved)?.id ?? remainingAssets[0]?.id ?? null;
      return {
        ...current,
        generatedMediaAssets: remainingAssets,
        imageUrl: nextPrimary,
        additionalImageUrls: nextAdditional.join("\n"),
      };
    });
    setFormDirty(true);
    setFocusedGeneratedAssetId(nextFocusId);
    setGeneratedPreviewErrors((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
    setProductImageGenerationMessage("Generated media preview removed from this draft.");
  }

  async function handleRegenerateGeneratedMediaAsset(asset: WalmartGeneratedMediaAsset) {
    await handleGenerateProductImages({
      replaceAssetId: asset.id,
      overrideImageType: asset.imageType,
      overrideGuidance: asset.guidance ?? "",
      overrideQuantity: 1,
    });
  }

  function revealInlineAiPanel() {
    if (!inlineAiPanelRef.current) return;
    inlineAiPanelRef.current.focus();
    if (typeof inlineAiPanelRef.current.scrollIntoView === "function") {
      inlineAiPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  async function handleExtractLabelFacts() {
    try {
      setExtractingLabelFacts(true);
      setLabelFactsMessage("Extracting label facts from images...");

      const response = await fetch("/api/ecomviper/walmart/ai/images/extract-facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: product.sku,
          draftPayload: preview,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ExtractLabelFactsResponse | null;
      if (!response.ok || !payload?.ok) {
        setLabelFactsMessage(
          payload?.error?.message?.trim() || "Label extraction failed. Try again."
        );
        return;
      }

      const mappedCandidates = payload.mappedSearchBrowseAttributes ?? {};
      const sanitized = sanitizeWalmartAiSearchBrowseAttributes({
        candidates: mappedCandidates,
        existingKeys: Object.keys(form.searchBrowseAttributes),
      });
      const mergedSearchBrowse = {
        ...form.searchBrowseAttributes,
        ...sanitized.accepted,
      };
      syncAliasGroups({ attributes: mergedSearchBrowse });

      const nextAttributesJson = JSON.stringify(
        mergeAttributesWithSearchBrowse({
          baseAttributes: readAttributesFromForm(form.attributesJson),
          searchBrowseAttributes: mergedSearchBrowse,
        }),
        null,
        2
      );

      patchForm({
        searchBrowseAttributes: mergedSearchBrowse,
        attributesJson: nextAttributesJson,
        imageVisionExtraction: payload.visionFactPayload ?? form.imageVisionExtraction,
      });

      const status = payload.extraction?.status?.trim() || "unknown";
      const detail =
        payload.extraction?.message?.trim() ||
        "Label extraction completed.";
      setLabelFactsMessage(`Label extraction status: ${status}. ${detail}`);
    } catch {
      setLabelFactsMessage("Label extraction failed. Try again.");
    } finally {
      setExtractingLabelFacts(false);
    }
  }

  async function runInlineOptimization() {
    revealInlineAiPanel();
    setWorkflowTab("improve");
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
          draftPayload: currentWalmartStateDraftPayload,
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
    const suggestedBrand = pickMeaningfulAiText(inlineAiSuggestion.suggestedBrand) ?? "";
    const safeBrand =
      suggestedBrand && suggestedBrand.toLowerCase() !== "unknown"
        ? suggestedBrand
        : form.brand;
    const entitySet = inlineAiSuggestion.entitySet;
    const inferredManufacturer =
      pickMeaningfulAiText(
        (inlineAiSuggestion.searchBrowseAttributes ?? {}).manufacturer ??
          (inlineAiSuggestion.suggestedAttributes ?? {}).manufacturer
      ) ?? "";
    const inferredSearchKeywords = unique([
      safeBrand,
      pickMeaningfulAiText(entitySet?.productName) ?? "",
      pickMeaningfulAiText(entitySet?.category) ?? "",
      pickMeaningfulAiText(entitySet?.form) ?? "",
      ...(entitySet?.keyIngredients ?? []),
      ...(entitySet?.supportedBenefits ?? []),
    ])
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 1 && !isLowConfidenceAiFieldValue(entry))
      .slice(0, 12)
      .join(", ");

    const inferredSearchBrowseCandidates: Record<string, string> = {};
    if (shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.brand) && safeBrand.trim()) {
      inferredSearchBrowseCandidates.brand = safeBrand.trim();
    }
    if (
      shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.manufacturer) &&
      inferredManufacturer.trim() &&
      inferredManufacturer.trim().toLowerCase() !== safeBrand.trim().toLowerCase()
    ) {
      inferredSearchBrowseCandidates.manufacturer = inferredManufacturer.trim();
    }
    if (
      shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.supplement_type) &&
      pickMeaningfulAiText(entitySet?.category)
    ) {
      inferredSearchBrowseCandidates.supplement_type = String(entitySet?.category).trim();
    }
    if (
      shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.product_form) &&
      pickMeaningfulAiText(entitySet?.form)
    ) {
      inferredSearchBrowseCandidates.product_form = String(entitySet?.form).trim();
    }
    if (
      shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.target_audience) &&
      pickMeaningfulAiText(entitySet?.audience)
    ) {
      inferredSearchBrowseCandidates.target_audience = String(entitySet?.audience).trim();
    }
    if (
      shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.main_ingredients) &&
      (entitySet?.keyIngredients?.length ?? 0) > 0
    ) {
      inferredSearchBrowseCandidates.main_ingredients = entitySet!.keyIngredients.join(", ");
    }
    if (
      shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.support_areas) &&
      (entitySet?.supportedBenefits?.length ?? 0) > 0
    ) {
      inferredSearchBrowseCandidates.support_areas = entitySet!.supportedBenefits.join(", ");
    }
    if (shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.search_keywords) && inferredSearchKeywords) {
      inferredSearchBrowseCandidates.search_keywords = inferredSearchKeywords;
    }
    if (shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.search_terms) && inferredSearchKeywords) {
      inferredSearchBrowseCandidates.search_terms = inferredSearchKeywords;
    }
    if (
      shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.directions_suggested_use)
    ) {
      inferredSearchBrowseCandidates.directions_suggested_use =
        DEFAULT_SUPPLEMENT_DIRECTIONS;
    }
    if (shouldBackfillSearchBrowseValue(form.searchBrowseAttributes.safety_warnings)) {
      inferredSearchBrowseCandidates.safety_warnings = DEFAULT_SUPPLEMENT_WARNINGS;
    }
    const diagnostics = normalizeInlineAiApplyDiagnostics(
      inlineAiSuggestion.applyDiagnostics
    );

    const aiAttributeMap: Record<string, unknown> = {
      ...inferredSearchBrowseCandidates,
      ...(inlineAiSuggestion.suggestedAttributes ?? {}),
      ...(inlineAiSuggestion.searchBrowseAttributes ?? {}),
    };
    const sanitizedAiSearchBrowse = sanitizeWalmartAiSearchBrowseAttributes({
      candidates: aiAttributeMap,
      existingKeys: [
        ...Object.keys(form.searchBrowseAttributes),
        ...Object.keys(attributeMap),
      ],
    });
    const mergedSearchBrowseAttributes = { ...form.searchBrowseAttributes };
    syncAliasGroups({ attributes: mergedSearchBrowseAttributes });
    const appliedSearchBrowseFields: string[] = [];
    for (const [key, value] of Object.entries(sanitizedAiSearchBrowse.accepted)) {
      const currentValue = (mergedSearchBrowseAttributes[key] ?? "").trim();
      if (currentValue === value.trim()) continue;
      mergedSearchBrowseAttributes[key] = value;
      attributeMap[key] = value;
      appliedSearchBrowseFields.push(key);
    }
    for (const key of diagnostics.staleFieldsCleared) {
      const keysToClear = expandAliasKeys([key]);
      for (const clearKey of keysToClear) {
        if (!hasOwn(mergedSearchBrowseAttributes, clearKey)) continue;
        const existingValue = (mergedSearchBrowseAttributes[clearKey] ?? "").trim();
        if (!existingValue) continue;
        clearAliasGroupValues({
          attributes: mergedSearchBrowseAttributes,
          key: clearKey,
        });
        clearAliasGroupValues({
          attributes: attributeMap,
          key: clearKey,
        });
        appliedSearchBrowseFields.push(clearKey);
      }
    }
    syncAliasGroups({ attributes: mergedSearchBrowseAttributes });
    syncAliasGroups({ attributes: attributeMap });

    const meaningfulTitle = pickMeaningfulAiText(inlineAiSuggestion.suggestedTitle);
    const meaningfulLongDescription = pickMeaningfulAiText(inlineAiSuggestion.suggestedDescription);
    const meaningfulShortDescription = pickMeaningfulAiText(
      inlineAiSuggestion.suggestedShortDescription
    );
    const meaningfulBullets = inlineAiSuggestion.suggestedBullets
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && !isLowConfidenceAiFieldValue(entry));
    const nextTitle = meaningfulTitle ?? form.title;
    const nextLongDescription = meaningfulLongDescription ?? form.longDescription;
    const nextShortDescription =
      (meaningfulShortDescription ??
        form.shortDescription.trim()) ||
      inferShortDescriptionFromAi(nextLongDescription);
    const nextBulletPoints =
      meaningfulBullets.length > 0
        ? meaningfulBullets.join("\n")
        : form.bulletPoints;
    const nextMediaRecommendations = (inlineAiSuggestion.mediaRecommendations ?? [])
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const nextFaqSnippets = (inlineAiSuggestion.faqSnippets ?? [])
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && !isLowConfidenceAiFieldValue(entry))
      .slice(0, 8);
    const nextComplianceNotes = (inlineAiSuggestion.complianceNotes ?? [])
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const nextAltText = pickMeaningfulAiText(inlineAiSuggestion.altText) ?? form.altText;

    const appliedContentFields: string[] = [];
    if (nextTitle.trim() !== form.title.trim()) appliedContentFields.push("title");
    if (nextShortDescription.trim() !== form.shortDescription.trim()) {
      appliedContentFields.push("short description");
    }
    if (nextLongDescription.trim() !== form.longDescription.trim()) {
      appliedContentFields.push("long description");
    }
    if (nextBulletPoints.trim() !== form.bulletPoints.trim()) {
      appliedContentFields.push("bullet points");
    }
    if (
      nextFaqSnippets.join("\n").trim() &&
      nextFaqSnippets.join("\n").trim() !== form.faqSnippets.trim()
    ) {
      appliedContentFields.push("FAQ snippets");
    }
    if (safeBrand.trim() !== form.brand.trim()) appliedContentFields.push("brand");

    const skippedProtectedFields = unique([
      ...sanitizedAiSearchBrowse.skipped
        .filter((entry) => entry.reason === "protected_field")
        .map((entry) => entry.key),
      ...diagnostics.skippedProtectedFields,
    ]).slice(0, 8);
    const skippedLowConfidenceFields = unique([
      ...sanitizedAiSearchBrowse.skipped
        .filter((entry) => entry.reason === "low_confidence")
        .map((entry) => entry.key),
      ...diagnostics.skippedLowConfidenceFields,
    ]).slice(0, 8);

    patchForm({
      title: nextTitle,
      longDescription: nextLongDescription,
      shortDescription: nextShortDescription,
      bulletPoints: nextBulletPoints,
      brand: safeBrand,
      attributesJson: JSON.stringify(attributeMap, null, 2),
      searchBrowseAttributes: mergedSearchBrowseAttributes,
      faqSnippets:
        diagnostics.faqGenerationState === "pending"
          ? form.faqSnippets
          : nextFaqSnippets.length > 0
          ? nextFaqSnippets.join("\n")
          : form.faqSnippets,
      mediaRecommendations:
        nextMediaRecommendations.length > 0
          ? nextMediaRecommendations.join("\n")
          : form.mediaRecommendations,
      altText: nextAltText,
      complianceNotes:
        nextComplianceNotes.length > 0
          ? nextComplianceNotes.join("\n")
          : form.complianceNotes,
    });
    setAiSuggestionApplied(true);
    setWorkflowTab("edit-submit");
    setDraftEditorOpen(true);
    setActiveTab("Content");
    setShowAiDetails(false);
    setInlineAiState("success");
    const contentSummary = appliedContentFields.length
      ? appliedContentFields.join(", ")
      : "none";
    const searchBrowseSummary = appliedSearchBrowseFields.length
      ? appliedSearchBrowseFields.join(", ")
      : "none";
    const faqSummary = nextFaqSnippets.length > 0 ? String(nextFaqSnippets.length) : "none";
    const protectedSummary = skippedProtectedFields.length
      ? skippedProtectedFields.join(", ")
      : "none";
    const lowConfidenceSummary = skippedLowConfidenceFields.length
      ? skippedLowConfidenceFields.join(", ")
      : "none";
    const staleSummary = unique([
      ...diagnostics.staleFieldsReplaced,
      ...diagnostics.staleFieldsCleared,
    ]);
    const staleSummaryText = staleSummary.length ? staleSummary.join(", ") : "none";
    const factsSummaryText =
      diagnostics.factsUpdated.length > 0
        ? diagnostics.factsUpdated.join(", ")
        : "none";
    const sourceSummaryText =
      diagnostics.factsSources.length > 0
        ? diagnostics.factsSources.join(", ")
        : "none";
    const complianceSummaryText =
      diagnostics.complianceChanges.length > 0
        ? diagnostics.complianceChanges.join(", ")
        : "none";
    const disclaimerSummaryText = diagnostics.disclaimerStatus;
    const imageFactsStatusText = diagnostics.imageFactsStatus;
    const imageFactsMessageText = diagnostics.imageFactsMessage || "none";
    const manufacturerSummary = `Manufacturer provenance: source=${diagnostics.manufacturerSource}, confidence=${diagnostics.manufacturerConfidence}, needs_review=${diagnostics.manufacturerNeedsReview}.`;
    setInlineAiMessage(
      `AI improvements applied to draft fields. Save Draft when ready. Updated Content: ${contentSummary}. Updated Search & Browse: ${searchBrowseSummary}. FAQ snippets: ${faqSummary}. Facts updated: ${factsSummaryText}. Sources used: ${sourceSummaryText}. Stale fields cleared/replaced: ${staleSummaryText}. Image-derived facts status: ${imageFactsStatusText}. Image-derived facts detail: ${imageFactsMessageText}. ${manufacturerSummary} Compliance changes: ${complianceSummaryText}. Skipped protected fields: ${protectedSummary}. Skipped low-confidence fields: ${lowConfidenceSummary}. FDA disclaimer status: ${disclaimerSummaryText}.`
    );
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
    setWorkflowTab("edit-submit");
    const readiness = document.getElementById("walmart-product-readiness");
    if (!readiness) return;
    readiness.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleReviewAiChanges() {
    setWorkflowTab("improve");
    setShowAiDetails(true);
    revealInlineAiPanel();
  }

  const schemaGapHighlights = unique([
    ...currentWalmartState.schemaCoverage.missingRequiredFields.map(
      (field) => `Missing required field: ${field}`
    ),
    ...currentWalmartState.schemaCoverage.missingComplianceFields.map(
      (field) => `Missing compliance field: ${field}`
    ),
    ...currentWalmartState.schemaCoverage.missingDiscoverabilityFields.map(
      (field) => `Missing discoverability field: ${field}`
    ),
  ]).slice(0, 4);
  const currentSchemaGapAnalysis = optimizedProposalLayer.optimizationAnalysis.currentGapAnalysis;
  const proposalSchemaGapAnalysis = optimizedProposalLayer.optimizationAnalysis.proposalGapAnalysis;
  const currentSchemaGapCount =
    currentSchemaGapAnalysis.missingRequiredFields.length +
    currentSchemaGapAnalysis.missingComplianceFields.length +
    currentSchemaGapAnalysis.missingSearchableFields.length +
    currentSchemaGapAnalysis.missingDiscoverabilityFields.length;
  const proposalSchemaGapCount =
    proposalSchemaGapAnalysis.missingRequiredFields.length +
    proposalSchemaGapAnalysis.missingComplianceFields.length +
    proposalSchemaGapAnalysis.missingSearchableFields.length +
    proposalSchemaGapAnalysis.missingDiscoverabilityFields.length;
  const currentListingShortDescription =
    currentWalmartState.content.siteDescription || "Not available";
  const currentListingLongDescription =
    currentWalmartState.content.longDescription || "Not available";
  const currentListingBullets = currentWalmartState.content.keyFeatures;
  const currentSalePrice = currentWalmartState.pricingInventory.salePrice;
  const currentFulfillmentSignals = [
    {
      label: "Fulfillment model",
      value: currentWalmartState.pricingInventory.fulfillmentType,
    },
    {
      label: "WFS status",
      value: currentWalmartState.pricingInventory.wfsStatus,
    },
    {
      label: "Shipping template",
      value: currentWalmartState.pricingInventory.shippingTemplate,
    },
    {
      label: "Lag time",
      value: currentWalmartState.pricingInventory.lagTime,
    },
  ].filter((entry) => entry.value.trim().length > 0);
  const currentComplianceSignals = [
    {
      label: "Warning text",
      value: currentWalmartState.compliance.warningText,
    },
    {
      label: "Stop use indications",
      value: currentWalmartState.compliance.stopUseIndications,
    },
    {
      label: "Prop 65",
      value: currentWalmartState.compliance.prop65,
    },
    {
      label: "Country of origin",
      value: currentWalmartState.compliance.countryOfOrigin,
    },
    {
      label: "Regulatory fields",
      value: currentWalmartState.compliance.regulatoryFields,
    },
  ].filter((entry) => entry.value.trim().length > 0);
  const listingSearchBrowseGroups = useMemo(
    () =>
      currentWalmartState.searchBrowse.groupedAttributes.filter(
        (group) => group.group !== "compliance" && group.group !== "fulfillment"
      ),
    [currentWalmartState.searchBrowse.groupedAttributes]
  );
  const currentImageFactsStatus =
    currentWalmartState.media.imageFactsStatus || resolvedImageFactsStatus;
  const currentImageFactsMessage =
    currentWalmartState.media.imageFactsMessage || resolvedImageFactsMessage;
  const currentTaxonomyPlacement =
    currentWalmartState.searchBrowse.taxonomyPlacement ||
    currentWalmartState.taxonomyPlacement ||
    "Not available";
  const currentListingReferenceSections = (panel: "review" | "improve") => (
    <section
      className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
    >
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-[#0F172A]">Current Walmart State</h2>
        <p className="mt-1 text-sm text-[#475569]">
          {panel === "review"
            ? "This is the current Walmart-native listing state before optimization."
            : "Reference source-of-truth while AI optimized proposals are generated."}
        </p>
        <p className="mt-1 text-xs text-[#64748B]">
          Source of truth: {currentWalmartState.sourceOfTruth.join(", ")}
        </p>
        <div
          className="mt-2 grid gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#334155]"
          data-testid="ecomviper-walmart-live-hydration-status"
        >
          <p>
            <span className="text-[#64748B]">Hydration source:</span>{" "}
            {currentWalmartState.hydration.source}
          </p>
          <p>
            <span className="text-[#64748B]">Hydration status:</span>{" "}
            {currentWalmartState.hydration.status}
          </p>
          <p>
            <span className="text-[#64748B]">Hydrated at:</span>{" "}
            {currentWalmartState.hydration.hydratedAt}
          </p>
          {currentWalmartState.hydration.fallbackReason ? (
            <p>
              <span className="text-[#64748B]">Fallback reason:</span>{" "}
              {currentWalmartState.hydration.fallbackReason}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <article
          className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3"
          data-testid="ecomviper-walmart-current-listing-content"
        >
          <h3 className="text-sm font-semibold text-[#0F172A]">Content</h3>
          <div className="mt-2 space-y-2 text-sm text-[#334155]">
            <p>
              <span className="text-[#64748B]">Product name:</span>{" "}
              {currentWalmartState.content.productName || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Site description:</span>{" "}
              {currentListingShortDescription}
            </p>
            <p>
              <span className="text-[#64748B]">Long description:</span> {currentListingLongDescription}
            </p>
            <div>
              <p className="text-[#64748B]">Key features / bullets:</p>
              {currentListingBullets.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                  {currentListingBullets.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[#334155]">No bullet points currently available.</p>
              )}
            </div>
            <p>
              <span className="text-[#64748B]">Brand:</span>{" "}
              {currentWalmartState.content.brand || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Manufacturer:</span>{" "}
              {currentWalmartState.content.manufacturer || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Rich media status:</span>{" "}
              {currentWalmartState.content.richMediaStatus || "Not available"}
            </p>
          </div>
        </article>

        <article
          className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3"
          data-testid="ecomviper-walmart-current-listing-media"
        >
          <h3 className="text-sm font-semibold text-[#0F172A]">Media</h3>
          <div className="mt-2 space-y-2 text-sm text-[#334155]">
            <p>
              <span className="text-[#64748B]">Primary image:</span>{" "}
              {currentWalmartState.media.primaryImageUrl ? "Available" : "Not available"}
            </p>
            {currentWalmartState.media.primaryImageUrl ? (
              <img
                src={currentWalmartState.media.primaryImageUrl}
                alt={`${product.sku} current primary`}
                className="h-20 w-20 rounded-lg border border-[#D9E4F0] bg-white object-cover"
                loading="lazy"
              />
            ) : null}
            <p>
              <span className="text-[#64748B]">Gallery images:</span>{" "}
              {currentWalmartState.media.galleryImageUrls.length}
            </p>
            {currentWalmartState.media.galleryImageUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {currentWalmartState.media.galleryImageUrls.slice(0, 6).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt="Current listing media preview"
                    className="h-14 w-14 rounded border border-[#D9E4F0] bg-white object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}
            <p>
              <span className="text-[#64748B]">Public Walmart listing source:</span>{" "}
              {currentWalmartState.media.publicWalmartUrl || "Not linked"}
            </p>
            <p>
              <span className="text-[#64748B]">Source image lane:</span>{" "}
              {currentWalmartState.media.sourceImageLane || "unknown"}
            </p>
            <p>
              <span className="text-[#64748B]">Image-derived facts status:</span>{" "}
              {currentImageFactsStatus}
            </p>
            <p className="text-xs text-[#475569]">{currentImageFactsMessage}</p>
            {panel === "improve" ? (
              <div className="mt-1 rounded-md border border-[#E2E8F0] bg-white p-2 text-xs text-[#334155]">
                <p className="font-medium text-[#0F172A]">
                  {currentImageFactsStatus === "needs_vision_extraction"
                    ? "Label fact extraction is needed before stronger AI attribute updates."
                    : "Image fact extraction can be rerun if you need updated label details."}
                </p>
                <button
                  type="button"
                  onClick={handleExtractLabelFacts}
                  disabled={extractingLabelFacts}
                  className="mt-2 rounded border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs text-[#0F172A] disabled:opacity-60"
                  data-testid="ecomviper-walmart-extract-label-facts-button"
                >
                  {extractingLabelFacts
                    ? "Extracting label facts..."
                    : "Extract label facts from images"}
                </button>
                {labelFactsMessage ? <p className="mt-1 text-xs text-[#475569]">{labelFactsMessage}</p> : null}
              </div>
            ) : null}
          </div>
        </article>

        <article
          className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3"
          data-testid="ecomviper-walmart-current-listing-pricing-inventory"
        >
          <h3 className="text-sm font-semibold text-[#0F172A]">Pricing &amp; Inventory</h3>
          <div className="mt-2 space-y-1 text-sm text-[#334155]">
            <p>
              <span className="text-[#64748B]">Price:</span>{" "}
              {currentWalmartState.pricingInventory.currentPrice !== null
                ? `$${currentWalmartState.pricingInventory.currentPrice.toFixed(2)}`
                : "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Sale price:</span>{" "}
              {currentSalePrice !== null ? `$${currentSalePrice.toFixed(2)}` : "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Inventory:</span>{" "}
              {currentWalmartState.pricingInventory.inventory === null
                ? "Unknown"
                : currentWalmartState.pricingInventory.inventory}
            </p>
            {currentFulfillmentSignals.length > 0 ? (
              currentFulfillmentSignals.map((entry) => (
                <p key={entry.label}>
                  <span className="text-[#64748B]">{entry.label}:</span> {entry.value}
                </p>
              ))
            ) : (
              <p>
                <span className="text-[#64748B]">Fulfillment/shipping fields:</span> Not available
              </p>
            )}
          </div>
        </article>

        <article
          className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 xl:col-span-2"
          data-testid="ecomviper-walmart-current-listing-search-browse"
        >
          <h3 className="text-sm font-semibold text-[#0F172A]">Search &amp; Browse</h3>
          <p className="mt-1 text-xs text-[#475569]">
            Product identity, audience/usage, ingredients/form, dimensions/packaging, and search metadata in the Walmart-native state.
          </p>
          <div className="mt-2 grid gap-2 text-sm text-[#334155] md:grid-cols-2">
            <p>
              <span className="text-[#64748B]">Product type:</span>{" "}
              {currentWalmartState.searchBrowse.productType || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Supplement type:</span>{" "}
              {currentWalmartState.searchBrowse.supplementType || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Primary ingredient:</span>{" "}
              {currentWalmartState.searchBrowse.primaryIngredient || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Serving size:</span>{" "}
              {currentWalmartState.searchBrowse.servingSize || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Servings per container:</span>{" "}
              {currentWalmartState.searchBrowse.servingsPerContainer || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Count per pack:</span>{" "}
              {currentWalmartState.searchBrowse.countPerPack || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Form:</span>{" "}
              {currentWalmartState.searchBrowse.form || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Flavor:</span>{" "}
              {currentWalmartState.searchBrowse.flavor || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Dietary need:</span>{" "}
              {currentWalmartState.searchBrowse.dietaryNeed || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Health concerns:</span>{" "}
              {currentWalmartState.searchBrowse.healthConcerns || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Ingredient preferences:</span>{" "}
              {currentWalmartState.searchBrowse.ingredientPreferences || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Nutrients:</span>{" "}
              {currentWalmartState.searchBrowse.nutrients || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Gender:</span>{" "}
              {currentWalmartState.searchBrowse.gender || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Age group:</span>{" "}
              {currentWalmartState.searchBrowse.ageGroup || "Not available"}
            </p>
            <p>
              <span className="text-[#64748B]">Product line:</span>{" "}
              {currentWalmartState.searchBrowse.productLine || "Not available"}
            </p>
            <p className="md:col-span-2">
              <span className="text-[#64748B]">Taxonomy placement:</span> {currentTaxonomyPlacement}
            </p>
          </div>
          {listingSearchBrowseGroups.length > 0 ? (
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {listingSearchBrowseGroups.map((group) => (
                <div key={group.group} className="rounded-md border border-[#D9E4F0] bg-white p-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                    {group.label}
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                    {group.values.map((entry) => (
                      <li key={entry.key}>
                        <span className="text-[#64748B]">{entry.label}:</span> {entry.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#334155]">No Search &amp; Browse values currently set.</p>
          )}
        </article>

        <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
          <h3 className="text-sm font-semibold text-[#0F172A]">Compliance</h3>
          {currentComplianceSignals.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-[#334155]">
              {currentComplianceSignals.map((entry) => (
                <li key={entry.label}>
                  <span className="text-[#64748B]">{entry.label}:</span> {entry.value}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#334155]">No compliance fields currently populated.</p>
          )}
        </article>

        <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
          <h3 className="text-sm font-semibold text-[#0F172A]">Validation / readiness summary</h3>
          <p className="mt-1 text-sm text-[#334155]">
            Readiness status:{" "}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                canSubmit ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {readinessLabel}
            </span>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#334155]">
            <li>Blockers: {validationViolations.length}</li>
            <li>Warnings: {validationWarnings.length}</li>
            <li>Info notes: {validationInfos.length}</li>
          </ul>
          {schemaGapHighlights.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                Schema diagnostics
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                {schemaGapHighlights.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
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
  const draftEditorIsActive = aiSuggestionApplied || draftEditorOpen;
  const hasExistingDraft = Boolean(lastDraftSavedAt);

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-product-editor-page">
      <WalmartPageHeader
        title="Product Editor"
        subtitle="Current Walmart state, AI optimized proposal, and editable MP_MAINTENANCE draft."
        actions={
          <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
            SKU: {product.sku}
          </span>
        }
      />

      <section
        className="sticky top-2 z-20 rounded-2xl border border-[#D9E4F0] bg-white/95 p-3 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-product-editor-tabs"
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {workflowTabs.map((tab) => {
            const active = workflowTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setWorkflowTab(tab.key);
                  if (tab.key === "edit-submit") {
                    setDraftEditorOpen(true);
                  }
                }}
                data-testid={tab.testId}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 transition ${
                  active
                    ? "border-[#0F172A] bg-[#0F172A] text-white"
                    : "border-[#D9E4F0] bg-[#F8FBFF] text-[#475569] hover:border-[#94A3B8] hover:text-[#0F172A]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-product-optimizer-summary"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="shrink-0">
              {displayPrimaryImageUrl ? (
                <img
                  src={displayPrimaryImageUrl}
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
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Current Walmart State</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-[#0F172A]">
                {currentWalmartState.content.productName || displayTitle}
              </h2>
              <p className="mt-1 text-sm text-[#475569]">SKU: {product.sku}</p>
              <div className="mt-3 grid gap-2 text-sm text-[#334155] sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  <span className="text-[#64748B]">Brand:</span>{" "}
                  {currentWalmartState.content.brand || displayBrand}
                </p>
                <p>
                  <span className="text-[#64748B]">Price:</span>{" "}
                  {currentWalmartState.pricingInventory.currentPrice !== null
                    ? `$${currentWalmartState.pricingInventory.currentPrice.toFixed(2)}`
                    : "Not available"}
                </p>
                <p>
                  <span className="text-[#64748B]">Inventory:</span>{" "}
                  {currentWalmartState.pricingInventory.inventory === null
                    ? "Unknown"
                    : currentWalmartState.pricingInventory.inventory}
                </p>
                <p>
                  <span className="text-[#64748B]">Product type:</span>{" "}
                  {currentWalmartState.searchBrowse.productType || "Not available"}
                </p>
                <p className="sm:col-span-2 lg:col-span-1">
                  <span className="text-[#64748B]">Taxonomy placement:</span>{" "}
                  {currentTaxonomyPlacement}
                </p>
              </div>
            </div>
          </div>

          <article className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-3 xl:max-w-[320px]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Hydration + spec diagnostics</p>
              <button
                type="button"
                onClick={handleViewAllIssues}
                className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
              >
                View validation
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-[#334155]">
              <li className="rounded-md bg-white px-2 py-1">
                Hydration source: {currentWalmartState.hydration.source}
              </li>
              <li className="rounded-md bg-white px-2 py-1">
                Hydration status: {currentWalmartState.hydration.status}
              </li>
              <li className="rounded-md bg-white px-2 py-1">
                Hydrated at: {currentWalmartState.hydration.hydratedAt}
              </li>
              {schemaGapHighlights.length > 0 ? (
                schemaGapHighlights.slice(0, 2).map((issue) => (
                  <li key={issue} className="rounded-md bg-white px-2 py-1">
                    {issue}
                  </li>
                ))
              ) : (
                <li className="rounded-md bg-white px-2 py-1">No major schema gaps detected.</li>
              )}
            </ul>
          </article>
        </div>
      </section>

      <section
        className={workflowTab === "review" ? "block" : "hidden"}
        data-testid="ecomviper-walmart-review-panel"
      >
        {currentListingReferenceSections("review")}
      </section>

      <section
        className={workflowTab === "improve" ? "space-y-4" : "hidden space-y-4"}
        data-testid="ecomviper-walmart-improve-panel"
      >
      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-primary-actions"
        ref={inlineAiPanelRef}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">AI Optimized State</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">
              {inlineAiSuggestion ? aiResultHeaderCopy : "Generate AI optimized Walmart-native proposal"}
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              EcomViper will generate proposal updates for product name/title, site description, long description, key features, Search &amp; Browse attributes, supplement fields, FAQ snippets, and media guidance. This tab does not submit to Walmart.
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Proposed product name: {optimizedProposalState.content.productName || "Not generated"}
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
            ? "Optimize title, descriptions, bullets, and search & browse attributes without leaving this page."
            : null}
        </div>

        <div
          className="mt-3 grid gap-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 lg:grid-cols-2"
          data-testid="ecomviper-walmart-schema-gap-analysis"
        >
          <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">Current schema gap analysis</h3>
            <p className="mt-1 text-sm text-[#334155]">Total gaps: {currentSchemaGapCount}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {currentSchemaGapAnalysis.missingRequiredFields
                .slice(0, 3)
                .map((field) => (
                  <li key={`current-required-${field}`}>Missing required: {field}</li>
                ))}
              {currentSchemaGapAnalysis.missingComplianceFields
                .slice(0, 2)
                .map((field) => (
                  <li key={`current-compliance-${field}`}>Missing compliance: {field}</li>
                ))}
              {currentSchemaGapAnalysis.missingSearchableFields
                .slice(0, 2)
                .map((field) => (
                  <li key={`current-searchable-${field}`}>Missing searchable: {field}</li>
                ))}
              {currentSchemaGapAnalysis.missingDiscoverabilityFields
                .slice(0, 2)
                .map((field) => (
                  <li key={`current-discovery-${field}`}>Missing discoverability: {field}</li>
                ))}
              {currentSchemaGapCount === 0 ? <li>No current schema gaps detected.</li> : null}
            </ul>
          </article>
          <article className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">AI proposal schema gap analysis</h3>
            <p className="mt-1 text-sm text-[#334155]">Projected gaps: {proposalSchemaGapCount}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {proposalSchemaGapAnalysis.missingRequiredFields
                .slice(0, 3)
                .map((field) => (
                  <li key={`proposal-required-${field}`}>Missing required: {field}</li>
                ))}
              {proposalSchemaGapAnalysis.missingComplianceFields
                .slice(0, 2)
                .map((field) => (
                  <li key={`proposal-compliance-${field}`}>Missing compliance: {field}</li>
                ))}
              {proposalSchemaGapAnalysis.missingSearchableFields
                .slice(0, 2)
                .map((field) => (
                  <li key={`proposal-searchable-${field}`}>Missing searchable: {field}</li>
                ))}
              {proposalSchemaGapAnalysis.missingDiscoverabilityFields
                .slice(0, 2)
                .map((field) => (
                  <li key={`proposal-discovery-${field}`}>Missing discoverability: {field}</li>
                ))}
              {proposalSchemaGapCount === 0 ? <li>No projected schema gaps.</li> : null}
            </ul>
          </article>
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
                <li>
                  Search &amp; Browse attributes: {Object.keys(form.searchBrowseAttributes).length} →{" "}
                  {Object.keys(inlineAiSuggestion.searchBrowseAttributes ?? {}).length}
                </li>
                <li>
                  Walmart-native proposal fields changed:{" "}
                  {optimizedProposalLayer.optimizationAnalysis.changedFields.length > 0
                    ? optimizedProposalLayer.optimizationAnalysis.changedFields.join(", ")
                    : "none"}
                </li>
                <li>
                  FAQ snippets:{" "}
                  {form.faqSnippets
                    .split("\n")
                    .map((entry) => entry.trim())
                    .filter(Boolean).length}{" "}
                  → {inlineAiSuggestion.faqSnippets?.length ?? 0}
                </li>
                {!displayPrimaryImageUrl ? <li>Image still missing from catalog data.</li> : null}
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
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">
                      Search &amp; Browse attributes
                    </h4>
                    {Object.keys(inlineAiSuggestion.searchBrowseAttributes ?? {}).length ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                        {Object.entries(inlineAiSuggestion.searchBrowseAttributes ?? {}).map(
                          ([key, value]) => (
                            <li key={key}>
                              {key}: {value}
                            </li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-[#334155]">No Search &amp; Browse updates suggested.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">Suggested FAQ snippets</h4>
                    {inlineAiSuggestion.faqSnippets?.length ? (
                      <ul
                        className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]"
                        data-testid="ecomviper-walmart-ai-faq-suggestions"
                      >
                        {inlineAiSuggestion.faqSnippets.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-[#334155]">No FAQ suggestions provided.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F172A]">Media / Alt text guidance</h4>
                    <p className="mt-1 text-sm text-[#334155]">
                      Alt text: {inlineAiSuggestion.altText?.trim() || "Not provided"}
                    </p>
                    {inlineAiSuggestion.mediaRecommendations?.length ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                        {inlineAiSuggestion.mediaRecommendations.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-[#334155]">No media recommendations provided.</p>
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

              {inlineAiSuggestion ? (
                <div
                  className="mt-3 rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm text-[#334155]"
                  data-testid="ecomviper-walmart-ai-apply-diagnostics"
                >
                  <h4 className="text-sm font-semibold text-[#0F172A]">Apply diagnostics</h4>
                  <ul className="mt-2 space-y-1">
                    <li>
                      Facts updated:{" "}
                      {inlineAiDiagnostics.factsUpdated.length
                        ? inlineAiDiagnostics.factsUpdated.join(", ")
                        : "none"}
                    </li>
                    <li>
                      Sources used:{" "}
                      {inlineAiDiagnostics.factsSources.length
                        ? inlineAiDiagnostics.factsSources.join(", ")
                        : "none"}
                    </li>
                    <li>
                      Stale fields cleared/replaced:{" "}
                      {unique([
                        ...inlineAiDiagnostics.staleFieldsReplaced,
                        ...inlineAiDiagnostics.staleFieldsCleared,
                      ]).length
                        ? unique([
                            ...inlineAiDiagnostics.staleFieldsReplaced,
                            ...inlineAiDiagnostics.staleFieldsCleared,
                          ]).join(", ")
                        : "none"}
                    </li>
                    <li>
                      Compliance changes:{" "}
                      {inlineAiDiagnostics.complianceChanges.length
                        ? inlineAiDiagnostics.complianceChanges.join(", ")
                        : "none"}
                    </li>
                    <li>
                      Skipped protected fields:{" "}
                      {inlineAiDiagnostics.skippedProtectedFields.length
                        ? inlineAiDiagnostics.skippedProtectedFields.join(", ")
                        : "none"}
                    </li>
                    <li>
                      Skipped low-confidence fields:{" "}
                      {inlineAiDiagnostics.skippedLowConfidenceFields.length
                        ? inlineAiDiagnostics.skippedLowConfidenceFields.join(", ")
                        : "none"}
                    </li>
                    <li>
                      Image-derived facts status: {inlineAiDiagnostics.imageFactsStatus}
                    </li>
                    <li>
                      Image-derived facts detail:{" "}
                      {inlineAiDiagnostics.imageFactsMessage || "none"}
                    </li>
                    <li>
                      FDA disclaimer status: {inlineAiDiagnostics.disclaimerStatus}
                    </li>
                  </ul>
                </div>
              ) : null}
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
      {currentListingReferenceSections("improve")}
      </section>

      <section
        className={workflowTab === "edit-submit" ? "space-y-4" : "hidden space-y-4"}
        data-testid="ecomviper-walmart-edit-submit-panel"
      >
      <div data-testid="ecomviper-walmart-final-draft-editor">
      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-draft-editor-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Editable Draft State</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Current editable MP_MAINTENANCE draft</h2>
            <p className="mt-1 text-sm text-[#475569]">
              Review AI improvements, fine-tune fields, then save draft before submission approval.
            </p>
          </div>
          {!draftEditorIsActive ? (
            <button
              type="button"
              onClick={() => {
                setWorkflowTab("edit-submit");
                setDraftEditorOpen(true);
              }}
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
        {draftHardening.diagnostics.repairedCount > 0 || draftHardening.diagnostics.droppedCount > 0 ? (
          <p
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            data-testid="ecomviper-walmart-draft-hardening-warning"
          >
            Legacy draft rows were normalized while loading this editor.
            {" "}
            Repaired: {draftHardening.diagnostics.repairedCount}. Dropped:{" "}
            {draftHardening.diagnostics.droppedCount}.
          </p>
        ) : null}
        <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#334155]">
          <p className="font-medium text-[#0F172A]">Draft layer status</p>
          <p className="mt-1">Editable draft product name: {editableDraftState.content.productName || "Not set"}</p>
          <p className="mt-1">
            Fields changed from AI optimized proposal:{" "}
            {editableDraftLayer.changedFromProposalFields.length > 0
              ? editableDraftLayer.changedFromProposalFields.join(", ")
              : "none"}
          </p>
        </div>

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
                        <p>SerpApi key missing. Connect SerpApi to enable automated public Walmart image enrichment.</p>
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

                    {!resolvedPublicImages && persistedDraftImagePreview ? (
                      <div className="mt-3 rounded-lg border border-[#BFDBFE] bg-white p-3">
                        <p className="text-xs text-[#1D4ED8]">
                          Source: {persistedDraftImagePreview.imageSourceLabel}
                        </p>
                        <p className="mt-1 text-xs text-[#334155]">
                          Public product ID: {persistedDraftImagePreview.publicWalmartProductId || "Unknown"}
                        </p>
                        <p className="mt-1 text-xs text-[#334155]">
                          Gallery image count: {persistedDraftImagePreview.imageCount}
                        </p>
                        <p className="mt-1 break-all text-xs text-[#334155]">
                          Primary image URL: {persistedDraftImagePreview.primaryImageUrl || "Not provided"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {persistedDraftImagePreview.galleryImageUrls.slice(0, 4).map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt="Saved draft image preview"
                              className="h-14 w-14 rounded border border-[#D9E4F0] bg-white object-cover"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm text-[#334155] md:col-span-2"
                    data-testid="ecomviper-walmart-generate-product-images"
                  >
                    <p className="font-medium text-[#0F172A]">Generate Product Images</p>
                    <p className="mt-1 text-xs text-[#475569]">
                      Create product images using OpenAI and add approved results to this Walmart listing.
                    </p>

                    {!aiProviderConnected ? (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
                        <p>OpenAI API key not connected. Connect OpenAI to generate product images.</p>
                        <a
                          href="/apps/ecomviper/walmart/connect"
                          className="mt-2 inline-flex rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800"
                        >
                          Connect OpenAI key
                        </a>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-sm text-[#334155]">
                        Image type
                        <select
                          value={generatedImageType}
                          onChange={(event) =>
                            setGeneratedImageType(event.target.value as WalmartGeneratedImageType)
                          }
                          className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                        >
                          {GENERATED_IMAGE_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-[#64748B]">
                          {
                            GENERATED_IMAGE_TYPE_OPTIONS.find(
                              (option) => option.value === generatedImageType
                            )?.description
                          }
                        </p>
                      </label>

                      <label className="text-sm text-[#334155]">
                        Quantity
                        <select
                          value={generatedImageQuantity}
                          onChange={(event) => setGeneratedImageQuantity(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                        >
                          <option value="1">1 image</option>
                          <option value="2">2 images</option>
                        </select>
                      </label>

                      <label className="text-sm text-[#334155] md:col-span-2">
                        Scene/style guidance (optional)
                        <textarea
                          value={generatedImageGuidance}
                          onChange={(event) => setGeneratedImageGuidance(event.target.value)}
                          placeholder="Example: warm bedside table with calming evening mood, premium packaging focus."
                          className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                        />
                      </label>

                      <div className="md:col-span-2 rounded-md border border-[#D9E4F0] bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[#0F172A]">
                            Reference images (optional)
                          </p>
                          <button
                            type="button"
                            onClick={() => referenceFileInputRef.current?.click()}
                            className="rounded border border-[#0F172A] bg-white px-2 py-1 text-xs text-[#0F172A]"
                          >
                            Upload reference images
                          </button>
                          <input
                            ref={referenceFileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleAttachReferenceImages}
                            className="hidden"
                            data-testid="ecomviper-generated-reference-input"
                          />
                        </div>
                        <p className="mt-1 text-xs text-[#64748B]">
                          {generatedImageType === "supplement_facts"
                            ? "Upload a bottle label or supplement-facts reference image for best results."
                            : "Optional reference images can guide product appearance or scene style."}
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                          Accepted formats: PNG, JPEG, WEBP. Use smaller files (about{" "}
                          {formatBytes(MAX_GENERATED_REFERENCE_IMAGE_BYTES)} each,{" "}
                          {formatBytes(MAX_GENERATED_REFERENCE_TOTAL_BYTES)} total) for reliable generation.
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                          {generatedImageType === "supplement_facts"
                            ? "If no upload is provided, EcomViper will try existing product media. Uploading a facts panel is more reliable."
                            : "Lifestyle and hero generations can use references to keep packaging/brand identity aligned."}
                        </p>
                        {generatedReferenceMessage ? (
                          <p className="mt-2 text-xs text-[#334155]">{generatedReferenceMessage}</p>
                        ) : null}
                        {generatedReferenceImages.length > 0 ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {generatedReferenceImages.map((reference) => (
                              <article
                                key={reference.id}
                                className="rounded border border-[#E2E8F0] bg-[#F8FBFF] p-2"
                              >
                                <img
                                  src={reference.dataUrl}
                                  alt={`Reference preview ${reference.name}`}
                                  className="h-20 w-full rounded border border-[#D9E4F0] bg-white object-cover"
                                  loading="lazy"
                                />
                                <p className="mt-1 truncate text-[11px] text-[#334155]">
                                  {reference.name}
                                </p>
                                <p className="mt-1 text-[11px] text-[#64748B]">
                                  {reference.mimeType} · {formatBytes(reference.byteSize)}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReferenceImage(reference.id)}
                                  className="mt-1 rounded border border-[#D9E4F0] bg-white px-2 py-1 text-[11px] text-[#334155]"
                                >
                                  Remove reference
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={() => handleGenerateProductImages()}
                          disabled={!aiProviderConnected || generatingProductImages}
                          className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
                        >
                          {generatingProductImages ? "Generating Images..." : "Generate"}
                        </button>
                      </div>
                    </div>

                    {productImageGenerationMessage ? (
                      <p className="mt-2 text-xs text-[#334155]">
                        {productImageGenerationMessage}
                      </p>
                    ) : null}
                    {productImageGenerationError ? (
                      <div
                        className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-900"
                        data-testid="ecomviper-generated-image-error-details"
                      >
                        <p className="font-medium">Generation diagnostics</p>
                        <p className="mt-1">
                          Code: {productImageGenerationError.code || "unknown"}
                          {productImageGenerationError.category
                            ? ` | Category: ${productImageGenerationError.category}`
                            : ""}
                          {typeof productImageGenerationError.statusCode === "number"
                            ? ` | Status: ${productImageGenerationError.statusCode}`
                            : ""}
                        </p>
                        <p className="mt-1">
                          Mode:{" "}
                          {formatGenerationMode(
                            productImageGenerationError.requestDiagnostics?.generationMode
                          )}
                        </p>
                        <p className="mt-1">
                          Image type:{" "}
                          {productImageGenerationError.requestDiagnostics?.imageType || "unknown"}
                          {" | "}Layout mode:{" "}
                          {formatLayoutMode(
                            productImageGenerationError.requestDiagnostics?.layoutMode
                          )}
                        </p>
                        <p className="mt-1">
                          Layout preservation instruction:{" "}
                          {productImageGenerationError.requestDiagnostics?.layoutPreservationInstruction
                            ? "yes"
                            : "no"}
                          {" | "}User guidance included:{" "}
                          {productImageGenerationError.requestDiagnostics?.userGuidanceIncluded
                            ? "yes"
                            : "no"}
                        </p>
                        <p className="mt-1">
                          Product facts source:{" "}
                          {formatProductFactsSource(
                            productImageGenerationError.requestDiagnostics?.productFactsSource
                          )}
                        </p>
                        <p className="mt-1">
                          Model:{" "}
                          {productImageGenerationError.requestDiagnostics?.model || "unknown"}
                          {" | "}Size:{" "}
                          {productImageGenerationError.requestDiagnostics?.size || "unknown"}
                        </p>
                        <p className="mt-1">
                          Reference images:{" "}
                          {productImageGenerationError.requestDiagnostics?.referenceCount ??
                            generatedReferenceImages.length}
                        </p>
                        {productImageGenerationError.requestDiagnostics?.referenceMimeTypes &&
                        productImageGenerationError.requestDiagnostics?.referenceMimeTypes?.length >
                          0 ? (
                          <p className="mt-1">
                            Reference MIME types:{" "}
                            {productImageGenerationError.requestDiagnostics?.referenceMimeTypes?.join(
                              ", "
                            )}
                          </p>
                        ) : null}
                        {productImageGenerationError.requestDiagnostics?.referenceByteSizes &&
                        productImageGenerationError.requestDiagnostics?.referenceByteSizes?.length >
                          0 ? (
                          <p className="mt-1">
                            Reference sizes:{" "}
                            {productImageGenerationError.requestDiagnostics?.referenceByteSizes
                              ?.map((size) => formatBytes(size))
                              .join(", ")}
                          </p>
                        ) : null}
                        {typeof productImageGenerationError.requestDiagnostics?.width === "number" &&
                        typeof productImageGenerationError.requestDiagnostics?.height === "number" ? (
                          <p className="mt-1">
                            Output dimensions:{" "}
                            {productImageGenerationError.requestDiagnostics?.width}x
                            {productImageGenerationError.requestDiagnostics?.height}
                            {" | "}Square:{" "}
                            {productImageGenerationError.requestDiagnostics?.isSquare ? "yes" : "no"}
                            {productImageGenerationError.requestDiagnostics?.squareNormalized
                              ? " (normalized to square canvas)"
                              : ""}
                          </p>
                        ) : null}
                        {productImageGenerationError.requestDiagnostics?.routePhase ? (
                          <p className="mt-1">
                            Failed phase:{" "}
                            {productImageGenerationError.requestDiagnostics?.routePhase}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-2 rounded-md border border-[#E2E8F0] bg-white px-2 py-2 text-xs text-[#475569]">
                      <p>Approved generated images: {approvedGeneratedMediaAssets.length}</p>
                      <p className="mt-1">
                        Pending previews: {pendingGeneratedMediaAssets.length}
                      </p>
                      <p className="mt-1">
                        Editor state updates immediately after generation and approval.
                      </p>
                    </div>
                    {malformedGeneratedMediaCount > 0 ? (
                      <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
                        {malformedGeneratedMediaCount} malformed generated-media entr
                        {malformedGeneratedMediaCount === 1 ? "y was" : "ies were"} skipped during load.
                      </p>
                    ) : null}

                    {focusedGeneratedMediaAsset ? (
                      <article
                        className="mt-3 rounded-lg border border-[#BFDBFE] bg-white p-3"
                        data-testid="ecomviper-generated-media-focused-preview"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#1D4ED8]">
                          Current generated preview
                        </p>
                        <div className="mt-2 aspect-square w-full overflow-hidden rounded-md border border-[#D9E4F0] bg-white">
                          <img
                            data-testid="ecomviper-generated-media-focused-image"
                            src={focusedGeneratedMediaAsset.previewUrl || focusedGeneratedMediaAsset.url}
                            alt={`${formatGeneratedImageTypeLabel(focusedGeneratedMediaAsset.imageType)} preview`}
                            className="h-full w-full object-contain p-1"
                            loading="lazy"
                            onError={() => handleGeneratedPreviewLoadError(focusedGeneratedMediaAsset)}
                          />
                        </div>
                        <p className="mt-2 text-xs font-medium text-[#0F172A]">
                          {formatGeneratedImageTypeLabel(focusedGeneratedMediaAsset.imageType)}
                        </p>
                        <p className="mt-1 text-[11px] text-[#64748B]">Source: OpenAI generated</p>
                        {typeof focusedGeneratedMediaAsset.width === "number" &&
                        typeof focusedGeneratedMediaAsset.height === "number" ? (
                          <p className="mt-1 text-[11px] text-[#64748B]">
                            Dimensions: {focusedGeneratedMediaAsset.width}x
                            {focusedGeneratedMediaAsset.height}
                            {" | "}Square: {focusedGeneratedMediaAsset.isSquare ? "yes" : "no"}
                            {focusedGeneratedMediaAsset.squareNormalized
                              ? " (normalized to square canvas)"
                              : ""}
                          </p>
                        ) : null}
                        {focusedGeneratedMediaAsset.seoFilename ? (
                          <p className="mt-1 break-all text-[11px] text-[#64748B]">
                            SEO filename: {focusedGeneratedMediaAsset.seoFilename}
                          </p>
                        ) : null}
                        {focusedGeneratedMediaAsset.altText ? (
                          <p className="mt-1 text-[11px] text-[#64748B]">
                            Alt text: {focusedGeneratedMediaAsset.altText}
                          </p>
                        ) : null}
                        {focusedGeneratedMediaAsset.promptSummary ? (
                          <p className="mt-1 text-[11px] text-[#64748B]">
                            Prompt: {focusedGeneratedMediaAsset.promptSummary}
                          </p>
                        ) : null}
                        {generatedPreviewErrors[focusedGeneratedMediaAsset.id] ? (
                          <p className="mt-1 text-[11px] text-amber-700">
                            {generatedPreviewErrors[focusedGeneratedMediaAsset.id]}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a
                            href={focusedGeneratedMediaAsset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#0F172A]"
                          >
                            Open full size
                          </a>
                          {!focusedGeneratedMediaAsset.approved ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleApproveGeneratedMediaAsset(focusedGeneratedMediaAsset.id)
                                }
                                className="rounded border border-[#2563EB] bg-[#2563EB] px-2 py-1 text-xs text-white"
                              >
                                Add to Product Media
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRegenerateGeneratedMediaAsset(focusedGeneratedMediaAsset)
                                }
                                disabled={generatingProductImages}
                                className="rounded border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#0F172A] disabled:opacity-50"
                              >
                                Regenerate
                              </button>
                            </>
                          ) : (
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                              Approved for Walmart
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveGeneratedMediaAsset(focusedGeneratedMediaAsset.id)
                            }
                            className="rounded border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#334155]"
                          >
                            Remove draft preview
                          </button>
                        </div>
                      </article>
                    ) : null}

                    {form.generatedMediaAssets.length > 0 ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {form.generatedMediaAssets.map((asset) => (
                          <article
                            key={asset.id}
                            className="rounded-lg border border-[#E2E8F0] bg-white p-2"
                          >
                            <div className="aspect-square w-full overflow-hidden rounded-md border border-[#D9E4F0] bg-[#F8FBFF]">
                              <img
                                src={asset.previewUrl || asset.url}
                                alt={`${formatGeneratedImageTypeLabel(asset.imageType)} preview`}
                                className="h-full w-full object-contain p-1"
                                loading="lazy"
                                onError={() => handleGeneratedPreviewLoadError(asset)}
                              />
                            </div>
                            <p className="mt-2 text-xs font-medium text-[#0F172A]">
                              {formatGeneratedImageTypeLabel(asset.imageType)}
                            </p>
                            <p className="mt-1 text-[11px] text-[#64748B]">
                              Source: OpenAI generated
                            </p>
                            {asset.seoFilename ? (
                              <p className="mt-1 break-all text-[11px] text-[#64748B]">
                                SEO filename: {asset.seoFilename}
                              </p>
                            ) : null}
                            <p className="mt-1 break-all text-[11px] text-[#64748B]">
                              URL: {asset.url}
                            </p>
                            {generatedPreviewErrors[asset.id] ? (
                              <p className="mt-1 text-[11px] text-amber-700">
                                {generatedPreviewErrors[asset.id]}
                              </p>
                            ) : null}
                            {asset.promptSummary ? (
                              <p className="mt-1 text-[11px] text-[#64748B]">
                                Prompt: {asset.promptSummary}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-[#64748B]">
                              Created: {asset.createdAt}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setFocusedGeneratedAssetId(asset.id)}
                                className="rounded border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#0F172A]"
                              >
                                View preview
                              </button>
                              <a
                                href={asset.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#0F172A]"
                              >
                                Open full size
                              </a>
                              {!asset.approved ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveGeneratedMediaAsset(asset.id)}
                                    className="rounded border border-[#2563EB] bg-[#2563EB] px-2 py-1 text-xs text-white"
                                  >
                                    Add to Product Media
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateGeneratedMediaAsset(asset)}
                                    disabled={generatingProductImages}
                                    className="rounded border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#0F172A] disabled:opacity-50"
                                  >
                                    Regenerate
                                  </button>
                                </>
                              ) : (
                                <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                                  Approved for Walmart
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveGeneratedMediaAsset(asset.id)}
                                className="rounded border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#334155]"
                              >
                                Remove draft preview
                              </button>
                            </div>
                          </article>
                        ))}
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
                    <p>Image sync status: {formatImageStatus(scoringProduct)}</p>
                    <p className="mt-1">Source: {formatImageSource(scoringProduct)}</p>
                    <p className="mt-1">Gallery images: {displayGalleryPreviewUrls.length}</p>
                    <p className="mt-1">Variant images: {displayVariantPreviewUrls.length}</p>
                    <p className="mt-1">Approved generated images: {approvedGeneratedMediaUrls.length}</p>
                    {isShopifyMediaSource ? (
                      <>
                        <p className="mt-1">
                          Imported Shopify media images: {importedShopifyMediaImageCount}
                        </p>
                        {missingShopifyAdditionalImageReason ? (
                          <p className="mt-1">
                            Reason additional images are blank:{" "}
                            {missingShopifyAdditionalImageReason}
                          </p>
                        ) : null}
                      </>
                    ) : null}
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

              {activeTab === "Search & Browse" ? (
                <>
                  <h3
                    className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]"
                    data-testid="ecomviper-walmart-search-browse-section"
                  >
                    Search &amp; Browse
                  </h3>
                  <p className="md:col-span-2 text-xs text-[#475569]">
                    These structured attributes help Walmart understand where your product belongs in search and browse.
                    Blank fields are omitted from submit payloads.
                  </p>
                  <p className="md:col-span-2 text-xs text-[#475569]">
                    Image-derived facts status: {resolvedImageFactsStatus}. {resolvedImageFactsMessage}
                  </p>
                  <div className="md:col-span-2 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
                    <p className="font-medium text-[#0F172A]">
                      {resolvedImageFactsStatus === "needs_vision_extraction"
                        ? "Images are available, but label text has not been extracted yet."
                        : resolvedImageFactsStatus === "extracted"
                        ? "Image label facts extracted. Review confidence before final submit."
                        : resolvedImageFactsStatus === "unavailable"
                        ? "Image fact extraction is unavailable."
                        : "Image fact extraction is pending review."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExtractLabelFacts}
                        disabled={extractingLabelFacts}
                        className="rounded border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs text-[#0F172A] disabled:opacity-60"
                        data-testid="ecomviper-walmart-extract-label-facts-button"
                      >
                        {extractingLabelFacts
                          ? "Extracting label facts..."
                          : "Extract label facts from images"}
                      </button>
                      {labelFactsMessage ? (
                        <p className="text-xs text-[#475569]">{labelFactsMessage}</p>
                      ) : null}
                    </div>
                  </div>
                  {(
                    [
                      "product_identity",
                      "audience_usage",
                      "ingredients_form",
                      "dimensions_packaging",
                      "search_browse_metadata",
                    ] as const
                  ).map((group) => {
                    const fields = searchBrowseFieldsByGroup.get(group) ?? [];
                    if (fields.length === 0) return null;

                    return (
                      <div key={group} className="md:col-span-2 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                          {searchBrowseGroupLabel(group)}
                        </h4>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {fields.map((field) => {
                            const value = form.searchBrowseAttributes[field.key] ?? "";
                            const invalidNumberUnit =
                              field.type === "number-unit" && !isValidNumberUnitValue(value);
                            const commonClass = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                              invalidNumberUnit
                                ? "border-amber-300 bg-amber-50"
                                : "border-[#D9E4F0] bg-white"
                            }`;

                            if (field.type === "textarea") {
                              return (
                                <label key={field.key} className="text-sm text-[#334155] md:col-span-2">
                                  {field.label}
                                  <textarea
                                    value={value}
                                    onChange={(event) =>
                                      patchSearchBrowseField(field.key, event.target.value)
                                    }
                                    placeholder={field.placeholder}
                                    className={`${commonClass} min-h-20`}
                                  />
                                  {field.helperText ? (
                                    <p className="mt-1 text-xs text-[#64748B]">{field.helperText}</p>
                                  ) : null}
                                  {invalidNumberUnit ? (
                                    <p className="mt-1 text-xs text-amber-700">
                                      Use number-only or number + unit (for example, 4.5 in).
                                    </p>
                                  ) : null}
                                </label>
                              );
                            }

                            if (field.type === "select" && field.options?.length) {
                              return (
                                <label key={field.key} className="text-sm text-[#334155]">
                                  {field.label}
                                  <select
                                    value={value}
                                    onChange={(event) =>
                                      patchSearchBrowseField(field.key, event.target.value)
                                    }
                                    className={commonClass}
                                  >
                                    <option value="">Select</option>
                                    {field.options.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                  {field.helperText ? (
                                    <p className="mt-1 text-xs text-[#64748B]">{field.helperText}</p>
                                  ) : null}
                                </label>
                              );
                            }

                            return (
                              <label key={field.key} className="text-sm text-[#334155]">
                                {field.label}
                                <input
                                  value={value}
                                  onChange={(event) =>
                                    patchSearchBrowseField(field.key, event.target.value)
                                  }
                                  placeholder={field.placeholder}
                                  className={commonClass}
                                />
                                {field.helperText ? (
                                  <p className="mt-1 text-xs text-[#64748B]">{field.helperText}</p>
                                ) : null}
                                {invalidNumberUnit ? (
                                  <p className="mt-1 text-xs text-amber-700">
                                    Use number-only or number + unit (for example, 4.5 in).
                                  </p>
                                ) : null}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <label className="text-sm text-[#334155] md:col-span-2">
                    Media recommendations (staged notes)
                    <textarea
                      value={form.mediaRecommendations}
                      onChange={(event) => patchForm({ mediaRecommendations: event.target.value })}
                      className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                      placeholder="Front bottle image, supplement facts image..."
                    />
                  </label>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    Alt text guidance
                    <input
                      value={form.altText}
                      onChange={(event) => patchForm({ altText: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                      placeholder="Full product entity-rich alt text"
                    />
                  </label>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    Compliance notes
                    <textarea
                      value={form.complianceNotes}
                      onChange={(event) => patchForm({ complianceNotes: event.target.value })}
                      className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                      placeholder="Keep factual claims aligned to product label."
                    />
                  </label>
                </>
              ) : null}

              {activeTab === "FAQ" ? (
                <>
                  <h3
                    className="md:col-span-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]"
                    data-testid="ecomviper-walmart-faq-section"
                  >
                    FAQ
                  </h3>
                  <div className="md:col-span-2 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm text-[#334155]">
                    <p className="text-xs uppercase tracking-[0.08em] text-[#64748B]">
                      FAQ status
                    </p>
                    <p className="mt-1 text-sm text-[#334155]">
                      {inlineAiDiagnostics.faqGenerationState === "pending"
                        ? "FAQ generation pending label extraction or product facts review."
                        : "FAQ suggestions are draft enrichment notes. Keep answers product-specific and fact-grounded before submit."}
                    </p>
                  </div>
                  <label className="text-sm text-[#334155] md:col-span-2">
                    FAQ snippets (5 to 8 product-specific entries)
                    <textarea
                      value={form.faqSnippets}
                      onChange={(event) => patchForm({ faqSnippets: event.target.value })}
                      className="mt-1 min-h-40 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                      placeholder={`Q: What is this product? A: ...\nQ: How do I take it? A: ...`}
                      data-testid="ecomviper-walmart-faq-textarea"
                    />
                    <p className="mt-1 text-xs text-[#64748B]">
                      Keep FAQ entries product-specific, compliant, and grounded in label-backed facts.
                    </p>
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
      </div>

      <section
        id="walmart-product-readiness"
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ecomviper-walmart-readiness"
      >
        <h2 className="text-lg font-semibold text-[#0F172A]">Readiness & validation</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Validation is checked continuously and before Submit Update.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
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

          <article className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">Validation info</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {validationInfos.length ? (
                validationInfos.map((entry) => <li key={entry}>{entry}</li>)
              ) : (
                <li>No additional guidance.</li>
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
