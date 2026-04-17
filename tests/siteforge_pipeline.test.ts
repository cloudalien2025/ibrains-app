import { describe, expect, it, vi, beforeEach } from "vitest";
import { runPlannerAgent, runPlannerAgentDeterministic } from "@/lib/siteforge/agents/planner";
import { runContentAgent, runContentAgentDeterministic } from "@/lib/siteforge/agents/content";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";
import { runQaAgent } from "@/lib/siteforge/agents/qa";
import { applyBuildDelta, createBuildDelta } from "@/lib/siteforge/refinement";

const mockGenerateStructuredJson = vi.fn();

vi.mock("@/lib/siteforge/llm/openai", () => ({
  generateStructuredJson: (...args: unknown[]) => mockGenerateStructuredJson(...args),
}));

const brief = {
  businessName: "Acme Growth",
  businessType: "SaaS",
  businessDescription: "CRM automation for sales teams",
  targetAudience: "B2B sales leaders",
  websiteGoal: "drive_demos_trials" as const,
  mainOffer: "Revenue acceleration platform",
  brandTone: "expert" as const,
  marketLocation: "US",
  competitors: "HubSpot",
  differentiators: "Fast setup",
};

describe("siteforge pipeline", () => {
  beforeEach(() => {
    mockGenerateStructuredJson.mockReset();
  });

  it("planner/content agents return validated structured outputs from mocked model payloads", async () => {
    mockGenerateStructuredJson
      .mockResolvedValueOnce({
        businessType: "SaaS",
        businessSummary: "CRM automation for sales teams",
        siteGoal: "drive demos and trials",
        primaryCTA: "Book a Demo",
        targetAudience: "B2B sales leaders",
        homepageSlug: "home",
        navigation: ["Home", "About", "Contact"],
        assumptions: ["Conversion-first"],
        warnings: [],
        pages: [
          {
            id: "page_home",
            title: "Home",
            slug: "home",
            purpose: "Primary conversion page",
            sections: [
              { id: "sec_hero", sectionType: "hero", purpose: "Value prop" },
              { id: "sec_cta", sectionType: "cta", purpose: "Drive demo" },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        siteTitle: "Acme Growth",
        brandVoice: "expert and modern",
        pages: [
          {
            pageId: "page_home",
            title: "Home",
            slug: "home",
            headline: "Scale revenue faster",
            subheadline: "Built for B2B sales teams",
            cta: "Book a Demo",
            sections: [
              {
                sectionId: "sec_hero",
                heading: "Revenue growth, simplified",
                body: "Unify pipeline and outreach in one platform.",
              },
              {
                sectionId: "sec_cta",
                heading: "Start your rollout",
                body: "Get implementation support.",
                cta: "Book a Demo",
              },
            ],
          },
        ],
      });

    const plan = await runPlannerAgent({ brief, model: "gpt-4.1-mini", apiKey: "sk-test" });
    expect(plan.pages).toHaveLength(1);
    expect(plan.primaryCTA).toBe("Book a Demo");

    const content = await runContentAgent({ sitePlan: plan, brief, model: "gpt-4.1-mini", apiKey: "sk-test" });
    expect(content.pages).toHaveLength(1);
    expect(content.pages[0]?.sections).toHaveLength(2);

    const spec = runBuildSpecAgent(plan, content);
    const qa = runQaAgent(spec);
    expect(qa.isValid).toBe(true);
    expect(qa.errors).toHaveLength(0);
  });

  it("rejects invalid planner/content model output safely", async () => {
    mockGenerateStructuredJson.mockResolvedValueOnce({ invalid: true });
    await expect(runPlannerAgent({ brief, model: "gpt-4.1-mini", apiKey: "sk-test" })).rejects.toThrow(
      /missing required|must include/i
    );

    const deterministicPlan = runPlannerAgentDeterministic("Build a coaching site");
    mockGenerateStructuredJson.mockResolvedValueOnce({ siteTitle: "x", brandVoice: "y", pages: [] });
    await expect(
      runContentAgent({ sitePlan: deterministicPlan, brief, model: "gpt-4.1-mini", apiKey: "sk-test" })
    ).rejects.toThrow(/must include pages/i);
  });

  it("creates and applies targeted revision delta", () => {
    const plan = runPlannerAgentDeterministic("Build an ecommerce site");
    const content = runContentAgentDeterministic(plan);
    const spec = runBuildSpecAgent(plan, content);

    const delta = createBuildDelta({ message: "make it more premium and add testimonials" });
    expect(delta.operations.length).toBeGreaterThan(0);

    const revised = applyBuildDelta(spec, delta);
    const home = revised.pages.find((page) => page.slug === "home");
    expect(home).toBeTruthy();
    expect(
      home?.sections.some(
        (section) => /Refinement applied/i.test(section.body) || /New Conversion Section/i.test(section.heading)
      )
    ).toBe(true);
  });
});
