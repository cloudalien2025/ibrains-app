import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runMarketIntelligenceAgent } from "@/lib/siteforge/agents/marketIntelligence";

const brief = {
  businessName: "iPetzo",
  businessType: "Pet wellness app",
  businessDescription: "AI assistant for pet parents",
  targetAudience: "pet owners",
  websiteGoal: "drive_demos_trials" as const,
  mainOffer: "AI pet health guidance",
  brandTone: "expert" as const,
  marketLocation: "United States",
  competitors: "Chewy, Rover",
  differentiators: "AI-first triage insights",
};

describe("siteforge market intelligence agent", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns not_configured when SerpApi key is unavailable", async () => {
    const result = await runMarketIntelligenceAgent({
      brief,
      serpApiKey: null,
    });

    expect(result.status).toBe("not_configured");
    expect(result.source).toBe("none");
    expect(result.plannerEnriched).toBe(false);
    expect(result.contentEnriched).toBe(false);
    expect(result.querySet).toEqual([]);
  });

  it("returns structured pattern brief when SerpApi responds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "Pet Care App - Trusted by 1M users",
            link: "https://example.com/landing",
            snippet:
              "Start free trial, view testimonials, FAQ accordion, and app screenshots. Download on App Store and Google Play.",
          },
        ],
      }),
    } as Response);

    const result = await runMarketIntelligenceAgent({
      brief,
      serpApiKey: "serpapi-test",
    });

    expect(result.status).toBe("used");
    expect(result.source).toBe("serpapi");
    expect(result.querySet.length).toBeGreaterThan(0);
    expect(result.competitorPatterns.length).toBeGreaterThan(0);
    expect(result.ctaPatterns).toContain("start_free_trial");
    expect(result.faqThemes).toContain("how_it_works");
    expect(result.visualPatternHints).toContain("app_mockup_showcase");
    expect(result.contentWarnings).toContain("patterns_only_no_copy");
    expect(result.fingerprint).toHaveLength(16);
  });
});
