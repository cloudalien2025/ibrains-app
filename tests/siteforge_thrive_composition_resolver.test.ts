import { describe, expect, it } from "vitest";
import { BuildSpec, MarketIntelligenceBrief, ThriveIntelligence, WebsiteStrategy } from "@/lib/siteforge/contracts";
import { resolveThriveComposition } from "@/lib/siteforge/thriveCompositionResolver";

const baseSpec: BuildSpec = {
  siteTitle: "Acme",
  homepageSlug: "home",
  menu: [{ label: "Home", slug: "home" }],
  pages: [
    {
      pageId: "p_home",
      title: "Home",
      slug: "home",
      purpose: "Primary conversion page",
      sections: [
        { id: "s_hero", type: "hero", heading: "Hero", body: "Category and promise", metadata: {} },
        { id: "s_trust", type: "testimonials", heading: "Trust", body: "Grounded assurance", metadata: {} },
        { id: "s_cta", type: "cta", heading: "Start", body: "Primary action", metadata: {} },
      ],
      metadata: { template: "landing" },
    },
  ],
  metadata: {
    conversionFocus: "high",
    thriveAware: false,
    createdAt: "2026-04-20T00:00:00.000Z",
  },
};

const strategy: WebsiteStrategy = {
  siteType: "app",
  primaryAudience: "Operators",
  secondaryAudience: [],
  primaryConversionGoal: "start trial",
  positioning: {
    category: "operations app",
    differentiatedPromise: "faster execution",
    tone: "premium and confident",
    trustModel: "clarity-first",
  },
  homepageStrategy: {
    heroObjective: "clear first-view conversion",
    keyMessages: ["workflow", "clarity"],
    sectionBlueprint: ["hero", "features", "solution", "testimonials", "cta"],
    primaryCta: "Start free trial",
    secondaryCta: "See workflow",
  },
  pageStrategy: {
    requiredPages: ["Home"],
    optionalPages: [],
  },
  designDirection: {
    visualTone: "premium modern",
    density: "balanced",
    hierarchyStyle: "hero first",
    proofStyle: "grounded",
    mockupStrategy: "neutral",
  },
  thriveExecutionHints: {
    preferredShellType: "thrive-homepage-canonical",
    preferredSectionPatterns: ["hero_first"],
    preferredSymbolCategories: ["header", "cta"],
    prefersLandingPageStyle: true,
  },
};

const market: MarketIntelligenceBrief = {
  status: "used",
  source: "serpapi",
  querySet: ["saas landing"],
  competitorPatterns: [],
  commonPageSections: ["hero", "cta"],
  recurringValueProps: ["speed"],
  trustSignals: ["clarity"],
  ctaPatterns: ["start_trial"],
  faqThemes: [],
  visualPatternHints: ["premium_modern_aesthetic"],
  appStorePositioningHints: [],
  contentWarnings: [],
  summary: "patterns",
  fingerprint: "abc",
  generatedAt: "2026-04-20T00:00:00.000Z",
  plannerEnriched: true,
  contentEnriched: true,
  researchIntelligence: {
    niche: "ops",
    audienceSegments: ["operators"],
    conversionGoal: "start trial",
    recurringValueProps: ["clarity"],
    recurringCtaPatterns: ["start trial"],
    recurringTrustPatterns: ["assurance"],
    recurringSectionPatterns: ["hero_first"],
    visualDirectionSignals: ["premium_modern_aesthetic"],
    differentiationOpportunities: ["execution speed"],
    recommendedPages: ["Home"],
    confidenceNotes: [],
    sourceSnapshots: [],
  },
};

const intelligence: ThriveIntelligence = {
  source: "wordpress_rest_get",
  collectedAt: "2026-04-20T00:00:00.000Z",
  mode: "wp_safe_mode",
  activeSkin: { id: 1, name: "Skin", slug: "skin", tag: null, isActive: true },
  templates: [
    { id: 10, slug: "landing-shell-a", title: "Landing Shell A" },
    { id: 11, slug: "landing-shell-b", title: "Landing Shell B" },
  ],
  layouts: [{ id: 21, slug: "homepage-layout", title: "Homepage Layout" }],
  sections: [{ id: 31, slug: "cta-band", title: "CTA Band" }],
  symbolInventory: [
    {
      id: 41,
      title: "Premium Hero Header",
      slug: "premium-hero-header",
      taxonomy: { slug: "headers", name: "Headers" },
      inferredRole: "header",
      reusable: true,
      hasBuilderContent: true,
      hasCustomCss: true,
      contentHash: "a",
      cssHash: "b",
      keywords: ["hero", "header", "cta"],
    },
  ],
  symbolSummary: { total: 1, headers: 1, footers: 0, sections: 0, unknown: 0 },
  primitiveCounts: { thriveTemplate: 2, thriveLayout: 1, thriveSection: 1, tcbSymbol: 1 },
  safeHints: { frontPageUsesWpSettings: true },
  warnings: [],
};

describe("siteforge thrive composition resolver", () => {
  it("ranks candidates deterministically and prefers strong existing Thrive symbols", () => {
    const resolved = resolveThriveComposition({
      buildSpec: baseSpec,
      researchIntelligence: market.researchIntelligence ?? null,
      websiteStrategy: strategy,
      thriveIntelligence: intelligence,
      marketIntelligence: market,
    });

    const home = resolved.pages[0];
    const hero = home.sections.find((section) => section.sectionId === "s_hero");

    expect(home.template_ref_candidates[0]).toBe(10);
    expect(home.shell_strategy).toContain("homepage_shell");
    expect(home.render_mode).toBe("thrive_intel_mode");
    expect(hero?.render_target).toBe("prefer_existing_thrive_symbol");
    expect(hero?.symbol_ref_selected).toBe(41);
  });

  it("emits staging_only_native_write_required when Thrive inventory is present but weakly matched", () => {
    const weak = resolveThriveComposition({
      buildSpec: baseSpec,
      researchIntelligence: market.researchIntelligence ?? null,
      websiteStrategy: strategy,
      thriveIntelligence: {
        ...intelligence,
        templates: [{ id: 100, slug: "x", title: "x" }],
        layouts: [{ id: 101, slug: "y", title: "y" }],
        sections: [{ id: 102, slug: "z", title: "z" }],
        symbolInventory: [],
      },
      marketIntelligence: market,
    });

    expect(weak.pages[0]?.render_target).toBe("staging_only_native_write_required");
  });

  it("falls back to safe WordPress render hints when Thrive inventory is unavailable", () => {
    const fallback = resolveThriveComposition({
      buildSpec: baseSpec,
      researchIntelligence: market.researchIntelligence ?? null,
      websiteStrategy: strategy,
      thriveIntelligence: null,
      marketIntelligence: market,
    });

    expect(fallback.pages[0]?.render_target).toBe("safe_wordpress_render_with_thrive_hints");
    expect(fallback.pages[0]?.fallback_reason).toBe("no_thrive_inventory");
  });
});
