import { describe, expect, it } from "vitest";
import { parseBuildPayload } from "@/lib/siteforge/api";

describe("siteforge build payload contract", () => {
  it("requires structured website brief", () => {
    expect(() => parseBuildPayload({ prompt: "old" })).toThrow(/Website brief is required/i);
  });

  it("synthesizes prompt from website brief", () => {
    const payload = parseBuildPayload({
      websiteBrief: {
        businessName: "Acme Co",
        businessType: "Consulting",
        businessDescription: "Growth consulting for SaaS",
        targetAudience: "Founders",
        websiteGoal: "book_calls",
        mainOffer: "Strategy sessions",
        brandTone: "expert",
      },
      homepageStrategy: "use_existing",
    });

    expect(payload.prompt).toContain("Business name: Acme Co");
    expect(payload.prompt).toContain("Website goal: Book calls");
    expect(payload.websiteBrief.businessName).toBe("Acme Co");
  });
});
