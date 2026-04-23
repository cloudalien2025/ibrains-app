export type BdSiteVerificationStatus = "verified" | "unresolved";

export type BdSiteVerificationSnapshot = {
  overall: BdSiteVerificationStatus;
  listings: BdSiteVerificationStatus;
  blogPosts: BdSiteVerificationStatus;
  listingsCount: number | null;
  blogPostsCount: number | null;
};

type LegacyResponse = {
  ok?: unknown;
  preflight?: { ok?: unknown } | null;
  search?: { ok?: unknown; count?: unknown } | null;
};

type VerificationBranch = {
  status?: unknown;
  search?: { count?: unknown } | null;
};

type V2Response = {
  ok?: unknown;
  verification?: {
    listings?: VerificationBranch | null;
    blog_posts?: VerificationBranch | null;
  } | null;
};

function asStatus(value: unknown): BdSiteVerificationStatus {
  return value === "verified" ? "verified" : "unresolved";
}

function asCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function normalizeBdSiteTestVerification(input: unknown): BdSiteVerificationSnapshot {
  const payload = (input ?? {}) as LegacyResponse & V2Response;
  const verification = payload.verification;

  if (verification && typeof verification === "object") {
    const listings = asStatus(verification.listings?.status);
    const blogPosts = asStatus(verification.blog_posts?.status);
    const overall =
      payload.ok === true || (listings === "verified" && blogPosts === "verified") ? "verified" : "unresolved";

    return {
      overall,
      listings,
      blogPosts,
      listingsCount: asCount(verification.listings?.search?.count),
      blogPostsCount: asCount(verification.blog_posts?.search?.count),
    };
  }

  const listings = payload.preflight?.ok === true && payload.search?.ok === true ? "verified" : "unresolved";
  const overall = payload.ok === true ? "verified" : listings;
  return {
    overall,
    listings,
    blogPosts: overall,
    listingsCount: asCount(payload.search?.count),
    blogPostsCount: null,
  };
}
