type NormalizeListingImageUrlInput = {
  rawUrl: string | null | undefined;
  listingUrl?: string | null;
  bdBaseUrl?: string | null;
};

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toAbsoluteBaseUrl(input: string | null | undefined): string | null {
  const value = clean(input);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function joinToBase(base: string, pathOrFile: string): string | null {
  try {
    const normalized = pathOrFile.startsWith("/") ? pathOrFile : `/${pathOrFile.replace(/^\/+/, "")}`;
    return new URL(normalized, base).toString();
  } catch {
    return null;
  }
}

export function normalizeListingImageUrl(input: NormalizeListingImageUrlInput): string | null {
  const candidate = clean(input.rawUrl);
  if (!candidate) return null;

  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("//")) return `https:${candidate}`;

  const listingBase = toAbsoluteBaseUrl(input.listingUrl);
  const bdBase = toAbsoluteBaseUrl(input.bdBaseUrl);
  const baseUrl = listingBase ?? bdBase;
  if (!baseUrl) return null;

  if (candidate.startsWith("/")) {
    return joinToBase(baseUrl, candidate);
  }

  if (!candidate.includes("/")) {
    return joinToBase(baseUrl, candidate);
  }

  return joinToBase(baseUrl, candidate);
}
