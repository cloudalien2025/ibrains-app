import {
  BuildSpec,
  BuildSpecPage,
  ContentPackage,
  PageIntent,
  SitePlan,
  SiteForgeVisualDesignTokens,
  VisualPattern,
  VisualSectionComposition,
} from "@/lib/siteforge/contracts";
import { nowIso } from "@/lib/siteforge/utils";

function templateForSlug(slug: string): BuildSpecPage["metadata"]["template"] {
  if (slug === "home") return "landing";
  if (slug === "contact") return "contact";
  return "standard";
}

function sectionIntent(sectionType: BuildSpec["pages"][number]["sections"][number]["type"]): "conversion" | "informational" | "trust" | "navigation" {
  if (sectionType === "hero" || sectionType === "cta") return "conversion";
  if (sectionType === "testimonials") return "trust";
  if (sectionType === "contact") return "navigation";
  return "informational";
}

function pageRole(slug: string, homepageSlug: string): PageIntent {
  const normalized = slug.toLowerCase().trim();
  if (normalized === homepageSlug.toLowerCase().trim() || normalized === "home") return "homepage";
  if (normalized.includes("about")) return "about";
  if (normalized.includes("contact")) return "contact";
  if (normalized.includes("faq")) return "faq";
  if (normalized.includes("feature")) return "features";
  if (normalized.includes("pricing") || normalized.includes("plans")) return "pricing";
  return "generic";
}

function shellRoleForPage(role: PageIntent): NonNullable<BuildSpec["pages"][number]["metadata"]["shellRole"]> {
  if (role === "homepage") return "homepage_shell";
  if (role === "contact") return "utility_shell";
  if (role === "features" || role === "pricing") return "conversion_shell";
  if (role === "about" || role === "faq") return "standard_shell";
  return "unknown";
}

function isAppOrSaasSite(plan: SitePlan): boolean {
  const source = `${plan.businessType} ${plan.businessSummary} ${plan.siteGoal}`.toLowerCase();
  return /saas|software|app|platform|mobile/i.test(source);
}

function visualPatternForSection(params: {
  sectionType: BuildSpec["pages"][number]["sections"][number]["type"];
  pageRole: PageIntent;
  appLike: boolean;
}): VisualPattern {
  const { sectionType, pageRole, appLike } = params;
  if (sectionType === "hero") return appLike ? "hero_split" : "hero_centered";
  if (sectionType === "features") return "feature_cards_grid";
  if (sectionType === "testimonials") return appLike ? "trust_strip" : "testimonial_cards";
  if (sectionType === "faq") return "faq_toggle";
  if (sectionType === "cta") return "cta_band";
  if (sectionType === "contact") return "trust_strip";
  if (sectionType === "solution" && (appLike || pageRole === "homepage")) return "app_mockup_showcase";
  if (sectionType === "problem") return "icon_benefits_row";
  return "alternating_content_band";
}

function compositionForPattern(pattern: VisualPattern): VisualSectionComposition {
  if (pattern === "hero_split") {
    return {
      visualPattern: pattern,
      sectionLayout: "split",
      emphasisLevel: "high",
      backgroundStyle: "contrast_band",
      cardStyle: "none",
      mediaSlot: "app_screenshot",
      iconStyle: "line",
      ctaStyle: "dual_button",
      spacingDensity: "airy",
      sectionBandStyle: "accent",
      trustSignalStyle: "badge_strip",
      preferredNativePrimitives: ["thrive_template_symbol", "thrive_columns_background_band", "thrive_call_to_action"],
    };
  }
  if (pattern === "hero_centered") {
    return {
      visualPattern: pattern,
      sectionLayout: "centered",
      emphasisLevel: "high",
      backgroundStyle: "accent_band",
      cardStyle: "none",
      mediaSlot: "image",
      iconStyle: "line",
      ctaStyle: "primary_button",
      spacingDensity: "airy",
      sectionBandStyle: "accent",
      trustSignalStyle: "badge_strip",
      preferredNativePrimitives: ["thrive_template_symbol", "thrive_call_to_action", "thrive_columns_background_band"],
    };
  }
  if (pattern === "feature_cards_grid") {
    return {
      visualPattern: pattern,
      sectionLayout: "grid_3",
      emphasisLevel: "medium",
      backgroundStyle: "surface",
      cardStyle: "elevated",
      mediaSlot: "icon_cluster",
      iconStyle: "duotone",
      ctaStyle: "inline_link",
      spacingDensity: "comfortable",
      sectionBandStyle: "light",
      trustSignalStyle: "none",
      preferredNativePrimitives: ["thrive_content_box", "thrive_columns_background_band"],
    };
  }
  if (pattern === "testimonial_cards") {
    return {
      visualPattern: pattern,
      sectionLayout: "grid_3",
      emphasisLevel: "medium",
      backgroundStyle: "muted_band",
      cardStyle: "soft",
      mediaSlot: "none",
      iconStyle: "none",
      ctaStyle: "none",
      spacingDensity: "comfortable",
      sectionBandStyle: "light",
      trustSignalStyle: "rating_row",
      preferredNativePrimitives: ["thrive_content_box", "thrive_template_symbol"],
    };
  }
  if (pattern === "faq_toggle") {
    return {
      visualPattern: pattern,
      sectionLayout: "centered",
      emphasisLevel: "medium",
      backgroundStyle: "surface",
      cardStyle: "outlined",
      mediaSlot: "none",
      iconStyle: "line",
      ctaStyle: "none",
      spacingDensity: "comfortable",
      sectionBandStyle: "light",
      trustSignalStyle: "none",
      preferredNativePrimitives: ["thrive_toggle", "thrive_content_box"],
    };
  }
  if (pattern === "cta_band") {
    return {
      visualPattern: pattern,
      sectionLayout: "band",
      emphasisLevel: "high",
      backgroundStyle: "contrast_band",
      cardStyle: "none",
      mediaSlot: "none",
      iconStyle: "none",
      ctaStyle: "primary_button",
      spacingDensity: "comfortable",
      sectionBandStyle: "accent",
      trustSignalStyle: "none",
      preferredNativePrimitives: ["thrive_call_to_action", "thrive_columns_background_band"],
    };
  }
  if (pattern === "trust_strip") {
    return {
      visualPattern: pattern,
      sectionLayout: "row",
      emphasisLevel: "low",
      backgroundStyle: "muted_band",
      cardStyle: "none",
      mediaSlot: "none",
      iconStyle: "solid",
      ctaStyle: "none",
      spacingDensity: "compact",
      sectionBandStyle: "light",
      trustSignalStyle: "logo_row",
      preferredNativePrimitives: ["thrive_content_box", "thrive_columns_background_band"],
    };
  }
  if (pattern === "icon_benefits_row") {
    return {
      visualPattern: pattern,
      sectionLayout: "row",
      emphasisLevel: "medium",
      backgroundStyle: "surface",
      cardStyle: "soft",
      mediaSlot: "none",
      iconStyle: "line",
      ctaStyle: "inline_link",
      spacingDensity: "comfortable",
      sectionBandStyle: "none",
      trustSignalStyle: "none",
      preferredNativePrimitives: ["thrive_content_box", "thrive_columns_background_band"],
    };
  }
  if (pattern === "app_mockup_showcase") {
    return {
      visualPattern: pattern,
      sectionLayout: "split",
      emphasisLevel: "medium",
      backgroundStyle: "surface",
      cardStyle: "elevated",
      mediaSlot: "image",
      iconStyle: "line",
      ctaStyle: "inline_link",
      spacingDensity: "comfortable",
      sectionBandStyle: "none",
      trustSignalStyle: "none",
      preferredNativePrimitives: ["thrive_columns_background_band", "thrive_content_box"],
    };
  }
  return {
    visualPattern: pattern,
    sectionLayout: "split",
    emphasisLevel: "low",
    backgroundStyle: "surface",
    cardStyle: "none",
    mediaSlot: "image",
    iconStyle: "none",
    ctaStyle: "none",
    spacingDensity: "comfortable",
    sectionBandStyle: "none",
    trustSignalStyle: "none",
    preferredNativePrimitives: ["wordpress_structured_fallback", "thrive_columns_background_band"],
  };
}

function visualTokens(appLike: boolean): SiteForgeVisualDesignTokens {
  return {
    headingScale: appLike ? "bold_marketing" : "balanced_saas",
    bodyScale: "comfortable",
    sectionSpacing: "mobile_first_spacious",
    cardRadiusShadowLevel: "soft_depth",
    buttonHierarchy: "primary_strong_secondary_ghost",
    accentBackgroundContrast: "high_contrast_clear_cta",
    trustSectionStyling: "logo_badge_with_soft_band",
    appProductVisualEmphasis: appLike ? "screenshot_forward" : "copy_forward",
    maxTextDensityPerSection: "tight",
  };
}

export function runBuildSpecAgent(sitePlan: SitePlan, contentPackage: ContentPackage): BuildSpec {
  const appLike = isAppOrSaasSite(sitePlan);
  const pages = sitePlan.pages.map((page) => {
    const content = contentPackage.pages.find((entry) => entry.pageId === page.id);

    const sections = page.sections.map((section) => {
      const match = content?.sections.find((entry) => entry.sectionId === section.id);
      const role = pageRole(page.slug, sitePlan.homepageSlug);
      const candidateType: NonNullable<BuildSpec["pages"][number]["sections"][number]["metadata"]>["symbolCandidateType"] =
        section.sectionType === "hero"
          ? "header"
          : section.sectionType === "contact"
            ? "footer"
            : section.sectionType === "cta"
              ? "cta"
              : section.sectionType === "faq"
                ? "faq"
                : section.sectionType === "testimonials"
                  ? "testimonial"
                  : "marketing";
      const thriveSymbolRoleCandidate: "header" | "footer" | "section" | "unknown" =
        section.sectionType === "hero"
          ? "header"
          : section.sectionType === "contact"
            ? "footer"
            : "section";
      const visualPattern = visualPatternForSection({
        sectionType: section.sectionType,
        pageRole: role,
        appLike,
      });
      const visualComposition = compositionForPattern(visualPattern);
      return {
        id: section.id,
        type: section.sectionType,
        heading: match?.heading ?? `${page.title} section`,
        body: match?.body ?? section.purpose,
        cta: match?.cta,
        metadata: {
          source: "siteforge-v1",
          pageSlug: page.slug,
          pageRole: role,
          shellRole: shellRoleForPage(role),
          shellTemplateGroupCandidate: role === "homepage" ? "homepage" : "content",
          shellLayoutCandidate: role === "homepage" ? "thrive-homepage-canonical" : "thrive-standard-content",
          symbolCandidateType: candidateType,
          reusableSymbolCandidates: [],
          contentTemplateCandidates: [],
          landingPageCandidate: role === "homepage" ? `${page.slug}-landing` : null,
          rendererMode: "wp_safe_mode" as const,
          contractCaptureRef: null,
          sectionIntent: sectionIntent(section.sectionType),
          preferredRenderTarget: "wordpress_page_content" as const,
          thriveSymbolRoleCandidate,
          visualComposition,
        },
      };
    });

    const role = pageRole(page.slug, sitePlan.homepageSlug);
    return {
      pageId: page.id,
      title: page.title,
      slug: page.slug,
      purpose: page.purpose,
      sections,
      metadata: {
        template: templateForSlug(page.slug),
        pageRole: role,
        shellRole: shellRoleForPage(role),
        shellTemplateGroupCandidate: role === "homepage" ? "homepage" : "content",
        shellLayoutCandidate: role === "homepage" ? "thrive-homepage-canonical" : "thrive-standard-content",
        reusableSymbolCandidates: [],
        contentTemplateCandidates: [],
        landingPageCandidate: role === "homepage" ? `${page.slug}-landing` : null,
        rendererMode: "wp_safe_mode" as const,
        contractCaptureRef: null,
        preferredRenderTarget: "wordpress_page_content" as const,
      },
    };
  });

  return {
    siteTitle: contentPackage.siteTitle,
    homepageSlug: sitePlan.homepageSlug,
    menu: sitePlan.navigation.map((label) => ({
      label,
      slug: pages.find((page) => page.title === label)?.slug ?? "home",
    })),
    pages,
    metadata: {
      conversionFocus: "high",
      thriveAware: false,
      thriveMode: "wp_safe_mode",
      thriveExecutionMode: "wp_safe_mode",
      thriveIntelligenceUsed: false,
      designSystemVersion: "siteforge_visual_v1",
      visualDesignTokens: visualTokens(appLike),
      themeArtifactRef: null,
      architectContentArtifactRef: null,
      landingPageArtifactRef: null,
      designPackArtifactRef: null,
      contractCaptureRef: null,
      createdAt: nowIso(),
    },
  };
}
