import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPlannerAgent } from "@/lib/siteforge/agents/planner";

const mockGenerateStructuredJson = vi.fn();

vi.mock("@/lib/siteforge/llm/openai", () => ({
  generateStructuredJson: (...args: unknown[]) => mockGenerateStructuredJson(...args),
}));

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

describe("siteforge planner strategy integration", () => {
  beforeEach(() => {
    mockGenerateStructuredJson.mockReset();
  });

  it("applies strategy-required pages and homepage section blueprint", async () => {
    mockGenerateStructuredJson.mockResolvedValue({
      businessType: "SaaS",
      businessSummary: "summary",
      siteGoal: "goal",
      primaryCTA: "Book Demo",
      targetAudience: "buyers",
      homepageSlug: "home",
      navigation: ["Home"],
      assumptions: [],
      warnings: [],
      pages: [
        {
          id: "p_home",
          title: "Home",
          slug: "home",
          purpose: "home",
          sections: [{ id: "s_hero", sectionType: "hero", purpose: "hero" }],
        },
      ],
    });

    const strategy = {
      siteType: "app" as const,
      primaryAudience: "Pet parents",
      secondaryAudience: [],
      primaryConversionGoal: "start trial",
      positioning: {
        category: "pet care",
        differentiatedPromise: "clear coordinated care",
        tone: "premium and confident",
        trustModel: "clarity-first",
      },
      homepageStrategy: {
        heroObjective: "convert quickly",
        keyMessages: ["records", "reminders"],
        sectionBlueprint: ["hero", "problem", "features", "faq", "cta"] as const,
        primaryCta: "Start free trial",
        secondaryCta: "See how it works",
      },
      pageStrategy: {
        requiredPages: ["Home", "Features", "FAQ", "Contact"],
        optionalPages: ["Pricing"],
      },
      designDirection: {
        visualTone: "modern",
        density: "balanced" as const,
        hierarchyStyle: "hero-first",
        proofStyle: "grounded",
        mockupStrategy: "neutral",
      },
      thriveExecutionHints: {
        preferredShellType: "thrive-homepage-canonical",
        preferredSectionPatterns: [],
        preferredSymbolCategories: ["cta", "faq"],
        prefersLandingPageStyle: true,
      },
    };

    const result = await runPlannerAgent({
      brief,
      model: "gpt-5",
      apiKey: "sk-test",
      marketIntelligence: null,
      websiteStrategy: strategy,
    });

    expect(result.pages.map((page) => page.title)).toEqual(["Home", "Features", "FAQ", "Contact"]);
    const home = result.pages.find((page) => page.slug === "home");
    expect(home?.sections.map((section) => section.sectionType)).toEqual(["hero", "problem", "features", "faq", "cta"]);
  });
});
