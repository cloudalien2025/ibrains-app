import { describe, expect, it } from "vitest";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";

const sitePlan = {
  businessType: "SaaS",
  businessSummary: "Pet care app",
  siteGoal: "start trial",
  primaryCTA: "Start free trial",
  targetAudience: "Pet parents",
  homepageSlug: "home",
  navigation: ["Home"],
  assumptions: [],
  warnings: [],
  pages: [
    {
      id: "p_home",
      title: "Home",
      slug: "home",
      purpose: "Primary conversion page",
      sections: [
        { id: "s_hero", sectionType: "hero" as const, purpose: "Hero" },
        { id: "s_features", sectionType: "features" as const, purpose: "Features" },
        { id: "s_cta", sectionType: "cta" as const, purpose: "CTA" },
      ],
    },
  ],
};

const content = {
  siteTitle: "iPetzo",
  brandVoice: "premium",
  pages: [
    {
      pageId: "p_home",
      title: "Home",
      slug: "home",
      headline: "Keep pet care clear",
      subheadline: "Records and reminders in one app",
      cta: "Start free trial",
      sections: [
        { sectionId: "s_hero", heading: "Hero", body: "Hero body", cta: null },
        { sectionId: "s_features", heading: "Features", body: "Feature body", cta: null },
        { sectionId: "s_cta", heading: "CTA", body: "CTA body", cta: "Start free trial" },
      ],
    },
  ],
};

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

describe("siteforge buildspec thrive candidates", () => {
  it("emits thrive-aware candidate refs when inventories exist", () => {
    const spec = runBuildSpecAgent(sitePlan, content, {
      websiteStrategy: strategy,
      marketIntelligence: null,
      thriveIntelligence: {
        source: "wordpress_rest_get",
        collectedAt: "2026-04-22T00:00:00.000Z",
        mode: "wp_safe_mode",
        symbolInventory: [
          {
            id: 57,
            slug: "header-symbol",
            title: "Header Symbol",
            taxonomy: { slug: "headers", name: "Headers" },
            inferredRole: "header",
            reusable: true,
            hasBuilderContent: true,
            hasCustomCss: true,
            contentHash: "a",
            cssHash: "b",
            keywords: ["header", "cta"],
          },
        ],
        symbolSummary: { total: 1, headers: 1, footers: 0, sections: 0, unknown: 0 },
        primitiveCounts: { thriveTemplate: 2, thriveLayout: 1, thriveSection: 3, tcbSymbol: 1 },
        safeHints: { frontPageUsesWpSettings: true },
        templates: [
          { id: 200, slug: "template-200", title: "Template 200" },
          { id: 201, slug: "template-201", title: "Template 201" },
        ],
        layouts: [{ id: 300, slug: "layout-300", title: "Layout 300" }],
        sections: [{ id: 400, slug: "section-400", title: "Section 400" }],
        warnings: [],
      },
    });

    expect(spec.metadata.researchConfidence).toBe("medium");
    expect(spec.pages[0].metadata.thriveRefs?.templateRefCandidates?.length).toBeGreaterThan(0);
    expect(spec.pages[0].sections[0].metadata?.thriveRefs?.symbolRefCandidates?.length).toBeGreaterThan(0);
  });

  it("falls back safely when thrive inventories are absent", () => {
    const spec = runBuildSpecAgent(sitePlan, content, {
      websiteStrategy: null,
      marketIntelligence: null,
      thriveIntelligence: null,
    });

    expect(spec.metadata.researchConfidence).toBe("low");
    expect(spec.pages[0].metadata.thriveRefs?.templateRefCandidates ?? []).toEqual([]);
    expect(spec.pages[0].sections[0].metadata?.thriveRefs?.symbolRefCandidates ?? []).toEqual([]);
    expect(spec.pages[0].sections[0].metadata?.renderTarget).toBe("wordpress_page_content");
  });
});
