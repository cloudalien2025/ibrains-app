import { describe, expect, it } from "vitest";
import { normalizeBdSiteTestVerification } from "@/src/lib/directoryiq/siteTestVerification";

describe("normalizeBdSiteTestVerification", () => {
  it("normalizes v2 verification payloads", () => {
    const result = normalizeBdSiteTestVerification({
      ok: true,
      verification: {
        listings: {
          status: "verified",
          search: { count: 1 },
        },
        blog_posts: {
          status: "unresolved",
          search: { count: 0 },
        },
      },
    });

    expect(result.overall).toBe("verified");
    expect(result.listings).toBe("verified");
    expect(result.blogPosts).toBe("unresolved");
    expect(result.listingsCount).toBe(1);
    expect(result.blogPostsCount).toBe(0);
  });

  it("normalizes legacy preflight/search payloads", () => {
    const result = normalizeBdSiteTestVerification({
      ok: true,
      preflight: { ok: true },
      search: { ok: true, count: 3 },
    });

    expect(result.overall).toBe("verified");
    expect(result.listings).toBe("verified");
    expect(result.blogPosts).toBe("verified");
    expect(result.listingsCount).toBe(3);
    expect(result.blogPostsCount).toBeNull();
  });
});
