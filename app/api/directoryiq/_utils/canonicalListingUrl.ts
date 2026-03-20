function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveCanonicalListingUrl(raw: Record<string, unknown>, fallback: unknown): string | null {
  return (
    asString(raw.url) ||
    asString(raw.listing_url) ||
    asString(raw.profile_url) ||
    asString(raw.link) ||
    asString(raw.permalink) ||
    asString(raw.source_url) ||
    asString(fallback) ||
    null
  );
}
