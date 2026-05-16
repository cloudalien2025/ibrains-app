import {
  buildSearchBrowseAttributesFromSources,
  searchBrowseGroupLabel,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import { normalizeWalmartImageUrlList } from "@/lib/ecomviper/walmart/walmart-image-fields";
import {
  WALMART_DOCKET_BULLET_ALIASES,
  WALMART_DOCKET_LONG_DESCRIPTION_ALIASES,
  WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES,
} from "@/lib/ecomviper/walmart/walmart-docket-aliases";
import {
  collectWalmartDocketCandidateValues,
  normalizeWalmartBulletList,
  normalizeWalmartTextValue,
  pickFirstNonPlaceholder,
} from "@/lib/ecomviper/walmart/walmart-docket-hydration";
import {
  analyzeWalmartProductTypeFieldCoverage,
  resolveWalmartProductTypeIntelligence,
  type WalmartProductTypeCoverageAnalysis,
  type WalmartTaxonomyConfidence,
} from "@/lib/ecomviper/walmart/walmart-product-type-intelligence";
import {
  resolveWalmartStructuredAttributeRegistry,
  type WalmartStructuredAttributeRegistry,
  type WalmartStructuredAttributeValue,
} from "@/lib/ecomviper/walmart/walmart-structured-attributes";
import { resolveCanonicalWalmartPublicListingUrl } from "@/lib/ecomviper/walmart/walmart-public-listing-url";
import type { WalmartAiSuggestion, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export type WalmartHydrationStatus = "liveHydrated" | "snapshotFallback" | "partialHydration";

export interface WalmartNativeHydrationDiagnostics {
  status: WalmartHydrationStatus;
  source: "live_walmart_api" | "imported_snapshot" | "stale_live_cache";
  liveHydrated: boolean;
  snapshotFallback: boolean;
  partialHydration: boolean;
  stale: boolean;
  hydratedAt: string;
  fallbackReason: string;
  cacheState: "hit" | "miss" | "stale";
  cacheTtlMs: number;
  missingLiveFields: string[];
  sourceProvenance: string[];
  rawPayloadAvailable: boolean;
}

export interface WalmartNativeSchemaCoverage {
  missingRequiredFields: string[];
  missingSearchableFields: string[];
  missingComplianceFields: string[];
  missingDiscoverabilityFields: string[];
  nonWritableFieldsPresent: string[];
}

export interface WalmartNativeProductTypeIntelligence {
  productTypeGroup: string;
  productType: string;
  taxonomyPlacement: string;
  taxonomyConfidence: WalmartTaxonomyConfidence;
  requiredFields: string[];
  searchableFields: string[];
  complianceFields: string[];
  discoverabilityFields: string[];
  writableFields: string[];
  supplementSchema: boolean;
}

export interface WalmartNativeContentState {
  productName: string;
  siteDescription: string;
  longDescription: string;
  keyFeatures: string[];
  brand: string;
  manufacturer: string;
  richMediaStatus: string;
  imageUrls: string[];
}

export interface WalmartNativeMediaState {
  primaryImageUrl: string;
  galleryImageUrls: string[];
  publicWalmartUrl: string;
  publicWalmartItemId: string;
  publicWalmartListingSource:
    | "explicit_url"
    | "item_id"
    | "serpapi_result"
    | "walmart_search_result"
    | "hydration_diagnostic"
    | "media_source"
    | "unavailable";
  publicWalmartListingConfidence: "exact" | "derived" | "unavailable";
  publicWalmartListingWarnings: string[];
  sourceImageLane: string;
  imageFactsStatus: string;
  imageFactsMessage: string;
}

export interface WalmartNativePricingInventoryState {
  currentPrice: number | null;
  salePrice: number | null;
  inventory: number | null;
  fulfillmentType: string;
  lagTime: string;
  wfsStatus: string;
  shippingTemplate: string;
  dimensions: string;
  weight: string;
}

export interface WalmartNativeComplianceState {
  warningText: string;
  stopUseIndications: string;
  prop65: string;
  countryOfOrigin: string;
  regulatoryFields: string;
}

export interface WalmartNativeSearchBrowseState {
  taxonomyPlacement: string;
  productType: string;
  supplementType: string;
  primaryIngredient: string;
  servingSize: string;
  servingsPerContainer: string;
  countPerPack: string;
  form: string;
  flavor: string;
  dietaryNeed: string;
  healthConcerns: string;
  ingredientPreferences: string;
  nutrients: string;
  gender: string;
  ageGroup: string;
  productLine: string;
  attributes: Record<string, string>;
  groupedAttributes: Array<{
    group: string;
    label: string;
    values: Array<{ key: string; label: string; value: string; source: string }>;
  }>;
}

export interface WalmartNativeState {
  stateType: "current" | "proposal" | "draft";
  sku: string;
  sourceOfTruth: Array<"Walmart Item APIs" | "Walmart catalog payload" | "MP_ITEM" | "MP_MAINTENANCE">;
  taxonomyPlacement: string;
  hydration: WalmartNativeHydrationDiagnostics;
  productTypeIntelligence: WalmartNativeProductTypeIntelligence;
  schemaCoverage: WalmartNativeSchemaCoverage;
  content: WalmartNativeContentState;
  media: WalmartNativeMediaState;
  pricingInventory: WalmartNativePricingInventoryState;
  compliance: WalmartNativeComplianceState;
  searchBrowse: WalmartNativeSearchBrowseState;
  structuredAttributes: WalmartStructuredAttributeValue[];
  rawLivePayload: Record<string, unknown> | null;
}

export interface WalmartOptimizationAnalysis {
  generated: boolean;
  currentScore: number | null;
  projectedScore: number | null;
  scoreDelta: number | null;
  changedFields: string[];
  optimizationNotes: string[];
  currentGapAnalysis: WalmartNativeSchemaCoverage;
  proposalGapAnalysis: WalmartNativeSchemaCoverage;
}

export interface WalmartOptimizedProposalState {
  currentWalmartState: WalmartNativeState;
  optimizedProposalState: WalmartNativeState;
  optimizationAnalysis: WalmartOptimizationAnalysis;
}

export interface WalmartEditableDraftState {
  currentWalmartState: WalmartNativeState;
  optimizedProposalState: WalmartNativeState;
  editableDraftState: WalmartNativeState;
  changedFromProposalFields: string[];
}

interface NativeStateSourceRecord {
  record: Record<string, unknown> | null;
  source: string;
}

const NON_MEANINGFUL_TEXT = new Set([
  "unknown",
  "not available",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "not provided",
]);

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isMeaningfulText(value: unknown): boolean {
  const normalized = asText(value).trim().toLowerCase();
  if (!normalized) return false;
  return !NON_MEANINGFUL_TEXT.has(normalized);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function listFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asText(entry))
      .map((entry) => entry.trim())
      .filter((entry) => isMeaningfulText(entry));
  }

  const asNode = asObject(value);
  if (asNode) {
    const nestedList = [
      ...listFromUnknown(asNode.value),
      ...listFromUnknown(asNode.text),
      ...listFromUnknown(asNode.description),
      ...listFromUnknown(asNode.label),
      ...listFromUnknown(asNode.name),
      ...listFromUnknown(asNode.title),
    ];
    return unique(nestedList);
  }

  const asString = asText(value);
  if (!asString) return [];
  return asString
    .split(/\r?\n|[;|]+/)
    .map((entry) => entry.trim())
    .filter((entry) => isMeaningfulText(entry));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function firstNonEmptyString(
  source: Array<Record<string, unknown> | null>,
  keys: string[]
): string {
  for (const record of source) {
    if (!record) continue;
    for (const key of keys) {
      const value = asText(record[key]);
      if (isMeaningfulText(value)) {
        return value;
      }
    }
  }
  return "";
}

function firstSourcedString(
  source: NativeStateSourceRecord[],
  keys: string[]
): { value: string; source: string } {
  for (const entry of source) {
    if (!entry.record) continue;
    for (const key of keys) {
      const value = asText(entry.record[key]);
      if (!isMeaningfulText(value)) continue;
      return {
        value,
        source: entry.source,
      };
    }
  }
  return { value: "", source: "fallback" };
}

function firstNonEmptyNumber(
  source: Array<Record<string, unknown> | null>,
  keys: string[]
): number | null {
  for (const record of source) {
    if (!record) continue;
    for (const key of keys) {
      const value = asNumber(record[key]);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;

  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || Object.isFrozen(node)) continue;
    Object.freeze(node);
    if (Array.isArray(node)) {
      for (const entry of node) {
        stack.push(entry);
      }
      continue;
    }

    for (const entry of Object.values(node as Record<string, unknown>)) {
      stack.push(entry);
    }
  }

  return value;
}

function toSearchBrowseState(input: {
  attributes: Record<string, string>;
  registry: WalmartStructuredAttributeRegistry;
  productTypeHint: string;
  supplementTypeHint: string;
}): WalmartNativeSearchBrowseState {
  const attributes = input.attributes;

  return {
    taxonomyPlacement: input.registry.taxonomyPlacement,
    productType:
      input.productTypeHint ||
      attributes.product_type ||
      input.registry.productType,
    supplementType:
      input.supplementTypeHint ||
      attributes.supplement_type ||
      attributes.product_type,
    primaryIngredient:
      attributes.primary_ingredient ||
      attributes.main_ingredients ||
      attributes.ingredients_list,
    servingSize: attributes.serving_size,
    servingsPerContainer: attributes.servings_per_container || attributes.servings,
    countPerPack: attributes.count_per_pack || attributes.count_per_package,
    form: attributes.product_form || attributes.form,
    flavor: attributes.flavor,
    dietaryNeed: attributes.dietary_need || attributes.allergen_free_statements,
    healthConcerns: attributes.health_concerns || attributes.support_areas,
    ingredientPreferences:
      attributes.ingredient_preferences || attributes.allergen_free_statements,
    nutrients: attributes.nutrients,
    gender: attributes.gender,
    ageGroup: attributes.age_group,
    productLine: attributes.product_line,
    attributes: deepClone(attributes),
    groupedAttributes: input.registry.groupedValues.map((group) => ({
      group: group.group,
      label:
        group.group === "compliance" || group.group === "fulfillment"
          ? group.label
          : searchBrowseGroupLabel(group.group),
      values: group.values.map((entry) => ({
        key: entry.key,
        label: entry.label,
        value: entry.value,
        source: entry.source,
      })),
    })),
  };
}

function toSchemaCoverage(gaps: WalmartProductTypeCoverageAnalysis): WalmartNativeSchemaCoverage {
  return {
    missingRequiredFields: [...gaps.missingRequiredFields],
    missingSearchableFields: [...gaps.missingSearchableFields],
    missingComplianceFields: [...gaps.missingComplianceFields],
    missingDiscoverabilityFields: [...gaps.missingDiscoverabilityFields],
    nonWritableFieldsPresent: [...gaps.nonWritableFieldsPresent],
  };
}

function patchContentWithSuggestion(content: WalmartNativeContentState, suggestion: WalmartAiSuggestion) {
  if (asText(suggestion.suggestedTitle)) {
    content.productName = suggestion.suggestedTitle.trim();
  }
  if (asText(suggestion.suggestedShortDescription)) {
    content.siteDescription = suggestion.suggestedShortDescription!.trim();
  }
  if (asText(suggestion.suggestedDescription)) {
    content.longDescription = suggestion.suggestedDescription.trim();
  }
  if (Array.isArray(suggestion.suggestedBullets) && suggestion.suggestedBullets.length > 0) {
    content.keyFeatures = unique(suggestion.suggestedBullets.map((entry) => asText(entry)));
  }
  if (asText(suggestion.suggestedBrand)) {
    content.brand = suggestion.suggestedBrand!.trim();
  }
}

function patchSearchBrowseWithSuggestion(input: {
  searchBrowse: WalmartNativeSearchBrowseState;
  structuredAttributes: WalmartStructuredAttributeValue[];
  suggestion: WalmartAiSuggestion;
}) {
  const suggestionAttributes = {
    ...(input.suggestion.suggestedAttributes ?? {}),
    ...(input.suggestion.searchBrowseAttributes ?? {}),
  };

  for (const [key, rawValue] of Object.entries(suggestionAttributes)) {
    const value = asText(rawValue);
    if (!value) continue;
    input.searchBrowse.attributes[key] = value;

    const structuredEntry = input.structuredAttributes.find((entry) => entry.key === key);
    if (structuredEntry) {
      structuredEntry.value = value;
    }
  }

  input.searchBrowse.productType =
    input.searchBrowse.attributes.product_type || input.searchBrowse.productType;
  input.searchBrowse.supplementType =
    input.searchBrowse.attributes.supplement_type || input.searchBrowse.supplementType;
  input.searchBrowse.primaryIngredient =
    input.searchBrowse.attributes.primary_ingredient ||
    input.searchBrowse.attributes.main_ingredients ||
    input.searchBrowse.primaryIngredient;
  input.searchBrowse.servingSize =
    input.searchBrowse.attributes.serving_size || input.searchBrowse.servingSize;
  input.searchBrowse.servingsPerContainer =
    input.searchBrowse.attributes.servings_per_container || input.searchBrowse.servingsPerContainer;
  input.searchBrowse.countPerPack =
    input.searchBrowse.attributes.count_per_pack || input.searchBrowse.countPerPack;
  input.searchBrowse.form =
    input.searchBrowse.attributes.product_form || input.searchBrowse.attributes.form || input.searchBrowse.form;
  input.searchBrowse.flavor = input.searchBrowse.attributes.flavor || input.searchBrowse.flavor;
  input.searchBrowse.dietaryNeed =
    input.searchBrowse.attributes.dietary_need ||
    input.searchBrowse.attributes.allergen_free_statements ||
    input.searchBrowse.dietaryNeed;
  input.searchBrowse.healthConcerns =
    input.searchBrowse.attributes.health_concerns ||
    input.searchBrowse.attributes.support_areas ||
    input.searchBrowse.healthConcerns;
  input.searchBrowse.ingredientPreferences =
    input.searchBrowse.attributes.ingredient_preferences ||
    input.searchBrowse.attributes.allergen_free_statements ||
    input.searchBrowse.ingredientPreferences;
  input.searchBrowse.nutrients =
    input.searchBrowse.attributes.nutrients || input.searchBrowse.nutrients;
  input.searchBrowse.gender = input.searchBrowse.attributes.gender || input.searchBrowse.gender;
  input.searchBrowse.ageGroup = input.searchBrowse.attributes.age_group || input.searchBrowse.ageGroup;
  input.searchBrowse.productLine =
    input.searchBrowse.attributes.product_line || input.searchBrowse.productLine;
}

function patchNativeStateWithDraftPayload(state: WalmartNativeState, draftPayload: Record<string, unknown>) {
  const attributesPayload = asObject(draftPayload.searchBrowseAttributes) ?? asObject(draftPayload.attributes) ?? {};
  for (const [key, rawValue] of Object.entries(attributesPayload)) {
    const value = asText(rawValue);
    if (!value) continue;
    state.searchBrowse.attributes[key] = value;
    const match = state.structuredAttributes.find((entry) => entry.key === key);
    if (match) {
      match.value = value;
    }
  }

  const title = asText(draftPayload.title);
  if (title) state.content.productName = title;
  const shortDescription = asText(draftPayload.shortDescription);
  if (shortDescription) state.content.siteDescription = shortDescription;
  const longDescription = asText(draftPayload.longDescription);
  if (longDescription) state.content.longDescription = longDescription;

  const bullets = listFromUnknown(draftPayload.bulletPoints);
  if (bullets.length > 0) state.content.keyFeatures = bullets;

  const brand = asText(draftPayload.brand);
  if (brand) {
    state.content.brand = brand;
    state.searchBrowse.attributes.brand = brand;
  }

  const price = asNumber(draftPayload.price);
  if (price !== null) state.pricingInventory.currentPrice = price;
  const salePrice = asNumber(draftPayload.salePrice);
  if (salePrice !== null) state.pricingInventory.salePrice = salePrice;
  const inventoryQuantity = asNumber(draftPayload.inventoryQuantity);
  if (inventoryQuantity !== null) state.pricingInventory.inventory = inventoryQuantity;

  const primaryImageUrl = asText(draftPayload.imageUrl) || asText(draftPayload.primaryImageUrl);
  if (primaryImageUrl) {
    state.media.primaryImageUrl = primaryImageUrl;
  }

  const galleryImageUrls = normalizeWalmartImageUrlList([
    listFromUnknown(draftPayload.galleryImageUrls),
    listFromUnknown(draftPayload.additionalImageUrls),
    state.media.primaryImageUrl,
  ]);
  if (galleryImageUrls.length > 0) {
    state.media.galleryImageUrls = galleryImageUrls;
    state.content.imageUrls = galleryImageUrls;
  }

  const publicListingResolution = resolveCanonicalWalmartPublicListingUrl({
    explicitUrlCandidates: [
      draftPayload.publicWalmartUrl,
      draftPayload.publicWalmartListingUrl,
      draftPayload.itemPageUrl,
      draftPayload.walmartItemPageUrl,
    ],
    itemIdCandidates: [
      { value: draftPayload.publicWalmartProductId, provenance: "draftPayload.publicWalmartProductId" },
      { value: draftPayload.publicWalmartItemId, provenance: "draftPayload.publicWalmartItemId" },
      { value: draftPayload.itemId, provenance: "draftPayload.itemId" },
      { value: draftPayload.usItemId, provenance: "draftPayload.usItemId" },
    ],
    hydrationDiagnostic: [draftPayload.hydrationDiagnostic],
    mediaSource: [draftPayload.media],
  });
  if (publicListingResolution.url) {
    state.media.publicWalmartUrl = publicListingResolution.url;
  }
  if (publicListingResolution.itemId) {
    state.media.publicWalmartItemId = publicListingResolution.itemId;
  }
  if (publicListingResolution.source !== "unavailable") {
    state.media.publicWalmartListingSource = publicListingResolution.source;
    state.media.publicWalmartListingConfidence = publicListingResolution.confidence;
    state.media.publicWalmartListingWarnings = [...publicListingResolution.warnings];
  }

  state.searchBrowse.productType =
    state.searchBrowse.attributes.product_type || state.searchBrowse.productType;
  state.searchBrowse.supplementType =
    state.searchBrowse.attributes.supplement_type || state.searchBrowse.supplementType;
  state.searchBrowse.primaryIngredient =
    state.searchBrowse.attributes.primary_ingredient ||
    state.searchBrowse.attributes.main_ingredients ||
    state.searchBrowse.primaryIngredient;
  state.searchBrowse.servingSize =
    state.searchBrowse.attributes.serving_size || state.searchBrowse.servingSize;
  state.searchBrowse.servingsPerContainer =
    state.searchBrowse.attributes.servings_per_container || state.searchBrowse.servingsPerContainer;
  state.searchBrowse.countPerPack =
    state.searchBrowse.attributes.count_per_pack || state.searchBrowse.countPerPack;
  state.searchBrowse.form =
    state.searchBrowse.attributes.product_form || state.searchBrowse.attributes.form || state.searchBrowse.form;
  state.searchBrowse.flavor = state.searchBrowse.attributes.flavor || state.searchBrowse.flavor;
  state.searchBrowse.dietaryNeed =
    state.searchBrowse.attributes.dietary_need ||
    state.searchBrowse.attributes.allergen_free_statements ||
    state.searchBrowse.dietaryNeed;
  state.searchBrowse.healthConcerns =
    state.searchBrowse.attributes.health_concerns ||
    state.searchBrowse.attributes.support_areas ||
    state.searchBrowse.healthConcerns;
  state.searchBrowse.ingredientPreferences =
    state.searchBrowse.attributes.ingredient_preferences ||
    state.searchBrowse.attributes.allergen_free_statements ||
    state.searchBrowse.ingredientPreferences;
  state.searchBrowse.nutrients = state.searchBrowse.attributes.nutrients || state.searchBrowse.nutrients;
  state.searchBrowse.gender = state.searchBrowse.attributes.gender || state.searchBrowse.gender;
  state.searchBrowse.ageGroup = state.searchBrowse.attributes.age_group || state.searchBrowse.ageGroup;
  state.searchBrowse.productLine =
    state.searchBrowse.attributes.product_line || state.searchBrowse.productLine;
}

function changedFieldsBetweenStates(left: WalmartNativeState, right: WalmartNativeState): string[] {
  const fields: string[] = [];

  if (left.content.productName !== right.content.productName) fields.push("content.productName");
  if (left.content.siteDescription !== right.content.siteDescription) fields.push("content.siteDescription");
  if (left.content.longDescription !== right.content.longDescription) fields.push("content.longDescription");
  if (JSON.stringify(left.content.keyFeatures) !== JSON.stringify(right.content.keyFeatures)) {
    fields.push("content.keyFeatures");
  }
  if (left.content.brand !== right.content.brand) fields.push("content.brand");
  if (left.media.primaryImageUrl !== right.media.primaryImageUrl) fields.push("media.primaryImageUrl");
  if (JSON.stringify(left.media.galleryImageUrls) !== JSON.stringify(right.media.galleryImageUrls)) {
    fields.push("media.galleryImageUrls");
  }
  if (left.media.publicWalmartUrl !== right.media.publicWalmartUrl) {
    fields.push("media.publicWalmartUrl");
  }
  if (left.media.publicWalmartItemId !== right.media.publicWalmartItemId) {
    fields.push("media.publicWalmartItemId");
  }
  if (left.pricingInventory.currentPrice !== right.pricingInventory.currentPrice) {
    fields.push("pricingInventory.currentPrice");
  }
  if (left.pricingInventory.salePrice !== right.pricingInventory.salePrice) {
    fields.push("pricingInventory.salePrice");
  }
  if (left.pricingInventory.inventory !== right.pricingInventory.inventory) {
    fields.push("pricingInventory.inventory");
  }

  if (JSON.stringify(left.searchBrowse.attributes) !== JSON.stringify(right.searchBrowse.attributes)) {
    fields.push("searchBrowse.attributes");
  }

  return fields;
}

function buildHydrationDiagnostics(input: {
  metadata?: Partial<WalmartNativeHydrationDiagnostics>;
  schemaCoverage: WalmartNativeSchemaCoverage;
  rawPayloadAvailable: boolean;
}): WalmartNativeHydrationDiagnostics {
  const status = input.metadata?.status ?? "snapshotFallback";
  const source = input.metadata?.source ?? "imported_snapshot";

  return {
    status,
    source,
    liveHydrated: input.metadata?.liveHydrated ?? status === "liveHydrated",
    snapshotFallback: input.metadata?.snapshotFallback ?? status === "snapshotFallback",
    partialHydration: input.metadata?.partialHydration ?? status === "partialHydration",
    stale: input.metadata?.stale ?? false,
    hydratedAt: input.metadata?.hydratedAt ?? new Date().toISOString(),
    fallbackReason: input.metadata?.fallbackReason ?? "",
    cacheState: input.metadata?.cacheState ?? "miss",
    cacheTtlMs: input.metadata?.cacheTtlMs ?? 0,
    missingLiveFields: input.metadata?.missingLiveFields ?? [],
    sourceProvenance:
      input.metadata?.sourceProvenance ??
      (source === "live_walmart_api"
        ? ["walmart_item_api", "walmart_catalog_api"]
        : ["imported_snapshot_payload"]),
    rawPayloadAvailable: input.metadata?.rawPayloadAvailable ?? input.rawPayloadAvailable,
  };
}

export function hydrateCurrentWalmartState(input: {
  product: WalmartProductRecord;
  hydrationMetadata?: Partial<WalmartNativeHydrationDiagnostics>;
  liveItemPayload?: Record<string, unknown> | null;
}): WalmartNativeState {
  const normalizedPayload = asObject(input.product.normalizedPayload);
  const rawPayload = asObject(input.product.rawPayload);
  const rawProductPayload = asObject(rawPayload?.product);
  const rawContentPayload = asObject(rawPayload?.content);
  const rawMediaPayload = asObject(rawPayload?.media);
  const liveItemPayload = asObject(input.liveItemPayload);
  const liveItemNode = asObject(rawPayload?.liveItemNode);
  const liveItemPayloadFromRaw = asObject(rawPayload?.liveItemPayload);
  const normalizedLiveHydration = asObject(normalizedPayload?.liveHydration);
  const rawLiveHydration = asObject(rawPayload?.liveHydration);
  const normalizedWalmartSearchCandidate = asObject(normalizedPayload?.walmartItemSearchCandidate);
  const rawWalmartSearchCandidate = asObject(rawPayload?.walmartItemSearchCandidate);
  const rawWalmartSearchResult = asObject(rawPayload?.walmartSearchResult);
  const normalizedPublicListingSnapshot = asObject(normalizedPayload?.publicListingSnapshot);
  const rawPublicListingSnapshot = asObject(rawPayload?.publicListingSnapshot);
  const normalizedSerpApiListing = asObject(normalizedPayload?.serpApiListing);
  const rawSerpApiListing = asObject(rawPayload?.serpApiListing);
  const normalizedShopifySnapshot = asObject(normalizedPayload?.shopifySnapshot);
  const rawShopifySnapshot = asObject(rawPayload?.shopifySnapshot);
  const productRecord = input.product as unknown as Record<string, unknown>;

  const sellerNativeSources: NativeStateSourceRecord[] = [
    { record: productRecord, source: "seller_catalog" },
    { record: normalizedPayload, source: "seller_catalog" },
    { record: rawPayload, source: "seller_catalog" },
    { record: rawProductPayload, source: "seller_catalog" },
  ];
  const itemApiSources: NativeStateSourceRecord[] = [
    { record: liveItemPayload, source: "walmart_item_api_detail" },
    { record: liveItemNode, source: "walmart_item_api_detail" },
    { record: liveItemPayloadFromRaw, source: "walmart_item_api_detail" },
    { record: normalizedLiveHydration, source: "walmart_item_api_detail" },
    { record: rawLiveHydration, source: "walmart_item_api_detail" },
  ];
  const walmartSearchSources: NativeStateSourceRecord[] = [
    { record: normalizedWalmartSearchCandidate, source: "walmart_search_result" },
    { record: rawWalmartSearchCandidate, source: "walmart_search_result" },
    { record: rawWalmartSearchResult, source: "walmart_search_result" },
  ];
  const publicListingSources: NativeStateSourceRecord[] = [
    { record: rawContentPayload, source: "public_walmart_catalog" },
    { record: normalizedPublicListingSnapshot, source: "public_walmart_listing" },
    { record: rawPublicListingSnapshot, source: "public_walmart_listing" },
    { record: normalizedSerpApiListing, source: "serpapi_public_listing" },
    { record: rawSerpApiListing, source: "serpapi_public_listing" },
    { record: rawMediaPayload, source: "public_walmart_listing" },
  ];
  const shopifySources: NativeStateSourceRecord[] = [
    { record: normalizedShopifySnapshot, source: "shopify_import_snapshot" },
    { record: rawShopifySnapshot, source: "shopify_import_snapshot" },
  ];
  const contentSources = [
    ...sellerNativeSources,
    ...itemApiSources,
    ...walmartSearchSources,
    ...publicListingSources,
    ...shopifySources,
  ];
  const records = contentSources.map((entry) => entry.record);

  const searchBrowseAttributes = buildSearchBrowseAttributesFromSources({
    product: input.product,
  });
  const productTypeHint =
    asText(input.product.searchBrowseAttributes?.product_type) ||
    asText(input.product.attributes?.product_type);
  const supplementTypeHint =
    asText(input.product.searchBrowseAttributes?.supplement_type) ||
    asText(input.product.attributes?.supplement_type);
  const registry = resolveWalmartStructuredAttributeRegistry({
    product: input.product,
    sourceAttributes: searchBrowseAttributes,
  });

  const primaryImageUrl =
    input.product.imageUrl ||
    firstNonEmptyString(records, ["primaryImageUrl", "imageUrl", "mainImage", "mainImageUrl"]);
  const galleryImageUrls = normalizeWalmartImageUrlList([
    primaryImageUrl,
    input.product.galleryImageUrls ?? [],
    firstNonEmptyString(records, ["imageUrl", "mainImage"]),
    listFromUnknown(rawPayload?.galleryImageUrls),
    listFromUnknown(rawPayload?.additionalImageUrls),
    listFromUnknown(normalizedPayload?.galleryImageUrls),
    listFromUnknown(rawPayload?.images),
    listFromUnknown(rawProductPayload?.images),
    listFromUnknown(rawContentPayload?.images),
    listFromUnknown(rawMediaPayload?.images),
  ]);

  const resolvedSearchBrowse = toSearchBrowseState({
    attributes: searchBrowseAttributes,
    registry,
    productTypeHint,
    supplementTypeHint,
  });

  const intelligence = resolveWalmartProductTypeIntelligence({
    productType: resolvedSearchBrowse.productType,
    supplementType: resolvedSearchBrowse.supplementType,
    category: input.product.category,
    taxonomyPlacement: registry.taxonomyPlacement,
    title: input.product.title,
  });

  const schemaCoverage = toSchemaCoverage(
    analyzeWalmartProductTypeFieldCoverage({
      intelligence,
      attributes: resolvedSearchBrowse.attributes,
    })
  );

  const provenance = new Set<string>(input.hydrationMetadata?.sourceProvenance ?? []);
  const addProvenance = (value: string) => {
    if (value && value !== "fallback" && value !== "unavailable") {
      provenance.add(value);
    }
  };

  const contentNameFromSources = firstSourcedString(contentSources, [
    "productName",
    "title",
    "name",
    "product_title",
  ]);
  const productName = isMeaningfulText(input.product.title)
    ? input.product.title.trim()
    : contentNameFromSources.value;
  addProvenance(isMeaningfulText(input.product.title) ? "seller_catalog" : contentNameFromSources.source);

  const docketAliasSources = contentSources
    .filter((entry) => Boolean(entry.record))
    .map((entry) => ({
      source: "fallback" as const,
      sourceLabel: entry.source,
      payload: entry.record,
      confidence: "medium" as const,
    }));
  const contentShortFromSources = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: docketAliasSources,
      aliases: [...WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES, "short_desc", "synopsis"],
      normalizer: normalizeWalmartTextValue,
    })
  );
  const siteDescription = isMeaningfulText(input.product.shortDescription)
    ? input.product.shortDescription.trim()
    : contentShortFromSources?.value ?? "";
  addProvenance(
    isMeaningfulText(input.product.shortDescription)
      ? "seller_catalog"
      : contentShortFromSources?.metadata.sourceLabel ?? "fallback"
  );

  const contentLongFromSources = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: docketAliasSources,
      aliases: [...WALMART_DOCKET_LONG_DESCRIPTION_ALIASES, "description", "productDescription", "long_desc"],
      normalizer: normalizeWalmartTextValue,
    })
  );
  const longDescription = isMeaningfulText(input.product.longDescription)
    ? input.product.longDescription.trim()
    : contentLongFromSources?.value ?? "";
  addProvenance(
    isMeaningfulText(input.product.longDescription)
      ? "seller_catalog"
      : contentLongFromSources?.metadata.sourceLabel ?? "fallback"
  );

  const sellerBullets = unique(
    (input.product.bulletPoints ?? []).map((entry) => asText(entry)).filter((entry) => isMeaningfulText(entry))
  );
  const bulletFallback = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: docketAliasSources,
      aliases: [...WALMART_DOCKET_BULLET_ALIASES, "bulletPoints", "bullets"],
      normalizer: normalizeWalmartBulletList,
    })
  );
  const keyFeatures = sellerBullets.length > 0 ? sellerBullets : bulletFallback?.value ?? [];
  addProvenance(
    sellerBullets.length > 0 ? "seller_catalog" : bulletFallback?.metadata.sourceLabel ?? "fallback"
  );

  const brandFallback = firstSourcedString(contentSources, ["brand", "brandName"]);
  const brand = isMeaningfulText(input.product.brand) ? input.product.brand.trim() : brandFallback.value;
  addProvenance(isMeaningfulText(input.product.brand) ? "seller_catalog" : brandFallback.source);

  const manufacturerFallback = firstSourcedString(contentSources, [
    "manufacturer",
    "manufacturerName",
    "manufacturer_name",
  ]);
  const manufacturer = isMeaningfulText(searchBrowseAttributes.manufacturer)
    ? searchBrowseAttributes.manufacturer.trim()
    : manufacturerFallback.value;
  addProvenance(
    isMeaningfulText(searchBrowseAttributes.manufacturer)
      ? "seller_catalog"
      : manufacturerFallback.source
  );

  const publicListingResolution = resolveCanonicalWalmartPublicListingUrl({
    explicitUrlCandidates: [
      input.product.publicWalmartUrl,
      normalizedPayload?.publicWalmartUrl,
      normalizedPayload?.itemPageUrl,
      normalizedPayload?.walmartItemPageUrl,
      normalizedPayload?.productPageUrl,
      normalizedPayload?.productUrl,
      normalizedPayload?.canonicalUrl,
      rawPayload?.publicWalmartUrl,
      rawPayload?.itemPageUrl,
      rawPayload?.walmartItemPageUrl,
      rawPayload?.productPageUrl,
      rawPayload?.productUrl,
      rawPayload?.canonicalUrl,
      rawPayload?.url,
      rawPayload?.itemUrl,
      rawPayload?.shareUrl,
      rawPayload?.buyUrl,
      rawProductPayload?.publicWalmartUrl,
      rawProductPayload?.itemPageUrl,
      rawProductPayload?.walmartItemPageUrl,
      rawProductPayload?.productPageUrl,
      rawProductPayload?.productUrl,
      rawContentPayload?.publicWalmartUrl,
      rawContentPayload?.itemPageUrl,
      rawContentPayload?.walmartItemPageUrl,
      rawContentPayload?.productPageUrl,
      rawContentPayload?.productUrl,
    ],
    itemIdCandidates: [
      { value: input.product.publicWalmartProductId, provenance: "input.product.publicWalmartProductId" },
      { value: input.product.itemId, provenance: "input.product.itemId" },
      { value: normalizedPayload?.publicWalmartProductId, provenance: "normalizedPayload.publicWalmartProductId" },
      { value: normalizedPayload?.itemId, provenance: "normalizedPayload.itemId" },
      { value: normalizedPayload?.usItemId, provenance: "normalizedPayload.usItemId" },
      { value: rawPayload?.publicWalmartProductId, provenance: "rawPayload.publicWalmartProductId" },
      { value: rawPayload?.itemId, provenance: "rawPayload.itemId" },
      { value: rawPayload?.usItemId, provenance: "rawPayload.usItemId" },
      {
        value: rawPayload?.productId,
        provenance: "rawPayload.productId",
        productIdType: rawPayload?.productIdType ?? rawPayload?.product_id_type,
      },
      {
        value: rawPayload?.product_id,
        provenance: "rawPayload.product_id",
        productIdType: rawPayload?.productIdType ?? rawPayload?.product_id_type,
      },
      { value: rawProductPayload?.itemId, provenance: "rawProductPayload.itemId" },
      { value: rawProductPayload?.usItemId, provenance: "rawProductPayload.usItemId" },
      {
        value: rawProductPayload?.productId,
        provenance: "rawProductPayload.productId",
        productIdType: rawProductPayload?.productIdType ?? rawProductPayload?.product_id_type,
      },
    ],
    serpapiResult: [normalizedSerpApiListing, rawSerpApiListing, normalizedPayload?.publicImageEnrichmentAttempt],
    walmartSearchResult: [normalizedWalmartSearchCandidate, rawWalmartSearchCandidate, rawWalmartSearchResult],
    hydrationDiagnostic: [liveItemPayload, liveItemNode, liveItemPayloadFromRaw, normalizedLiveHydration],
    mediaSource: [rawMediaPayload, rawPayload?.media],
  });
  const listingProvenanceBySource: Record<string, string> = {
    explicit_url: "public_walmart_listing",
    item_id: "public_walmart_listing",
    serpapi_result: "serpapi_public_listing",
    walmart_search_result: "walmart_search_result",
    hydration_diagnostic: "public_walmart_listing",
    media_source: "public_walmart_listing",
    unavailable: "fallback",
  };
  addProvenance(listingProvenanceBySource[publicListingResolution.source] ?? "fallback");

  const mergedHydrationMetadata: Partial<WalmartNativeHydrationDiagnostics> = {
    ...input.hydrationMetadata,
    sourceProvenance: unique([
      ...(input.hydrationMetadata?.sourceProvenance ?? []),
      ...Array.from(provenance),
    ]),
  };
  const hydration = buildHydrationDiagnostics({
    metadata: mergedHydrationMetadata,
    schemaCoverage,
    rawPayloadAvailable: Boolean(input.liveItemPayload || rawPayload || normalizedPayload),
  });

  const current: WalmartNativeState = {
    stateType: "current",
    sku: input.product.sku,
    sourceOfTruth: [
      "Walmart Item APIs",
      "Walmart catalog payload",
      "MP_ITEM",
      "MP_MAINTENANCE",
    ],
    taxonomyPlacement: registry.taxonomyPlacement,
    hydration,
    productTypeIntelligence: {
      productTypeGroup: intelligence.productTypeGroup,
      productType: intelligence.productType,
      taxonomyPlacement: intelligence.taxonomyPlacement,
      taxonomyConfidence: intelligence.taxonomyConfidence,
      requiredFields: intelligence.requiredFields,
      searchableFields: intelligence.searchableFields,
      complianceFields: intelligence.complianceFields,
      discoverabilityFields: intelligence.discoverabilityFields,
      writableFields: intelligence.writableFields,
      supplementSchema: intelligence.supplementSchema,
    },
    schemaCoverage,
    content: {
      productName,
      siteDescription,
      longDescription,
      keyFeatures,
      brand,
      manufacturer,
      richMediaStatus: firstNonEmptyString(records, ["richMediaStatus", "rich_media_status"]) || "unknown",
      imageUrls: galleryImageUrls,
    },
    media: {
      primaryImageUrl,
      galleryImageUrls,
      publicWalmartUrl: publicListingResolution.url ?? "",
      publicWalmartItemId: publicListingResolution.itemId ?? "",
      publicWalmartListingSource: publicListingResolution.source,
      publicWalmartListingConfidence: publicListingResolution.confidence,
      publicWalmartListingWarnings: [...publicListingResolution.warnings],
      sourceImageLane: input.product.imageSource || "unknown",
      imageFactsStatus: firstNonEmptyString(records, ["imageFactsStatus", "image_facts_status"]) || "unknown",
      imageFactsMessage:
        firstNonEmptyString(records, ["imageFactsMessage", "image_facts_message"]) ||
        "No image-derived fact detail provided.",
    },
    pricingInventory: {
      currentPrice: asNumber(input.product.price),
      salePrice: firstNonEmptyNumber(records, ["salePrice", "sale_price", "specialPrice", "promoPrice"]),
      inventory:
        input.product.inventoryStatus === "unknown"
          ? null
          : asNumber(input.product.inventoryQuantity),
      fulfillmentType: firstNonEmptyString(records, ["fulfillmentType", "fulfillment_type", "fulfillment"]),
      lagTime: firstNonEmptyString(records, ["lagTime", "lag_time", "fulfillmentLagTime"]),
      wfsStatus: firstNonEmptyString(records, ["wfsStatus", "wfs_status", "wfs"]),
      shippingTemplate: firstNonEmptyString(records, ["shippingTemplate", "shipping_template"]),
      dimensions:
        firstNonEmptyString(records, ["dimensions", "packageDimensions", "assembledDimensions"]) ||
        [
          searchBrowseAttributes.assembled_product_depth,
          searchBrowseAttributes.assembled_product_width,
          searchBrowseAttributes.assembled_product_height,
        ]
          .filter(Boolean)
          .join(" x "),
      weight: firstNonEmptyString(records, ["weight", "packageWeight", "shippingWeight"]),
    },
    compliance: {
      warningText:
        searchBrowseAttributes.warning_text ||
        searchBrowseAttributes.safety_warnings ||
        firstNonEmptyString(records, ["warningText", "warning_text", "warnings"]),
      stopUseIndications:
        searchBrowseAttributes.stop_use_indications ||
        firstNonEmptyString(records, ["stopUseIndications", "stop_use_indications"]),
      prop65:
        searchBrowseAttributes.prop_65 || firstNonEmptyString(records, ["prop65", "prop_65"]),
      countryOfOrigin:
        searchBrowseAttributes.country_of_origin ||
        firstNonEmptyString(records, ["countryOfOrigin", "country_of_origin"]),
      regulatoryFields:
        searchBrowseAttributes.regulatory_fields ||
        firstNonEmptyString(records, ["regulatoryFields", "regulatory_fields"]),
    },
    searchBrowse: resolvedSearchBrowse,
    structuredAttributes: registry.values,
    rawLivePayload: input.liveItemPayload ?? asObject(rawPayload?.liveItemPayload) ?? null,
  };

  return deepFreeze(current);
}

function buildCoverageForState(state: WalmartNativeState): WalmartNativeSchemaCoverage {
  const intelligence = resolveWalmartProductTypeIntelligence({
    productType: state.searchBrowse.productType,
    supplementType: state.searchBrowse.supplementType,
    taxonomyPlacement: state.searchBrowse.taxonomyPlacement,
    title: state.content.productName,
  });

  return toSchemaCoverage(
    analyzeWalmartProductTypeFieldCoverage({
      intelligence,
      attributes: state.searchBrowse.attributes,
    })
  );
}

export function generateOptimizedProposalState(input: {
  currentWalmartState: WalmartNativeState;
  suggestion: WalmartAiSuggestion | null;
  currentScore?: number;
  projectedScore?: number;
}): WalmartOptimizedProposalState {
  const currentWalmartState = deepFreeze(deepClone(input.currentWalmartState));
  const optimizedProposalState = deepClone(currentWalmartState);
  optimizedProposalState.stateType = "proposal";

  if (input.suggestion) {
    patchContentWithSuggestion(optimizedProposalState.content, input.suggestion);
    patchSearchBrowseWithSuggestion({
      searchBrowse: optimizedProposalState.searchBrowse,
      structuredAttributes: optimizedProposalState.structuredAttributes,
      suggestion: input.suggestion,
    });
  }

  const currentGapAnalysis = buildCoverageForState(currentWalmartState);
  const proposalGapAnalysis = buildCoverageForState(optimizedProposalState);
  optimizedProposalState.schemaCoverage = proposalGapAnalysis;

  const changedFields = changedFieldsBetweenStates(currentWalmartState, optimizedProposalState);

  const optimizationNotes: string[] = input.suggestion
    ? [
        "Proposal generated from current Walmart-native state.",
        "Proposal fields are draft-only until approved and saved.",
      ]
    : ["No AI proposal generated yet."];

  if (proposalGapAnalysis.missingRequiredFields.length < currentGapAnalysis.missingRequiredFields.length) {
    optimizationNotes.push("Required-field coverage improved in proposal state.");
  }
  if (proposalGapAnalysis.missingDiscoverabilityFields.length < currentGapAnalysis.missingDiscoverabilityFields.length) {
    optimizationNotes.push("Discoverability-field coverage improved in proposal state.");
  }
  if (proposalGapAnalysis.missingComplianceFields.length < currentGapAnalysis.missingComplianceFields.length) {
    optimizationNotes.push("Compliance-field coverage improved in proposal state.");
  }

  const optimizationAnalysis: WalmartOptimizationAnalysis = {
    generated: Boolean(input.suggestion),
    currentScore:
      typeof input.currentScore === "number" && Number.isFinite(input.currentScore)
        ? input.currentScore
        : null,
    projectedScore:
      typeof input.projectedScore === "number" && Number.isFinite(input.projectedScore)
        ? input.projectedScore
        : null,
    scoreDelta:
      typeof input.currentScore === "number" &&
      Number.isFinite(input.currentScore) &&
      typeof input.projectedScore === "number" &&
      Number.isFinite(input.projectedScore)
        ? input.projectedScore - input.currentScore
        : null,
    changedFields,
    optimizationNotes,
    currentGapAnalysis,
    proposalGapAnalysis,
  };

  return deepFreeze({
    currentWalmartState,
    optimizedProposalState,
    optimizationAnalysis,
  });
}

export function generateEditableDraftState(input: {
  currentWalmartState: WalmartNativeState;
  optimizedProposalState: WalmartNativeState;
  draftPayload: Record<string, unknown>;
}): WalmartEditableDraftState {
  const currentWalmartState = deepFreeze(deepClone(input.currentWalmartState));
  const optimizedProposalState = deepFreeze(deepClone(input.optimizedProposalState));

  const editableDraftState = deepClone(optimizedProposalState);
  editableDraftState.stateType = "draft";
  patchNativeStateWithDraftPayload(editableDraftState, input.draftPayload);
  editableDraftState.schemaCoverage = buildCoverageForState(editableDraftState);

  const changedFromProposalFields = changedFieldsBetweenStates(
    optimizedProposalState,
    editableDraftState
  );

  return deepFreeze({
    currentWalmartState,
    optimizedProposalState,
    editableDraftState,
    changedFromProposalFields,
  });
}

export function toNativeStateDraftPayload(state: WalmartNativeState): Record<string, unknown> {
  const searchBrowseAttributes = deepClone(state.searchBrowse.attributes);
  if (state.searchBrowse.productType) {
    searchBrowseAttributes.product_type = state.searchBrowse.productType;
  }
  if (state.searchBrowse.supplementType) {
    searchBrowseAttributes.supplement_type = state.searchBrowse.supplementType;
  }

  return {
    title: state.content.productName,
    shortDescription: state.content.siteDescription,
    longDescription: state.content.longDescription,
    bulletPoints: deepClone(state.content.keyFeatures),
    brand: state.content.brand,
    imageUrl: state.media.primaryImageUrl,
    galleryImageUrls: deepClone(state.media.galleryImageUrls),
    publicWalmartUrl: state.media.publicWalmartUrl,
    publicWalmartProductId: state.media.publicWalmartItemId,
    publicWalmartItemId: state.media.publicWalmartItemId,
    publicWalmartListingSource: state.media.publicWalmartListingSource,
    publicWalmartListingConfidence: state.media.publicWalmartListingConfidence,
    price: state.pricingInventory.currentPrice,
    salePrice: state.pricingInventory.salePrice,
    inventoryQuantity: state.pricingInventory.inventory,
    searchBrowseAttributes,
    attributes: deepClone(searchBrowseAttributes),
    compliance: {
      warningText: state.compliance.warningText,
      stopUseIndications: state.compliance.stopUseIndications,
      prop65: state.compliance.prop65,
      countryOfOrigin: state.compliance.countryOfOrigin,
      regulatoryFields: state.compliance.regulatoryFields,
    },
    fulfillment: {
      fulfillmentType: state.pricingInventory.fulfillmentType,
      lagTime: state.pricingInventory.lagTime,
      wfsStatus: state.pricingInventory.wfsStatus,
      shippingTemplate: state.pricingInventory.shippingTemplate,
      dimensions: state.pricingInventory.dimensions,
      weight: state.pricingInventory.weight,
    },
  };
}
