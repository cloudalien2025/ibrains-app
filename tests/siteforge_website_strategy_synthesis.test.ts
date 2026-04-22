import { describe, expect, it } from "vitest";
import { synthesizeWebsiteStrategy } from "@/lib/siteforge/websiteStrategy";

const brief = {
  businessName: "iPetzo",
  businessType: "Pet wellness app",
  businessDescription: "Mobile app for pet records and reminders",
  targetAudience: "Pet parents",
  websiteGoal: "drive_demos_trials" as const,
  mainOffer: "Pet care command center",
  brandTone: "premium" as const,
  marketLocation: null,
  competitors: null,
  differentiators: "Grounded support and family coordination",
};

const marketIntelligence = {
  status: "used" as const,
  source: "serpapi" as const,
  querySet: ["pet app"],
  competitorPatterns: ["example.com"],
  commonPageSections: ["hero_section", "feature_grid", "faq_section"],
  recurringValueProps: ["ease_of_use"],
  trustSignals: ["social_proof"],
  ctaPatterns: ["start_free_trial"],
  faqThemes: ["how_it_works"],
  visualPatternHints: ["app_mockup_showcase"],
  appStorePositioningHints: ["store_presence"],
  contentWarnings: [],
  summary: "used",
  fingerprint: "abcd",
  generatedAt: "2026-04-22T00:00:00.000Z",
  plannerEnriched: true,
  contentEnriched: true,
  researchIntelligence: {
    niche: "pet care",
    audienceSegments: ["Pet parents", "caregivers and families"],
    conversionGoal: "trial_or_demo",
    recurringValueProps: ["organized records", "medication tracking"],
    recurringCtaPatterns: ["start free trial"],
    recurringTrustPatterns: ["social proof", "workflow clarity"],
    recurringSectionPatterns: ["hero_first", "feature_proof_block", "faq_flow", "cta_close"],
    visualDirectionSignals: ["product_visual_showcase", "premium_modern_aesthetic"],
    differentiationOpportunities: ["care coordination"],
    recommendedPages: ["Home", "Features", "FAQ", "Contact", "Pricing"],
    confidenceNotes: ["SerpAPI patterns included."],
    sourceSnapshots: [],
  },
};

describe("siteforge website strategy synthesis", () => {
  it("builds deterministic strategy from brief + research", () => {
    const strategy = synthesizeWebsiteStrategy({
      brief,
      marketIntelligence,
      thriveIntelligence: null,
    });

    expect(strategy.siteType).toBe("app");
    expect(strategy.primaryAudience).toBe("Pet parents");
    expect(strategy.primaryConversionGoal).toBe("start trial or demo");
    expect(strategy.homepageStrategy.sectionBlueprint[0]).toBe("hero");
    expect(strategy.homepageStrategy.sectionBlueprint).toContain("faq");
    expect(strategy.pageStrategy.requiredPages).toContain("Features");
    expect(strategy.thriveExecutionHints.prefersLandingPageStyle).toBe(true);
  });

  it("varies homepage composition blueprint by intent", () => {
    const serviceStrategy = synthesizeWebsiteStrategy({
      brief: {
        ...brief,
        businessType: "Consulting service",
        businessDescription: "B2B advisory and implementation",
        mainOffer: "Service retainers",
      },
      marketIntelligence,
      thriveIntelligence: null,
    });
    const productStrategy = synthesizeWebsiteStrategy({
      brief: {
        ...brief,
        businessType: "Physical product brand",
        businessDescription: "Consumer product storefront",
        mainOffer: "Flagship starter kit",
      },
      marketIntelligence,
      thriveIntelligence: null,
    });

    expect(serviceStrategy.siteType).toBe("service");
    expect(serviceStrategy.homepageStrategy.sectionBlueprint).toEqual([
      "hero",
      "solution",
      "features",
      "testimonials",
      "faq",
      "contact",
      "cta",
    ]);
    expect(productStrategy.siteType).toBe("product");
    expect(productStrategy.homepageStrategy.sectionBlueprint).toEqual([
      "hero",
      "features",
      "solution",
      "testimonials",
      "cta",
    ]);
  });
});
