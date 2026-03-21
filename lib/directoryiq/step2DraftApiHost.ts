const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

export function resolveStep2DraftDirectoryIqApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE ?? DEFAULT_DIRECTORYIQ_API_BASE).trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_DIRECTORYIQ_API_BASE must use http or https");
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid NEXT_PUBLIC_DIRECTORYIQ_API_BASE: ${error.message}`
        : "Invalid NEXT_PUBLIC_DIRECTORYIQ_API_BASE"
    );
  }
}

export function buildStep2DraftApiUrl(listingId: string, slot: number, siteQuery = ""): string {
  const base = resolveStep2DraftDirectoryIqApiBase();
  const target = new URL(
    `/api/directoryiq/listings/${encodeURIComponent(listingId)}/authority/${encodeURIComponent(String(slot))}/draft`,
    `${base}/`
  );

  const normalizedQuery = siteQuery.trim().replace(/^\?/, "");
  if (normalizedQuery) {
    target.search = normalizedQuery;
  }

  return target.toString();
}
