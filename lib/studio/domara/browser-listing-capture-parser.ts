import { stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type {
  CasaHudListingCandidate,
  CasaHudListingExtractionStatus,
  CasaHudListingImageStatus,
  CasaHudListingProvider,
  CasaHudListingUrlClassification,
} from "@/lib/studio/domara/campaigns";
import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { normalizeImportedListingCandidate } from "@/lib/studio/domara/imported-listing-candidate";
import { classifyListingImportUrl } from "@/lib/studio/domara/listing-url-extractor";
import { normalizeListingImportUrl } from "@/lib/studio/domara/listing-url-importer";
import { parseLocalizedNumber, parseRealEstatePrice } from "@/lib/studio/domara/number-parsing";

export const CASAHUD_BROWSER_IMPORT_VERSION = "casahud-browser-import-v1";
export const CASAHUD_BROWSER_IMPORT_CAPTURE_VERSION = "2026-04-30";
export const CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS = 80_000;
export const CASAHUD_BROWSER_IMPORT_MAX_IMAGE_CANDIDATES = 30;
export const CASAHUD_BROWSER_IMPORT_MAX_PAYLOAD_BYTES = 220_000;

type BrowserCaptureImageSource = "og" | "twitter" | "visible_img" | "srcset";

export type CasaHudBrowserListingCaptureImageCandidate = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  source: BrowserCaptureImageSource;
};

export type CasaHudBrowserListingCapturePayload = {
  version: string;
  campaignId?: string;
  sourceUrl: string;
  canonicalUrl?: string;
  providerHost?: string;
  capturedAt: string;
  captureVersion?: string;
  title?: string;
  metaDescription?: string;
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
    image?: string;
  };
  priceCandidates?: string[];
  descriptionCandidates?: string[];
  visibleText?: string;
  imageCandidates?: CasaHudBrowserListingCaptureImageCandidate[];
};

type BrowserImageCandidate = CasaHudBrowserListingCaptureImageCandidate & {
  normalizedUrl: string;
};

export type CasaHudBrowserListingCapturePreview = {
  payload: CasaHudBrowserListingCapturePayload;
  candidate: CasaHudListingCandidate;
  provider: CasaHudListingProvider;
  providerName: string;
  urlClassification: CasaHudListingUrlClassification;
  extractionStatus: CasaHudListingExtractionStatus;
  extractionConfidence: number;
  extractionFields: string[];
  warnings: string[];
};

type BrowserParsedDraft = {
  title?: string;
  locationText?: string;
  addressText?: string;
  city?: string;
  province?: string;
  region?: string;
  country?: string;
  price?: number;
  currency?: string;
  priceText?: string;
  propertyType?: string;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  commercialSurfaceSqm?: number;
  landSizeSqm?: number;
  floorText?: string;
  garageParking?: string;
  balcony?: boolean;
  terrace?: boolean;
  condition?: string;
  heating?: string;
  airConditioning?: string;
  energyClass?: string;
  energyConsumption?: string;
  pricePerSquareMeter?: number;
  referenceCode?: string;
  updatedDate?: string;
  photoCount?: number;
  floorPlanCount?: number;
  virtualTour?: boolean;
  advertiser?: string;
  descriptionSnippet?: string;
  keyFeatures: string[];
  lifestyleHighlights: string[];
};

const DISALLOWED_CAPTURE_KEYS = ["cookie", "cookies", "localstorage", "sessionstorage", "token", "tokens", "authorization", "password"];

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  euro: "€",
  ndash: "-",
  mdash: "-",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

const LOCATION_FEATURE_FRAGMENT_PATTERN =
  /\b(good condition|condition|parking|car parking|garage|posto auto|box auto|with terrace|terrace|terrazz[oa]|balcony|balcone|independent heating|heating|riscaldamento|aria condizionata|air conditioning)\b/i;

const FACT_LINE_PATTERN =
  /^(price|prezzo|address|indirizzo|location|ubicazione|zona|comune|rooms?|locali|bedrooms?|camere(?: da letto)?|bathrooms?|bagni|surface|superficie|interior size|commercial surface|garden|giardino|land|terreno|garage|parking|posti auto|condition|stato|heating|riscaldamento|energy class|classe energetica|reference|riferimento|ref\.?|rif\.?|updated|aggiornato|advertiser|agency|agenzia|description|descrizione)\b/i;
const PHOTO_NOISE_PATTERN = /\b(?:photo|photos|foto|images?|immagini)\b/i;
const IMMOBILIARE_HOST_PATTERN = /(^|\.)immobiliare\.it$/i;

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entityToken) => {
    const entity = String(entityToken || "").toLowerCase();
    if (!entity) return match;
    if (entity.startsWith("#x")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint > 0 ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint > 0 ? String.fromCodePoint(codePoint) : match;
    }
    return HTML_ENTITY_MAP[entity] ?? match;
  });
}

function normalizeWhitespace(value: string, preserveNewLines = false): string {
  const normalized = decodeHtmlEntities(value).replace(/\u00a0/g, " ").replace(/\r/g, "\n");
  if (preserveNewLines) {
    return normalized
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function cleanTrailingPunctuation(value: string): string {
  return value
    .replace(/^[,;:|·\-–—\s]+/g, "")
    .replace(/[,;:|·\-–—\s]+$/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:]){2,}/g, "$1")
    .trim();
}

function cleanText(value?: string | null) {
  if (typeof value !== "string") return undefined;
  const cleaned = cleanTrailingPunctuation(normalizeWhitespace(value));
  return cleaned || undefined;
}

function cleanMultilineText(value?: string | null) {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeWhitespace(value, true);
  return normalized || undefined;
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function payloadSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function containsDisallowedCaptureFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsDisallowedCaptureFields(item));

  return Object.entries(value as Record<string, unknown>).some(([key, current]) => {
    const normalizedKey = key.replace(/[^a-z]/gi, "").toLowerCase();
    if (DISALLOWED_CAPTURE_KEYS.includes(normalizedKey)) return true;
    return containsDisallowedCaptureFields(current);
  });
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeWhitespace(value, value.includes("\n"));
  return normalized || undefined;
}

function optionalNumber(value: unknown) {
  return parseLocalizedNumber(value);
}

function optionalStringList(value: unknown, options?: { maxItems?: number; maxChars?: number }): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const maxItems = options?.maxItems ?? 12;
  const maxChars = options?.maxChars ?? 2_400;
  return Array.from(
    new Set(
      value
        .map((entry) => optionalString(entry))
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => (entry.length <= maxChars ? entry : `${entry.slice(0, maxChars)}…`)),
    ),
  ).slice(0, maxItems);
}

function normalizeNumberish(value: string | undefined) {
  if (!value) return undefined;
  return parseLocalizedNumber(normalizeWhitespace(value));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolvePayloadHost(payload: CasaHudBrowserListingCapturePayload): string | undefined {
  const explicitHost = cleanText(payload.providerHost);
  if (explicitHost) return explicitHost.replace(/^www\./i, "").toLowerCase();

  const candidateUrl = payload.canonicalUrl || payload.sourceUrl;
  try {
    return new URL(candidateUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function isImmobiliarePayload(payload: CasaHudBrowserListingCapturePayload): boolean {
  const host = resolvePayloadHost(payload);
  return Boolean(host && IMMOBILIARE_HOST_PATTERN.test(host));
}

function containsPhotoNoise(value: string | undefined): boolean {
  if (!value) return false;
  return PHOTO_NOISE_PATTERN.test(value) || /\b\d+\s*\/\s*\d+\b/.test(value);
}

function descriptionLooksIncomplete(value: string | undefined): boolean {
  const cleaned = cleanText(value);
  if (!cleaned) return true;
  if (cleaned.length < 100) return true;
  if (/…$|\.{3}$/.test(cleaned)) return true;
  if (/\b(of|with|and|for|to|the|a|an|in|on)\s*$/i.test(cleaned)) return true;
  return false;
}

function integerFromText(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/(\d{1,4})(?:\+)?/);
  return match ? Number(match[1]) : undefined;
}

function capitalizeWords(value: string | undefined) {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function formatPrice(price?: number, currency?: string) {
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  if ((currency || "EUR").toUpperCase() === "EUR") return `€${price.toLocaleString("en-US")}`;
  if ((currency || "").toUpperCase() === "USD") return `$${price.toLocaleString("en-US")}`;
  return `${currency || "EUR"} ${price.toLocaleString("en-US")}`;
}

function extractPriceText(text: string | undefined) {
  if (!text) return {};
  const normalized = normalizeWhitespace(text).replace(/\s*\/\s*m².*/i, "").trim();
  if (!normalized) return {};
  if (/\b(price on request|prezzo su richiesta)\b/i.test(normalized)) {
    return { priceOnRequest: true, rawPriceText: "Price on request" };
  }
  const currencyBefore = normalized.match(/(€|eur|usd|\$)\s*([0-9][0-9.,\s]*)/i);
  if (currencyBefore) {
    return {
      rawPriceText: `${currencyBefore[1]} ${currencyBefore[2]}`.replace(/\s+/g, " ").trim(),
      currencyToken: currencyBefore[1],
      amountToken: currencyBefore[2],
    };
  }
  const currencyAfter = normalized.match(/([0-9][0-9.,\s]*)\s*(€|eur|usd|\$)/i);
  if (currencyAfter) {
    return {
      rawPriceText: `${currencyAfter[1]} ${currencyAfter[2]}`.replace(/\s+/g, " ").trim(),
      currencyToken: currencyAfter[2],
      amountToken: currencyAfter[1],
    };
  }
  const amountOnly = normalized.match(/([0-9][0-9.,\s]{2,})/);
  if (amountOnly) {
    return {
      rawPriceText: amountOnly[1].replace(/\s+/g, " ").trim(),
      amountToken: amountOnly[1],
    };
  }
  return {};
}

function normalizeCurrencyPrice(text: string | undefined) {
  const extracted = extractPriceText(text);
  if ("priceOnRequest" in extracted && extracted.priceOnRequest) return { priceText: extracted.rawPriceText };
  const currencyToken = "currencyToken" in extracted ? extracted.currencyToken : undefined;
  const amountToken = "amountToken" in extracted ? extracted.amountToken : undefined;
  if (!amountToken) return {};
  const currency = currencyToken ? (currencyToken === "$" || currencyToken.toLowerCase() === "usd" ? "USD" : "EUR") : "EUR";
  const price = parseRealEstatePrice(amountToken);
  if (price === undefined) return { currency };
  return {
    price,
    currency,
    priceText: formatPrice(price, currency),
  };
}

function parseAddressParts(locationText: string | undefined) {
  if (!locationText) return {};
  const parts = locationText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) return {};
  if (parts.length === 1) {
    return {
      city: parts[0],
      country: /(?:italy|italia)$/i.test(parts[0]) ? "Italy" : undefined,
    };
  }

  const inferredCountry = /^(italy|italia)$/i.test(parts[parts.length - 1] || "") ? "Italy" : parts[parts.length - 1];
  const inferredCity = parts.find((part, index) => index > 0 && !/\d/.test(part)) || parts[0];

  return {
    city: inferredCity,
    province: parts.length >= 5 ? parts[2] : parts.length >= 4 ? parts[1] : undefined,
    region: parts.length >= 5 ? parts[3] : parts.length >= 4 ? parts[2] : parts.length === 3 ? parts[1] : undefined,
    country: inferredCountry,
  };
}

function normalizeTitle(value: string | undefined) {
  if (!value) return undefined;
  return value
    .replace(/\s+\|\s+[^|]+$/i, "")
    .replace(/\s+-\s+(idealista|immobiliare)(\.it)?$/i, "")
    .replace(/\s+\|\s+(idealista|immobiliare)(\.it)?$/i, "")
    .trim();
}

function normalizePropertyType(value: string | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return undefined;
  if (/\bsingle family villa\b/i.test(cleaned)) return "Single family villa";
  if (/\bcountry house|casale|rustic farmhouse|farmhouse\b/i.test(cleaned)) return "Country house";
  if (/\bvilla\b/i.test(cleaned)) return "Villa";
  if (/\bapartment|flat|appartamento\b/i.test(cleaned)) return "Apartment";
  if (/\bhouse\b/i.test(cleaned)) return "House";
  return capitalizeWords(cleaned);
}

function splitVisibleLines(text: string | undefined) {
  return (text || "")
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function findLineValue(lines: string[], patterns: RegExp[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const captured = cleanText(match[1]);
      if (captured) return captured;

      const next = cleanText(lines[index + 1]);
      if (next) return next;
    }
  }

  return undefined;
}

function findLabeledValue(lines: string[], labels: string[], lookahead = 2) {
  if (labels.length === 0) return undefined;
  const labelPattern = new RegExp(`^(?:${labels.map((label) => escapeRegex(label)).join("|")})\\b[\\s:–—-]*(.*)$`, "i");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const match = line.match(labelPattern);
    if (!match) continue;

    const inlineValue = cleanText(match[1]);
    if (inlineValue) return inlineValue;

    for (let offset = 1; offset <= lookahead; offset += 1) {
      const nextLine = cleanText(lines[index + offset]);
      if (!nextLine) continue;
      if (FACT_LINE_PATTERN.test(nextLine)) break;
      return nextLine;
    }
  }

  return undefined;
}

function collectSectionText(lines: string[], headingPatterns: RegExp[], maxLines = 8) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!headingPatterns.some((pattern) => pattern.test(line))) continue;

    const collected: string[] = [];
    for (let offset = 1; offset <= maxLines; offset += 1) {
      const next = cleanText(lines[index + offset]);
      if (!next) break;
      if (FACT_LINE_PATTERN.test(next)) {
        break;
      }
      collected.push(next);
    }

    if (collected.length > 0) return collected.join(" ");
  }

  return undefined;
}

function extractDescriptionBlock(lines: string[]) {
  const section = collectSectionText(lines, [/^(?:description|descrizione|overview|details)\b/i], 30);
  if (section) return section;
  const paragraphCandidate = lines.find((line) => line.length >= 120 && /[.!?]/.test(line) && !FACT_LINE_PATTERN.test(line));
  return cleanText(paragraphCandidate);
}

function pickBestDescription(candidates: Array<string | undefined>) {
  const normalized = uniqueStrings(candidates);
  if (normalized.length === 0) return undefined;
  normalized.sort((left, right) => {
    const leftScore =
      (left.length >= 120 ? 26 : 0) +
      (/[.!?]$/.test(left) ? 12 : 0) +
      (/…$|\.{3}$/.test(left) ? -28 : 0) +
      (descriptionLooksIncomplete(left) ? -22 : 0);
    const rightScore =
      (right.length >= 120 ? 26 : 0) +
      (/[.!?]$/.test(right) ? 12 : 0) +
      (/…$|\.{3}$/.test(right) ? -28 : 0) +
      (descriptionLooksIncomplete(right) ? -22 : 0);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return right.length - left.length;
  });
  let best = normalized[0]!;
  if (/…$|\.{3}$/.test(best)) {
    const fuller = normalized.find((candidate) => !/…$|\.{3}$/.test(candidate) && candidate.length >= Math.max(120, best.length - 30));
    if (fuller) best = fuller;
  }
  if (best.length <= 1_200) return best;
  const trimmed = best.slice(0, 1_200);
  const punctuationBoundary = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf("!"), trimmed.lastIndexOf("?"));
  const paragraphBoundary = trimmed.lastIndexOf("\n");
  const wordBoundary = trimmed.lastIndexOf(" ");
  const lastBoundary = Math.max(punctuationBoundary, paragraphBoundary, wordBoundary);
  const bounded = cleanText(trimmed.slice(0, lastBoundary > 220 ? lastBoundary : 1_200));
  if (!bounded) return undefined;
  return /[.!?]$/.test(bounded) ? bounded : `${bounded}…`;
}

function cleanLocationText(value: string | undefined) {
  const initial = cleanText(value);
  if (!initial) return undefined;

  const withoutFeatureSentence = initial
    .split(/\.\s+/)
    .filter((part, index) => index === 0 || !LOCATION_FEATURE_FRAGMENT_PATTERN.test(part))
    .join(". ");
  const parts = withoutFeatureSentence
    .split(",")
    .map((part) =>
      cleanText(
        part
          .replace(/\b(?:ref(?:erence)?|rif)\.?\s*[:#-]?\s*[A-Z0-9-]{2,}\b/gi, "")
          .replace(/\b(?:ref(?:erence)?|rif)\.?\b/gi, ""),
      ),
    )
    .filter((part): part is string => {
      if (!part) return false;
      return !LOCATION_FEATURE_FRAGMENT_PATTERN.test(part);
    });

  const joined = cleanTrailingPunctuation(parts.join(", "));
  return joined || undefined;
}

function cleanParkingText(value: string | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return undefined;
  const normalized = cleanTrailingPunctuation(cleaned.replace(/[·|/]+/g, ", ").replace(/\s*,\s*/g, ", "));
  if (!normalized) return undefined;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

type BrowserListingFacts = {
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  commercialSurfaceSqm?: number;
  landSizeSqm?: number;
  warnings: string[];
};

function parseAreaMeasurement(value: string | undefined) {
  if (!value) return undefined;
  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;

  const explicitArea = normalized.match(
    /(\d{1,3}(?:[.,]\d{3})+|\d{2,5}(?:[.,]\d+)?|\d{1,4})\s*(?:sqm|sq\.?\s*m|m²|m2|mq|metri quadrati|square meters?)/i,
  )?.[1];
  const parsed = parseLocalizedNumber(explicitArea || normalized);
  if (parsed === undefined || parsed <= 0) return undefined;
  if (parsed > 80_000) return undefined;
  return parsed;
}

function pickPreferredAreaValue(
  field: "interior" | "commercial" | "land",
  primary: number | undefined,
  fallback: number | undefined,
  warnings: string[],
) {
  if (primary === undefined) return fallback;
  if (fallback === undefined) return primary;

  if (primary > 20_000 && fallback <= 10_000) {
    warnings.push(`Used ${Math.round(fallback)} m² for ${field} area and ignored an implausible concatenated value.`);
    return fallback;
  }

  if (field !== "land" && primary >= fallback * 15 && fallback >= 20) {
    warnings.push(`Used ${Math.round(fallback)} m² for ${field} area from nearby clean facts.`);
    return fallback;
  }

  return primary;
}

function extractListingFacts(
  fullText: string,
  lines: string[],
  options?: {
    strictBedroomLabels?: boolean;
  },
): BrowserListingFacts {
  const warnings: string[] = [];
  const normalized = normalizeWhitespace(fullText);
  const strictBedroomLabels = Boolean(options?.strictBedroomLabels);

  const interiorLine =
    findLabeledValue(lines, ["interior size", "interior surface", "surface", "superficie", "size", "metratura"]) ||
    findLineValue(lines, [/^(?:interior size|interior surface|surface|superficie|size|metratura)\b[:\s-]*(.*)$/i]);
  const commercialLine =
    findLabeledValue(lines, ["commercial surface", "commercial area", "superficie commerciale"]) ||
    findLineValue(lines, [/^(?:commercial surface|commercial area|superficie commerciale)\b[:\s-]*(.*)$/i]);
  const landLine =
    findLabeledValue(lines, ["garden", "land", "plot", "lot", "giardino", "terreno"]) ||
    findLineValue(lines, [/^(?:garden|land|plot|lot|giardino|terreno)\b[:\s-]*(.*)$/i]);

  const areaMentions: Array<{
    value: number;
    context: string;
  }> = [];
  const areaPattern = /(\d[\d.,]*)\s*(?:sqm|sq\.?\s*m|m²|m2|mq|metri quadrati|square meters?)/gi;
  let areaMatch: RegExpExecArray | null;
  while ((areaMatch = areaPattern.exec(normalized)) !== null) {
    const rawValue = areaMatch[1];
    if (!rawValue) continue;
    const value = parseLocalizedNumber(rawValue);
    if (value === undefined || value <= 0 || value > 80_000) continue;
    const index = areaMatch.index || 0;
    const context = normalized.slice(Math.max(0, index - 42), Math.min(normalized.length, index + 34)).toLowerCase();
    areaMentions.push({ value, context });
  }

  const firstAreaByContext = (context: "land" | "commercial" | "interior") =>
    areaMentions.find((mention) => {
      if (context === "land") {
        return /(?:land|garden|plot|lot|giardino|terreno|agricultural|olive grove)/i.test(mention.context);
      }
      if (context === "commercial") {
        return /(?:commercial surface|commercial area|superficie commerciale|retail|shop|office|ufficio)/i.test(mention.context);
      }
      return !/(?:land|garden|plot|lot|giardino|terreno|agricultural|commercial surface|commercial area|superficie commerciale)/i.test(
        mention.context,
      );
    })?.value;

  const bedroomLine = findLabeledValue(lines, ["bedrooms", "bedroom", "camere da letto", "camera da letto"]);
  const bathroomLine = findLabeledValue(lines, ["bathrooms", "bathroom", "bagni", "bagno"]);
  const roomLine = findLabeledValue(lines, ["rooms", "room", "locali"]);

  const bedroomsFromLine = containsPhotoNoise(bedroomLine) ? undefined : integerFromText(bedroomLine);
  const bedroomsFallback = strictBedroomLabels
    ? undefined
    : integerFromText(normalized.match(/(\d{1,2})\s*(?:bedrooms?|camere da letto|camere)\b/i)?.[1]);

  const bathroomsFromLine = containsPhotoNoise(bathroomLine) ? undefined : integerFromText(bathroomLine);
  const bathroomsFallback = integerFromText(normalized.match(/(\d{1,2})\s*(?:bathrooms?|bagni)\b/i)?.[1]);

  const roomsFromLine = containsPhotoNoise(roomLine) ? undefined : integerFromText(roomLine);
  const roomsFallback = integerFromText(normalized.match(/(\d{1,2}\+?)\s*(?:rooms?|locali)\b/i)?.[1]);

  return {
    bedrooms: bedroomsFromLine ?? bedroomsFallback,
    bathrooms: bathroomsFromLine ?? bathroomsFallback,
    rooms: roomsFromLine ?? roomsFallback,
    sizeSqm: pickPreferredAreaValue("interior", parseAreaMeasurement(interiorLine), firstAreaByContext("interior"), warnings),
    commercialSurfaceSqm: pickPreferredAreaValue("commercial", parseAreaMeasurement(commercialLine), firstAreaByContext("commercial"), warnings),
    landSizeSqm: pickPreferredAreaValue("land", parseAreaMeasurement(landLine), firstAreaByContext("land"), warnings),
    warnings,
  };
}

function resolveUrl(value: string | undefined, baseUrl: string) {
  if (!value) return undefined;
  const normalized = value.startsWith("//") ? `https:${value}` : value;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function looksLikeDecorativeImage(candidate: BrowserImageCandidate) {
  const url = candidate.normalizedUrl.toLowerCase();
  const alt = (candidate.alt || "").toLowerCase();
  const maxDimension = Math.max(candidate.width || 0, candidate.height || 0);
  if (candidate.source === "og" || candidate.source === "twitter") return false;
  if (maxDimension > 0 && maxDimension < 180) return true;
  return /logo|icon|favicon|sprite|avatar|badge/.test(url) || /logo|icon|avatar/.test(alt);
}

function imageSourceScore(source: BrowserCaptureImageSource) {
  if (source === "og") return 30_000;
  if (source === "twitter") return 20_000;
  if (source === "srcset") return 10_000;
  return 0;
}

function normalizeImageCandidates(
  payload: CasaHudBrowserListingCapturePayload,
  baseUrl: string,
  warnings: string[],
) {
  const rawCandidates = [
    ...(payload.openGraph?.image ? [{ url: payload.openGraph.image, source: "og" as const }] : []),
    ...(payload.twitter?.image ? [{ url: payload.twitter.image, source: "twitter" as const }] : []),
    ...((payload.imageCandidates || []).map((candidate) => ({
      url: candidate.url,
      alt: candidate.alt,
      width: optionalNumber(candidate.width),
      height: optionalNumber(candidate.height),
      source: candidate.source,
    })) as CasaHudBrowserListingCaptureImageCandidate[]),
  ];

  const normalizedCandidates = rawCandidates
    .map((candidate) => {
      const normalizedUrl = resolveUrl(candidate.url, payload.canonicalUrl || baseUrl);
      if (!normalizedUrl) return undefined;
      return {
        ...candidate,
        normalizedUrl,
      };
    })
    .filter((candidate): candidate is BrowserImageCandidate => Boolean(candidate));

  const validated = validateDomaraImageUrls(normalizedCandidates.map((candidate) => candidate.normalizedUrl));
  warnings.push(...validated.warnings);
  const acceptedSet = new Set(validated.acceptedUrls);

  const deduped: BrowserImageCandidate[] = [];
  for (const candidate of normalizedCandidates) {
    if (!acceptedSet.has(candidate.normalizedUrl)) continue;
    if (looksLikeDecorativeImage(candidate)) continue;
    if (deduped.some((existing) => existing.normalizedUrl === candidate.normalizedUrl)) continue;
    deduped.push(candidate);
    if (deduped.length >= CASAHUD_BROWSER_IMPORT_MAX_IMAGE_CANDIDATES) break;
  }

  deduped.sort((left, right) => {
    const leftScore = imageSourceScore(left.source) + Math.max(left.width || 0, left.height || 0);
    const rightScore = imageSourceScore(right.source) + Math.max(right.width || 0, right.height || 0);
    return rightScore - leftScore;
  });

  return deduped;
}

function trimVisibleText(value: string | undefined) {
  const sanitized = cleanMultilineText(value);
  if (!sanitized) return undefined;
  if (sanitized.length <= CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS) return sanitized;
  const clipped = sanitized.slice(0, CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS);
  const lastBoundary = Math.max(clipped.lastIndexOf("\n"), clipped.lastIndexOf(". "), clipped.lastIndexOf(" "));
  return cleanText(clipped.slice(0, lastBoundary > 100 ? lastBoundary : CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS));
}

function extractLocationText(lines: string[], fullText: string, title: string | undefined) {
  const explicitAddress = findLineValue(lines, [/^(?:address|indirizzo)\b[:\s-]*(.*)$/i]);
  if (explicitAddress) return cleanLocationText(explicitAddress);

  const explicitLocation = findLineValue(lines, [/^(?:location|ubicazione|zona|comune|where)\b[:\s-]*(.*)$/i]);
  const cleanedExplicitLocation = cleanLocationText(explicitLocation);
  if (cleanedExplicitLocation && !LOCATION_FEATURE_FRAGMENT_PATTERN.test(cleanedExplicitLocation)) {
    return cleanedExplicitLocation;
  }

  const addressMatch =
    fullText.match(/\b(?:via|contrada|piazza|viale|corso|strada|loc\.?) [^,\n]+,\s*[A-Za-zÀ-ÿ' -]+(?:,\s*[A-Za-zÀ-ÿ' -]+){1,4}/i) ||
    title?.match(/\b(?:via|contrada|piazza|viale|corso|strada|loc\.?) [^,\n]+,\s*[A-Za-zÀ-ÿ' -]+(?:,\s*[A-Za-zÀ-ÿ' -]+){0,3}/i);

  if (addressMatch?.[0]) return cleanLocationText(addressMatch[0]);

  const placeLine = lines.find((line) => /,\s*(?:Italy|Italia)\b/i.test(line) && !LOCATION_FEATURE_FRAGMENT_PATTERN.test(line));
  if (placeLine) return cleanLocationText(placeLine);
  const areaLine = lines.find((line) => /\b(?:capaccio|paestum|salerno|calabria|puglia|campania)\b/i.test(line) && !FACT_LINE_PATTERN.test(line));
  return cleanLocationText(areaLine);
}

function cleanListingTitle(value: string | undefined, draft: Pick<BrowserParsedDraft, "city" | "propertyType" | "terrace" | "garageParking" | "landSizeSqm">) {
  const normalized = normalizeTitle(value);
  if (!normalized) return undefined;
  const withoutFeatureTail = cleanTrailingPunctuation(
    normalized
      .replace(/\.\s*(good condition|excellent|parking|car parking|with terrace|terrace|independent heating).*/i, "")
      .replace(/\b(good condition|independent heating)\b.*$/i, ""),
  );
  const generated = buildDisplayTitle({
    title: withoutFeatureTail,
    city: draft.city,
    propertyType: draft.propertyType,
    terrace: draft.terrace,
    garageParking: draft.garageParking,
    landSizeSqm: draft.landSizeSqm,
    keyFeatures: [],
    lifestyleHighlights: [],
  });
  if (generated) return generated;
  return withoutFeatureTail;
}

function buildDisplayTitle(draft: BrowserParsedDraft) {
  const city = cleanText(draft.city);
  const propertyType = normalizePropertyType(draft.propertyType);
  if (!city || !propertyType) return normalizeTitle(draft.title);
  const suffix =
    typeof draft.landSizeSqm === "number" && draft.landSizeSqm >= 200
      ? " with Private Garden"
      : draft.terrace
        ? " with Terrace"
        : draft.garageParking
          ? " with Parking"
          : "";
  return `${city} ${propertyType}${suffix}`;
}

function extractVisiblePriceCandidate(
  payload: CasaHudBrowserListingCapturePayload,
  lines: string[],
  fullText: string,
  preferStructured = false,
) {
  for (const candidate of payload.priceCandidates || []) {
    if (
      /((?:€|eur|usd|\$)\s*\d[\d.,\s]*|\d[\d.,\s]*\s*(?:€|eur|usd|\$))/i.test(candidate) &&
      !/\b(?:photos?|foto|rooms?|bagni?|bathrooms?|bedrooms?|sqm|m²|m2)\b/i.test(candidate)
    ) {
      return candidate;
    }
  }

  const labeledPrice = findLabeledValue(lines, ["price", "prezzo"]);
  if (labeledPrice) return labeledPrice;

  const lineBudget = preferStructured ? 140 : 80;
  const visiblePriceLine = lines
    .slice(0, lineBudget)
    .find(
      (line) =>
        /((?:€|eur|usd|\$)\s*\d[\d.,\s]*|\d[\d.,\s]*\s*(?:€|eur|usd|\$))/i.test(line) &&
        !/\b(?:phone|call|contact|telefono|annuncio|listing id|reference|rif)\b/i.test(line) &&
        !containsPhotoNoise(line),
    );
  if (visiblePriceLine) return visiblePriceLine;

  return (
    fullText.match(/(?:price|prezzo)[^\d€$]{0,16}((?:€|eur|usd|\$)?\s*\d[\d.,\s]*\s*(?:€|eur|usd|\$)?)/i)?.[1] ||
    fullText.match(/((?:€|eur|usd|\$)\s*\d[\d.,\s]*|\d[\d.,\s]*\s*(?:€|eur|usd|\$))/i)?.[1]
  );
}

type BrowserDraftExtraction = {
  draft: BrowserParsedDraft;
  warnings: string[];
};

function extractDraftFromCapture(payload: CasaHudBrowserListingCapturePayload): BrowserDraftExtraction {
  const warnings: string[] = [];
  const isImmobiliare = isImmobiliarePayload(payload);
  const fullText = [
    payload.title,
    payload.openGraph?.title,
    payload.metaDescription,
    payload.openGraph?.description,
    payload.twitter?.description,
    ...(payload.descriptionCandidates || []),
    ...(payload.priceCandidates || []),
    payload.visibleText,
  ]
    .filter(Boolean)
    .map((value) => normalizeWhitespace(String(value), true))
    .join("\n");
  const lines = splitVisibleLines(payload.visibleText);
  const description = pickBestDescription([
    ...(payload.descriptionCandidates || []),
    extractDescriptionBlock(lines),
    payload.openGraph?.description,
    payload.twitter?.description,
    payload.metaDescription,
  ]);
  const locationText = extractLocationText(lines, fullText, payload.title || payload.openGraph?.title || payload.twitter?.title);
  const addressParts = parseAddressParts(locationText);
  const priceInfo = normalizeCurrencyPrice(extractVisiblePriceCandidate(payload, lines, fullText, isImmobiliare));
  const facts = extractListingFacts(fullText, lines, { strictBedroomLabels: isImmobiliare });
  warnings.push(...facts.warnings);
  if (priceInfo.price === undefined) {
    warnings.push("Price was not detected from the visible page. Please enter it manually.");
  }
  if (descriptionLooksIncomplete(description)) {
    warnings.push("Description may be incomplete. Review and paste the full listing description if needed.");
  }

  const propertyType =
    normalizePropertyType(
      findLineValue(lines, [/^(?:property type|tipologia|type)\b[:\s-]*(.*)$/i]) ||
        payload.openGraph?.title ||
        payload.title ||
        fullText.match(/\b(single family villa|country house|casale|villa|apartment|flat|house)\b/i)?.[1],
    );

  const rooms = facts.rooms;
  const bedrooms = facts.bedrooms;
  const bathrooms = facts.bathrooms;
  const sizeSqm = facts.sizeSqm;
  const commercialSurfaceSqm = facts.commercialSurfaceSqm || parseAreaMeasurement(findLabeledValue(lines, ["commercial surface", "commercial area"]));
  const landSizeSqm = facts.landSizeSqm;

  const garageParking = cleanParkingText(
    findLineValue(lines, [/^(?:garage(?:\s*\/\s*parking)?|parking|posti auto|box auto)\b[:\s-]*(.*)$/i]) ||
      fullText.match(/\b(?:garage|parking|posto auto|box auto)\b[:\s-]*([^.\n]{3,80})/i)?.[1],
  );
  const balcony =
    /\bbalcony\b|\bbalcone\b/i.test(fullText) ||
    undefined;
  const terrace =
    /\bterrace\b|\bterrazz[ao]\b/i.test(fullText) ||
    undefined;
  const condition = cleanText(findLineValue(lines, [/^(?:condition|stato)\b[:\s-]*(.*)$/i]) || fullText.match(/\b(excellent|renovated|good condition|to renovate)\b/i)?.[1]);
  const heating = findLineValue(lines, [/^(?:heating|riscaldamento)\b[:\s-]*(.*)$/i]);
  const airConditioning = findLineValue(lines, [/^(?:air conditioning|aria condizionata)\b[:\s-]*(.*)$/i]);
  const energyClass =
    findLineValue(lines, [/^(?:energy class|classe energetica)\b[:\s-]*(.*)$/i]) ||
    fullText.match(/\b(?:energy class|classe energetica)\s*[:\-]?\s*([A-G][+]?)/i)?.[1];
  const energyConsumption = fullText.match(/\b(\d{1,4}\s*kwh\/m²\/year)\b/i)?.[1];
  const pricePerSquareMeter = normalizeNumberish(
    findLineValue(lines, [/^(?:price per m²|price per sqm)\b[:\s-]*(.*)$/i]) || fullText.match(/€\s*([\d.,]+)\s*\/\s*m²/i)?.[1],
  );
  const referenceCode =
    findLineValue(lines, [/^(?:reference|rif\.?)\b[:\s-]*(.*)$/i]) ||
    fullText.match(/\b(?:EK-|Rif\.?\s*)([A-Z0-9-]{5,})\b/i)?.[0];
  const updatedDate = findLineValue(lines, [/^(?:updated|aggiornato)\b[:\s-]*(.*)$/i]);
  const photoCount =
    integerFromText(findLineValue(lines, [/^(?:photos|photo count|foto)\b[:\s-]*(.*)$/i])) ||
    integerFromText(fullText.match(/\b(\d{1,3})\s*(?:photos|foto)\b/i)?.[1]);
  const floorPlanCount =
    integerFromText(findLineValue(lines, [/^(?:floor plans?|planimetrie)\b[:\s-]*(.*)$/i])) ||
    integerFromText(fullText.match(/\b(\d{1,2})\s*(?:floor plans?|planimetrie)\b/i)?.[1]);
  const virtualTour = /\bvirtual tour\b/i.test(fullText) || /\b3d tour\b/i.test(fullText) ? true : undefined;
  const advertiser = findLineValue(lines, [/^(?:advertiser|agency|agenzia)\b[:\s-]*(.*)$/i]);
  const cleanedLocationText = cleanLocationText(locationText);
  const finalTitle = cleanListingTitle(payload.openGraph?.title || payload.title || payload.twitter?.title, {
    city: addressParts.city,
    propertyType,
    terrace,
    garageParking,
    landSizeSqm,
  });

  const keyFeatures = uniqueStrings([
    propertyType,
    rooms ? `${rooms}+ rooms` : undefined,
    bedrooms ? `${bedrooms} bedrooms` : undefined,
    bathrooms ? `${bathrooms} bathrooms` : undefined,
    sizeSqm ? `${Math.round(sizeSqm)} m² interior` : undefined,
    commercialSurfaceSqm ? `${Math.round(commercialSurfaceSqm)} m² commercial surface` : undefined,
    landSizeSqm ? `${Math.round(landSizeSqm).toLocaleString("en-US")} m² garden/land` : undefined,
    garageParking,
    balcony ? "Balcony" : undefined,
    terrace ? "Terrace" : undefined,
    condition,
    heating,
    airConditioning,
    energyClass,
  ]).slice(0, 8);

  const lifestyleHighlights = uniqueStrings([
    description,
    lines.find((line) => /\bcoast|beach|olive|garden|panoramic|privacy|park\b/i.test(line)),
    lines.find((line) => /\bpool potential|services nearby|private garden|southern italy\b/i.test(line)),
  ]).slice(0, 4);

  return {
    draft: {
      title: finalTitle,
      addressText: cleanedLocationText,
      locationText: cleanedLocationText,
      ...addressParts,
      ...priceInfo,
      propertyType,
      rooms,
      bedrooms,
      bathrooms,
      sizeSqm,
      commercialSurfaceSqm,
      landSizeSqm,
      garageParking: cleanParkingText(garageParking),
      balcony: balcony || undefined,
      terrace: terrace || undefined,
      condition: capitalizeWords(condition),
      heating: cleanText(heating),
      airConditioning: cleanText(airConditioning),
      energyClass: cleanText(energyClass),
      energyConsumption: cleanText(energyConsumption),
      pricePerSquareMeter,
      referenceCode: cleanText(referenceCode),
      updatedDate: cleanText(updatedDate),
      photoCount,
      floorPlanCount,
      virtualTour,
      advertiser: cleanText(advertiser),
      descriptionSnippet: description,
      keyFeatures,
      lifestyleHighlights,
    } satisfies BrowserParsedDraft,
    warnings,
  };
}

function determineExtractionStatus(fieldCount: number, needsReviewCount: number): {
  status: CasaHudListingExtractionStatus;
  confidence: number;
} {
  if (fieldCount >= 8 && needsReviewCount <= 3) {
    return { status: "extracted", confidence: 0.88 };
  }
  if (fieldCount >= 3) {
    return { status: "partial", confidence: 0.62 };
  }
  return { status: "failed", confidence: 0.28 };
}

function extractionFieldNames(draft: BrowserParsedDraft, imageUrls: string[]) {
  return Object.entries({
    title: draft.title,
    locationText: draft.locationText,
    price: draft.price,
    propertyType: draft.propertyType,
    rooms: draft.rooms,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    sizeSqm: draft.sizeSqm,
    commercialSurfaceSqm: draft.commercialSurfaceSqm,
    landSizeSqm: draft.landSizeSqm,
    garageParking: draft.garageParking,
    condition: draft.condition,
    heating: draft.heating,
    airConditioning: draft.airConditioning,
    energyClass: draft.energyClass,
    referenceCode: draft.referenceCode,
    updatedDate: draft.updatedDate,
    photoCount: draft.photoCount,
    floorPlanCount: draft.floorPlanCount,
    virtualTour: draft.virtualTour,
    advertiser: draft.advertiser,
    descriptionSnippet: draft.descriptionSnippet,
    images: imageUrls.length > 0 ? imageUrls.length : undefined,
  })
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([field]) => field);
}

function sanitizePayload(rawPayload: unknown): CasaHudBrowserListingCapturePayload {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    throw new Error("CasaFlix needs a browser import payload to continue.");
  }
  if (containsDisallowedCaptureFields(rawPayload)) {
    throw new Error("CasaFlix browser import only accepts visible page text, metadata, and image candidates.");
  }
  const payload = rawPayload as Record<string, unknown>;
  const sourceUrl = optionalString(payload.sourceUrl);
  if (!sourceUrl) throw new Error("CasaFlix browser import needs a source URL.");

  const priceCandidates = optionalStringList(payload.priceCandidates, { maxItems: 12, maxChars: 240 });
  const descriptionCandidates = optionalStringList(payload.descriptionCandidates, { maxItems: 8, maxChars: 6_000 });
  const visibleText = trimVisibleText(optionalString(payload.visibleText));
  const imageCandidates = Array.isArray(payload.imageCandidates)
    ? payload.imageCandidates
        .map((candidate): CasaHudBrowserListingCaptureImageCandidate | null => {
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
          const record = candidate as Record<string, unknown>;
          const url = optionalString(record.url);
          const source = optionalString(record.source) as BrowserCaptureImageSource | undefined;
          if (!url || !source || !["og", "twitter", "visible_img", "srcset"].includes(source)) return null;
          const normalizedCandidate: CasaHudBrowserListingCaptureImageCandidate = {
            url,
            source,
          };
          const alt = optionalString(record.alt);
          const width = optionalNumber(record.width);
          const height = optionalNumber(record.height);
          if (alt) normalizedCandidate.alt = alt;
          if (width !== undefined) normalizedCandidate.width = width;
          if (height !== undefined) normalizedCandidate.height = height;
          return normalizedCandidate;
        })
        .filter((candidate): candidate is CasaHudBrowserListingCaptureImageCandidate => candidate !== null)
        .slice(0, CASAHUD_BROWSER_IMPORT_MAX_IMAGE_CANDIDATES)
    : [];

  const sanitizedPayload = {
    version: optionalString(payload.version) || CASAHUD_BROWSER_IMPORT_VERSION,
    campaignId: optionalString(payload.campaignId),
    sourceUrl,
    canonicalUrl: optionalString(payload.canonicalUrl),
    providerHost: optionalString(payload.providerHost),
    capturedAt: optionalString(payload.capturedAt) || new Date().toISOString(),
    captureVersion: optionalString(payload.captureVersion) || CASAHUD_BROWSER_IMPORT_CAPTURE_VERSION,
    title: optionalString(payload.title),
    metaDescription: optionalString(payload.metaDescription),
    openGraph:
      payload.openGraph && typeof payload.openGraph === "object" && !Array.isArray(payload.openGraph)
        ? {
            title: optionalString((payload.openGraph as Record<string, unknown>).title),
            description: optionalString((payload.openGraph as Record<string, unknown>).description),
            image: optionalString((payload.openGraph as Record<string, unknown>).image),
          }
        : undefined,
    twitter:
      payload.twitter && typeof payload.twitter === "object" && !Array.isArray(payload.twitter)
        ? {
            title: optionalString((payload.twitter as Record<string, unknown>).title),
            description: optionalString((payload.twitter as Record<string, unknown>).description),
            image: optionalString((payload.twitter as Record<string, unknown>).image),
          }
        : undefined,
    priceCandidates,
    descriptionCandidates,
    visibleText,
    imageCandidates,
  };

  if (payloadSize(sanitizedPayload) > CASAHUD_BROWSER_IMPORT_MAX_PAYLOAD_BYTES) {
    throw new Error("CasaFlix browser import payload is too large. Capture less page text and fewer images.");
  }

  return sanitizedPayload;
}

function browserImportLabel(providerName: string) {
  return providerName === "Source domain" ? "Browser import" : providerName;
}

export function parseCasaHudBrowserListingCapture(
  rawPayload: unknown,
  options?: {
    importedAt?: string;
  },
): CasaHudBrowserListingCapturePreview {
  const payload = sanitizePayload(rawPayload);
  const normalizedSourceUrl = normalizeListingImportUrl(payload.sourceUrl).toString();
  const sourceClassification = classifyListingImportUrl(normalizedSourceUrl);
  const canonicalSourceUrl = payload.canonicalUrl ? normalizeListingImportUrl(payload.canonicalUrl).toString() : undefined;
  const warnings: string[] = [];
  const images = normalizeImageCandidates(payload, canonicalSourceUrl || normalizedSourceUrl, warnings);
  const parsedDraft = extractDraftFromCapture({
    ...payload,
    sourceUrl: normalizedSourceUrl,
    canonicalUrl: canonicalSourceUrl,
  });
  warnings.push(...parsedDraft.warnings);
  const draft = parsedDraft.draft;

  const imageUrls = images.map((candidate) => candidate.normalizedUrl);
  const extractionFields = extractionFieldNames(draft, imageUrls);
  const imageStatus: CasaHudListingImageStatus = imageUrls.length > 0 ? "available" : "missing";

  const candidateBase: CasaHudListingCandidate = {
    id: stableCasaHudId("listing", canonicalSourceUrl || normalizedSourceUrl),
    provider: sourceClassification.provider,
    sourceType: "browser_assisted_import",
    providerListingId:
      sourceClassification.provider === "immobiliare"
        ? normalizedSourceUrl.match(/\/annunci\/(\d+)/i)?.[1]
        : sourceClassification.provider === "idealista"
          ? normalizedSourceUrl.match(/\/(?:annuncio|immobile|inmueble)\/(\d+)/i)?.[1]
          : normalizedSourceUrl.match(/\/(\d{5,})\/?$/)?.[1],
    originalSourceUrl: payload.sourceUrl,
    normalizedSourceUrl,
    canonicalSourceUrl: canonicalSourceUrl || normalizedSourceUrl,
    sourceUrl: normalizedSourceUrl,
    canonicalUrl: canonicalSourceUrl || normalizedSourceUrl,
    sourceHost: new URL(normalizedSourceUrl).hostname.replace(/^www\./, ""),
    sourceLabel: browserImportLabel(sourceClassification.providerName),
    urlClassification: sourceClassification.classification,
    importedAt: options?.importedAt || payload.capturedAt,
    metadataTitle: normalizeTitle(payload.title || payload.openGraph?.title || payload.twitter?.title),
    metadataDescription: cleanText(payload.openGraph?.description || payload.twitter?.description || payload.metaDescription),
    metadataImageUrl: imageUrls[0],
    extractionProvider: "browser_capture",
    extractionFields,
    extractionWarnings: warnings,
    title: buildDisplayTitle(draft) || draft.title || normalizeTitle(payload.title) || `Browser import from ${sourceClassification.providerName}`,
    priceText: draft.priceText,
    addressText: draft.addressText,
    locationText: draft.locationText || draft.addressText || "Location needs review",
    country: draft.country,
    region: draft.region,
    city: draft.city,
    province: draft.province,
    price: draft.price,
    currency: draft.currency || "EUR",
    propertyType: draft.propertyType,
    rooms: draft.rooms,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    sizeSqm: draft.sizeSqm,
    commercialSurfaceSqm: draft.commercialSurfaceSqm,
    landSizeSqm: draft.landSizeSqm,
    floorText: draft.floorText,
    garageParking: draft.garageParking,
    balcony: draft.balcony,
    terrace: draft.terrace,
    condition: draft.condition,
    heating: draft.heating,
    airConditioning: draft.airConditioning,
    energyClass: draft.energyClass,
    energyConsumption: draft.energyConsumption,
    pricePerSquareMeter: draft.pricePerSquareMeter,
    referenceCode: draft.referenceCode,
    updatedDate: draft.updatedDate,
    photoCount: draft.photoCount,
    floorPlanCount: draft.floorPlanCount,
    virtualTour: draft.virtualTour,
    advertiser: draft.advertiser,
    descriptionSnippet: draft.descriptionSnippet,
    keyFeatures: draft.keyFeatures,
    lifestyleHighlights: draft.lifestyleHighlights,
    featuredImageUrl: imageUrls[0],
    imageStatus,
    features: uniqueStrings([...(draft.keyFeatures || []), ...(draft.lifestyleHighlights || [])]).slice(0, 10),
    imageUrls,
    imageCount: imageUrls.length,
    photoAvailability: imageUrls.length >= 2 ? "available" : imageUrls.length === 1 ? "limited" : "none",
    rawProviderMetadata: {
      importMethod: "browser_assisted",
      browserCaptureVersion: payload.captureVersion || CASAHUD_BROWSER_IMPORT_CAPTURE_VERSION,
      browserCaptureCapturedAt: payload.capturedAt,
      browserCaptureSourceUrl: normalizedSourceUrl,
      browserCaptureCanonicalUrl: canonicalSourceUrl || null,
      browserCaptureProviderHost: payload.providerHost || new URL(normalizedSourceUrl).hostname.replace(/^www\./, ""),
      browserCaptureVisibleTextLength: payload.visibleText?.length || 0,
      browserCapturePriceCandidates: payload.priceCandidates || [],
      browserCaptureDescriptionCandidates: payload.descriptionCandidates || [],
      browserCaptureImageCandidates: images.map((candidate) => ({
        url: candidate.normalizedUrl,
        alt: candidate.alt,
        width: candidate.width,
        height: candidate.height,
        source: candidate.source,
      })),
      notOfficialApi: true,
      captureMethod: "user_visible_page_capture",
    },
    discoveredAt: options?.importedAt || payload.capturedAt,
    preliminaryMatchNotes: draft.descriptionSnippet || `Browser-assisted listing import from ${sourceClassification.providerName}.`,
  };

  const normalizedCandidate = normalizeImportedListingCandidate(candidateBase);
  const extraction = determineExtractionStatus(extractionFields.length, normalizedCandidate.needsReviewFields?.length || 0);
  const candidate = normalizeImportedListingCandidate({
    ...normalizedCandidate,
    extractionStatus: extraction.status,
    extractionConfidence: extraction.confidence,
    sourceLabel: sourceClassification.providerName,
    casaHudDisplayTitle: normalizedCandidate.casaHudDisplayTitle || buildDisplayTitle(draft) || normalizedCandidate.title,
  });

  return {
    payload,
    candidate,
    provider: sourceClassification.provider,
    providerName: sourceClassification.providerName,
    urlClassification: sourceClassification.classification,
    extractionStatus: extraction.status,
    extractionConfidence: extraction.confidence,
    extractionFields,
    warnings: uniqueStrings([...(candidate.extractionWarnings || []), ...warnings]),
  };
}
