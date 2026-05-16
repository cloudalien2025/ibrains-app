import {
  WALMART_DOCKET_BRAND_ALIASES,
  WALMART_DOCKET_BULLET_ALIASES,
  WALMART_DOCKET_IMAGE_ALIASES,
  WALMART_DOCKET_INVENTORY_ALIASES,
  WALMART_DOCKET_ITEM_ID_ALIASES,
  WALMART_DOCKET_LONG_DESCRIPTION_ALIASES,
  WALMART_DOCKET_PRICE_ALIASES,
  WALMART_DOCKET_PUBLIC_URL_ALIASES,
  WALMART_DOCKET_SALE_PRICE_ALIASES,
  WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES,
  WALMART_DOCKET_STATUS_ALIASES,
  WALMART_DOCKET_TITLE_ALIASES,
} from "@/lib/ecomviper/walmart/walmart-docket-aliases";
import {
  createEmptyWalmartDocket,
  createWalmartDocketField,
  type WalmartDocketField,
  type WalmartDocketHydrationStatus,
  type WalmartNormalizedDocket,
} from "@/lib/ecomviper/walmart/walmart-docket";
import {
  createWalmartDocketFieldMetadata,
  sourceLabelForWalmartDocket,
  type WalmartDocketFieldConfidence,
  type WalmartDocketFieldMetadata,
  type WalmartDocketFieldSource,
} from "@/lib/ecomviper/walmart/walmart-docket-source-metadata";
import { normalizeWalmartImageUrlList } from "@/lib/ecomviper/walmart/walmart-image-fields";
import { resolveCanonicalWalmartPublicListingUrl } from "@/lib/ecomviper/walmart/walmart-public-listing-url";

const PLACEHOLDER_VALUES = new Set([
  "",
  "unknown",
  "not available",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "not provided",
]);

export interface WalmartDocketHydrationSource {
  source: WalmartDocketFieldSource;
  payload: unknown;
  sourceLabel?: string;
  retrievedAt?: string | null;
  updatedAt?: string | null;
  confidence?: WalmartDocketFieldConfidence;
  warnings?: string[];
}

export interface WalmartDocketCandidateValue<T = unknown> {
  value: T;
  metadata: WalmartDocketFieldMetadata;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return "";
}

function stripHtml(value: string): string {
  const normalized = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
  return normalized.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function isMeaningfulText(value: unknown): boolean {
  const candidate = asText(value);
  if (!candidate) return false;
  return !isPlaceholder(candidate);
}

function toPathSegments(path: string): string[] {
  return path
    .split(".")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readPath(value: unknown, path: string): unknown {
  const segments = toPathSegments(path);
  if (segments.length === 0) return value;
  let current: unknown = value;
  for (const segment of segments) {
    const objectValue = asObject(current);
    if (!objectValue) return undefined;
    current = objectValue[segment];
  }
  return current;
}

function deepValues(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => deepValues(entry));
  }
  const objectValue = asObject(value);
  if (!objectValue) return [value];
  return Object.values(objectValue).flatMap((entry) => deepValues(entry));
}

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeTextList(entry))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .filter((entry) => !isPlaceholder(entry));
  }

  const objectValue = asObject(value);
  if (objectValue) {
    const direct = [
      objectValue.value,
      objectValue.text,
      objectValue.description,
      objectValue.label,
      objectValue.name,
      objectValue.title,
      objectValue.url,
    ].flatMap((entry) => normalizeTextList(entry));
    if (direct.length > 0) return direct;
    return Object.values(objectValue).flatMap((entry) => normalizeTextList(entry));
  }

  const asString = stripHtml(asText(value));
  if (!asString) return [];
  return asString
    .split(/\r?\n|[;|]+/)
    .map((entry) => entry.trim().replace(/^[-*]+\s*/, ""))
    .filter((entry) => entry.length > 0)
    .filter((entry) => !isPlaceholder(entry));
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

export function normalizeWalmartTextValue(value: unknown): string {
  if (typeof value === "string") {
    const stripped = stripHtml(value).trim();
    return isPlaceholder(stripped) ? "" : stripped;
  }

  const list = normalizeTextList(value);
  if (list.length === 0) return "";
  const combined = stripHtml(list.join(" ")).trim();
  return isPlaceholder(combined) ? "" : combined;
}

export function normalizeWalmartBulletList(value: unknown): string[] {
  if (typeof value === "string" && /<li\b/i.test(value)) {
    const liMatches = value.match(/<li[^>]*>(.*?)<\/li>/gi) ?? [];
    if (liMatches.length > 0) {
      return dedupe(
        liMatches
          .map((entry) => stripHtml(entry).replace(/^[-*]+\s*/, "").trim())
          .filter(Boolean)
          .filter((entry) => !isPlaceholder(entry))
      );
    }
  }

  return dedupe(
    normalizeTextList(value)
      .flatMap((entry) => entry.split(/\r?\n|[|;]+/))
      .map((entry) => entry.trim().replace(/^[-*]+\s*/, ""))
      .filter(Boolean)
      .filter((entry) => !isPlaceholder(entry))
  );
}

export function normalizeWalmartImageList(value: unknown): string[] {
  const candidates = deepValues(value)
    .map((entry) => asText(entry))
    .filter(Boolean);
  return normalizeWalmartImageUrlList(candidates);
}

export function normalizeWalmartPriceValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const objectValue = asObject(value);
  if (!objectValue) return null;
  return (
    normalizeWalmartPriceValue(objectValue.amount) ??
    normalizeWalmartPriceValue(objectValue.value) ??
    normalizeWalmartPriceValue(objectValue.price)
  );
}

export function normalizeWalmartInventoryValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  const objectValue = asObject(value);
  if (!objectValue) return null;
  return (
    normalizeWalmartInventoryValue(objectValue.amount) ??
    normalizeWalmartInventoryValue(objectValue.quantity) ??
    normalizeWalmartInventoryValue(objectValue.value)
  );
}

export function collectWalmartDocketCandidateValues<T = unknown>(input: {
  sources: WalmartDocketHydrationSource[];
  aliases: readonly string[];
  normalizer?: (value: unknown) => T;
}): WalmartDocketCandidateValue<T>[] {
  const collected: WalmartDocketCandidateValue<T>[] = [];

  for (const source of input.sources) {
    for (const alias of input.aliases) {
      const value = readPath(source.payload, alias);
      if (typeof value === "undefined") continue;
      const normalized = input.normalizer ? input.normalizer(value) : (value as T);
      collected.push({
        value: normalized,
        metadata: createWalmartDocketFieldMetadata({
          source: source.source,
          sourceLabel: source.sourceLabel ?? sourceLabelForWalmartDocket(source.source),
          retrievedAt: source.retrievedAt ?? null,
          updatedAt: source.updatedAt ?? null,
          confidence: source.confidence ?? "unknown",
          warnings: source.warnings ?? [],
        }),
      });
    }
  }

  return collected;
}

function isMeaningfulValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return isMeaningfulText(value);
}

export function pickFirstNonPlaceholder<T>(
  candidates: WalmartDocketCandidateValue<T>[]
): WalmartDocketCandidateValue<T> | null {
  for (const candidate of candidates) {
    if (isMeaningfulValue(candidate.value)) {
      return candidate;
    }
  }
  return null;
}

function sourcePriority(source: WalmartDocketFieldSource): number {
  if (source === "user_edit") return 100;
  if (source === "ai_optimized") return 90;
  if (source === "item_detail") return 80;
  if (source === "item_report") return 75;
  if (source === "items_list") return 70;
  if (source === "page_live_refresh") return 65;
  if (source === "public_catalog") return 50;
  if (source === "serpapi_public_listing") return 45;
  if (source === "shopify_import_fallback") return 40;
  if (source === "fallback") return 10;
  return 0;
}

export function mergeWalmartDocketFieldSources<T>(
  base: WalmartDocketField<T>,
  incoming: WalmartDocketField<T>
): WalmartDocketField<T> {
  const incomingHasValue = isMeaningfulValue(incoming.value);
  const baseHasValue = isMeaningfulValue(base.value);
  if (!incomingHasValue) {
    return {
      ...base,
      warnings: dedupe([...(base.warnings ?? []), ...(incoming.warnings ?? [])]),
    };
  }
  if (!baseHasValue || sourcePriority(incoming.source) >= sourcePriority(base.source)) {
    return {
      ...incoming,
      warnings: dedupe([...(base.warnings ?? []), ...(incoming.warnings ?? [])]),
    };
  }
  return {
    ...base,
    warnings: dedupe([...(base.warnings ?? []), ...(incoming.warnings ?? [])]),
  };
}

function toStringRecord(value: unknown): Record<string, string> {
  const objectValue = asObject(value);
  if (!objectValue) return {};
  const mapped: Record<string, string> = {};
  for (const [key, raw] of Object.entries(objectValue)) {
    const normalized = normalizeWalmartTextValue(raw);
    if (!normalized) continue;
    mapped[key.trim()] = normalized;
  }
  return mapped;
}

function collectAttributeCandidates(sources: WalmartDocketHydrationSource[]): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of sources) {
    const objectPayload = asObject(source.payload) ?? {};
    const attributes = [
      toStringRecord(objectPayload.attributes),
      toStringRecord(objectPayload.searchBrowseAttributes),
      toStringRecord(objectPayload.specs),
      toStringRecord(objectPayload.productAttributes),
    ];
    for (const entry of attributes) {
      for (const [key, value] of Object.entries(entry)) {
        if (!value) continue;
        if (!(key in merged)) merged[key] = value;
      }
    }
  }
  return merged;
}

function recordFromCandidate<T>(
  fallback: T,
  candidate: WalmartDocketCandidateValue<T> | null,
  source: WalmartDocketFieldSource = "unknown"
): WalmartDocketField<T> {
  if (!candidate) return createWalmartDocketField(fallback, { source });
  return createWalmartDocketField(candidate.value, candidate.metadata);
}

function valueFromDocketField(field: WalmartDocketField<string> | undefined): string {
  return field?.value?.trim() ?? "";
}

function valuesFromDocketField(field: WalmartDocketField<string[]> | undefined): string[] {
  return Array.isArray(field?.value) ? [...field.value] : [];
}

export function hydrateWalmartDocketFromSources(input: {
  sku: string;
  sources: WalmartDocketHydrationSource[];
  existingDocket?: WalmartNormalizedDocket | null;
  statuses?: WalmartDocketHydrationStatus[];
  hydratedAt?: string;
}): WalmartNormalizedDocket {
  const hydratedAt = input.hydratedAt ?? new Date().toISOString();
  const existing = input.existingDocket ?? createEmptyWalmartDocket({ sku: input.sku, hydratedAt });

  const titleCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_TITLE_ALIASES,
      normalizer: normalizeWalmartTextValue,
    })
  );
  const shortCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES,
      normalizer: normalizeWalmartTextValue,
    })
  );
  const longCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_LONG_DESCRIPTION_ALIASES,
      normalizer: normalizeWalmartTextValue,
    })
  );
  const bulletCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_BULLET_ALIASES,
      normalizer: normalizeWalmartBulletList,
    })
  );
  const brandCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_BRAND_ALIASES,
      normalizer: normalizeWalmartTextValue,
    })
  );
  const imageCandidates = collectWalmartDocketCandidateValues({
    sources: input.sources,
    aliases: WALMART_DOCKET_IMAGE_ALIASES,
    normalizer: normalizeWalmartImageList,
  });
  const imageCandidate = pickFirstNonPlaceholder(imageCandidates);
  const priceCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_PRICE_ALIASES,
      normalizer: normalizeWalmartPriceValue,
    })
  );
  const salePriceCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_SALE_PRICE_ALIASES,
      normalizer: normalizeWalmartPriceValue,
    })
  );
  const inventoryCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_INVENTORY_ALIASES,
      normalizer: normalizeWalmartInventoryValue,
    })
  );
  const statusCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_STATUS_ALIASES,
      normalizer: normalizeWalmartTextValue,
    })
  );
  const itemIdCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_ITEM_ID_ALIASES,
      normalizer: normalizeWalmartTextValue,
    })
  );
  const publicUrlCandidate = pickFirstNonPlaceholder(
    collectWalmartDocketCandidateValues({
      sources: input.sources,
      aliases: WALMART_DOCKET_PUBLIC_URL_ALIASES,
      normalizer: normalizeWalmartTextValue,
    })
  );

  const attributes = collectAttributeCandidates(input.sources);

  const listingResolution = resolveCanonicalWalmartPublicListingUrl({
    explicitUrlCandidates: publicUrlCandidate ? [publicUrlCandidate.value] : [],
    itemIdCandidates: itemIdCandidate
      ? [{ value: itemIdCandidate.value, provenance: itemIdCandidate.metadata.sourceLabel }]
      : [],
    mediaSource: input.sources.map((source) => source.payload),
  });

  const next = createEmptyWalmartDocket({
    sku: input.sku,
    hydratedAt,
    statuses: dedupe([...(existing.statuses ?? []), ...(input.statuses ?? ["imported_docket_ready"])]) as WalmartDocketHydrationStatus[],
  });

  next.content.title = mergeWalmartDocketFieldSources(
    existing.content.title,
    recordFromCandidate(valueFromDocketField(existing.content.title), titleCandidate)
  );
  next.content.shortDescription = mergeWalmartDocketFieldSources(
    existing.content.shortDescription,
    recordFromCandidate(valueFromDocketField(existing.content.shortDescription), shortCandidate)
  );
  next.content.longDescription = mergeWalmartDocketFieldSources(
    existing.content.longDescription,
    recordFromCandidate(valueFromDocketField(existing.content.longDescription), longCandidate)
  );
  next.content.bullets = mergeWalmartDocketFieldSources(
    existing.content.bullets,
    recordFromCandidate(valuesFromDocketField(existing.content.bullets), bulletCandidate)
  );
  next.content.brand = mergeWalmartDocketFieldSources(
    existing.content.brand,
    recordFromCandidate(valueFromDocketField(existing.content.brand), brandCandidate)
  );
  next.content.manufacturer = mergeWalmartDocketFieldSources(
    existing.content.manufacturer,
    createWalmartDocketField(
      attributes.manufacturer || valueFromDocketField(existing.content.manufacturer),
      {
        source: attributes.manufacturer ? "items_list" : existing.content.manufacturer.source,
        confidence: attributes.manufacturer ? "medium" : existing.content.manufacturer.confidence,
      }
    )
  );
  next.content.richMediaStatus = existing.content.richMediaStatus;
  next.content.complianceNotes = existing.content.complianceNotes;

  const mergedImageCandidates = dedupe(
    imageCandidates.flatMap((candidate) => normalizeWalmartImageUrlList(candidate.value ?? []))
  );
  const images =
    mergedImageCandidates.length > 0
      ? mergedImageCandidates
      : imageCandidate?.value ?? valuesFromDocketField(existing.media.galleryImages);
  const primaryImage = images[0] ?? existing.media.primaryImage.value;
  const additionalImages = dedupe(
    normalizeWalmartImageUrlList([primaryImage, ...images]).filter((entry) => entry !== primaryImage)
  );

  next.media.primaryImage = mergeWalmartDocketFieldSources(
    existing.media.primaryImage,
    createWalmartDocketField(primaryImage, imageCandidate?.metadata ?? { source: "unknown" })
  );
  next.media.galleryImages = mergeWalmartDocketFieldSources(
    existing.media.galleryImages,
    createWalmartDocketField(dedupe([primaryImage, ...additionalImages]).filter(Boolean), imageCandidate?.metadata ?? { source: "unknown" })
  );
  next.media.publicListingUrl = mergeWalmartDocketFieldSources(
    existing.media.publicListingUrl,
    createWalmartDocketField(
      listingResolution.url ?? valueFromDocketField(existing.media.publicListingUrl),
      publicUrlCandidate?.metadata ?? { source: "fallback" }
    )
  );
  next.media.confirmedItemId = mergeWalmartDocketFieldSources(
    existing.media.confirmedItemId,
    createWalmartDocketField(
      listingResolution.itemId ?? (itemIdCandidate?.value ?? valueFromDocketField(existing.media.confirmedItemId)),
      itemIdCandidate?.metadata ?? { source: "fallback" }
    )
  );
  next.media.imageSourceLane = existing.media.imageSourceLane;
  next.media.imageDerivedFactsStatus = existing.media.imageDerivedFactsStatus;
  next.media.generateProductImagesMetadata = existing.media.generateProductImagesMetadata;
  next.media.altTextGuidance = existing.media.altTextGuidance;

  next.pricingInventory.price = mergeWalmartDocketFieldSources(
    existing.pricingInventory.price,
    recordFromCandidate<number | null>(existing.pricingInventory.price.value, priceCandidate)
  );
  next.pricingInventory.salePrice = mergeWalmartDocketFieldSources(
    existing.pricingInventory.salePrice,
    recordFromCandidate<number | null>(existing.pricingInventory.salePrice.value, salePriceCandidate)
  );
  next.pricingInventory.currency = existing.pricingInventory.currency;
  next.pricingInventory.inventoryQuantity = mergeWalmartDocketFieldSources(
    existing.pricingInventory.inventoryQuantity,
    recordFromCandidate<number | null>(existing.pricingInventory.inventoryQuantity.value, inventoryCandidate)
  );
  next.pricingInventory.inventoryStatus = mergeWalmartDocketFieldSources(
    existing.pricingInventory.inventoryStatus,
    recordFromCandidate(existing.pricingInventory.inventoryStatus.value, statusCandidate)
  );
  next.pricingInventory.fulfillmentData = existing.pricingInventory.fulfillmentData;
  next.pricingInventory.freshnessTimestamps = createWalmartDocketField(
    Object.fromEntries(
      input.sources.map((source) => [source.source, source.retrievedAt ?? null])
    ),
    { source: "fallback", confidence: "unknown" }
  );

  const resolvedLookupIdentifiers = dedupe([
    input.sku,
    attributes.sku ?? "",
    attributes.gtin ?? "",
    attributes.upc ?? "",
    existing.searchBrowse.gtin.value,
    existing.searchBrowse.upc.value,
  ]).filter(Boolean);

  next.searchBrowse.productType = createWalmartDocketField(
    attributes.product_type ?? existing.searchBrowse.productType.value,
    { source: attributes.product_type ? "items_list" : existing.searchBrowse.productType.source }
  );
  next.searchBrowse.category = createWalmartDocketField(
    attributes.category ?? existing.searchBrowse.category.value,
    { source: attributes.category ? "items_list" : existing.searchBrowse.category.source }
  );
  next.searchBrowse.taxonomy = createWalmartDocketField(
    attributes.taxonomy ?? existing.searchBrowse.taxonomy.value,
    { source: attributes.taxonomy ? "items_list" : existing.searchBrowse.taxonomy.source }
  );
  next.searchBrowse.sku = createWalmartDocketField(input.sku, { source: "fallback" });
  next.searchBrowse.gtin = createWalmartDocketField(attributes.gtin ?? existing.searchBrowse.gtin.value, {
    source: attributes.gtin ? "items_list" : existing.searchBrowse.gtin.source,
  });
  next.searchBrowse.upc = createWalmartDocketField(attributes.upc ?? existing.searchBrowse.upc.value, {
    source: attributes.upc ? "items_list" : existing.searchBrowse.upc.source,
  });
  next.searchBrowse.lookupIdentifiers = createWalmartDocketField(resolvedLookupIdentifiers, { source: "fallback" });
  next.searchBrowse.productForm = createWalmartDocketField(
    attributes.product_form ?? attributes.form ?? existing.searchBrowse.productForm.value,
    { source: attributes.product_form || attributes.form ? "items_list" : existing.searchBrowse.productForm.source }
  );
  next.searchBrowse.flavor = createWalmartDocketField(attributes.flavor ?? existing.searchBrowse.flavor.value, {
    source: attributes.flavor ? "items_list" : existing.searchBrowse.flavor.source,
  });
  next.searchBrowse.mainIngredients = createWalmartDocketField(
    attributes.main_ingredients ?? existing.searchBrowse.mainIngredients.value,
    { source: attributes.main_ingredients ? "items_list" : existing.searchBrowse.mainIngredients.source }
  );
  next.searchBrowse.ingredientsList = createWalmartDocketField(
    attributes.ingredients_list ?? existing.searchBrowse.ingredientsList.value,
    { source: attributes.ingredients_list ? "items_list" : existing.searchBrowse.ingredientsList.source }
  );
  next.searchBrowse.servingSize = createWalmartDocketField(
    attributes.serving_size ?? existing.searchBrowse.servingSize.value,
    { source: attributes.serving_size ? "items_list" : existing.searchBrowse.servingSize.source }
  );
  next.searchBrowse.servings = createWalmartDocketField(
    attributes.servings ?? attributes.servings_per_container ?? existing.searchBrowse.servings.value,
    {
      source:
        attributes.servings || attributes.servings_per_container
          ? "items_list"
          : existing.searchBrowse.servings.source,
    }
  );
  next.searchBrowse.dosageStrength = createWalmartDocketField(
    attributes.dosage_strength ?? existing.searchBrowse.dosageStrength.value,
    { source: attributes.dosage_strength ? "items_list" : existing.searchBrowse.dosageStrength.source }
  );
  next.searchBrowse.countPerPack = createWalmartDocketField(
    attributes.count_per_pack ?? attributes.count_per_package ?? existing.searchBrowse.countPerPack.value,
    {
      source:
        attributes.count_per_pack || attributes.count_per_package
          ? "items_list"
          : existing.searchBrowse.countPerPack.source,
    }
  );
  next.searchBrowse.dimensions = createWalmartDocketField(
    attributes.dimensions ?? existing.searchBrowse.dimensions.value,
    { source: attributes.dimensions ? "items_list" : existing.searchBrowse.dimensions.source }
  );
  next.searchBrowse.suggestedUse = createWalmartDocketField(
    attributes.suggested_use ?? attributes.directions_suggested_use ?? existing.searchBrowse.suggestedUse.value,
    {
      source:
        attributes.suggested_use || attributes.directions_suggested_use
          ? "items_list"
          : existing.searchBrowse.suggestedUse.source,
    }
  );
  next.searchBrowse.safetyWarnings = createWalmartDocketField(
    attributes.safety_warnings ?? attributes.warning_text ?? existing.searchBrowse.safetyWarnings.value,
    {
      source:
        attributes.safety_warnings || attributes.warning_text
          ? "items_list"
          : existing.searchBrowse.safetyWarnings.source,
    }
  );
  next.searchBrowse.targetAudience = createWalmartDocketField(
    attributes.target_audience ?? attributes.age_group ?? existing.searchBrowse.targetAudience.value,
    {
      source:
        attributes.target_audience || attributes.age_group
          ? "items_list"
          : existing.searchBrowse.targetAudience.source,
    }
  );
  next.searchBrowse.searchKeywords = createWalmartDocketField(
    attributes.search_keywords ?? attributes.search_terms ?? existing.searchBrowse.searchKeywords.value,
    {
      source:
        attributes.search_keywords || attributes.search_terms
          ? "items_list"
          : existing.searchBrowse.searchKeywords.source,
    }
  );
  next.searchBrowse.benefits = createWalmartDocketField(
    attributes.benefits ?? attributes.support_areas ?? existing.searchBrowse.benefits.value,
    {
      source:
        attributes.benefits || attributes.support_areas
          ? "items_list"
          : existing.searchBrowse.benefits.source,
    }
  );
  next.searchBrowse.allergenFree = createWalmartDocketField(
    attributes.allergen_free ?? existing.searchBrowse.allergenFree.value,
    { source: attributes.allergen_free ? "items_list" : existing.searchBrowse.allergenFree.source }
  );
  next.searchBrowse.attributes = createWalmartDocketField(
    {
      ...existing.searchBrowse.attributes.value,
      ...attributes,
    },
    { source: "items_list", confidence: "medium" }
  );
  next.searchBrowse.complianceSearchNotes = existing.searchBrowse.complianceSearchNotes;

  return next;
}
