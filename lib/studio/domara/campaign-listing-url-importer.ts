import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type {
  CasaHudCampaign,
  CasaHudListingCandidate,
  CasaHudListingNeedsReviewField,
  CasaHudListingProvider,
} from "@/lib/studio/domara/campaigns";
import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { validateListingImportUrl } from "@/lib/studio/domara/listing-url-importer";

const MAX_URLS_PER_REQUEST = 12;
const MAX_HTML_BYTES = 350_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 4_500;

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  text: () => Promise<string>;
  url: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponse>;

export type CasaHudImportedUrlCandidateResult = {
  inputUrl: string;
  normalizedUrl?: string;
  status: "imported" | "duplicate" | "invalid";
  candidate?: CasaHudListingCandidate;
  warnings: string[];
  reason?: string;
};

export type ImportCasaHudListingUrlsResult = {
  results: CasaHudImportedUrlCandidateResult[];
  importedCandidates: CasaHudListingCandidate[];
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  warnings: string[];
  importedAt: string;
};

type ListingMetadata = {
  title?: string;
  description?: string;
  imageUrl?: string;
  canonicalUrl?: string;
};

function decodeHtml(value: string): string {
  return value
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
    const key = (attrs.property || attrs.name || "").toLowerCase();
    const content = attrs.content?.trim();
    if (key && content) meta[key] = content;
  }

  return meta;
}

function extractTitleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function resolveUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
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

function extractListingMetadata(html: string, pageUrl: string): ListingMetadata {
  const meta = parseMetaTags(html);
  const title = meta["og:title"] || meta["twitter:title"] || extractTitleTag(html);
  const description = meta["og:description"] || meta["twitter:description"] || meta.description;
  const imageUrl = resolveUrl(meta["og:image"] || meta["twitter:image"], pageUrl);
  const canonicalUrl = extractCanonicalLink(html, pageUrl) || meta["og:url"] || pageUrl;

  return {
    title,
    description,
    imageUrl,
    canonicalUrl: resolveUrl(canonicalUrl, pageUrl) || pageUrl,
  };
}

function detectProviderFromHostname(hostname: string): {
  provider: CasaHudListingProvider;
  sourceLabel: string;
} {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host.endsWith("idealista.it")) return { provider: "idealista", sourceLabel: "Idealista" };
  if (host.endsWith("immobiliare.it")) return { provider: "immobiliare", sourceLabel: "Immobiliare" };
  return { provider: "generic", sourceLabel: host };
}

function cleanImportedTitle(value: string | undefined, sourceLabel: string): string {
  if (!value) return `Imported listing from ${sourceLabel}`;
  const cleaned = value
    .replace(/\s+\|\s+(idealista|immobiliare)(\.it)?$/i, "")
    .replace(/\s+-\s+(idealista|immobiliare)(\.it)?$/i, "")
    .trim();
  return cleaned || `Imported listing from ${sourceLabel}`;
}

function parsePrice(value: string | undefined): { price?: number; currency?: string } {
  if (!value) return {};
  const match = value.match(/(€|eur|usd|\$)\s*([\d.,]+)\s*([kKmM])?/i);
  if (!match) return {};

  const [, symbol, rawAmount, suffix] = match;
  const normalized = Number(rawAmount.replace(/\./g, "").replace(/,/g, "."));
  if (!Number.isFinite(normalized)) return {};
  const multiplier = suffix?.toLowerCase() === "m" ? 1_000_000 : suffix?.toLowerCase() === "k" ? 1_000 : 1;

  return {
    price: Math.round(normalized * multiplier),
    currency: symbol === "$" || symbol?.toLowerCase() === "usd" ? "USD" : "EUR",
  };
}

function parseBedroomsBathrooms(value: string | undefined): { bedrooms?: number; bathrooms?: number } {
  if (!value) return {};
  const bedroomsMatch = value.match(/(\d{1,2})\s*(?:bed|beds|bedroom|bedrooms|camera|camere)/i);
  const bathroomsMatch = value.match(/(\d{1,2})\s*(?:bath|baths|bathroom|bathrooms|bagno|bagni)/i);

  return {
    bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : undefined,
    bathrooms: bathroomsMatch ? Number(bathroomsMatch[1]) : undefined,
  };
}

function parseSizeSqm(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d{2,4})\s*(?:sqm|sq\.?\s*m|m2|m²)/i);
  return match ? Number(match[1]) : undefined;
}

function parsePropertyType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const corpus = value.toLowerCase();
  if (/\bfarmhouse\b|\bcountry house\b/.test(corpus)) return "farmhouse";
  if (/\btownhouse\b|\btown house\b/.test(corpus)) return "townhouse";
  if (/\bapartment\b|\bflat\b/.test(corpus)) return "apartment";
  if (/\bvilla\b/.test(corpus)) return "villa";
  if (/\bhouse\b|\bhome\b/.test(corpus)) return "house";
  if (/\bstudio\b/.test(corpus)) return "studio";
  if (/\bloft\b/.test(corpus)) return "loft";
  return undefined;
}

function parseLocationText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  const locationInMatch = normalized.match(/\b(?:in|a)\s+([A-Z][A-Za-z' -]+(?:,\s*[A-Z][A-Za-z' -]+){0,2})/);
  if (locationInMatch?.[1]) return locationInMatch[1].trim();

  const separators = normalized.split(/\s+[|\-–]\s+/).map((item) => item.trim()).filter(Boolean);
  const locationSegment = separators.find((segment) => /,\s*[A-Z]/.test(segment));
  return locationSegment;
}

function normalizeReviewFields(candidate: {
  price?: number;
  locationText?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
}): CasaHudListingNeedsReviewField[] {
  const fields: CasaHudListingNeedsReviewField[] = [];
  if (typeof candidate.price !== "number") fields.push("price");
  if (!candidate.locationText || candidate.locationText === "Location needs review") fields.push("location");
  if (!candidate.propertyType) fields.push("property_type");
  if (typeof candidate.bedrooms !== "number" || typeof candidate.bathrooms !== "number") fields.push("bedrooms_bathrooms");
  if (typeof candidate.sizeSqm !== "number") fields.push("size");
  return fields;
}

function importedNarrationNote(needsReviewFields: CasaHudListingNeedsReviewField[]): string {
  if (needsReviewFields.length === 0) {
    return "Imported from a live listing URL with enough public detail to review in the shortlist.";
  }
  return "Imported from a live listing URL. Review the missing facts before using it as a lead shortlist pick.";
}

function buildFallbackDescription(sourceLabel: string): string {
  return `Imported from ${sourceLabel}. Public page details were limited, so this listing needs a quick review before validation.`;
}

async function fetchWithRedirectLimit(url: string, fetchFn: FetchLike): Promise<FetchResponse> {
  let currentUrl = url;

  for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
    const response = await fetchFn(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "CasaHUD-ImportedListingBridge/1.0 (+https://app.ibrains.ai)",
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

function dedupeKey(input: string): string {
  try {
    const parsed = new URL(input);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return input.trim();
  }
}

function existingUrlKeys(campaign: CasaHudCampaign): Set<string> {
  const urls = [
    ...campaign.listingCandidates,
    ...campaign.approvedListings,
    ...campaign.rejectedListings,
  ].flatMap((listing) => [listing.sourceUrl, listing.canonicalUrl]);

  return new Set(urls.filter(Boolean).map((value) => dedupeKey(value!)));
}

async function buildImportedCandidate(params: {
  url: URL;
  fetchFn: FetchLike;
  importedAt: string;
}): Promise<{ candidate: CasaHudListingCandidate; warnings: string[] }> {
  const sourceHost = params.url.hostname.replace(/^www\./, "");
  const { provider, sourceLabel } = detectProviderFromHostname(sourceHost);
  const warnings: string[] = [];

  let metadata: ListingMetadata = {};
  let extractionStatus: CasaHudListingCandidate["extractionStatus"] = "failed";

  try {
    const response = await fetchWithRedirectLimit(params.url.toString(), params.fetchFn);
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const contentLength = Number(response.headers.get("content-length") || "0");

    if ([401, 403, 429].includes(response.status)) {
      warnings.push(`Metadata was limited by the source host (HTTP ${response.status}).`);
    } else if (!response.ok) {
      warnings.push(`Metadata could not be loaded from the source page (HTTP ${response.status}).`);
    } else if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      warnings.push("Metadata was unavailable because the source did not return an HTML page.");
    } else if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      warnings.push("Metadata was unavailable because the source page was too large to import safely.");
    } else {
      const html = await response.text();
      if (html.length > MAX_HTML_BYTES) {
        warnings.push("Metadata was unavailable because the source page exceeded the safe import size.");
      } else {
        metadata = extractListingMetadata(html, response.url || params.url.toString());
      }
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Metadata fetch failed.");
  }

  const validatedImageUrls = validateDomaraImageUrls(metadata.imageUrl ? [metadata.imageUrl] : []);
  warnings.push(...validatedImageUrls.warnings);
  const metadataImageUrl = validatedImageUrls.acceptedUrls[0];
  const rawText = [metadata.title, metadata.description].filter(Boolean).join(" ");
  const priceDetails = parsePrice(rawText);
  const bedroomsBathrooms = parseBedroomsBathrooms(rawText);
  const sizeSqm = parseSizeSqm(rawText);
  const propertyType = parsePropertyType(rawText);
  const locationText = parseLocationText(metadata.title) || parseLocationText(metadata.description) || "Location needs review";
  const title = cleanImportedTitle(metadata.title, sourceLabel);
  const needsReviewFields = normalizeReviewFields({
    price: priceDetails.price,
    locationText,
    propertyType,
    bedrooms: bedroomsBathrooms.bedrooms,
    bathrooms: bedroomsBathrooms.bathrooms,
    sizeSqm,
  });

  if (metadata.title || metadata.description || metadataImageUrl) {
    extractionStatus = needsReviewFields.length === 0 ? "extracted" : "partial";
  }

  const candidate: CasaHudListingCandidate = {
    id: stableCasaHudId("listing", metadata.canonicalUrl || params.url.toString()),
    provider,
    sourceType: "imported_url",
    sourceUrl: params.url.toString(),
    sourceHost,
    sourceLabel,
    importedAt: params.importedAt,
    featuredImageUrl: metadataImageUrl,
    metadataTitle: metadata.title,
    metadataDescription: metadata.description,
    metadataImageUrl,
    canonicalUrl: metadata.canonicalUrl,
    extractionStatus,
    extractionWarnings: warnings,
    needsReviewFields,
    title,
    locationText,
    price: priceDetails.price,
    currency: priceDetails.currency,
    propertyType,
    bedrooms: bedroomsBathrooms.bedrooms,
    bathrooms: bedroomsBathrooms.bathrooms,
    sizeSqm,
    descriptionSnippet: metadata.description || buildFallbackDescription(sourceLabel),
    features: [],
    imageUrls: metadataImageUrl ? [metadataImageUrl] : [],
    imageCount: metadataImageUrl ? 1 : 0,
    photoAvailability: metadataImageUrl ? "limited" : "none",
    rawProviderMetadata: {
      importMethod: "safe_metadata",
      metadataHost: sourceHost,
    },
    discoveredAt: params.importedAt,
    preliminaryMatchNotes: importedNarrationNote(needsReviewFields),
  };

  return { candidate, warnings };
}

export function parseListingUrlLines(rawUrls: string): string[] {
  return Array.from(
    new Set(
      rawUrls
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export async function importCasaHudListingUrls(params: {
  campaign: CasaHudCampaign;
  rawUrls: string;
  fetchFn?: FetchLike;
  importedAt?: string;
}): Promise<ImportCasaHudListingUrlsResult> {
  const fetchFn = params.fetchFn || (fetch as FetchLike);
  const importedAt = params.importedAt || nowIso();
  const urls = parseListingUrlLines(params.rawUrls);

  if (urls.length === 0) {
    throw new Error("Paste at least one listing URL to import.");
  }
  if (urls.length > MAX_URLS_PER_REQUEST) {
    throw new Error(`Import up to ${MAX_URLS_PER_REQUEST} listing URLs at a time.`);
  }

  const existingKeys = existingUrlKeys(params.campaign);
  const seenInRequest = new Set<string>();
  const results: CasaHudImportedUrlCandidateResult[] = [];
  const importedCandidates: CasaHudListingCandidate[] = [];

  for (const inputUrl of urls) {
    let parsedUrl: URL;
    try {
      parsedUrl = validateListingImportUrl(inputUrl);
    } catch (error) {
      results.push({
        inputUrl,
        status: "invalid",
        warnings: [],
        reason: error instanceof Error ? error.message : "Invalid URL.",
      });
      continue;
    }

    const normalizedUrl = parsedUrl.toString();
    const key = dedupeKey(normalizedUrl);

    if (existingKeys.has(key) || seenInRequest.has(key)) {
      results.push({
        inputUrl,
        normalizedUrl,
        status: "duplicate",
        warnings: [],
        reason: "Duplicate URL skipped.",
      });
      continue;
    }

    seenInRequest.add(key);

    const { candidate, warnings } = await buildImportedCandidate({
      url: parsedUrl,
      fetchFn,
      importedAt,
    });

    results.push({
      inputUrl,
      normalizedUrl,
      status: "imported",
      candidate,
      warnings,
    });
    importedCandidates.push(candidate);
  }

  return {
    results,
    importedCandidates,
    importedCount: importedCandidates.length,
    duplicateCount: results.filter((result) => result.status === "duplicate").length,
    invalidCount: results.filter((result) => result.status === "invalid").length,
    warnings: Array.from(new Set(results.flatMap((result) => result.warnings))),
    importedAt,
  };
}
