import { buildDirectoryIqWriteApiUrl, resolveDirectoryIqWriteApiBase } from "@/lib/directoryiq/writeApiHost";

export function resolveStep2DraftDirectoryIqApiBase(): string {
  return resolveDirectoryIqWriteApiBase();
}

export function buildStep2DraftApiUrl(listingId: string, slot: number, siteQuery = ""): string {
  return buildDirectoryIqWriteApiUrl(
    `/api/directoryiq/listings/${encodeURIComponent(listingId)}/authority/${encodeURIComponent(String(slot))}/draft`,
    siteQuery
  );
}
