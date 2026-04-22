import { describe, expect, it } from "vitest";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";

const sitePlan = {
  businessType: "SaaS",
  businessSummary: "Workflow app",
  siteGoal: "start trials",
  primaryCTA: "Start trial",
  targetAudience: "Operations teams",
  homepageSlug: "home",
  navigation: ["Home"],
  assumptions: [],
  warnings: [],
  pages: [
    {
      id: "p_home",
      title: "Home",
      slug: "home",
      purpose: "Conversion page",
      sections: [
        { id: "s_hero", sectionType: "hero" as const, purpose: "Hero" },
        { id: "s_features", sectionType: "features" as const, purpose: "Features" },
        { id: "s_testimonials", sectionType: "testimonials" as const, purpose: "Trust" },
        { id: "s_cta", sectionType: "cta" as const, purpose: "CTA" },
      ],
    },
  ],
};

const content = {
  siteTitle: "Acme",
  brandVoice: "premium",
  pages: [
    {
      pageId: "p_home",
      title: "Home",
      slug: "home",
      headline: "Hero",
      subheadline: "Sub",
      cta: "Start",
      sections: [
        { sectionId: "s_hero", heading: "Hero", body: "Hero body", cta: null },
        { sectionId: "s_features", heading: "Features", body: "Features body", cta: null },
        { sectionId: "s_testimonials", heading: "Trust", body: "Assurance body", cta: null },
        { sectionId: "s_cta", heading: "CTA", body: "CTA body", cta: "Start" },
      ],
    },
  ],
};

describe("siteforge buildspec premium hints", () => {
  it("emits mobile hierarchy, CTA rhythm, and hero composition hints", () => {
    const spec = runBuildSpecAgent(sitePlan, content, {
      websiteStrategy: null,
      marketIntelligence: null,
      thriveIntelligence: null,
    });

    const page = spec.pages[0];
    const hero = page.sections.find((section) => section.type === "hero");
    const cta = page.sections.find((section) => section.type === "cta");

    expect(page.metadata.premiumCompositionSummary).toBeTruthy();
    expect(Array.isArray(page.metadata.homepageSequenceHint)).toBe(true);
    expect(hero?.metadata?.mobileHierarchyHint).toBeTruthy();
    expect(hero?.metadata?.premiumVisualStructureHint).toContain("premium_hero");
    expect(cta?.metadata?.ctaRhythmHint).toContain("hero");
    expect(hero?.metadata?.mockupStrategy).not.toContain("placeholder");
    expect(page.metadata.thriveApplicationDecision?.path).toBe("safe_wordpress_render_with_premium_visual_hints");
    expect(page.metadata.native_authoring_mode).toBe("safe_wordpress_render_with_premium_visual_hints");
    expect(hero?.metadata?.thriveApplicationDecision?.path).toBe("safe_wordpress_render_with_premium_visual_hints");
    expect(hero?.metadata?.native_authoring_mode).toBe("safe_wordpress_render_with_premium_visual_hints");
  });
});
