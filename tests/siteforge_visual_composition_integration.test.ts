import { describe, expect, it } from "vitest";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";
import { applyThriveMappings } from "@/lib/siteforge/thrive";
import { createThriveNativeCompositionPlan } from "@/lib/siteforge/thriveNativeComposer";
import { ContentPackage, SitePlan, ThriveIntelligence, ThriveNativeGuardStatus, ExecutionResult } from "@/lib/siteforge/contracts";

const appPlan: SitePlan = {
  businessType: "SaaS",
  businessSummary: "AI pet wellness iPhone app",
  siteGoal: "drive demos and trials",
  primaryCTA: "Download App",
  targetAudience: "pet owners",
  homepageSlug: "home",
  navigation: ["Home"],
  assumptions: [],
  warnings: [],
  pages: [
    {
      id: "p_home",
      title: "Home",
      slug: "home",
      purpose: "app homepage",
      sections: [
        { id: "s_hero", sectionType: "hero", purpose: "hero" },
        { id: "s_features", sectionType: "features", purpose: "features" },
        { id: "s_testimonials", sectionType: "testimonials", purpose: "testimonials" },
        { id: "s_faq", sectionType: "faq", purpose: "faq" },
        { id: "s_cta", sectionType: "cta", purpose: "cta" },
      ],
    },
  ],
};

const content: ContentPackage = {
  siteTitle: "iPetzo",
  brandVoice: "expert",
  pages: [
    {
      pageId: "p_home",
      title: "Home",
      slug: "home",
      headline: "Smarter Pet Care",
      subheadline: "AI support for your pet",
      cta: "Download",
      sections: [
        { sectionId: "s_hero", heading: "Hero", body: "Hero body", cta: "Download" },
        { sectionId: "s_features", heading: "Features", body: "- One\n- Two\n- Three" },
        { sectionId: "s_testimonials", heading: "Testimonials", body: "Great app" },
        { sectionId: "s_faq", heading: "FAQ", body: "How does it work?" },
        { sectionId: "s_cta", heading: "Start today", body: "Get the app", cta: "Download" },
      ],
    },
  ],
};

const intelligence: ThriveIntelligence = {
  source: "wordpress_rest_get",
  collectedAt: "2026-04-20T00:00:00.000Z",
  mode: "wp_safe_mode",
  activeSkin: { id: 8, name: "Shapeshift", slug: "shapeshift", tag: "q1" },
  symbolInventory: [
    {
      id: 57,
      title: "Default Header for Shapeshift",
      slug: "default-header-for-shapeshift",
      taxonomy: { slug: "headers", name: "Headers" },
      inferredRole: "header",
      reusable: true,
      hasBuilderContent: true,
      hasCustomCss: true,
      contentHash: "a1",
      cssHash: "b1",
      keywords: ["header"],
    },
  ],
  symbolSummary: { total: 1, headers: 1, footers: 0, sections: 0, unknown: 0 },
  primitiveCounts: { thriveTemplate: 19, thriveLayout: 5, thriveSection: 1, tcbSymbol: 1 },
  safeHints: { frontPageUsesWpSettings: true },
  warnings: [],
};

const execution: ExecutionResult = {
  success: true,
  createdPages: [{ title: "Home", slug: "home", pageId: 65, url: "https://example.com/", status: "updated", intent: "homepage", decision: "reused_existing" }],
  homepage: { success: true, pageId: 65, message: "ok" },
  menu: { success: true, menuId: 5, message: "ok" },
  thrive: {
    enabled: true,
    appliedMappings: [],
    fallbackUsed: false,
    executionMode: "wp_safe_mode",
    intelligenceAvailable: true,
    symbolInventoryPresent: true,
    intelligence,
    runtime: { wpSafeMode: true, thriveIntelMode: true, stagingNativeMode: true },
    currentMode: "thrive_native_staging_mode",
    nativeGuard: null,
    nativeComposition: null,
    nativeExecution: null,
    nativeValidation: null,
    sectionResolutions: [],
  },
  actionLog: [],
  warnings: [],
  errors: [],
};

const guard: ThriveNativeGuardStatus = {
  eligible: true,
  blockedReason: null,
  environment: "test",
  nativeTargetMode: "approved_non_production_target",
  targetClassification: "approved_non_production_target",
  nativeTargetEligibility: "eligible",
  approvedTargetHost: "ipetzo.com",
  approvalSource: "env_allowlist",
  connectionHost: "ipetzo.com",
  allowlistedOperations: [
    "createOrUpdateTemplateShellReference",
    "attachReusablePrimitiveToPagePlan",
    "createOrUpdateSection",
    "createOrUpdateSymbol",
    "assignTemplateToPost",
  ],
  routeAllowlist: [],
  schemaContractVersion: "v1",
};

describe("siteforge visual composition integration", () => {
  it("selects premium visual patterns and maps to Thrive visual primitives deterministically", () => {
    const spec = runBuildSpecAgent(appPlan, content);
    const mapped = applyThriveMappings(spec, true, intelligence);
    const plan = createThriveNativeCompositionPlan({
      spec: mapped.spec,
      intelligence,
      sectionResolutions: mapped.sectionResolutions,
      execution,
      guard,
    });

    const hero = mapped.sectionResolutions.find((entry) => entry.sectionType === "hero");
    const features = mapped.sectionResolutions.find((entry) => entry.sectionType === "features");
    const faq = mapped.sectionResolutions.find((entry) => entry.sectionType === "faq");
    const cta = mapped.sectionResolutions.find((entry) => entry.sectionType === "cta");

    expect(mapped.spec.metadata.designSystemVersion).toBe("siteforge_visual_v1");
    expect(hero?.visualPattern).toBe("hero_split");
    expect(features?.visualPattern).toBe("feature_cards_grid");
    expect(faq?.visualPattern).toBe("faq_toggle");
    expect(cta?.visualPattern).toBe("cta_band");
    expect(faq?.selectedVisualPrimitive).toBe("thrive_toggle");
    expect(plan.sections.some((entry) => entry.intent === "created_visual_faq_toggle" || entry.intent === "reused_visual_symbol")).toBe(true);
  });
});
