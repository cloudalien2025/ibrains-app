import { canonicalizeUrl } from "@/src/directoryiq/utils/canonicalizeUrl";

export type LinkPolicy = {
  maxLinksPerBlogToListings: number;
  minLinksPerBlogToListings: number;
  maxLinksPerListingFromSingleBlog: number;
  allowedAnchorTypesPriority: Array<"brand" | "exact" | "partial" | "generic" | "geo" | "service">;
  bannedAnchors: string[];
  requireBacklinkForLinksTo: boolean;
  preferPrimaryListingUrl: boolean;
  canonicalizeUrl: (value: string | null | undefined) => string;
};

export function getLinkPolicy(tenantId: string, vertical?: string | null): LinkPolicy {
  void tenantId;
  void vertical;
  return {
    maxLinksPerBlogToListings: 12,
    minLinksPerBlogToListings: 3,
    maxLinksPerListingFromSingleBlog: 1,
    allowedAnchorTypesPriority: ["brand", "exact", "partial", "geo", "service", "generic"],
    bannedAnchors: ["click here", "read more", "here", "learn more"],
    requireBacklinkForLinksTo: true,
    preferPrimaryListingUrl: true,
    canonicalizeUrl,
  };
}
