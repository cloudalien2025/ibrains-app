import type {
  CasaHudListingExtractionStatus,
  CasaHudListingNeedsReviewField,
  CasaHudListingImageStatus,
  CasaHudListingProvider,
  CasaHudListingUrlClassification,
} from "@/lib/studio/domara/campaigns";
import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { normalizeListingImportUrl, validateListingImportUrl } from "@/lib/studio/domara/listing-url-importer";

const MAX_HTML_BYTES = 500_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 6_500;

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  text: () => Promise<string>;
  url: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponse>;

type JsonRecord = Record<string, unknown>;

export type CasaHudListingUrlExtractionProvider = "immobiliare_html" | "idealista_generic" | "generic_html";

export type CasaHudImportedListingExtractionData = {
  sourceType: "imported_url";
  originalSourceUrl?: string;
  normalizedSourceUrl?: string;
  sourceUrl: string;
  sourceHost: string;
  sourceLabel: string;
  providerName: string;
  providerListingId?: string;
  canonicalUrl?: string;
  canonicalSourceUrl?: string;
  title?: string;
  metadataTitle?: string;
  metadataDescription?: string;
  locationText?: string;
  addressText?: string;
  city?: string;
  province?: string;
  region?: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  price?: number;
  priceCurrency?: string;
  priceText?: string;
  propertyType?: string;
  contract?: string;
  ownership?: string;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  kitchen?: string;
  interiorSizeSqm?: number;
  commercialSurfaceSqm?: number;
  landSizeSqm?: number;
  floorCount?: number;
  floorText?: string;
  buildingFloors?: number;
  lift?: boolean;
  garageParking?: string;
  balcony?: boolean;
  terrace?: boolean;
  furnished?: string;
  condition?: string;
  heating?: string;
  airConditioning?: string;
  energyClass?: string;
  energyConsumption?: string;
  pricePerSquareMeter?: number;
  condoFees?: string;
  referenceCode?: string;
  updatedDate?: string;
  photoCount?: number;
  floorPlanCount?: number;
  virtualTour?: boolean;
  advertiser?: string;
  description?: string;
  summary?: string;
  keyFeatures: string[];
  lifestyleHighlights: string[];
  featuredImageUrl?: string;
  imageUrls: string[];
  imageStatus: CasaHudListingImageStatus;
  casaHudDisplayTitle?: string;
  casaHudShortSummary?: string;
  casaHudNarrationSeed?: string;
};

export type CasaHudImportedListingExtractionResult = {
  normalizedUrl: string;
  provider: CasaHudListingProvider;
  providerName: string;
  providerListingId?: string;
  urlClassification: CasaHudListingUrlClassification;
  discoveredListingUrls: string[];
  extractionProvider: CasaHudListingUrlExtractionProvider;
  extractionStatus: CasaHudListingExtractionStatus;
  extractionConfidence: number;
  needsReviewFields: CasaHudListingNeedsReviewField[];
  warnings: string[];
  extractionFields: string[];
  data: CasaHudImportedListingExtractionData;
};

type ProviderInfo = {
  provider: CasaHudListingProvider;
  providerName: string;
  extractionProvider: CasaHudListingUrlExtractionProvider;
};

type ParsedListingDraft = Omit<CasaHudImportedListingExtractionData, "sourceType" | "sourceUrl" | "sourceHost" | "sourceLabel" | "providerName" | "imageUrls" | "keyFeatures" | "lifestyleHighlights" | "imageStatus"> & {
  imageCandidates?: string[];
  keyFeatures?: string[];
  lifestyleHighlights?: string[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(tagHtml: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attributeRegex.exec(tagHtml)) !== null) {
    const key = (match[1] || "").toLowerCase();
    const raw = match[3] ?? match[4] ?? match[5] ?? "";
    attributes[key] = decodeHtml(raw);
  }

  return attributes;
}

function parseMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const metaRegex = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.property || attrs.name || attrs["http-equiv"] || "").toLowerCase();
    const content = attrs.content?.trim();
    if (key && content) meta[key] = content;
  }

  return meta;
}

function extractTitleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function extractH1(html: string): string | undefined {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match?.[1]) return undefined;
  return decodeHtml(match[1].replace(/<[^>]+>/g, " "));
}

function resolveUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.startsWith("//") ? `https:${value}` : value;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractCanonicalLink(html: string, baseUrl: string): string | undefined {
  const match = html.match(/<link\b[^>]*rel\s*=\s*("|')canonical\1[^>]*>/i);
  if (!match?.[0]) return undefined;
  const attrs = parseAttributes(match[0]);
  return resolveUrl(attrs.href, baseUrl);
}

function flattenJson(value: unknown): JsonRecord[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenJson(item));
  const record = asRecord(value);
  if (!record) return [];

  const graph = record["@graph"];
  if (Array.isArray(graph)) {
    return [record, ...graph.flatMap((item) => flattenJson(item))];
  }

  return [record];
}

function readJsonPath(source: JsonRecord, paths: string[]): unknown {
  for (const path of paths) {
    const segments = path.split(".");
    let current: unknown = source;
    let failed = false;

    for (const segment of segments) {
      const record = asRecord(current);
      if (!record || !(segment in record)) {
        failed = true;
        break;
      }
      current = record[segment];
    }

    if (!failed && current !== undefined && current !== null) {
      return current;
    }
  }

  return undefined;
}

function normalizeNumberish(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const raw = String(value).trim();
  if (!raw) return undefined;
  const normalized = raw
    .replace(/\u00a0/g, " ")
    .replace(/(?<=\d)\.(?=\d{3}\b)/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.+-]/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integerFromText(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d{1,6})(?:[+])?/);
  return match ? Number(match[1]) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? decodeHtml(value) : undefined;
}

function pushUnique(target: string[], value?: string | null) {
  if (!value) return;
  const normalized = value.trim();
  if (!normalized) return;
  if (!target.includes(normalized)) target.push(normalized);
}

function normalizeTitle(value: string | undefined, providerName: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\s+\|\s+[^|]+$/i, "")
    .replace(/\s+-\s+(idealista|immobiliare)(\.it)?$/i, "")
    .replace(/\s+\|\s+(idealista|immobiliare)(\.it)?$/i, "")
    .trim();
  return cleaned || `Imported listing from ${providerName}`;
}

function normalizePropertyType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\b(class|@type|offer)\b/gi, "")
    .trim();
  return cleaned || undefined;
}

function formatPrice(price?: number, currency?: string): string | undefined {
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  if ((currency || "EUR").toUpperCase() === "EUR") return `€${price.toLocaleString("en-US")}`;
  if ((currency || "").toUpperCase() === "USD") return `$${price.toLocaleString("en-US")}`;
  return `${currency || "EUR"} ${price.toLocaleString("en-US")}`;
}

function parsePrice(value: string | undefined): { price?: number; currency?: string; priceText?: string } {
  if (!value) return {};
  const match = value.match(/(€|eur|usd|\$)\s*([\d.]+(?:,\d{1,2})?|\d[\d.,]*)/i);
  if (!match) return {};

  const currency = match[1] === "$" || match[1]?.toLowerCase() === "usd" ? "USD" : "EUR";
  const amount = normalizeNumberish(match[2]);
  if (amount === undefined) return { currency };

  const price = Math.round(amount);
  return {
    price,
    currency,
    priceText: formatPrice(price, currency),
  };
}

function extractFactsFromText(text: string | undefined): ParsedListingDraft {
  if (!text) return { imageCandidates: [], keyFeatures: [], lifestyleHighlights: [] };

  const draft: ParsedListingDraft = { imageCandidates: [], keyFeatures: [], lifestyleHighlights: [] };
  const propertyCorpus = text.toLowerCase();
  if (/\b(casale|country house|rustic farmhouse|farmhouse)\b/i.test(text)) draft.propertyType = "Country house";
  else if (/\btownhouse\b/i.test(text)) draft.propertyType = "Townhouse";
  else if (/\b(apartment|flat|appartamento)\b/i.test(text)) draft.propertyType = "Apartment";
  else if (/\bvilla\b/i.test(text)) draft.propertyType = "Villa";
  else if (/\bstudio\b/i.test(text)) draft.propertyType = "Studio";
  else if (/\bloft\b/i.test(text)) draft.propertyType = "Loft";
  else if (/\bhouse\b/i.test(propertyCorpus)) draft.propertyType = "House";

  draft.rooms = integerFromText(text.match(/(\d{1,2}\+?)\s*(?:rooms?|locali)/i)?.[1]);
  draft.bedrooms = integerFromText(text.match(/(\d{1,2})\s*(?:bed(?:rooms?)?|camere? da letto|camere?)/i)?.[1]);
  draft.bathrooms = integerFromText(text.match(/(\d{1,2})\s*(?:bath(?:rooms?)?|bagni?)/i)?.[1]);
  draft.interiorSizeSqm = normalizeNumberish(text.match(/(\d{2,5})\s*(?:sqm|sq\.?\s*m|m2|m²)/i)?.[1]);

  const locationMatch =
    text.match(/\bin\s+([A-Z][A-Za-z' -]+(?:,\s*[A-Z][A-Za-z' -]+){0,3})(?=\s+(?:with|for)\b|[.!,]|$)/) ||
    text.match(/-\s*([A-Z][A-Za-z' -]+(?:,\s*[A-Z][A-Za-z' -]+){0,3})(?=\s+(?:with|for)\b|[.!,]|$)/);
  if (locationMatch?.[1]) draft.locationText = locationMatch[1].trim();

  return draft;
}

function parseAddressParts(locationText: string | undefined) {
  if (!locationText) return {};
  const parts = locationText.split(",").map((item) => item.trim()).filter(Boolean);
  const city = parts.length >= 5 ? parts[1] : parts[0];
  const province = parts.length >= 5 ? parts[2] : parts.length >= 4 ? parts[1] : undefined;
  const region = parts.length >= 5 ? parts[3] : parts.length >= 4 ? parts[2] : parts.length === 3 ? parts[1] : undefined;
  const country = parts.length >= 2 ? parts[parts.length - 1] : undefined;
  return {
    city,
    province,
    region,
    country,
  };
}

function extractJsonLdScripts(html: string): JsonRecord[] {
  const results: JsonRecord[] = [];
  const scriptRegex = /<script\b[^>]*type\s*=\s*("|')application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const payload = (match[2] || "").trim();
    if (!payload) continue;

    try {
      const parsed = JSON.parse(payload);
      results.push(...flattenJson(parsed));
    } catch {
      continue;
    }
  }

  return results;
}

function extractEmbeddedStateScripts(html: string): JsonRecord[] {
  const results: JsonRecord[] = [];
  const jsonScriptRegex = /<script\b[^>]*type\s*=\s*("|')application\/json\1[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = jsonScriptRegex.exec(html)) !== null) {
    const payload = (match[2] || "").trim();
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload);
      results.push(...flattenJson(parsed));
    } catch {
      continue;
    }
  }

  const windowStateRegex = /window\.__[A-Z0-9_]+\s*=\s*(\{[\s\S]*?\});/gi;
  while ((match = windowStateRegex.exec(html)) !== null) {
    const payload = (match[1] || "").trim().replace(/;$/, "");
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload);
      results.push(...flattenJson(parsed));
    } catch {
      continue;
    }
  }

  return results;
}

function htmlToTextLines(html: string): string[] {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/tr|\/h1|\/h2|\/h3|\/h4|\/h5|\/h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return withoutScripts
    .split(/\r?\n/)
    .map((line) => decodeHtml(line))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findLineValue(lines: string[], patterns: RegExp[]): string | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const captured = decodeHtml((match[1] || "").trim());
      if (captured) return captured;

      for (let offset = 1; offset <= 2; offset += 1) {
        const next = lines[index + offset];
        if (!next) break;
        if (next.length > 80 && !/\d/.test(next) && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}$/.test(next)) break;
        if (!patterns.some((candidate) => candidate.test(next))) return next;
      }
    }
  }

  return undefined;
}

function collectSectionText(lines: string[], headingPatterns: RegExp[], maxLines = 8): string | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!headingPatterns.some((pattern) => pattern.test(line))) continue;

    const collected: string[] = [];
    for (let offset = 1; offset <= maxLines; offset += 1) {
      const next = lines[index + offset];
      if (!next) break;
      if (/^(caratteristiche|features|indirizzo|address|prezzo|price|locali|rooms|bagni|bathrooms|camere|bedrooms|piano|floor|classe energetica|energy class|rif\.|reference|aggiornato|updated)\b/i.test(next)) {
        break;
      }
      collected.push(next);
    }

    if (collected.length > 0) return collected.join(" ").trim();
  }

  return undefined;
}

function detectProvider(url: URL): ProviderInfo {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host.endsWith("immobiliare.it")) {
    return { provider: "immobiliare", providerName: "Immobiliare", extractionProvider: "immobiliare_html" };
  }
  if (host.endsWith("idealista.it")) {
    return { provider: "idealista", providerName: "Idealista", extractionProvider: "idealista_generic" };
  }
  return { provider: "generic", providerName: host, extractionProvider: "generic_html" };
}

const IMMOBILIARE_LISTING_PATH = /^\/(?:[a-z]{2}\/)?annunci\/\d+(?:\/|$)/i;
const IDEALISTA_LISTING_PATH = /^\/(?:[a-z]{2}\/)?(?:annuncio|immobile|inmueble)\/\d+(?:\/|$)/i;
const SEARCH_RESULT_PATH = /\/(?:vendita|vendita-case|affitto|case|immobili|ricerca|search|result|results)(?:[-/]|$)/i;

export function classifyListingImportUrl(input: string | URL): {
  normalizedUrl: string;
  provider: CasaHudListingProvider;
  providerName: string;
  classification: CasaHudListingUrlClassification;
} {
  const normalized = normalizeListingImportUrl(input);
  const providerInfo = detectProvider(normalized);
  const pathname = normalized.pathname;

  if (providerInfo.provider === "immobiliare") {
    if (IMMOBILIARE_LISTING_PATH.test(pathname)) {
      return { normalizedUrl: normalized.toString(), provider: providerInfo.provider, providerName: providerInfo.providerName, classification: "listing" };
    }
    if (SEARCH_RESULT_PATH.test(pathname)) {
      return { normalizedUrl: normalized.toString(), provider: providerInfo.provider, providerName: providerInfo.providerName, classification: "search_results" };
    }
    return {
      normalizedUrl: normalized.toString(),
      provider: providerInfo.provider,
      providerName: providerInfo.providerName,
      classification: pathname === "/" ? "provider_page" : "unsupported_provider_path",
    };
  }

  if (providerInfo.provider === "idealista") {
    if (IDEALISTA_LISTING_PATH.test(pathname)) {
      return { normalizedUrl: normalized.toString(), provider: providerInfo.provider, providerName: providerInfo.providerName, classification: "listing" };
    }
    if (SEARCH_RESULT_PATH.test(pathname)) {
      return { normalizedUrl: normalized.toString(), provider: providerInfo.provider, providerName: providerInfo.providerName, classification: "search_results" };
    }
    return {
      normalizedUrl: normalized.toString(),
      provider: providerInfo.provider,
      providerName: providerInfo.providerName,
      classification: pathname === "/" ? "provider_page" : "unsupported_provider_path",
    };
  }

  const genericClassification =
    /\/\d{5,}(?:\/|$)/.test(pathname) || /\/(?:listing|property|annuncio|annunci|immobile)\//i.test(pathname)
      ? "listing"
      : pathname === "/"
        ? "provider_page"
        : "unsupported_provider_path";

  return {
    normalizedUrl: normalized.toString(),
    provider: providerInfo.provider,
    providerName: providerInfo.providerName,
    classification: genericClassification,
  };
}

function detectProviderListingId(url: URL, provider: CasaHudListingProvider): string | undefined {
  if (provider === "immobiliare") {
    return url.pathname.match(/\/annunci\/(\d+)/i)?.[1];
  }
  if (provider === "idealista") {
    return url.pathname.match(/\/(?:annuncio|immobile|inmueble)\/(\d+)/i)?.[1];
  }
  return url.pathname.match(/\/(\d{5,})\/?$/)?.[1];
}

function looksBlocked(html: string): boolean {
  return /please enable js and disable any ad blocker|captcha-delivery\.com|datadome|cf-chl|access denied/i.test(html);
}

function extractProviderListingUrlsFromHtml(html: string, baseUrl: string, provider: CasaHudListingProvider): string[] {
  const urls: string[] = [];
  const hrefRegex = /<a\b[^>]*href\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = decodeHtml((match[2] || match[3] || match[4] || "").trim());
    if (!href) continue;

    let resolved: URL;
    try {
      resolved = normalizeListingImportUrl(new URL(href.startsWith("//") ? `https:${href}` : href, baseUrl));
    } catch {
      continue;
    }

    if (provider !== "generic" && detectProvider(resolved).provider !== provider) continue;
    if (classifyListingImportUrl(resolved).classification !== "listing") continue;
    pushUnique(urls, resolved.toString());
    if (urls.length >= 8) break;
  }

  return urls;
}

function collectImagesFromUnknown(value: unknown, baseUrl: string, images: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    const resolved = resolveUrl(value, baseUrl);
    if (resolved) pushUnique(images, resolved);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImagesFromUnknown(item, baseUrl, images);
    return;
  }

  const record = asRecord(value);
  if (!record) return;
  for (const key of ["url", "src", "image", "contentUrl", "thumbnailUrl"]) {
    const resolved = resolveUrl(stringValue(record[key]), baseUrl);
    if (resolved) pushUnique(images, resolved);
  }
}

function extractFromJsonLd(nodes: JsonRecord[], baseUrl: string): ParsedListingDraft {
  const imageCandidates: string[] = [];
  const draft: ParsedListingDraft = { imageCandidates, keyFeatures: [], lifestyleHighlights: [] };

  for (const node of nodes) {
    if (!draft.title) draft.title = stringValue(readJsonPath(node, ["name", "headline", "title"]));
    if (!draft.description) draft.description = stringValue(readJsonPath(node, ["description"]));
    if (!draft.canonicalUrl) draft.canonicalUrl = resolveUrl(stringValue(readJsonPath(node, ["url", "mainEntityOfPage", "mainEntityOfPage.@id"])), baseUrl);
    if (!draft.price) {
      const price = readJsonPath(node, ["offers.price", "offers.priceSpecification.price", "price"]);
      draft.price = normalizeNumberish(price);
    }
    if (!draft.priceCurrency) draft.priceCurrency = stringValue(readJsonPath(node, ["offers.priceCurrency", "priceCurrency"]));
    if (!draft.propertyType) {
      draft.propertyType = stringValue(readJsonPath(node, ["category", "additionalType", "accommodationCategory", "@type"]));
    }
    if (draft.rooms === undefined) {
      draft.rooms = normalizeNumberish(readJsonPath(node, ["numberOfRooms", "numberOfRoomsTotal"]));
    }
    if (draft.bedrooms === undefined) {
      draft.bedrooms = normalizeNumberish(readJsonPath(node, ["numberOfBedrooms", "numberOfRooms"]));
    }
    if (draft.bathrooms === undefined) {
      draft.bathrooms = normalizeNumberish(readJsonPath(node, ["numberOfBathroomsTotal", "numberOfBathrooms"]));
    }
    if (draft.interiorSizeSqm === undefined) {
      draft.interiorSizeSqm = normalizeNumberish(readJsonPath(node, ["floorSize.value", "floorSize", "area.value"]));
    }
    if (!draft.addressText) {
      const address = readJsonPath(node, [
        "address.streetAddress",
        "address.name",
      ]);
      draft.addressText = stringValue(address);
    }
    if (!draft.city) draft.city = stringValue(readJsonPath(node, ["address.addressLocality"]));
    if (!draft.province) draft.province = stringValue(readJsonPath(node, ["address.addressRegion"]));
    if (!draft.country) draft.country = stringValue(readJsonPath(node, ["address.addressCountry"]));

    const latitude = normalizeNumberish(readJsonPath(node, ["geo.latitude", "geo.lat"]));
    const longitude = normalizeNumberish(readJsonPath(node, ["geo.longitude", "geo.lng", "geo.lon"]));
    if (!draft.coordinates && latitude !== undefined && longitude !== undefined) {
      draft.coordinates = { latitude, longitude };
    }

    collectImagesFromUnknown(readJsonPath(node, ["image", "photo", "photos"]), baseUrl, imageCandidates);
  }

  return draft;
}

function walkEmbeddedState(value: unknown, visitor: (path: string, key: string, value: unknown) => void, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkEmbeddedState(item, visitor, `${path}[${index}]`));
    return;
  }

  const record = asRecord(value);
  if (!record) return;
  for (const [key, current] of Object.entries(record)) {
    const nextPath = `${path}.${key}`;
    visitor(nextPath, key, current);
    walkEmbeddedState(current, visitor, nextPath);
  }
}

function extractFromEmbeddedState(nodes: JsonRecord[], baseUrl: string): ParsedListingDraft {
  const imageCandidates: string[] = [];
  const draft: ParsedListingDraft = { imageCandidates, keyFeatures: [], lifestyleHighlights: [] };

  for (const node of nodes) {
    walkEmbeddedState(node, (_path, key, value) => {
      const lowerKey = key.toLowerCase();
      if (!draft.title && ["title", "headline", "name"].includes(lowerKey)) {
        const text = stringValue(value);
        if (text && text.length >= 8) draft.title = text;
      }
      if (!draft.description && ["description", "summary", "descriptiontext"].includes(lowerKey)) {
        const text = stringValue(value);
        if (text && text.length >= 24) draft.description = text;
      }
      if (!draft.locationText && ["locationtext", "location", "address"].includes(lowerKey)) {
        const text = stringValue(value);
        if (text && /,/.test(text)) draft.locationText = text;
      }
      if (!draft.addressText && ["streetaddress", "addresstext"].includes(lowerKey)) {
        const text = stringValue(value);
        if (text) draft.addressText = text;
      }
      if (!draft.city && lowerKey === "city") draft.city = stringValue(value);
      if (!draft.province && ["province", "county"].includes(lowerKey)) draft.province = stringValue(value);
      if (!draft.region && ["region", "state"].includes(lowerKey)) draft.region = stringValue(value);
      if (!draft.country && lowerKey === "country") draft.country = stringValue(value);
      if (!draft.propertyType && ["propertytype", "category", "assettype"].includes(lowerKey)) {
        draft.propertyType = stringValue(value);
      }
      if (!draft.contract && ["contract", "contracttype"].includes(lowerKey)) draft.contract = stringValue(value);
      if (!draft.ownership && ["ownership", "ownershiptype"].includes(lowerKey)) draft.ownership = stringValue(value);
      if (!draft.priceText && lowerKey === "pricetext") draft.priceText = stringValue(value);
      if (draft.price === undefined && ["price", "amount", "value"].includes(lowerKey)) {
        const amount = normalizeNumberish(value);
        if (amount !== undefined && amount > 100) draft.price = amount;
      }
      if (!draft.priceCurrency && ["currency", "currencycode"].includes(lowerKey)) draft.priceCurrency = stringValue(value);
      if (draft.rooms === undefined && ["rooms", "roomcount"].includes(lowerKey)) draft.rooms = normalizeNumberish(value);
      if (draft.bedrooms === undefined && ["bedrooms", "bedroomcount", "numberofbedrooms"].includes(lowerKey)) {
        draft.bedrooms = normalizeNumberish(value);
      }
      if (draft.bathrooms === undefined && ["bathrooms", "bathroomcount", "numberofbathroomstotal"].includes(lowerKey)) {
        draft.bathrooms = normalizeNumberish(value);
      }
      if (!draft.kitchen && ["kitchen", "kitchentype"].includes(lowerKey)) draft.kitchen = stringValue(value);
      if (draft.interiorSizeSqm === undefined && ["sizesqm", "interiorsizesqm", "size", "surface"].includes(lowerKey)) {
        const amount = normalizeNumberish(value);
        if (amount !== undefined && amount > 10) draft.interiorSizeSqm = amount;
      }
      if (draft.commercialSurfaceSqm === undefined && ["commercialsurfacesqm", "commercialsurface"].includes(lowerKey)) {
        draft.commercialSurfaceSqm = normalizeNumberish(value);
      }
      if (draft.landSizeSqm === undefined && ["landsizesqm", "gardensizesqm", "plotsize", "landsize"].includes(lowerKey)) {
        draft.landSizeSqm = normalizeNumberish(value);
      }
      if (draft.floorCount === undefined && ["floorcount", "floors"].includes(lowerKey)) {
        draft.floorCount = normalizeNumberish(value);
      }
      if (!draft.floorText && ["floortext", "floor"].includes(lowerKey)) draft.floorText = stringValue(value);
      if (draft.buildingFloors === undefined && ["buildingfloors", "buildingfloorcount"].includes(lowerKey)) {
        draft.buildingFloors = normalizeNumberish(value);
      }
      if (draft.lift === undefined && lowerKey === "lift" && typeof value === "boolean") draft.lift = value;
      if (!draft.garageParking && ["garageparking", "parking", "parkingtext"].includes(lowerKey)) {
        draft.garageParking = stringValue(value);
      }
      if (draft.balcony === undefined && lowerKey === "balcony" && typeof value === "boolean") draft.balcony = value;
      if (draft.terrace === undefined && lowerKey === "terrace" && typeof value === "boolean") draft.terrace = value;
      if (!draft.furnished && ["furnished", "furniture"].includes(lowerKey)) draft.furnished = stringValue(value);
      if (!draft.condition && ["condition", "state"].includes(lowerKey)) draft.condition = stringValue(value);
      if (!draft.heating && ["heating", "heatingtype"].includes(lowerKey)) draft.heating = stringValue(value);
      if (!draft.airConditioning && ["airconditioning", "ac", "cooling"].includes(lowerKey)) draft.airConditioning = stringValue(value);
      if (!draft.energyClass && ["energyclass", "energy"].includes(lowerKey)) draft.energyClass = stringValue(value);
      if (!draft.energyConsumption && ["energyconsumption", "consumption"].includes(lowerKey)) draft.energyConsumption = stringValue(value);
      if (draft.pricePerSquareMeter === undefined && ["pricepersquaremeter", "pricepersqm"].includes(lowerKey)) {
        draft.pricePerSquareMeter = normalizeNumberish(value);
      }
      if (!draft.condoFees && ["condofees", "monthlyfees", "servicecharge"].includes(lowerKey)) draft.condoFees = stringValue(value);
      if (!draft.referenceCode && ["reference", "referencecode", "listingid"].includes(lowerKey)) {
        const text = stringValue(value);
        if (text) draft.referenceCode = text;
      }
      if (!draft.updatedDate && ["updateddate", "updatedat", "updatedon"].includes(lowerKey)) draft.updatedDate = stringValue(value);
      if (draft.photoCount === undefined && ["photocount", "photoscount", "imagescount"].includes(lowerKey)) {
        draft.photoCount = normalizeNumberish(value);
      }
      if (draft.floorPlanCount === undefined && ["floorplancount", "planimetrycount"].includes(lowerKey)) {
        draft.floorPlanCount = normalizeNumberish(value);
      }
      if (draft.virtualTour === undefined && ["virtualtour", "hastour"].includes(lowerKey) && typeof value === "boolean") {
        draft.virtualTour = value;
      }
      if (!draft.advertiser && ["advertiser", "agency", "agencyname", "contactname"].includes(lowerKey)) {
        draft.advertiser = stringValue(value);
      }
      if (lowerKey.includes("image") || lowerKey.includes("photo") || lowerKey.includes("gallery")) {
        collectImagesFromUnknown(value, baseUrl, imageCandidates);
      }
    });
  }

  return draft;
}

function mergeDrafts(...drafts: ParsedListingDraft[]): ParsedListingDraft {
  const result: ParsedListingDraft = { imageCandidates: [], keyFeatures: [], lifestyleHighlights: [] };

  for (const draft of drafts) {
    for (const [key, value] of Object.entries(draft)) {
      if (key === "imageCandidates") {
        for (const image of (value as string[] | undefined) || []) pushUnique(result.imageCandidates!, image);
        continue;
      }
      if (key === "keyFeatures") {
        for (const item of (value as string[] | undefined) || []) pushUnique(result.keyFeatures!, item);
        continue;
      }
      if (key === "lifestyleHighlights") {
        for (const item of (value as string[] | undefined) || []) pushUnique(result.lifestyleHighlights!, item);
        continue;
      }
      if (value === undefined || value === null) continue;
      if ((result as Record<string, unknown>)[key] === undefined) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }

  return result;
}

function booleanFromText(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (/\b(?:yes|true|si|sì|presente|available)\b/i.test(value)) return true;
  if (/\b(?:no|false|assente|none|non presente)\b/i.test(value)) return false;
  return undefined;
}

function extractImmobiliareFromText(lines: string[], fullText: string): ParsedListingDraft {
  const draft: ParsedListingDraft = { imageCandidates: [], keyFeatures: [], lifestyleHighlights: [] };

  const locationValue =
    findLineValue(lines, [/^(?:indirizzo|address|localit(?:a|à)|location)\b[:\s-]*(.*)$/i]) ||
    findLineValue(lines, [/^(?:Contrada|Via|Viale|Piazza)\b(.*)$/i]);
  if (locationValue) {
    draft.locationText = locationValue.startsWith("Contrada") ? locationValue : locationValue;
    draft.addressText = locationValue;
  }

  const propertyType = findLineValue(lines, [/^(?:tipologia|property type)\b[:\s-]*(.*)$/i]);
  if (propertyType) draft.propertyType = propertyType;

  const priceText =
    findLineValue(lines, [/^(?:prezzo|price)\b[:\s-]*(.*)$/i]) ||
    fullText.match(/(€\s*[\d.]+(?:,\d+)?)/i)?.[1];
  if (priceText) {
    draft.priceText = priceText;
    const parsedPrice = parsePrice(priceText);
    if (parsedPrice.price !== undefined) draft.price = parsedPrice.price;
    if (parsedPrice.currency) draft.priceCurrency = parsedPrice.currency;
  }

  const rooms = findLineValue(lines, [/^(?:locali|rooms?)\b[:\s-]*(.*)$/i]);
  if (rooms) draft.rooms = integerFromText(rooms);

  const bedrooms = findLineValue(lines, [/^(?:camere da letto|bedrooms?)\b[:\s-]*(.*)$/i, /^(?:camere)\b[:\s-]*(.*)$/i]);
  if (bedrooms) draft.bedrooms = integerFromText(bedrooms);

  const bathrooms = findLineValue(lines, [/^(?:bagni|bathrooms?)\b[:\s-]*(.*)$/i]);
  if (bathrooms) draft.bathrooms = integerFromText(bathrooms);

  const interior = findLineValue(lines, [/^(?:superficie interna|superficie|surface|metratura)\b[:\s-]*(.*)$/i]);
  if (interior) draft.interiorSizeSqm = normalizeNumberish(interior);

  const commercialSurface = findLineValue(lines, [/^(?:superficie commerciale|commercial surface)\b[:\s-]*(.*)$/i]);
  if (commercialSurface) draft.commercialSurfaceSqm = normalizeNumberish(commercialSurface);

  const land = findLineValue(lines, [/^(?:terreno|giardino|land|garden)\b[:\s-]*(.*)$/i]);
  if (land) draft.landSizeSqm = normalizeNumberish(land);

  const floor = findLineValue(lines, [/^(?:piano|floor|floors?)\b[:\s-]*(.*)$/i]);
  if (floor) {
    draft.floorText = floor;
    const floorCount = fullText.match(/(\d+)\s*(?:piani|floors? total|floors? in total)/i)?.[1];
    draft.floorCount = floorCount ? Number(floorCount) : integerFromText(floor);
  }

  const parking = findLineValue(lines, [/^(?:garage|garage\/parking|posti auto|parking)\b[:\s-]*(.*)$/i]);
  if (parking) draft.garageParking = parking;

  const balcony = findLineValue(lines, [/^(?:balcone|balcony)\b[:\s-]*(.*)$/i]);
  if (balcony !== undefined) draft.balcony = booleanFromText(balcony) ?? true;

  const terrace = findLineValue(lines, [/^(?:terrazzo|terrace)\b[:\s-]*(.*)$/i]);
  if (terrace !== undefined) draft.terrace = booleanFromText(terrace) ?? true;

  const condition = findLineValue(lines, [/^(?:stato|condition)\b[:\s-]*(.*)$/i]);
  if (condition) draft.condition = condition;

  const furnished = findLineValue(lines, [/^(?:arredato|furnished)\b[:\s-]*(.*)$/i]);
  if (furnished) draft.furnished = furnished;

  const heating = findLineValue(lines, [/^(?:riscaldamento|heating)\b[:\s-]*(.*)$/i]);
  if (heating) draft.heating = heating;

  const airConditioning = findLineValue(lines, [/^(?:aria condizionata|air conditioning)\b[:\s-]*(.*)$/i]);
  if (airConditioning) draft.airConditioning = airConditioning;

  const energy = findLineValue(lines, [/^(?:classe energetica|energy class)\b[:\s-]*(.*)$/i]);
  if (energy) draft.energyClass = energy;

  const pricePerSqm = fullText.match(/€\s*([\d.]+(?:,\d+)?)\s*\/\s*m²/i)?.[1];
  if (pricePerSqm) draft.pricePerSquareMeter = normalizeNumberish(pricePerSqm);

  const reference =
    findLineValue(lines, [/^(?:rif(?:erimento)?\.?|reference)\b[:\s-]*(.*)$/i]) ||
    fullText.match(/\b(EK-[A-Z0-9-]+)\b/i)?.[1];
  if (reference) draft.referenceCode = reference;

  const updated =
    findLineValue(lines, [/^(?:aggiornato(?: il)?|updated(?: on)?)\b[:\s-]*(.*)$/i]) ||
    fullText.match(/\b(?:Aggiornato(?: il)?|Updated(?: on)?)\s+([A-Za-z0-9 ,]+(?:\d{4}))/i)?.[1];
  if (updated) draft.updatedDate = updated;

  const photoCount = fullText.match(/\b(\d{1,3})\s*fot[oi]\b/i)?.[1];
  if (photoCount) draft.photoCount = Number(photoCount);

  const floorPlanCount = fullText.match(/\b(\d{1,3})\s*planimetr/i)?.[1];
  if (floorPlanCount) draft.floorPlanCount = Number(floorPlanCount);

  if (draft.virtualTour === undefined && /\bvirtual tour\b/i.test(fullText)) {
    draft.virtualTour = true;
  }

  const advertiser = findLineValue(lines, [/^(?:annunciante|advertiser|agenzia|agency)\b[:\s-]*(.*)$/i]);
  if (advertiser) draft.advertiser = advertiser;

  const description = collectSectionText(lines, [/^(?:descrizione|description)$/i], 10);
  if (description) draft.description = description;

  return draft;
}

function extractGenericMetaDraft(meta: Record<string, string>, pageUrl: string, titleTag?: string): ParsedListingDraft {
  const metadataTitle = meta["og:title"] || meta["twitter:title"] || titleTag;
  const metadataDescription = meta["og:description"] || meta["twitter:description"] || meta.description;
  const priceDetails = parsePrice(metadataDescription);
  const titleFacts = extractFactsFromText(metadataTitle);
  const descriptionFacts = extractFactsFromText(metadataDescription);
  const textFacts = mergeDrafts(descriptionFacts, titleFacts);
  const imageCandidates: string[] = [];
  pushUnique(imageCandidates, resolveUrl(meta["og:image"] || meta["twitter:image"], pageUrl));
  return {
    title: metadataTitle,
    metadataTitle,
    metadataDescription,
    canonicalUrl: resolveUrl(meta["og:url"], pageUrl),
    price: priceDetails.price,
    priceCurrency: priceDetails.currency,
    priceText: priceDetails.priceText,
    locationText: descriptionFacts.locationText || titleFacts.locationText,
    propertyType: textFacts.propertyType,
    rooms: textFacts.rooms,
    bedrooms: textFacts.bedrooms,
    bathrooms: textFacts.bathrooms,
    interiorSizeSqm: textFacts.interiorSizeSqm,
    imageCandidates,
    keyFeatures: [],
    lifestyleHighlights: [],
  };
}

function lifestyleHighlights(description: string | undefined): string[] {
  if (!description) return [];
  const sentences = description
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(
    new Set(
      sentences.filter((sentence) =>
        /\b(olive|grove|beach|cilento|park|panoramic|capri|fruit trees?|spring|vacation home|agriturismo|privacy|countryside|coastal)\b/i.test(
          sentence,
        ),
      ),
    ),
  ).slice(0, 4);
}

function buildKeyFeatures(draft: ParsedListingDraft): string[] {
  const features: string[] = [];
  pushUnique(features, draft.propertyType);
  if (draft.rooms !== undefined) pushUnique(features, `${draft.rooms}+ rooms`);
  if (draft.bedrooms !== undefined) pushUnique(features, `${draft.bedrooms} bedrooms`);
  if (draft.bathrooms !== undefined) pushUnique(features, `${draft.bathrooms} bathrooms`);
  if (draft.interiorSizeSqm !== undefined) pushUnique(features, `${Math.round(draft.interiorSizeSqm)} m² interior`);
  if (draft.landSizeSqm !== undefined) pushUnique(features, `${Math.round(draft.landSizeSqm).toLocaleString("en-US")} m² land`);
  if (draft.garageParking) pushUnique(features, draft.garageParking);
  if (draft.balcony) pushUnique(features, "Balcony");
  if (draft.terrace) pushUnique(features, "Terrace");
  if (draft.condition) pushUnique(features, draft.condition);
  if (draft.heating) pushUnique(features, draft.heating);
  if (draft.energyClass) pushUnique(features, draft.energyClass);
  return features.slice(0, 8);
}

function buildShortSummary(draft: ParsedListingDraft): string | undefined {
  const parts = [
    draft.propertyType ? `A ${draft.propertyType.toLowerCase()}` : draft.title ? draft.title : "This property",
    draft.locationText ? `in ${draft.locationText}` : null,
    draft.bedrooms !== undefined ? `with ${draft.bedrooms} bedrooms` : null,
    draft.bathrooms !== undefined ? `${draft.bathrooms} bathrooms` : null,
    draft.interiorSizeSqm !== undefined ? `${Math.round(draft.interiorSizeSqm)} m² of interior space` : null,
    draft.landSizeSqm !== undefined ? `${Math.round(draft.landSizeSqm).toLocaleString("en-US")} m² of land` : null,
    draft.priceText ? `priced at ${draft.priceText}` : null,
  ].filter(Boolean) as string[];

  if (parts.length < 2) return undefined;
  return `${parts[0]} ${parts.slice(1).join(", ")}.`.replace(/\s+,/g, ",");
}

function buildNarrationSeed(draft: ParsedListingDraft): string | undefined {
  const summary = buildShortSummary(draft);
  const highlight = lifestyleHighlights(draft.description || draft.metadataDescription)[0];
  if (summary && highlight) return `${summary} ${highlight}`;
  return summary || highlight || undefined;
}

function extractionFields(draft: ParsedListingDraft, featuredImageUrl?: string): string[] {
  const fields = [
    ["title", draft.title],
    ["locationText", draft.locationText],
    ["addressText", draft.addressText],
    ["price", draft.price],
    ["propertyType", draft.propertyType],
    ["rooms", draft.rooms],
    ["bedrooms", draft.bedrooms],
    ["bathrooms", draft.bathrooms],
    ["interiorSizeSqm", draft.interiorSizeSqm],
    ["commercialSurfaceSqm", draft.commercialSurfaceSqm],
    ["landSizeSqm", draft.landSizeSqm],
    ["floorText", draft.floorText],
    ["garageParking", draft.garageParking],
    ["condition", draft.condition],
    ["heating", draft.heating],
    ["energyClass", draft.energyClass],
    ["referenceCode", draft.referenceCode],
    ["updatedDate", draft.updatedDate],
    ["photoCount", draft.photoCount],
    ["floorPlanCount", draft.floorPlanCount],
    ["description", draft.description],
    ["featuredImageUrl", featuredImageUrl],
  ] as const;

  return fields.flatMap(([name, value]) => (value !== undefined && value !== null ? [name] : []));
}

function determineStatus(params: {
  blocked: boolean;
  extractedFields: string[];
}): CasaHudListingExtractionStatus {
  if (params.blocked) return "blocked_or_unavailable";
  if (params.extractedFields.length >= 6) return "extracted";
  if (params.extractedFields.length >= 2) return "partial";
  return "failed";
}

function buildNeedsReviewFields(draft: ParsedListingDraft, imageStatus: CasaHudListingImageStatus) {
  const fields: CasaHudListingNeedsReviewField[] = [];
  if (draft.price === undefined) fields.push("price");
  if (!draft.locationText) fields.push("location");
  if (!draft.propertyType) fields.push("property_type");
  if (draft.bedrooms === undefined || draft.bathrooms === undefined) fields.push("bedrooms_bathrooms");
  if (draft.interiorSizeSqm === undefined) fields.push("size");
  if (draft.rooms === undefined) fields.push("rooms");
  if (draft.landSizeSqm === undefined) fields.push("land_size");
  if (!draft.floorText && draft.floorCount === undefined) fields.push("floor");
  if (!draft.garageParking) fields.push("parking");
  if (!draft.condition) fields.push("condition");
  if (!draft.energyClass) fields.push("energy");
  if (imageStatus !== "available") fields.push("images");
  if (!draft.description && !draft.summary) fields.push("summary");
  return fields;
}

function fetchErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Listing extraction failed.";
  return error.message.replace(/(api[_-]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}

function buildEmptyExtractionResult(params: {
  url: URL;
  providerInfo: ProviderInfo;
  providerListingId?: string;
  urlClassification: CasaHudListingUrlClassification;
  extractionStatus: CasaHudListingExtractionStatus;
  warnings: string[];
  discoveredListingUrls?: string[];
  canonicalUrl?: string;
  originalUrl?: string;
}): CasaHudImportedListingExtractionResult {
  return {
    normalizedUrl: params.url.toString(),
    provider: params.providerInfo.provider,
    providerName: params.providerInfo.providerName,
    providerListingId: params.providerListingId || detectProviderListingId(params.url, params.providerInfo.provider),
    urlClassification: params.urlClassification,
    discoveredListingUrls: params.discoveredListingUrls || [],
    extractionProvider: params.providerInfo.extractionProvider,
    extractionStatus: params.extractionStatus,
    extractionConfidence: 0,
    needsReviewFields: [],
    warnings: params.warnings,
    extractionFields: [],
    data: {
      sourceType: "imported_url",
      originalSourceUrl: params.originalUrl || params.url.toString(),
      normalizedSourceUrl: params.url.toString(),
      sourceUrl: params.url.toString(),
      sourceHost: params.url.hostname.replace(/^www\./, ""),
      sourceLabel: params.providerInfo.providerName,
      providerName: params.providerInfo.providerName,
      providerListingId: params.providerListingId || detectProviderListingId(params.url, params.providerInfo.provider),
      canonicalUrl: params.canonicalUrl || params.url.toString(),
      canonicalSourceUrl: params.canonicalUrl || params.url.toString(),
      keyFeatures: [],
      lifestyleHighlights: [],
      imageUrls: [],
      imageStatus: "missing",
    },
  };
}

async function fetchWithRedirectLimit(url: string, fetchImpl: FetchLike): Promise<FetchResponse> {
  let currentUrl = url;

  for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
    const response = await fetchImpl(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "CasaHUD-ListingExtractor/1.0 (+https://app.ibrains.ai)",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      const redirectedUrl = new URL(location, currentUrl).toString();
      validateListingImportUrl(redirectedUrl);
      currentUrl = redirectedUrl;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects while importing listing URL.");
}

function finalizeDraft(params: {
  url: URL;
  providerInfo: ProviderInfo;
  titleTag?: string;
  meta: Record<string, string>;
  draft: ParsedListingDraft;
  warnings: string[];
  originalUrl?: string;
}): CasaHudImportedListingExtractionResult {
  const { url, providerInfo, titleTag, meta, warnings } = params;
  const draft = { ...params.draft };
  draft.title = normalizeTitle(draft.title || titleTag || draft.metadataTitle, providerInfo.providerName);
  draft.propertyType = normalizePropertyType(draft.propertyType);
  draft.locationText = draft.locationText || draft.addressText;

  if (!draft.locationText && draft.city) {
    draft.locationText = [draft.addressText, draft.city, draft.province, draft.region, draft.country].filter(Boolean).join(", ");
  }

  if (!draft.priceText) {
    const price = parsePrice(draft.metadataDescription || meta.description);
    if (price.price !== undefined && draft.price === undefined) draft.price = price.price;
    if (!draft.priceCurrency && price.currency) draft.priceCurrency = price.currency;
    draft.priceText = price.priceText || formatPrice(draft.price, draft.priceCurrency);
  }

  const allImageCandidates = [
    ...(draft.imageCandidates || []),
    resolveUrl(meta["og:image"] || meta["twitter:image"], url.toString()),
  ].filter(Boolean) as string[];
  const validatedImages = validateDomaraImageUrls(Array.from(new Set(allImageCandidates)));
  warnings.push(...validatedImages.warnings);

  const featuredImageUrl = validatedImages.acceptedUrls[0];
  const imageStatus: CasaHudListingImageStatus =
    featuredImageUrl ? "available" : validatedImages.skippedUrls.length > 0 ? "invalid" : "missing";
  if (!draft.summary) draft.summary = buildShortSummary(draft);
  if (!draft.casaHudShortSummary) draft.casaHudShortSummary = draft.summary;
  if (!draft.casaHudNarrationSeed) draft.casaHudNarrationSeed = buildNarrationSeed(draft);
  if (!draft.casaHudDisplayTitle) draft.casaHudDisplayTitle = draft.title;

  const parsedLocation = parseAddressParts(draft.locationText);
  draft.city = draft.city || parsedLocation.city;
  draft.province = draft.province || parsedLocation.province;
  draft.region = draft.region || parsedLocation.region;
  draft.country = draft.country || parsedLocation.country;
  draft.keyFeatures = draft.keyFeatures?.length ? draft.keyFeatures : buildKeyFeatures(draft);
  draft.lifestyleHighlights =
    draft.lifestyleHighlights?.length ? draft.lifestyleHighlights : lifestyleHighlights(draft.description || draft.metadataDescription);

  const fields = extractionFields(draft, featuredImageUrl);
  const needsReviewFields = buildNeedsReviewFields(draft, imageStatus);
  const blocked = false;
  const extractionStatus = determineStatus({ blocked, extractedFields: fields });
  const extractionConfidence = Math.min(1, Number((fields.length / 14).toFixed(2)));
  const canonicalSourceUrl = draft.canonicalUrl || url.toString();

  return {
    normalizedUrl: url.toString(),
    provider: providerInfo.provider,
    providerName: providerInfo.providerName,
    providerListingId: draft.providerListingId || detectProviderListingId(url, providerInfo.provider),
    urlClassification: "listing",
    discoveredListingUrls: [],
    extractionProvider: providerInfo.extractionProvider,
    extractionStatus,
    extractionConfidence,
    needsReviewFields,
    warnings: Array.from(new Set(warnings)),
    extractionFields: fields,
    data: {
      sourceType: "imported_url",
      originalSourceUrl: params.originalUrl || url.toString(),
      normalizedSourceUrl: url.toString(),
      sourceUrl: url.toString(),
      sourceHost: url.hostname.replace(/^www\./, ""),
      sourceLabel: providerInfo.providerName,
      providerName: providerInfo.providerName,
      providerListingId: draft.providerListingId || detectProviderListingId(url, providerInfo.provider),
      canonicalUrl: canonicalSourceUrl,
      canonicalSourceUrl,
      title: draft.title,
      metadataTitle: draft.metadataTitle || meta["og:title"] || meta["twitter:title"] || titleTag,
      metadataDescription: draft.metadataDescription || meta["og:description"] || meta["twitter:description"] || meta.description,
      locationText: draft.locationText,
      addressText: draft.addressText,
      city: draft.city,
      province: draft.province,
      region: draft.region,
      country: draft.country,
      coordinates: draft.coordinates,
      price: draft.price,
      priceCurrency: draft.priceCurrency,
      priceText: draft.priceText,
      propertyType: draft.propertyType,
      contract: draft.contract,
      ownership: draft.ownership,
      rooms: draft.rooms,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      kitchen: draft.kitchen,
      interiorSizeSqm: draft.interiorSizeSqm,
      commercialSurfaceSqm: draft.commercialSurfaceSqm,
      landSizeSqm: draft.landSizeSqm,
      floorCount: draft.floorCount,
      floorText: draft.floorText,
      buildingFloors: draft.buildingFloors,
      lift: draft.lift,
      garageParking: draft.garageParking,
      balcony: draft.balcony,
      terrace: draft.terrace,
      furnished: draft.furnished,
      condition: draft.condition,
      heating: draft.heating,
      airConditioning: draft.airConditioning,
      energyClass: draft.energyClass,
      energyConsumption: draft.energyConsumption,
      pricePerSquareMeter: draft.pricePerSquareMeter,
      condoFees: draft.condoFees,
      referenceCode: draft.referenceCode,
      updatedDate: draft.updatedDate,
      photoCount: draft.photoCount,
      floorPlanCount: draft.floorPlanCount,
      virtualTour: draft.virtualTour,
      advertiser: draft.advertiser,
      description: draft.description,
      summary: draft.summary,
      keyFeatures: draft.keyFeatures || [],
      lifestyleHighlights: draft.lifestyleHighlights || [],
      featuredImageUrl,
      imageUrls: validatedImages.acceptedUrls,
      imageStatus,
      casaHudDisplayTitle: draft.casaHudDisplayTitle,
      casaHudShortSummary: draft.casaHudShortSummary,
      casaHudNarrationSeed: draft.casaHudNarrationSeed,
    },
  };
}

export function extractListingUrlMetadataFromHtml(input: {
  url: string;
  html: string;
}): CasaHudImportedListingExtractionResult {
  const parsedUrl = normalizeListingImportUrl(input.url);
  const providerInfo = detectProvider(parsedUrl);
  const initialClassification = classifyListingImportUrl(parsedUrl).classification;
  const discoveredListingUrls =
    initialClassification === "listing" ? [] : extractProviderListingUrlsFromHtml(input.html, parsedUrl.toString(), providerInfo.provider);
  if (discoveredListingUrls.length > 0 && initialClassification !== "listing") {
    return {
      normalizedUrl: parsedUrl.toString(),
      provider: providerInfo.provider,
      providerName: providerInfo.providerName,
      providerListingId: detectProviderListingId(parsedUrl, providerInfo.provider),
      urlClassification: "search_results",
      discoveredListingUrls,
      extractionProvider: providerInfo.extractionProvider,
      extractionStatus: "failed",
      extractionConfidence: 0,
      needsReviewFields: [],
      warnings: ["This looks like a search results page. Paste individual listing URLs or choose listings to import."],
      extractionFields: [],
      data: {
        sourceType: "imported_url",
        originalSourceUrl: input.url,
        normalizedSourceUrl: parsedUrl.toString(),
        sourceUrl: parsedUrl.toString(),
        sourceHost: parsedUrl.hostname.replace(/^www\./, ""),
        sourceLabel: providerInfo.providerName,
        providerName: providerInfo.providerName,
        providerListingId: detectProviderListingId(parsedUrl, providerInfo.provider),
        canonicalUrl: parsedUrl.toString(),
        canonicalSourceUrl: parsedUrl.toString(),
        keyFeatures: [],
        lifestyleHighlights: [],
        imageUrls: [],
        imageStatus: "missing",
      },
    };
  }

  const meta = parseMetaTags(input.html);
  const titleTag = extractTitleTag(input.html);
  const jsonLdDraft = extractFromJsonLd(extractJsonLdScripts(input.html), parsedUrl.toString());
  const embeddedDraft = extractFromEmbeddedState(extractEmbeddedStateScripts(input.html), parsedUrl.toString());
  const lines = htmlToTextLines(input.html);
  const fullText = lines.join("\n");
  const visibleDraft =
    providerInfo.provider === "immobiliare"
      ? extractImmobiliareFromText(lines, fullText)
      : ({ imageCandidates: [], keyFeatures: [], lifestyleHighlights: [] } satisfies ParsedListingDraft);
  const metaDraft = extractGenericMetaDraft(meta, parsedUrl.toString(), titleTag);
  const h1 = extractH1(input.html);

  const merged = mergeDrafts(jsonLdDraft, embeddedDraft, metaDraft, visibleDraft);
  if (h1 && (!merged.title || /idealista|immobiliare/i.test(merged.title))) merged.title = h1;
  if (
    visibleDraft.locationText &&
    (!merged.locationText ||
      visibleDraft.locationText.includes(",") ||
      visibleDraft.locationText.length > merged.locationText.length)
  ) {
    merged.locationText = visibleDraft.locationText;
  }
  if (
    visibleDraft.addressText &&
    (!merged.addressText ||
      visibleDraft.addressText.includes(",") ||
      visibleDraft.addressText.length > merged.addressText.length)
  ) {
    merged.addressText = visibleDraft.addressText;
  }
  if (
    visibleDraft.propertyType &&
    (!merged.propertyType ||
      /\b(residence|house|singlefamilyresidence)\b/i.test(merged.propertyType) ||
      visibleDraft.propertyType.length > merged.propertyType.length)
  ) {
    merged.propertyType = visibleDraft.propertyType;
  }
  if (!merged.locationText) {
    merged.locationText =
      findLineValue(lines, [/^(?:indirizzo|address|localit(?:a|à)|location)\b[:\s-]*(.*)$/i]) ||
      findLineValue(lines, [/^([A-Z][^|]+,\s*[A-Z][^|]+,\s*[A-Z][^|]+)$/]);
  }
  if (!merged.description) {
    merged.description = collectSectionText(lines, [/^(?:descrizione|description)$/i], 10) || metaDraft.metadataDescription;
  }
  if (!merged.canonicalUrl) {
    merged.canonicalUrl = extractCanonicalLink(input.html, parsedUrl.toString()) || resolveUrl(meta["og:url"], parsedUrl.toString()) || parsedUrl.toString();
  }
  if (!merged.providerListingId) merged.providerListingId = detectProviderListingId(parsedUrl, providerInfo.provider);

  return finalizeDraft({
    url: parsedUrl,
    providerInfo,
    titleTag,
    meta,
    draft: merged,
    warnings: [],
    originalUrl: input.url,
  });
}

export async function extractListingUrlMetadata(input: {
  url: string;
  fetchImpl?: FetchLike;
  now?: Date;
}): Promise<CasaHudImportedListingExtractionResult> {
  const parsedUrl = normalizeListingImportUrl(input.url);
  const providerInfo = detectProvider(parsedUrl);
  const initialClassification = classifyListingImportUrl(parsedUrl).classification;
  const fetchImpl = input.fetchImpl || (fetch as FetchLike);
  const warnings: string[] = [];

  try {
    const response = await fetchWithRedirectLimit(parsedUrl.toString(), fetchImpl);
    const finalUrl = normalizeListingImportUrl(response.url || parsedUrl.toString());
    const finalClassification = classifyListingImportUrl(finalUrl).classification;
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const contentLength = Number(response.headers.get("content-length") || "0");
    const providerListingId = detectProviderListingId(finalUrl, providerInfo.provider) || detectProviderListingId(parsedUrl, providerInfo.provider);

    if ([401, 403, 429].includes(response.status)) {
      warnings.push(`Listing extraction was limited by the source host (HTTP ${response.status}).`);
      return buildEmptyExtractionResult({
        url: finalUrl,
        providerInfo,
        providerListingId,
        urlClassification: "blocked_or_unavailable",
        extractionStatus: "blocked_or_unavailable",
        warnings,
        canonicalUrl: finalUrl.toString(),
        originalUrl: input.url,
      });
    }

    if (!response.ok) {
      warnings.push(`Listing extraction failed (HTTP ${response.status}).`);
    }
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      warnings.push("Listing extraction requires an HTML page.");
      return buildEmptyExtractionResult({
        url: finalUrl,
        providerInfo,
        providerListingId,
        urlClassification: finalClassification,
        extractionStatus: "failed",
        warnings,
        canonicalUrl: finalUrl.toString(),
        originalUrl: input.url,
      });
    }
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      warnings.push("Listing extraction stopped because the page was too large to import safely.");
      return buildEmptyExtractionResult({
        url: finalUrl,
        providerInfo,
        providerListingId,
        urlClassification: finalClassification,
        extractionStatus: "failed",
        warnings,
        canonicalUrl: finalUrl.toString(),
        originalUrl: input.url,
      });
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      warnings.push("Listing extraction stopped because the page exceeded the safe import size.");
      return buildEmptyExtractionResult({
        url: finalUrl,
        providerInfo,
        providerListingId,
        urlClassification: finalClassification,
        extractionStatus: "failed",
        warnings,
        canonicalUrl: finalUrl.toString(),
        originalUrl: input.url,
      });
    }

    if (looksBlocked(html)) {
      warnings.push("Listing extraction was blocked by the source page's bot or JS gate.");
      return buildEmptyExtractionResult({
        url: finalUrl,
        providerInfo,
        providerListingId,
        urlClassification: "blocked_or_unavailable",
        extractionStatus: "blocked_or_unavailable",
        warnings,
        canonicalUrl: finalUrl.toString(),
        originalUrl: input.url,
      });
    }

    const discoveredListingUrls =
      finalClassification === "listing" ? [] : extractProviderListingUrlsFromHtml(html, finalUrl.toString(), providerInfo.provider);
    if (discoveredListingUrls.length > 0 && finalClassification !== "listing") {
      warnings.push("This looks like a search results page. Paste individual listing URLs or choose listings to import.");
      return buildEmptyExtractionResult({
        url: finalUrl,
        providerInfo,
        providerListingId,
        urlClassification: "search_results",
        extractionStatus: "failed",
        warnings: Array.from(new Set(warnings)),
        discoveredListingUrls,
        canonicalUrl: finalUrl.toString(),
        originalUrl: input.url,
      });
    }

    const extracted = extractListingUrlMetadataFromHtml({
      url: finalUrl.toString(),
      html,
    });
    return {
      ...extracted,
      normalizedUrl: finalUrl.toString(),
      providerListingId,
      urlClassification:
        extracted.urlClassification === "listing" ? (initialClassification === "listing" ? "listing" : finalClassification) : extracted.urlClassification,
      warnings: Array.from(new Set([...warnings, ...extracted.warnings])),
    };
  } catch (error) {
    return buildEmptyExtractionResult({
      url: parsedUrl,
      providerInfo,
      providerListingId: detectProviderListingId(parsedUrl, providerInfo.provider),
      urlClassification: initialClassification,
      extractionStatus: "failed",
      warnings: [fetchErrorMessage(error)],
      canonicalUrl: parsedUrl.toString(),
      originalUrl: input.url,
    });
  }
}
