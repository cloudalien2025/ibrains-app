function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toHttpUrl(value: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: string): string | null {
  const direct = toHttpUrl(value);
  if (direct) return direct;
  const withProtocol = value && !value.includes("://") ? `https://${value}` : "";
  return toHttpUrl(withProtocol);
}

function normalizePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (toHttpUrl(trimmed)) return trimmed;
  const clean = trimmed.replace(/^\/+/, "");
  return clean ? `/${clean}` : null;
}

export function resolveCanonicalListingUrl(
  raw: Record<string, unknown>,
  fallback: unknown,
  siteBaseUrl?: string | null
): string | null {
  const directCandidates = [
    asString(raw.url),
    asString(raw.listing_url),
    asString(raw.profile_url),
    asString(raw.link),
    asString(raw.permalink),
    asString(raw.source_url),
    asString(fallback),
  ];
  for (const candidate of directCandidates) {
    const parsed = toHttpUrl(candidate);
    if (parsed) return parsed;
  }

  const baseCandidates = [
    asString(siteBaseUrl),
    asString(raw.site_base_url),
    asString(raw.base_url),
    asString(raw.home_url),
    asString(raw.site_url),
    asString(raw.domain),
  ];
  const base = baseCandidates.map(normalizeBaseUrl).find((candidate): candidate is string => Boolean(candidate)) ?? null;
  if (!base) return null;

  const pathCandidates = [
    asString(raw.group_filename),
    asString(raw.group_slug),
    asString(raw.slug),
    asString(raw.listing_slug),
    asString(raw.path),
    asString(raw.url_path),
  ];
  for (const candidate of pathCandidates) {
    const asAbsolute = toHttpUrl(candidate);
    if (asAbsolute) return asAbsolute;
    const path = normalizePath(candidate);
    if (!path) continue;
    try {
      return new URL(path, base).toString();
    } catch {
      continue;
    }
  }
  return null;
}
