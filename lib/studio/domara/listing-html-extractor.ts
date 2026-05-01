import { parseLocalizedNumber } from "@/lib/studio/domara/number-parsing";

export type DomaraListingHtmlExtraction = {
  title?: string;
  description?: string;
  price?: string;
  location?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareMeters?: number;
  imageUrls: string[];
  source?: string;
  canonicalUrl?: string;
  agency?: string;
  extractionSources: Array<"jsonLd" | "openGraph" | "meta" | "visibleImages">;
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

function pushUnique(items: string[], value?: string) {
  if (!value) return;
  const normalized = value.trim();
  if (!normalized) return;
  if (!items.includes(normalized)) items.push(normalized);
}

function resolveUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeNumberish(value: unknown): number | undefined {
  return parseLocalizedNumber(value);
}

function readJsonPath(source: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    const segments = path.split(".");
    let current: unknown = source;
    let failed = false;

    for (const segment of segments) {
      if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        failed = true;
        break;
      }
    }

    if (!failed && current !== undefined && current !== null) {
      return current;
    }
  }

  return undefined;
}

function flattenJsonLd(input: unknown): Record<string, unknown>[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap((item) => flattenJsonLd(item));
  if (typeof input !== "object") return [];

  const current = input as Record<string, unknown>;
  const graph = current["@graph"];
  if (Array.isArray(graph)) {
    return [current, ...graph.flatMap((item) => flattenJsonLd(item))];
  }

  return [current];
}

function isLikelyImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg")) return false;
  if (lower.includes("sprite") || lower.includes("favicon") || lower.includes("logo")) return false;
  return true;
}

function parseSrcsetCandidate(srcset: string): string | undefined {
  const candidates = srcset
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(/\s+/);
      const url = parts[0] || "";
      const widthToken = parts.find((part) => /\d+w$/.test(part));
      const width = widthToken ? Number(widthToken.replace("w", "")) : 0;
      return {
        url,
        width: Number.isFinite(width) ? width : 0,
      };
    })
    .filter((item) => item.url);

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.width - a.width);
  return candidates[0].url;
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
    const content = attrs.content;
    if (key && content) {
      meta[key] = content.trim();
    }
  }

  return meta;
}

function extractJsonLd(html: string, baseUrl: string): Partial<DomaraListingHtmlExtraction> {
  const result: Partial<DomaraListingHtmlExtraction> = { imageUrls: [] };
  const images: string[] = [];
  const scriptRegex = /<script\b[^>]*type\s*=\s*("|')application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const payload = (match[2] || "").trim();
    if (!payload) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }

    const candidates = flattenJsonLd(parsed);
    for (const candidate of candidates) {
      const title = readJsonPath(candidate, ["name", "headline", "title"]);
      const description = readJsonPath(candidate, ["description"]);
      const image = readJsonPath(candidate, ["image", "image.url"]);
      const canonicalUrl = readJsonPath(candidate, ["url", "mainEntityOfPage"]);
      const price = readJsonPath(candidate, ["offers.price", "offers.priceSpecification.price", "price"]);
      const propertyType = readJsonPath(candidate, ["@type", "additionalType", "accommodationCategory"]);
      const bedrooms = readJsonPath(candidate, ["numberOfRooms", "numberOfBedrooms", "numberOfRoomsTotal"]);
      const bathrooms = readJsonPath(candidate, ["numberOfBathroomsTotal", "numberOfBathrooms"]);
      const squareMeters = readJsonPath(candidate, ["floorSize.value", "floorSize", "area.value", "floorSize.maxValue"]);
      const agency = readJsonPath(candidate, ["seller.name", "provider.name", "brand.name", "agent.name"]);

      if (!result.title && typeof title === "string") result.title = decodeHtml(title);
      if (!result.description && typeof description === "string") result.description = decodeHtml(description);
      if (!result.canonicalUrl && typeof canonicalUrl === "string") {
        const resolved = resolveUrl(canonicalUrl, baseUrl);
        if (resolved) result.canonicalUrl = resolved;
      }
      if (!result.price && (typeof price === "string" || typeof price === "number")) result.price = String(price);
      if (!result.propertyType && typeof propertyType === "string") result.propertyType = decodeHtml(propertyType);
      if (result.bedrooms === undefined) result.bedrooms = normalizeNumberish(bedrooms);
      if (result.bathrooms === undefined) result.bathrooms = normalizeNumberish(bathrooms);
      if (result.squareMeters === undefined) result.squareMeters = normalizeNumberish(squareMeters);
      if (!result.agency && typeof agency === "string") result.agency = decodeHtml(agency);

      const address = readJsonPath(candidate, ["address.streetAddress", "address.addressLocality", "address.addressRegion", "address.addressCountry"]);
      if (!result.location && typeof address === "string") {
        result.location = decodeHtml(address);
      }

      if (typeof image === "string") {
        const resolved = resolveUrl(image, baseUrl);
        if (resolved && isLikelyImage(resolved)) pushUnique(images, resolved);
      } else if (Array.isArray(image)) {
        for (const item of image) {
          if (typeof item !== "string") continue;
          const resolved = resolveUrl(item, baseUrl);
          if (resolved && isLikelyImage(resolved)) pushUnique(images, resolved);
        }
      }
    }
  }

  result.imageUrls = images;
  return result;
}

function extractTitleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function extractCanonicalLink(html: string, baseUrl: string): string | undefined {
  const regex = /<link\b[^>]*rel\s*=\s*("|')canonical\1[^>]*>/i;
  const match = html.match(regex);
  if (!match?.[0]) return undefined;

  const attrs = parseAttributes(match[0]);
  const href = attrs.href;
  if (!href) return undefined;
  return resolveUrl(href, baseUrl) || undefined;
}

function extractVisibleImages(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const attrs = parseAttributes(tag);
    const srcsetCandidate = attrs.srcset ? parseSrcsetCandidate(attrs.srcset) : undefined;
    const src = srcsetCandidate || attrs["data-original"] || attrs["data-src"] || attrs.src;

    if (!src) continue;

    const width = normalizeNumberish(attrs.width) || 0;
    const height = normalizeNumberish(attrs.height) || 0;
    const altText = (attrs.alt || "").toLowerCase();
    const className = (attrs.class || "").toLowerCase();
    const lowerSrc = src.toLowerCase();

    if (width > 0 && height > 0 && (width <= 3 || height <= 3)) continue;
    if (altText.includes("logo") || className.includes("logo") || className.includes("icon")) continue;
    if (lowerSrc.includes("pixel") || lowerSrc.includes("tracking") || lowerSrc.endsWith(".svg")) continue;

    const resolved = resolveUrl(src, baseUrl);
    if (!resolved || !isLikelyImage(resolved)) continue;

    pushUnique(images, resolved);
  }

  return images;
}

export function extractListingFromHtml(html: string, pageUrl: string): DomaraListingHtmlExtraction {
  const result: DomaraListingHtmlExtraction = {
    imageUrls: [],
    extractionSources: [],
  };

  const jsonLd = extractJsonLd(html, pageUrl);
  if (
    jsonLd.title ||
    jsonLd.description ||
    jsonLd.price ||
    (jsonLd.imageUrls && jsonLd.imageUrls.length > 0) ||
    jsonLd.canonicalUrl
  ) {
    result.extractionSources.push("jsonLd");
  }

  if (jsonLd.title) result.title = jsonLd.title;
  if (jsonLd.description) result.description = jsonLd.description;
  if (jsonLd.price) result.price = jsonLd.price;
  if (jsonLd.location) result.location = jsonLd.location;
  if (jsonLd.propertyType) result.propertyType = jsonLd.propertyType;
  if (jsonLd.bedrooms !== undefined) result.bedrooms = jsonLd.bedrooms;
  if (jsonLd.bathrooms !== undefined) result.bathrooms = jsonLd.bathrooms;
  if (jsonLd.squareMeters !== undefined) result.squareMeters = jsonLd.squareMeters;
  if (jsonLd.agency) result.agency = jsonLd.agency;
  if (jsonLd.canonicalUrl) result.canonicalUrl = jsonLd.canonicalUrl;
  if (jsonLd.imageUrls?.length) {
    for (const url of jsonLd.imageUrls) {
      pushUnique(result.imageUrls, url);
    }
  }

  const meta = parseMetaTags(html);
  const ogTitle = meta["og:title"];
  const ogDescription = meta["og:description"];
  const ogImage = meta["og:image"];
  const ogUrl = meta["og:url"];
  const ogPrice = meta["product:price:amount"];

  if (ogTitle || ogDescription || ogImage || ogUrl || ogPrice) {
    result.extractionSources.push("openGraph");
  }

  if (!result.title && ogTitle) result.title = decodeHtml(ogTitle);
  if (!result.description && ogDescription) result.description = decodeHtml(ogDescription);
  if (!result.price && ogPrice) result.price = decodeHtml(ogPrice);
  if (!result.canonicalUrl && ogUrl) {
    const resolved = resolveUrl(ogUrl, pageUrl);
    if (resolved) result.canonicalUrl = resolved;
  }
  if (ogImage) {
    const resolved = resolveUrl(ogImage, pageUrl);
    if (resolved && isLikelyImage(resolved)) pushUnique(result.imageUrls, resolved);
  }

  const titleTag = extractTitleTag(html);
  const descriptionMeta = meta.description || meta["twitter:description"];
  const twitterImage = meta["twitter:image"];
  const canonicalFromLink = extractCanonicalLink(html, pageUrl);

  if (titleTag || descriptionMeta || twitterImage || canonicalFromLink) {
    result.extractionSources.push("meta");
  }

  if (!result.title && titleTag) result.title = titleTag;
  if (!result.description && descriptionMeta) result.description = decodeHtml(descriptionMeta);
  if (!result.canonicalUrl && canonicalFromLink) result.canonicalUrl = canonicalFromLink;
  if (twitterImage) {
    const resolved = resolveUrl(twitterImage, pageUrl);
    if (resolved && isLikelyImage(resolved)) pushUnique(result.imageUrls, resolved);
  }

  const visibleImages = extractVisibleImages(html, pageUrl);
  if (visibleImages.length > 0) {
    result.extractionSources.push("visibleImages");
  }
  for (const image of visibleImages) {
    pushUnique(result.imageUrls, image);
  }

  if (!result.canonicalUrl) {
    result.canonicalUrl = pageUrl;
  }

  return result;
}
