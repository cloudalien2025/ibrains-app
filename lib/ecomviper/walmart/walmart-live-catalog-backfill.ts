import "server-only";

import crypto from "crypto";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import { requestWalmartTokenForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import {
  getSerpApiCredentialsForUser,
  searchWalmartProductCandidatesViaSerpApi,
} from "@/lib/ecomviper/walmart/serpapi-walmart-images";
import {
  resolveCanonicalWalmartIdentifierFromProductRecord,
  isLikelyGtinOrUpc,
} from "@/lib/ecomviper/walmart/walmart-public-identifier";
import {
  buildWalmartPublicListingUrlFromItemId,
  normalizeWalmartPublicListingUrl,
} from "@/lib/ecomviper/walmart/walmart-public-listing-url";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import type { WalmartNativeState } from "@/lib/ecomviper/walmart/walmart-native-state";
import {
  scoreWalmartCatalogCandidate,
  type WalmartCatalogCandidateForScoring,
  type WalmartCatalogCandidateScore,
  type WalmartCatalogExpectedMatch,
  type WalmartCatalogMatchConfidence,
} from "@/lib/ecomviper/walmart/walmart-catalog-candidate-scoring";
import {
  buildWalmartSourceConfidenceRows,
  classifyWalmartFieldSourceConfidence,
  summarizeWalmartSourceConfidence,
  type WalmartCatalogBackfillFieldPatch,
  type WalmartCatalogBackfillSourceConfidence,
  type WalmartFieldSourceLabel,
} from "@/lib/ecomviper/walmart/walmart-source-confidence";

const BACKFILL_TIMEOUT_MS = 10_000;

export type WalmartCatalogBackfillStatus =
  | "skipped_no_identifier"
  | "skipped_no_credentials"
  | "matched"
  | "no_match"
  | "ambiguous"
  | "provider_error"
  | "validation_blocked";

type WalmartCatalogBackfillProviderStatus = "ok" | "no_credentials" | "error";

export type WalmartCatalogBackfillProviderSource =
  | "walmart_item_api"
  | "walmart_item_search"
  | "walmart_public_catalog"
  | "serpapi_public_listing"
  | "fixture";

export type WalmartCatalogBackfillCredentialMode = "mock" | "byo_live" | "unavailable";

interface WalmartCatalogBackfillCurrentFields {
  productName: string;
  siteDescription: string;
  longDescription: string;
  keyFeatures: string[];
  brand: string;
  manufacturer: string;
  price: number | null;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  category: string;
  publicWalmartUrl: string;
  publicWalmartItemId: string;
  upc: string;
  gtin: string;
}

type WalmartCatalogBackfillFieldName = keyof WalmartCatalogBackfillCurrentFields;

interface WalmartCatalogBackfillFieldSourceHints {
  [field: string]: WalmartFieldSourceLabel | undefined;
}

export interface WalmartCatalogBackfillInput {
  sku: string;
  title: string;
  brand: string;
  manufacturer: string;
  category: string;
  packCount: string;
  sizeHint: string;
  itemId: string;
  upc: string;
  gtin: string;
  canonicalPublicUrl: string;
  currentFields: WalmartCatalogBackfillCurrentFields;
  currentFieldSources: WalmartCatalogBackfillFieldSourceHints;
  userDraftFields: Partial<WalmartCatalogBackfillCurrentFields>;
}

export interface WalmartCatalogBackfillCandidate
  extends Omit<WalmartCatalogCandidateForScoring, "source">,
    WalmartCatalogCandidateScore {
  source: WalmartCatalogBackfillProviderSource;
  canonicalPublicUrl: string | null;
}

export interface WalmartCatalogBackfillDiagnostic {
  code: string;
  message: string;
  source: string;
}

export interface WalmartCatalogBackfillProviderCandidate {
  source: WalmartCatalogBackfillProviderSource;
  payload: Record<string, unknown>;
}

export interface WalmartCatalogBackfillProviderResponse {
  status: WalmartCatalogBackfillProviderStatus;
  credentialMode: WalmartCatalogBackfillCredentialMode;
  candidates: WalmartCatalogBackfillProviderCandidate[];
  diagnostics: WalmartCatalogBackfillDiagnostic[];
  warnings: string[];
}

export interface WalmartCatalogBackfillProvider {
  providerName: string;
  fetchCandidates(input: WalmartCatalogBackfillInput): Promise<WalmartCatalogBackfillProviderResponse>;
}

export interface WalmartCatalogBackfillSourceSummary {
  winningSource: WalmartCatalogBackfillProviderSource | "unavailable";
  sourceLabel: string;
  retrievedAt: string;
  credentialMode: WalmartCatalogBackfillCredentialMode;
}

export interface WalmartCatalogBackfillResult {
  status: WalmartCatalogBackfillStatus;
  canonicalItemId: string | null;
  canonicalPublicUrl: string | null;
  matchConfidence: WalmartCatalogMatchConfidence;
  selectedCandidate: WalmartCatalogBackfillCandidate | null;
  candidates: WalmartCatalogBackfillCandidate[];
  fieldPatches: WalmartCatalogBackfillFieldPatch[];
  sourceConfidence: WalmartCatalogBackfillSourceConfidence;
  diagnostics: WalmartCatalogBackfillDiagnostic[];
  warnings: string[];
  sourceSummary: WalmartCatalogBackfillSourceSummary;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const candidate = asText(value);
    if (candidate) return candidate;
  }
  return "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function toCanonicalItemId(itemId: string, url: string): string {
  const fromUrl = resolveCanonicalItemIdFromUrl(url);
  if (fromUrl) return fromUrl;
  return /^\d{6,20}$/.test(itemId.trim()) ? itemId.trim() : "";
}

function resolveCanonicalItemIdFromUrl(value: string): string {
  const normalized = normalizeWalmartPublicListingUrl(value);
  if (!normalized) return "";
  const matched = normalized.match(/\/ip\/(\d{6,20})$/);
  return matched?.[1] ?? "";
}

function hasIdentifier(input: WalmartCatalogBackfillInput): boolean {
  return Boolean(
    input.itemId.trim() ||
      input.upc.trim() ||
      input.gtin.trim() ||
      input.canonicalPublicUrl.trim() ||
      input.title.trim()
  );
}

function preferredSourceLabel(source: WalmartCatalogBackfillProviderSource | "unavailable"): string {
  if (source === "walmart_item_api") return "Walmart Item API";
  if (source === "walmart_item_search") return "Walmart Item Search";
  if (source === "walmart_public_catalog") return "Walmart public catalog";
  if (source === "serpapi_public_listing") return "SerpApi public listing";
  if (source === "fixture") return "Fixture provider";
  return "Unavailable";
}

function firstMeaningfulList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return unique(value.map((entry) => asText(entry)).filter(Boolean));
  }
  if (typeof value === "string") {
    return unique(
      value
        .split(/\r?\n|[;|]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
  }
  return [];
}

function extractCandidateImages(payload: Record<string, unknown>): { primary: string; gallery: string[] } {
  const imageInfo = asObject(payload.imageInfo);
  const media = asObject(payload.media);
  const content = asObject(payload.content);
  const galleryRows = [
    ...asObjectArray(payload.images),
    ...asObjectArray(payload.assets),
    ...asObjectArray(imageInfo?.allImages),
    ...asObjectArray(imageInfo?.images),
    ...asObjectArray(media?.images),
    ...asObjectArray(content?.images),
  ];
  const gallery = unique(
    [
      firstNonEmpty(payload.imageUrl, payload.mainImageUrl, imageInfo?.primaryImageUrl),
      ...galleryRows.flatMap((entry) => [
        asText(entry.url),
        asText(entry.imageUrl),
        asText(entry.thumbnail),
        asText(entry.assetUrl),
      ]),
    ].filter((entry) => /^https?:\/\//i.test(entry))
  );

  return {
    primary: gallery[0] ?? "",
    gallery,
  };
}

function normalizeCandidate(input: {
  source: WalmartCatalogBackfillProviderSource;
  payload: Record<string, unknown>;
}): WalmartCatalogBackfillCandidate {
  const payload = input.payload;
  const product = asObject(payload.product);
  const content = asObject(payload.content);
  const identifiers = asObject(payload.identifiers) ?? asObject(payload.productIdentifiers);
  const { primary, gallery } = extractCandidateImages(payload);

  const itemId = firstNonEmpty(
    payload.itemId,
    payload.usItemId,
    payload.productId,
    payload.id,
    identifiers?.itemId,
    identifiers?.usItemId
  );
  const candidateUrl = normalizeWalmartPublicListingUrl(
    firstNonEmpty(
      payload.itemPageUrl,
      payload.productPageUrl,
      payload.productUrl,
      payload.canonicalUrl,
      payload.url,
      payload.itemUrl,
      content?.itemPageUrl
    )
  );

  const keyFeatures = firstMeaningfulList(
    payload.keyFeatures ?? payload.bulletPoints ?? payload.features ?? content?.keyFeatures
  );

  return {
    source: input.source,
    itemId,
    sku: firstNonEmpty(payload.sku, identifiers?.sku),
    upc: firstNonEmpty(payload.upc, identifiers?.upc),
    gtin: firstNonEmpty(payload.gtin, identifiers?.gtin),
    title: firstNonEmpty(payload.productName, payload.title, payload.name, product?.title),
    brand: firstNonEmpty(payload.brand, payload.brandName, product?.brand),
    manufacturer: firstNonEmpty(
      payload.manufacturer,
      payload.manufacturerName,
      payload.manufacturer_name,
      product?.manufacturer
    ),
    category: firstNonEmpty(payload.category, payload.categoryPath, payload.taxonomy),
    shortDescription: firstNonEmpty(
      payload.shortDescription,
      payload.siteDescription,
      payload.synopsis,
      content?.shortDescription
    ),
    longDescription: firstNonEmpty(
      payload.longDescription,
      payload.fullDescription,
      payload.description,
      content?.longDescription,
      content?.description
    ),
    keyFeatures,
    price: asNumber(payload.price) ?? asNumber(asObject(payload.priceInfo)?.currentPrice),
    primaryImageUrl: primary,
    galleryImageUrls: gallery,
    raw: payload,
    canonicalPublicUrl:
      candidateUrl ?? (itemId ? buildWalmartPublicListingUrlFromItemId(itemId) : null),
    score: 0,
    confidence: "none",
    reasons: [],
    blockers: [],
    matchedFields: [],
    exactIdentifierMatch: false,
  };
}

function expectedFromInput(input: WalmartCatalogBackfillInput): WalmartCatalogExpectedMatch {
  return {
    itemId: input.itemId,
    sku: input.sku,
    upc: input.upc,
    gtin: input.gtin,
    title: input.title,
    brand: input.brand,
    manufacturer: input.manufacturer,
    category: input.category,
    packCount: input.packCount,
    sizeHint: input.sizeHint,
  };
}

function normalizeCurrentSource(value: WalmartFieldSourceLabel | undefined): WalmartFieldSourceLabel {
  return value ?? "unknown";
}

function mapProviderSourceToFieldSource(source: WalmartCatalogBackfillProviderSource): WalmartFieldSourceLabel {
  if (source === "walmart_item_api") return "walmart_item_api";
  if (source === "walmart_item_search") return "walmart_item_search";
  if (source === "serpapi_public_listing") return "serpapi_public_listing";
  return "walmart_public_catalog";
}

function hasUserEditedValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.some((entry) => hasUserEditedValue(entry));
  return false;
}

function buildFieldPatches(input: {
  selected: WalmartCatalogBackfillCandidate | null;
  backfillInput: WalmartCatalogBackfillInput;
}): WalmartCatalogBackfillFieldPatch[] {
  if (!input.selected) return [];

  const selected = input.selected;
  const proposedSource = mapProviderSourceToFieldSource(selected.source);
  const mapping: Array<{
    field: WalmartCatalogBackfillFieldName;
    proposed: string | number | string[] | null;
  }> = [
    { field: "productName", proposed: selected.title || null },
    { field: "siteDescription", proposed: selected.shortDescription || null },
    { field: "longDescription", proposed: selected.longDescription || null },
    { field: "keyFeatures", proposed: selected.keyFeatures.length > 0 ? selected.keyFeatures : null },
    { field: "brand", proposed: selected.brand || null },
    { field: "manufacturer", proposed: selected.manufacturer || null },
    { field: "price", proposed: selected.price },
    { field: "primaryImageUrl", proposed: selected.primaryImageUrl || null },
    {
      field: "galleryImageUrls",
      proposed: selected.galleryImageUrls.length > 0 ? selected.galleryImageUrls : null,
    },
    { field: "category", proposed: selected.category || null },
    { field: "publicWalmartUrl", proposed: selected.canonicalPublicUrl || null },
    { field: "publicWalmartItemId", proposed: selected.itemId || null },
    { field: "upc", proposed: selected.upc || null },
    { field: "gtin", proposed: selected.gtin || null },
  ];

  return mapping.map((entry) => {
    const currentValue = input.backfillInput.currentFields[entry.field];
    const currentSource = normalizeCurrentSource(input.backfillInput.currentFieldSources[entry.field]);
    const sellerNativePresent = currentSource === "seller_native";
    const userEditedValue = input.backfillInput.userDraftFields[entry.field];
    const userEdited = typeof userEditedValue !== "undefined" && hasUserEditedValue(userEditedValue);

    return classifyWalmartFieldSourceConfidence({
      field: entry.field,
      currentValue,
      currentSource,
      proposedValue: entry.proposed,
      proposedSource,
      candidateConfidence: selected.confidence,
      sellerNativePresent,
      userEdited,
    });
  });
}

function chooseStatus(input: {
  selected: WalmartCatalogBackfillCandidate | null;
  ranked: WalmartCatalogBackfillCandidate[];
  canonicalItemId: string;
}): WalmartCatalogBackfillStatus {
  if (!input.selected) return "no_match";
  if (input.selected.confidence === "none") return "no_match";

  const runnerUp = input.ranked[1] ?? null;
  if (
    runnerUp &&
    !input.selected.exactIdentifierMatch &&
    input.selected.score >= 35 &&
    runnerUp.score >= 35 &&
    Math.abs(input.selected.score - runnerUp.score) <= 7
  ) {
    return "ambiguous";
  }

  if (input.canonicalItemId && !input.selected.itemId) {
    return "validation_blocked";
  }

  return "matched";
}

function inferMatchConfidence(
  status: WalmartCatalogBackfillStatus,
  selected: WalmartCatalogBackfillCandidate | null
): WalmartCatalogMatchConfidence {
  if (status !== "matched" || !selected) return "none";
  return selected.confidence;
}

export function buildWalmartCatalogBackfillInputFromProduct(input: {
  product: WalmartProductRecord;
  currentWalmartState: WalmartNativeState;
  userDraftPayload?: Record<string, unknown> | null;
}): WalmartCatalogBackfillInput {
  const resolved = resolveCanonicalWalmartIdentifierFromProductRecord({
    product: input.product,
  });
  const canonicalItemId = resolved.preferredWalmartProductId;
  const canonicalPublicUrl =
    resolved.normalizedPublicWalmartUrl ||
    buildWalmartPublicListingUrlFromItemId(canonicalItemId) ||
    "";
  const userDraft = asObject(input.userDraftPayload);

  const readDraft = (key: string): string => firstNonEmpty(userDraft?.[key]);
  const readDraftList = (key: string): string[] => firstMeaningfulList(userDraft?.[key]);

  return {
    sku: input.product.sku,
    title: input.currentWalmartState.content.productName || input.product.title || "",
    brand: input.currentWalmartState.content.brand || input.product.brand || "",
    manufacturer: input.currentWalmartState.content.manufacturer || "",
    category: input.product.category || "",
    packCount: firstNonEmpty(
      input.product.searchBrowseAttributes?.count_per_pack,
      input.product.attributes?.count_per_pack,
      input.currentWalmartState.searchBrowse.countPerPack
    ),
    sizeHint: firstNonEmpty(
      input.product.searchBrowseAttributes?.serving_size,
      input.product.attributes?.serving_size,
      input.currentWalmartState.searchBrowse.servingSize
    ),
    itemId: canonicalItemId || input.currentWalmartState.media.publicWalmartItemId || "",
    upc: resolved.upc || "",
    gtin: resolved.gtin || "",
    canonicalPublicUrl: canonicalPublicUrl || input.currentWalmartState.media.publicWalmartUrl || "",
    currentFields: {
      productName: input.currentWalmartState.content.productName || "",
      siteDescription: input.currentWalmartState.content.siteDescription || "",
      longDescription: input.currentWalmartState.content.longDescription || "",
      keyFeatures: input.currentWalmartState.content.keyFeatures ?? [],
      brand: input.currentWalmartState.content.brand || "",
      manufacturer: input.currentWalmartState.content.manufacturer || "",
      price: input.currentWalmartState.pricingInventory.currentPrice,
      primaryImageUrl: input.currentWalmartState.media.primaryImageUrl || "",
      galleryImageUrls: input.currentWalmartState.media.galleryImageUrls ?? [],
      category: input.product.category || "",
      publicWalmartUrl: input.currentWalmartState.media.publicWalmartUrl || "",
      publicWalmartItemId: input.currentWalmartState.media.publicWalmartItemId || "",
      upc: resolved.upc || "",
      gtin: resolved.gtin || "",
    },
    currentFieldSources: {
      productName: input.currentWalmartState.content.productName ? "seller_native" : "unknown",
      siteDescription:
        input.product.shortDescription?.trim() || input.product.longDescription?.trim()
          ? "seller_native"
          : "fallback",
      longDescription: input.product.longDescription?.trim() ? "seller_native" : "fallback",
      keyFeatures: (input.product.bulletPoints ?? []).length > 0 ? "seller_native" : "fallback",
      brand: input.product.brand?.trim() ? "seller_native" : "fallback",
      manufacturer:
        input.product.searchBrowseAttributes?.manufacturer?.trim() ||
        input.product.attributes?.manufacturer?.trim()
          ? "seller_native"
          : "fallback",
      price: typeof input.product.price === "number" ? "seller_native" : "fallback",
      primaryImageUrl: input.product.imageUrl?.trim() ? "seller_native" : "fallback",
      galleryImageUrls: (input.product.galleryImageUrls ?? []).length > 0 ? "seller_native" : "fallback",
      category: input.product.category?.trim() ? "seller_native" : "fallback",
      publicWalmartUrl:
        input.currentWalmartState.media.publicWalmartListingSource === "unavailable"
          ? "unknown"
          : "walmart_public_catalog",
      publicWalmartItemId:
        input.currentWalmartState.media.publicWalmartListingSource === "unavailable"
          ? "unknown"
          : "walmart_public_catalog",
      upc: resolved.upc ? "seller_native" : "unknown",
      gtin: resolved.gtin ? "seller_native" : "unknown",
    },
    userDraftFields: {
      productName: readDraft("title"),
      siteDescription: readDraft("shortDescription"),
      longDescription: readDraft("longDescription"),
      keyFeatures: readDraftList("bulletPoints"),
      brand: readDraft("brand"),
      manufacturer: firstNonEmpty(readDraft("manufacturer"), readDraft("manufacturerName")),
      price: asNumber(userDraft?.price),
      primaryImageUrl: firstNonEmpty(readDraft("imageUrl"), readDraft("primaryImageUrl")),
      galleryImageUrls: readDraftList("galleryImageUrls"),
      category: readDraft("category"),
      publicWalmartUrl: readDraft("publicWalmartUrl"),
      publicWalmartItemId: firstNonEmpty(readDraft("publicWalmartProductId"), readDraft("publicWalmartItemId")),
      upc: readDraft("upc"),
      gtin: readDraft("gtin"),
    },
  };
}

function toUnavailableResult(input: {
  status: WalmartCatalogBackfillStatus;
  input: WalmartCatalogBackfillInput;
  diagnostics?: WalmartCatalogBackfillDiagnostic[];
  warnings?: string[];
  credentialMode: WalmartCatalogBackfillCredentialMode;
}): WalmartCatalogBackfillResult {
  const canonicalItemId = toCanonicalItemId(input.input.itemId, input.input.canonicalPublicUrl) || null;
  const canonicalPublicUrl =
    normalizeWalmartPublicListingUrl(input.input.canonicalPublicUrl) ??
    buildWalmartPublicListingUrlFromItemId(canonicalItemId) ??
    null;

  return {
    status: input.status,
    canonicalItemId,
    canonicalPublicUrl,
    matchConfidence: "none",
    selectedCandidate: null,
    candidates: [],
    fieldPatches: [],
    sourceConfidence: summarizeWalmartSourceConfidence({
      fieldPatches: [],
      overallConfidence: "none",
    }),
    diagnostics: input.diagnostics ?? [],
    warnings: input.warnings ?? [],
    sourceSummary: {
      winningSource: "unavailable",
      sourceLabel: "Unavailable",
      retrievedAt: new Date().toISOString(),
      credentialMode: input.credentialMode,
    },
  };
}

function rankCandidates(input: {
  candidates: WalmartCatalogBackfillCandidate[];
  expected: WalmartCatalogExpectedMatch;
  requiresDirectItemId: boolean;
}): WalmartCatalogBackfillCandidate[] {
  const ranked = input.candidates.map((candidate) => {
    const score = scoreWalmartCatalogCandidate({
      candidate,
      expected: input.expected,
      requiresDirectItemId: input.requiresDirectItemId,
    });
    return {
      ...candidate,
      ...score,
    };
  });

  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftTitle = left.title.toLowerCase();
    const rightTitle = right.title.toLowerCase();
    if (leftTitle !== rightTitle) return leftTitle.localeCompare(rightTitle);
    return left.itemId.localeCompare(right.itemId);
  });
  return ranked;
}

export async function runWalmartCatalogBackfillPreview(input: {
  backfillInput: WalmartCatalogBackfillInput;
  provider: WalmartCatalogBackfillProvider;
}): Promise<WalmartCatalogBackfillResult> {
  const backfillInput = input.backfillInput;
  const canonicalItemId =
    toCanonicalItemId(backfillInput.itemId, backfillInput.canonicalPublicUrl) || null;
  const canonicalPublicUrl =
    normalizeWalmartPublicListingUrl(backfillInput.canonicalPublicUrl) ??
    buildWalmartPublicListingUrlFromItemId(canonicalItemId) ??
    null;

  if (!hasIdentifier(backfillInput)) {
    return toUnavailableResult({
      status: "skipped_no_identifier",
      input: backfillInput,
      diagnostics: [
        {
          code: "skipped_no_identifier",
          message: "No Walmart item ID, GTIN, UPC, canonical URL, or title was available.",
          source: "backfill",
        },
      ],
      warnings: [],
      credentialMode: "unavailable",
    });
  }

  if (backfillInput.itemId && !/^\d{6,20}$/.test(backfillInput.itemId) && !canonicalItemId) {
    return toUnavailableResult({
      status: "validation_blocked",
      input: backfillInput,
      diagnostics: [
        {
          code: "validation_blocked",
          message: "Provided Walmart item ID was invalid and could not be normalized.",
          source: "backfill",
        },
      ],
      warnings: [],
      credentialMode: "unavailable",
    });
  }

  const providerResponse = await input.provider.fetchCandidates(backfillInput);
  if (providerResponse.status === "no_credentials") {
    return toUnavailableResult({
      status: "skipped_no_credentials",
      input: backfillInput,
      diagnostics: providerResponse.diagnostics,
      warnings: providerResponse.warnings,
      credentialMode: providerResponse.credentialMode,
    });
  }
  if (providerResponse.status === "error") {
    return toUnavailableResult({
      status: "provider_error",
      input: backfillInput,
      diagnostics: providerResponse.diagnostics,
      warnings: providerResponse.warnings,
      credentialMode: providerResponse.credentialMode,
    });
  }

  const normalizedCandidates = providerResponse.candidates.map((candidate) =>
    normalizeCandidate({
      source: candidate.source,
      payload: candidate.payload,
    })
  );
  const expected = expectedFromInput(backfillInput);
  const ranked = rankCandidates({
    candidates: normalizedCandidates,
    expected,
    requiresDirectItemId: Boolean(canonicalItemId),
  });
  const selected = ranked[0] ?? null;
  const status = chooseStatus({
    selected,
    ranked,
    canonicalItemId: canonicalItemId ?? "",
  });
  const matchConfidence = inferMatchConfidence(status, selected);
  const fieldPatches = buildFieldPatches({
    selected: status === "matched" ? selected : null,
    backfillInput,
  });
  const sourceConfidence = summarizeWalmartSourceConfidence({
    fieldPatches,
    overallConfidence: matchConfidence,
  });

  const selectedCanonicalItemId = selected?.itemId || canonicalItemId || null;
  const selectedCanonicalUrl =
    selected?.canonicalPublicUrl ||
    canonicalPublicUrl ||
    buildWalmartPublicListingUrlFromItemId(selectedCanonicalItemId) ||
    null;
  const winningSource =
    status === "matched" && selected ? selected.source : providerResponse.candidates[0]?.source ?? "unavailable";

  return {
    status,
    canonicalItemId: selectedCanonicalItemId,
    canonicalPublicUrl: selectedCanonicalUrl,
    matchConfidence,
    selectedCandidate: status === "matched" ? selected : null,
    candidates: ranked,
    fieldPatches: buildWalmartSourceConfidenceRows({ fieldPatches }),
    sourceConfidence,
    diagnostics: providerResponse.diagnostics,
    warnings: [
      ...providerResponse.warnings,
      ...(status === "ambiguous"
        ? ["Top candidates were too close without an exact identifier match."]
        : []),
    ],
    sourceSummary: {
      winningSource,
      sourceLabel: preferredSourceLabel(winningSource),
      retrievedAt: new Date().toISOString(),
      credentialMode: providerResponse.credentialMode,
    },
  };
}

function optionalHeader(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function walmartHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "WM_SEC.ACCESS_TOKEN": accessToken,
    "WM_QOS.CORRELATION_ID": crypto.randomUUID(),
    "WM_SVC.NAME": "Walmart Marketplace",
  };
  const channel = optionalHeader(process.env.WALMART_CONSUMER_CHANNEL_TYPE);
  const partnerId = optionalHeader(process.env.WALMART_PARTNER_ID);
  if (channel) headers["WM_CONSUMER.CHANNEL.TYPE"] = channel;
  if (partnerId) headers["WM_PARTNER.ID"] = partnerId;
  return headers;
}

async function fetchWalmartJson(input: {
  url: string;
  accessToken: string;
}): Promise<{ ok: boolean; status: number; payload: unknown; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKFILL_TIMEOUT_MS);
  try {
    const response = await fetch(input.url, {
      method: "GET",
      headers: walmartHeaders(input.accessToken),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text.trim() ? (JSON.parse(text) as unknown) : {};
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload,
        message: `Walmart API returned HTTP ${response.status}.`,
      };
    }
    return {
      ok: true,
      status: response.status,
      payload,
      message: "",
    };
  } catch {
    return {
      ok: false,
      status: 0,
      payload: {},
      message: "Walmart API request failed or timed out.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractWalmartItems(payload: unknown): Record<string, unknown>[] {
  const root = asObject(payload);
  if (!root) return [];

  const direct = asObject(root.item) ?? asObject(root.Item);
  if (direct) return [direct];

  const data = asObject(root.data);
  const dataItem = asObject(data?.item) ?? asObject(data?.Item);
  if (dataItem) return [dataItem];

  const itemResponse = asObject(root.ItemResponse) ?? asObject(root.itemResponse);
  const responseItem = asObject(itemResponse?.item) ?? asObject(itemResponse?.Item);
  if (responseItem) return [responseItem];

  const lists = [
    root.items,
    root.searchResult,
    data?.items,
    asObject(root.searchResult)?.items,
    itemResponse?.items,
  ];
  for (const entry of lists) {
    const rows = asObjectArray(entry);
    if (rows.length > 0) return rows;
  }

  return [];
}

async function queryLiveWalmartCatalog(input: {
  accessToken: string;
  backfillInput: WalmartCatalogBackfillInput;
}): Promise<{
  candidates: WalmartCatalogBackfillProviderCandidate[];
  diagnostics: WalmartCatalogBackfillDiagnostic[];
  warnings: string[];
  providerError: boolean;
}> {
  const candidates: WalmartCatalogBackfillProviderCandidate[] = [];
  const diagnostics: WalmartCatalogBackfillDiagnostic[] = [];
  const warnings: string[] = [];
  let providerError = false;

  const itemId = toCanonicalItemId(input.backfillInput.itemId, input.backfillInput.canonicalPublicUrl);
  const queryUrls: Array<{ source: WalmartCatalogBackfillProviderSource; url: string; code: string }> = [];
  if (itemId) {
    queryUrls.push({
      source: "walmart_item_api",
      url: `${WALMART_PRODUCTION_BASE_URL}/v3/items/${encodeURIComponent(itemId)}`,
      code: "item_api_detail",
    });
    queryUrls.push({
      source: "walmart_item_api",
      url: `${WALMART_PRODUCTION_BASE_URL}/v3/items?productIdType=ITEM_ID&productId=${encodeURIComponent(itemId)}`,
      code: "item_api_detail_product_id",
    });
  }
  if (input.backfillInput.gtin) {
    queryUrls.push({
      source: "walmart_item_search",
      url: `${WALMART_PRODUCTION_BASE_URL}/v3/items?gtin=${encodeURIComponent(input.backfillInput.gtin)}&limit=20`,
      code: "item_search_gtin",
    });
  }
  if (input.backfillInput.upc) {
    queryUrls.push({
      source: "walmart_item_search",
      url: `${WALMART_PRODUCTION_BASE_URL}/v3/items?upc=${encodeURIComponent(input.backfillInput.upc)}&limit=20`,
      code: "item_search_upc",
    });
  }
  if (input.backfillInput.title) {
    queryUrls.push({
      source: "walmart_item_search",
      url: `${WALMART_PRODUCTION_BASE_URL}/v3/items?query=${encodeURIComponent(input.backfillInput.title)}&limit=20`,
      code: "item_search_query",
    });
  }

  for (const request of queryUrls) {
    const response = await fetchWalmartJson({
      url: request.url,
      accessToken: input.accessToken,
    });
    if (!response.ok) {
      diagnostics.push({
        code: request.code,
        message: response.message,
        source: request.source,
      });
      if (response.status >= 500 || response.status === 0 || response.status === 429) {
        providerError = true;
      }
      continue;
    }

    const items = extractWalmartItems(response.payload);
    if (items.length === 0) {
      warnings.push(`${request.code}: response had no candidate items.`);
      continue;
    }

    diagnostics.push({
      code: request.code,
      message: `Retrieved ${items.length} candidate item(s).`,
      source: request.source,
    });
    for (const item of items.slice(0, 20)) {
      candidates.push({
        source: request.source,
        payload: item,
      });
    }
  }

  return {
    candidates,
    diagnostics,
    warnings,
    providerError,
  };
}

async function querySerpApiFallback(input: {
  userId: string;
  backfillInput: WalmartCatalogBackfillInput;
}): Promise<{
  status: WalmartCatalogBackfillProviderStatus;
  candidates: WalmartCatalogBackfillProviderCandidate[];
  diagnostics: WalmartCatalogBackfillDiagnostic[];
  warnings: string[];
}> {
  const credentials = await getSerpApiCredentialsForUser(input.userId);
  if (!credentials.connected || !credentials.apiKey) {
    return {
      status: "no_credentials",
      candidates: [],
      diagnostics: [
        {
          code: "serpapi_not_connected",
          message: "SerpApi key is not configured.",
          source: "serpapi_public_listing",
        },
      ],
      warnings: [],
    };
  }

  const query = input.backfillInput.title || input.backfillInput.sku;
  const search = await searchWalmartProductCandidatesViaSerpApi({
    apiKey: credentials.apiKey,
    query,
  });

  if (!search.ok) {
    return {
      status: "error",
      candidates: [],
      diagnostics: [
        {
          code: search.errorCode ?? "serpapi_error",
          message: search.statusReason,
          source: "serpapi_public_listing",
        },
      ],
      warnings: [],
    };
  }

  return {
    status: "ok",
    candidates: search.candidates.map((candidate) => ({
      source: "serpapi_public_listing",
      payload: {
        productId: candidate.productId,
        itemId: candidate.productId,
        title: candidate.title,
        brand: candidate.brand,
        upc: candidate.upc,
        gtin: candidate.gtin,
        imageUrl: candidate.primaryImageUrl,
        images: candidate.galleryImageUrls,
        itemPageUrl: buildWalmartPublicListingUrlFromItemId(candidate.productId),
        raw: candidate.raw,
      },
    })),
    diagnostics: [
      {
        code: "serpapi_search",
        message: search.statusReason,
        source: "serpapi_public_listing",
      },
    ],
    warnings: [],
  };
}

export function createFixtureWalmartCatalogBackfillProvider(input: {
  candidates: WalmartCatalogBackfillProviderCandidate[];
  diagnostics?: WalmartCatalogBackfillDiagnostic[];
  warnings?: string[];
}): WalmartCatalogBackfillProvider {
  return {
    providerName: "fixture",
    async fetchCandidates() {
      return {
        status: "ok",
        credentialMode: "mock",
        candidates: input.candidates,
        diagnostics:
          input.diagnostics ??
          [
            {
              code: "fixture_provider",
              message: `Loaded ${input.candidates.length} fixture candidate(s).`,
              source: "fixture",
            },
          ],
        warnings: input.warnings ?? [],
      };
    },
  };
}

export function createLiveWalmartCatalogBackfillProvider(input: {
  userId: string;
}): WalmartCatalogBackfillProvider {
  return {
    providerName: "walmart_live_catalog_backfill",
    async fetchCandidates(backfillInput): Promise<WalmartCatalogBackfillProviderResponse> {
      const token = await requestWalmartTokenForUser(input.userId, { forceRefresh: true });
      if (!token.ok || !token.accessToken) {
        const serpApiFallback = await querySerpApiFallback({
          userId: input.userId,
          backfillInput,
        });
        if (serpApiFallback.status !== "ok") {
          return {
            status: "no_credentials",
            credentialMode: "unavailable",
            candidates: [],
            diagnostics: [
              {
                code: "walmart_credentials_missing",
                message:
                  token.lastError?.message || "Walmart credentials are not configured for live catalog backfill.",
                source: "walmart_item_api",
              },
              ...serpApiFallback.diagnostics,
            ],
            warnings: serpApiFallback.warnings,
          };
        }

        return {
          status: "ok",
          credentialMode: "byo_live",
          candidates: serpApiFallback.candidates,
          diagnostics: serpApiFallback.diagnostics,
          warnings: [
            "Walmart credentials unavailable; used SerpApi fallback candidates.",
            ...serpApiFallback.warnings,
          ],
        };
      }

      const walmartResults = await queryLiveWalmartCatalog({
        accessToken: token.accessToken,
        backfillInput,
      });
      if (walmartResults.candidates.length > 0) {
        return {
          status: "ok",
          credentialMode: "byo_live",
          candidates: walmartResults.candidates,
          diagnostics: walmartResults.diagnostics,
          warnings: walmartResults.warnings,
        };
      }

      const serpApiFallback = await querySerpApiFallback({
        userId: input.userId,
        backfillInput,
      });
      if (serpApiFallback.status === "ok") {
        return {
          status: "ok",
          credentialMode: "byo_live",
          candidates: serpApiFallback.candidates,
          diagnostics: [...walmartResults.diagnostics, ...serpApiFallback.diagnostics],
          warnings: [
            ...walmartResults.warnings,
            "No Walmart catalog candidates returned; used SerpApi fallback search candidates.",
          ],
        };
      }

      if (walmartResults.providerError) {
        return {
          status: "error",
          credentialMode: "byo_live",
          candidates: [],
          diagnostics: walmartResults.diagnostics,
          warnings: walmartResults.warnings,
        };
      }

      return {
        status: "ok",
        credentialMode: "byo_live",
        candidates: [],
        diagnostics: [...walmartResults.diagnostics, ...serpApiFallback.diagnostics],
        warnings: [...walmartResults.warnings, ...serpApiFallback.warnings],
      };
    },
  };
}

export async function previewWalmartCatalogBackfillForUser(input: {
  userId: string;
  product: WalmartProductRecord;
  currentWalmartState: WalmartNativeState;
  userDraftPayload?: Record<string, unknown> | null;
}): Promise<WalmartCatalogBackfillResult> {
  const backfillInput = buildWalmartCatalogBackfillInputFromProduct({
    product: input.product,
    currentWalmartState: input.currentWalmartState,
    userDraftPayload: input.userDraftPayload ?? null,
  });

  if (
    backfillInput.itemId &&
    !/^\d{6,20}$/.test(backfillInput.itemId) &&
    !isLikelyGtinOrUpc(backfillInput.itemId)
  ) {
    return toUnavailableResult({
      status: "validation_blocked",
      input: backfillInput,
      diagnostics: [
        {
          code: "validation_blocked",
          message: "Walmart item ID format is invalid.",
          source: "backfill",
        },
      ],
      warnings: [],
      credentialMode: "unavailable",
    });
  }

  return runWalmartCatalogBackfillPreview({
    backfillInput,
    provider: createLiveWalmartCatalogBackfillProvider({
      userId: input.userId,
    }),
  });
}
