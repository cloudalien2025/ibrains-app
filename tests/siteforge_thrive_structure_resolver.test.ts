import { describe, expect, it } from "vitest";
import { applyThriveMappings } from "@/lib/siteforge/thrive";
import { BuildSpec, ThriveIntelligence } from "@/lib/siteforge/contracts";

function sampleSpec(): BuildSpec {
  return {
    siteTitle: "Acme",
    homepageSlug: "home",
    menu: [{ label: "Home", slug: "home" }],
    pages: [
      {
        pageId: "p_home",
        title: "Home",
        slug: "home",
        purpose: "primary conversion page",
        sections: [
          { id: "s_hero", type: "hero", heading: "Book More Calls", body: "Conversion focused hero", metadata: {} },
          { id: "s_cta", type: "cta", heading: "Start Now", body: "Primary CTA block", metadata: {} },
          { id: "s_faq", type: "faq", heading: "FAQ", body: "Top questions", metadata: {} },
        ],
        metadata: { template: "landing" },
      },
    ],
    metadata: {
      conversionFocus: "high",
      thriveAware: false,
      thriveMode: "wp_safe_mode",
      createdAt: "2026-04-20T00:00:00.000Z",
    },
  };
}

function intelligence(): ThriveIntelligence {
  return {
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
        keywords: ["header", "default"],
      },
      {
        id: 62,
        title: "Primary CTA Block",
        slug: "primary-cta-block",
        taxonomy: { slug: "sections", name: "Sections" },
        inferredRole: "section",
        reusable: true,
        hasBuilderContent: true,
        hasCustomCss: false,
        contentHash: "a2",
        cssHash: null,
        keywords: ["cta", "conversion"],
      },
      {
        id: 80,
        title: "FAQ Section",
        slug: "faq-section",
        taxonomy: { slug: "sections", name: "Sections" },
        inferredRole: "section",
        reusable: true,
        hasBuilderContent: true,
        hasCustomCss: false,
        contentHash: "a3",
        cssHash: null,
        keywords: ["faq"],
      },
    ],
    symbolSummary: { total: 3, headers: 1, footers: 0, sections: 2, unknown: 0 },
    primitiveCounts: { thriveTemplate: 9, thriveLayout: 3, thriveSection: 4, tcbSymbol: 3 },
    safeHints: { frontPageUsesWpSettings: true },
    warnings: [],
  };
}

describe("siteforge thrive structure resolver", () => {
  it("resolves page/section Thrive-aware metadata and symbol candidates deterministically", () => {
    const translated = applyThriveMappings(sampleSpec(), true, intelligence());

    expect(translated.spec.metadata.thriveExecutionMode).toBe("thrive_intel_mode");
    expect(translated.spec.metadata.themeArtifactRef).toContain("theme-skin:shapeshift");

    const page = translated.spec.pages[0];
    expect(page.metadata.pageRole).toBe("homepage");
    expect(page.metadata.shellRole).toBe("homepage_shell");
    expect(page.metadata.shellTemplateGroupCandidate).toBe("homepage");
    expect(page.metadata.reusableSymbolCandidates?.length).toBeGreaterThan(0);

    const hero = page.sections.find((entry) => entry.id === "s_hero");
    const cta = page.sections.find((entry) => entry.id === "s_cta");
    const faq = page.sections.find((entry) => entry.id === "s_faq");

    expect(hero?.metadata?.preferredRenderTarget).toBe("thrive_symbol_reference");
    expect(cta?.metadata?.preferredRenderTarget).toBe("thrive_symbol_reference");
    expect(["thrive_symbol_reference", "thrive_content_template_reference", "wp_html_fallback"]).toContain(
      faq?.metadata?.preferredRenderTarget
    );
    expect(hero?.metadata?.visualPrimitiveSelection?.requestedPattern).toBeDefined();
    expect(hero?.metadata?.visualPrimitiveSelection?.selectedPrimitive).toBeDefined();

    expect(translated.sectionResolutions.length).toBe(3);
    expect(translated.sectionResolutions.some((entry) => entry.resolution === "existing_symbol")).toBe(true);
    expect(translated.sectionResolutions.some((entry) => entry.visualPattern === "hero_centered")).toBe(true);
    expect(
      translated.sectionResolutions.every((entry) =>
        ["existing_reusable_symbol", "existing_compatible_primitive", "native_create_contract", "safe_fallback"].includes(
          entry.primitiveSelectionSource
        )
      )
    ).toBe(true);
  });
});
