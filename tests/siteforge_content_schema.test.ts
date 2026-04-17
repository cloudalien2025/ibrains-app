import { describe, expect, it, vi, beforeEach } from "vitest";
import { runContentAgent } from "@/lib/siteforge/agents/content";
import { validateContentPackage } from "@/lib/siteforge/agents/validators";

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

const sitePlan = {
  businessType: "SaaS",
  businessSummary: "CRM automation for sales teams",
  siteGoal: "drive demos and trials",
  primaryCTA: "Book a Demo",
  targetAudience: "B2B sales leaders",
  homepageSlug: "home",
  navigation: ["Home", "Contact"],
  assumptions: [],
  warnings: [],
  pages: [
    {
      id: "page_home",
      title: "Home",
      slug: "home",
      purpose: "Primary conversion page",
      sections: [
        { id: "sec_hero", sectionType: "hero" as const, purpose: "Value prop" },
        { id: "sec_cta", sectionType: "cta" as const, purpose: "Drive demo" },
      ],
    },
  ],
};

describe("siteforge content schema strict-mode contract", () => {
  beforeEach(() => {
    mockGenerateStructuredJson.mockReset();
  });

  it("sends a strict-valid section schema where required covers all section properties", async () => {
    mockGenerateStructuredJson.mockResolvedValue({
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
              cta: null,
            },
          ],
        },
      ],
    });

    await runContentAgent({ sitePlan, brief, model: "gpt-5", apiKey: "sk-test" });

    expect(mockGenerateStructuredJson).toHaveBeenCalledTimes(1);
    const request = mockGenerateStructuredJson.mock.calls[0]?.[0] as {
      schema: {
        properties: {
          pages: {
            items: {
              properties: {
                sections: {
                  items: {
                    properties: Record<string, unknown>;
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
      schemaName: string;
    };

    expect(request.schemaName).toBe("siteforge_content_package");
    const sectionItems = request.schema.properties.pages.items.properties.sections.items;
    expect(sectionItems.required).toEqual(["sectionId", "heading", "body", "cta"]);
    expect(Object.keys(sectionItems.properties)).toEqual(sectionItems.required);
    expect((sectionItems.properties.cta as { type: string[] }).type).toEqual(["string", "null"]);
  });

  it("validator accepts section cta null and normalizes it to undefined", () => {
    const parsed = validateContentPackage({
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
              cta: null,
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

    expect(parsed.pages[0]?.sections[0]?.cta).toBeUndefined();
    expect(parsed.pages[0]?.sections[1]?.cta).toBe("Book a Demo");
  });
});
