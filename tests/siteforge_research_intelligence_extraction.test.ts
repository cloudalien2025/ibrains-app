import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("siteforge research intelligence extraction", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("extracts normalized strategic signals from SerpAPI results", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "iPetzo | Pet Care App for Families",
            link: "https://example.com/pet-care",
            snippet: "Start free trial, manage medication and vaccination records, coordinate caregivers, and review FAQ.",
          },
          {
            title: "Pet Health Tracker",
            link: "https://another.example.com/app",
            snippet: "Trusted workflow with reminders and family coordination.",
          },
        ],
      }),
    } as Response);

    const result = await runMarketIntelligenceAgent({ brief, serpApiKey: "serpapi-test" });

    expect(result.status).toBe("used");
    expect(result.researchIntelligence).toBeTruthy();
    expect(result.researchIntelligence?.niche).toBe("pet care");
    expect(result.researchIntelligence?.audienceSegments.length).toBeGreaterThan(0);
    expect(result.researchIntelligence?.recurringCtaPatterns.join(" ").toLowerCase()).toContain("trial");
    expect(result.researchIntelligence?.recommendedPages).toContain("Home");
    expect(result.researchIntelligence?.sourceSnapshots.length).toBeGreaterThan(0);
    expect(result.researchIntelligence?.sourceSnapshots[0]?.domain).toBe("example.com");
  });

  it("marks confidence reduction when SerpAPI is unavailable", async () => {
    const result = await runMarketIntelligenceAgent({ brief, serpApiKey: null });
    expect(result.status).toBe("not_configured");
    expect(result.researchIntelligence?.confidenceNotes.join(" ").toLowerCase()).toContain("confidence reduced");
  });
});
