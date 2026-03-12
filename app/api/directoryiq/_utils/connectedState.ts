import type { BdSite } from "@/app/api/directoryiq/_utils/bdSites";

export type CanonicalDirectoryIqSite = Pick<BdSite, "enabled" | "secretPresent" | "baseUrl" | "listingsDataId">;

export function isCanonicalDirectoryIqSiteConnected(site: CanonicalDirectoryIqSite): boolean {
  return site.enabled && site.secretPresent && site.baseUrl.trim().length > 0 && site.listingsDataId != null;
}

export function hasCanonicalDirectoryIqConnection(sites: CanonicalDirectoryIqSite[]): boolean {
  return sites.some((site) => isCanonicalDirectoryIqSiteConnected(site));
}
