import { describe, expect, it } from "vitest";
import {
  buildBdTestUnresolvedMessage,
  formatVerificationStatus,
} from "@/app/apps/directoryiq/signal-sources/directoryiq-signal-sources-client";

describe("directoryiq bd verification ui status mapping", () => {
  it("formats verified and verified_empty statuses", () => {
    expect(formatVerificationStatus("verified", 12)).toBe("verified (12)");
    expect(formatVerificationStatus("verified_empty", 0)).toBe("verified, 0 rows returned");
    expect(formatVerificationStatus("invalid", 0)).toBe("invalid");
    expect(formatVerificationStatus("unresolved", 0)).toBe("unresolved (0)");
  });

  it("returns path-specific unresolved copy", () => {
    const listingPath = buildBdTestUnresolvedMessage({
      verification: {
        listings: {
          reason: "listings_valid_path_invalid",
          search: { path: "/api/v2/users_portfolio_groups/search", status: 404 },
        },
      },
    });
    expect(listingPath.toLowerCase()).toContain("listings path is invalid");

    const blogPath = buildBdTestUnresolvedMessage({
      verification: {
        blog_posts: { reason: "blog_posts_valid_path_invalid" },
      },
    });
    expect(blogPath.toLowerCase()).toContain("blog posts path is invalid");
  });
});
