import { describe, expect, it } from "vitest";
import { normalizeBdSiteTestVerification } from "@/src/lib/directoryiq/siteTestVerification";

describe("directoryiq site test verification status mapping", () => {
  it("treats verified_empty as verified overall", () => {
    const normalized = normalizeBdSiteTestVerification({
      ok: true,
      verification: {
        listings: { status: "verified_empty", search: { count: 0 } },
        blog_posts: { status: "verified_empty", search: { count: 0 } },
      },
    });

    expect(normalized.overall).toBe("verified");
    expect(normalized.listings).toBe("verified_empty");
    expect(normalized.blogPosts).toBe("verified_empty");
    expect(normalized.listingsCount).toBe(0);
    expect(normalized.blogPostsCount).toBe(0);
  });

  it("preserves invalid branch status", () => {
    const normalized = normalizeBdSiteTestVerification({
      ok: false,
      verification: {
        listings: { status: "invalid", search: { count: 0 } },
        blog_posts: { status: "unresolved", search: { count: 0 } },
      },
    });

    expect(normalized.overall).toBe("unresolved");
    expect(normalized.listings).toBe("invalid");
    expect(normalized.blogPosts).toBe("unresolved");
  });
});
