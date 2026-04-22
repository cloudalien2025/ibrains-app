import { describe, expect, it } from "vitest";
import { decidePageThriveApplication, decideSectionThriveApplication } from "@/lib/siteforge/thriveApplicationDecision";
import { BuildSpecPage, BuildSpecSection } from "@/lib/siteforge/contracts";

function basePage(): BuildSpecPage {
  return {
    pageId: "p_home",
    title: "Home",
    slug: "home",
    purpose: "Primary page",
    sections: [],
    metadata: {
      template: "landing",
      thriveRefs: {
        symbolRefSelected: null,
        symbolRefCandidates: [],
        templateRefSelected: null,
        templateRefCandidates: [],
        layoutRefSelected: null,
        layoutRefCandidates: [],
        sectionRefSelected: null,
        sectionRefCandidates: [],
      },
    },
  };
}

function baseSection(): BuildSpecSection {
  return {
    id: "s_hero",
    type: "hero",
    heading: "Hero",
    body: "Hero body",
    cta: "Start",
    metadata: {
      thriveRefs: {
        symbolRefSelected: null,
        symbolRefCandidates: [],
        templateRefSelected: null,
        templateRefCandidates: [],
        layoutRefSelected: null,
        layoutRefCandidates: [],
        sectionRefSelected: null,
        sectionRefCandidates: [],
      },
    },
  };
}

describe("siteforge thrive application decisions", () => {
  it("maps symbol reuse decisions to explicit live-safe native reuse path", () => {
    const page = basePage();
    page.metadata.thriveRefs = {
      symbolRefSelected: 57,
      symbolRefCandidates: [57],
      templateRefSelected: null,
      templateRefCandidates: [],
      layoutRefSelected: null,
      layoutRefCandidates: [],
      sectionRefSelected: null,
      sectionRefCandidates: [],
    };
    const section = baseSection();
    section.metadata = {
      thriveRefs: {
        symbolRefSelected: 57,
        symbolRefCandidates: [57],
        templateRefSelected: null,
        templateRefCandidates: [],
        layoutRefSelected: null,
        layoutRefCandidates: [],
        sectionRefSelected: null,
        sectionRefCandidates: [],
      },
    };

    const pageDecision = decidePageThriveApplication({
      page,
      decision: "prefer_existing_thrive_symbol",
      fallbackReason: null,
      strategy: null,
      thriveIntelligence: { source: "wordpress_rest_get", collectedAt: "2026-04-22T00:00:00.000Z", mode: "wp_safe_mode", symbolInventory: [], symbolSummary: { total: 0, headers: 0, footers: 0, sections: 0, unknown: 0 }, primitiveCounts: { thriveTemplate: 0, thriveLayout: 0, thriveSection: 0, tcbSymbol: 0 }, safeHints: { frontPageUsesWpSettings: true }, warnings: [] },
    });
    const sectionDecision = decideSectionThriveApplication({
      page,
      section,
      decision: "prefer_existing_thrive_symbol",
      fallbackReason: null,
      strategy: null,
      thriveIntelligence: { source: "wordpress_rest_get", collectedAt: "2026-04-22T00:00:00.000Z", mode: "wp_safe_mode", symbolInventory: [], symbolSummary: { total: 0, headers: 0, footers: 0, sections: 0, unknown: 0 }, primitiveCounts: { thriveTemplate: 0, thriveLayout: 0, thriveSection: 0, tcbSymbol: 0 }, safeHints: { frontPageUsesWpSettings: true }, warnings: [] },
    });

    expect(pageDecision.path).toBe("apply_existing_thrive_symbol");
    expect(pageDecision.native_authoring_mode).toBe("live_safe_native_reuse");
    expect(pageDecision.confidenceScore).toBeGreaterThan(0.9);
    expect(sectionDecision.path).toBe("apply_existing_thrive_symbol");
    expect(sectionDecision.native_authoring_mode).toBe("live_safe_native_reuse");
    expect(sectionDecision.staging_bundle_candidates).toEqual([]);
  });

  it("maps safe fallback without intelligence to premium visual hints path", () => {
    const page = basePage();
    const section = baseSection();

    const pageDecision = decidePageThriveApplication({
      page,
      decision: "safe_wordpress_render_with_thrive_hints",
      fallbackReason: "no_inventory",
      strategy: null,
      thriveIntelligence: null,
    });
    const sectionDecision = decideSectionThriveApplication({
      page,
      section,
      decision: "safe_wordpress_render_with_thrive_hints",
      fallbackReason: "no_inventory",
      strategy: null,
      thriveIntelligence: null,
    });

    expect(pageDecision.path).toBe("safe_wordpress_render_with_premium_visual_hints");
    expect(pageDecision.native_authoring_mode).toBe("safe_wordpress_render_with_premium_visual_hints");
    expect(sectionDecision.path).toBe("safe_wordpress_render_with_premium_visual_hints");
    expect(sectionDecision.fallbackReason).toBe("no_inventory");
    expect(sectionDecision.native_authoring_requirements).toEqual([]);
  });
});
