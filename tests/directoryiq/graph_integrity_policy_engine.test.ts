import { describe, expect, it } from "vitest";
import { getLinkPolicy } from "@/src/directoryiq/services/graphIntegrity/linkPolicyEngine";

describe("graph integrity policy engine", () => {
  it("includes banned anchors and max link rules", () => {
    const policy = getLinkPolicy("default", null);
    expect(policy.bannedAnchors).toContain("click here");
    expect(policy.maxLinksPerBlogToListings).toBeGreaterThan(0);
    expect(policy.maxLinksPerListingFromSingleBlog).toBe(1);
  });

  it("enforces min links when entities are present", () => {
    const policy = getLinkPolicy("default", null);
    expect(policy.minLinksPerBlogToListings).toBeGreaterThan(0);
  });
});
