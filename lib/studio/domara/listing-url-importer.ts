import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { extractListingFromHtml } from "@/lib/studio/domara/listing-html-extractor";
import type {
  DomaraListingUrlImportRequest,
  DomaraListingUrlImportResult,
  PropertyListingInput,
} from "@/lib/studio/domara/types";

const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGES = 30;
const REQUEST_TIMEOUT_MS = 9000;
const MAX_REDIRECTS = 4;

const PRIVATE_IPV4_PATTERNS = [/^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./];

function isPrivateIpv4Host(hostname: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isPrivateIpv6Host(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function isDisallowedHost(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  return (
    lowered === "localhost" ||
    lowered === "0.0.0.0" ||
    lowered.endsWith(".local") ||
    lowered.endsWith(".internal") ||
    lowered.endsWith(".localhost") ||
    isPrivateIpv4Host(lowered) ||
    isPrivateIpv6Host(lowered)
  );
}

function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown import failure.";
  return error.message.replace(/(api[_-]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}

export function validateListingImportUrl(input: string): URL {
  const value = input.trim();
  if (!value) throw new Error("Listing URL is required.");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Listing URL is invalid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https listing URLs are supported.");
  }

  if (isDisallowedHost(parsed.hostname)) {
    throw new Error("Private or local network hosts are not allowed for listing import.");
  }

  return parsed;
}

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  text: () => Promise<string>;
  url: string;
};

export type DomaraListingImporterDeps = {
  fetchFn?: (input: string, init?: RequestInit) => Promise<FetchResponse>;
  now?: () => Date;
};

async function fetchWithRedirectLimit(
  url: string,
  fetchFn: (input: string, init?: RequestInit) => Promise<FetchResponse>,
): Promise<FetchResponse> {
  let current = url;

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const response = await fetchFn(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "iBrains-Domara-ListingImporter/1.0 (+https://app.ibrains.ai)",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      const nextUrl = new URL(location, current).toString();
      validateListingImportUrl(nextUrl);
      current = nextUrl;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects while importing listing URL.");
}

function inferCountry(countryHint?: string): string {
  return countryHint?.trim() || "Italy";
}

function sourceLabelFromUrl(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  return host || "Listing URL Import";
}

function buildNormalizedListing(
  listingUrl: string,
  sourceLabel: string,
  extracted: DomaraListingUrlImportResult["extracted"],
  status: DomaraListingUrlImportResult["status"],
  extractionSources: DomaraListingUrlImportResult["extractionSources"],
  countryHint?: string,
  nowIso?: string,
): PropertyListingInput {
  return {
    listingUrl,
    source: sourceLabel,
    provider: "import_url",
    country: inferCountry(countryHint),
    title: extracted.title || "Imported Listing",
    description: extracted.description,
    price: extracted.price,
    propertyType: extracted.propertyType,
    bedrooms: extracted.bedrooms,
    bathrooms: extracted.bathrooms,
    squareMeters: extracted.squareMeters,
    imageUrls: extracted.imageUrls,
    agency: extracted.agency,
    fetchedAt: nowIso,
    providerMetadata: {
      importStatus: status,
      extractionSources: extractionSources.join(","),
      sourceMethod: "metadata-first public listing import",
      canonicalUrl: extracted.canonicalUrl,
    },
    sourceAttribution: `${sourceLabel} | ${listingUrl}`,
  };
}

function determineStatus(extracted: DomaraListingUrlImportResult["extracted"]): "imported" | "partial" | "failed" {
  const hasCoreData = Boolean(extracted.title || extracted.description || extracted.price || extracted.propertyType);
  const hasImages = extracted.imageUrls.length > 0;
  if (hasCoreData && hasImages) return "imported";
  if (hasCoreData || hasImages) return "partial";
  return "failed";
}

export async function importListingFromUrl(
  request: DomaraListingUrlImportRequest,
  deps: DomaraListingImporterDeps = {},
): Promise<DomaraListingUrlImportResult> {
  const fetchFn = (deps.fetchFn || fetch) as DomaraListingImporterDeps["fetchFn"];
  const now = deps.now ? deps.now() : new Date();
  const fetchedAt = now.toISOString();

  const parsedUrl = validateListingImportUrl(request.listingUrl);
  const listingUrl = parsedUrl.toString();
  const label = request.sourceLabel?.trim() || sourceLabelFromUrl(parsedUrl);

  try {
    const response = await fetchWithRedirectLimit(listingUrl, fetchFn!);

    if ([401, 403, 429].includes(response.status)) {
      return {
        status: "blocked",
        normalizedListingInput: null,
        extracted: { imageUrls: [], source: label, canonicalUrl: listingUrl },
        warnings: [`Listing import blocked by source host (HTTP ${response.status}).`],
        fallbackMessage: "Listing import was blocked or incomplete. Please paste listing details/images manually.",
        extractionSources: [],
        fetchedAt,
      };
    }

    if (!response.ok) {
      return {
        status: "failed",
        normalizedListingInput: null,
        extracted: { imageUrls: [], source: label, canonicalUrl: listingUrl },
        warnings: [`Listing import failed (HTTP ${response.status}).`],
        fallbackMessage: "Listing import was blocked or incomplete. Please paste listing details/images manually.",
        extractionSources: [],
        fetchedAt,
      };
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return {
        status: "failed",
        normalizedListingInput: null,
        extracted: { imageUrls: [], source: label, canonicalUrl: listingUrl },
        warnings: ["Unsupported content type for listing import."],
        fallbackMessage: "Listing import was blocked or incomplete. Please paste listing details/images manually.",
        extractionSources: [],
        fetchedAt,
      };
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      return {
        status: "failed",
        normalizedListingInput: null,
        extracted: { imageUrls: [], source: label, canonicalUrl: listingUrl },
        warnings: ["Listing page is too large to import safely."],
        fallbackMessage: "Listing import was blocked or incomplete. Please paste listing details/images manually.",
        extractionSources: [],
        fetchedAt,
      };
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return {
        status: "failed",
        normalizedListingInput: null,
        extracted: { imageUrls: [], source: label, canonicalUrl: listingUrl },
        warnings: ["Listing page exceeded safe import size."],
        fallbackMessage: "Listing import was blocked or incomplete. Please paste listing details/images manually.",
        extractionSources: [],
        fetchedAt,
      };
    }

    const extractedRaw = extractListingFromHtml(html, response.url || listingUrl);
    const validated = validateDomaraImageUrls(extractedRaw.imageUrls || []);
    const imageUrls = validated.acceptedUrls.slice(0, MAX_IMAGES);
    const extracted = {
      title: extractedRaw.title,
      description: extractedRaw.description,
      price: extractedRaw.price,
      location: extractedRaw.location,
      propertyType: extractedRaw.propertyType,
      bedrooms: extractedRaw.bedrooms,
      bathrooms: extractedRaw.bathrooms,
      squareMeters: extractedRaw.squareMeters,
      imageUrls,
      source: label,
      canonicalUrl: extractedRaw.canonicalUrl || listingUrl,
      agency: extractedRaw.agency,
    };

    const status = determineStatus(extracted);
    const warnings = [...validated.warnings];
    if (extractedRaw.imageUrls.length > MAX_IMAGES) {
      warnings.push(`Limited imported images to ${MAX_IMAGES}.`);
    }

    const fallbackMessage =
      status === "partial"
        ? extracted.imageUrls.length > 0
          ? "Images imported. Please review/add property facts manually."
          : "Listing import was blocked or incomplete. Please paste listing details/images manually."
        : status === "failed"
          ? "Listing import was blocked or incomplete. Please paste listing details/images manually."
          : undefined;

    const normalizedListingInput =
      status === "failed"
        ? null
        : buildNormalizedListing(
            listingUrl,
            label,
            extracted,
            status,
            extractedRaw.extractionSources,
            request.countryHint,
            fetchedAt,
          );

    return {
      status,
      normalizedListingInput,
      extracted,
      warnings,
      fallbackMessage,
      extractionSources: extractedRaw.extractionSources,
      fetchedAt,
    };
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    const blocked = /abort|timeout|network|fetch|blocked/i.test(message);

    return {
      status: blocked ? "blocked" : "failed",
      normalizedListingInput: null,
      extracted: {
        imageUrls: [],
        source: label,
        canonicalUrl: listingUrl,
      },
      warnings: [message],
      fallbackMessage: "Listing import was blocked or incomplete. Please paste listing details/images manually.",
      extractionSources: [],
      fetchedAt,
    };
  }
}
