import {
  BuildSpec,
  BuildSpecPage,
  ContentPackage,
  MarketIntelligenceBrief,
  PageIntent,
  SitePlan,
  SiteForgeVisualDesignTokens,
  ThriveExecutionPathDecision,
  ThriveIntelligence,
  ThriveRenderTarget,
  VisualPattern,
  VisualSectionComposition,
  WebsiteStrategy,
} from "@/lib/siteforge/contracts";
import { resolveThriveComposition } from "@/lib/siteforge/thriveCompositionResolver";
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
      spacingDensity: "comfortable",
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
      emphasisLevel: "high",
      backgroundStyle: "surface",
      cardStyle: "elevated",
      mediaSlot: "image",
      iconStyle: "line",
      ctaStyle: "inline_link",
      spacingDensity: "comfortable",
      sectionBandStyle: "accent",
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

function inferResearchConfidence(params: {
  marketIntelligence: MarketIntelligenceBrief | null;
  strategy: WebsiteStrategy | null;
}): "high" | "medium" | "low" {
  if (params.marketIntelligence?.status === "used" && (params.marketIntelligence.researchIntelligence?.sourceSnapshots.length ?? 0) >= 6) return "high";
  if (params.marketIntelligence?.status === "used" || params.strategy) return "medium";
  return "low";
}

function toPreferredRenderTarget(decision: ThriveExecutionPathDecision): ThriveRenderTarget {
  if (decision === "prefer_existing_thrive_symbol") return "thrive_symbol_reference";
  if (decision === "prefer_existing_thrive_section" || decision === "prefer_existing_thrive_template" || decision === "prefer_existing_thrive_layout") {
    return "thrive_content_template_reference";
  }
  if (decision === "staging_only_native_write_required") return "future_landing_page_candidate";
  return "wordpress_page_content";
}

export function runBuildSpecAgent(
  sitePlan: SitePlan,
  contentPackage: ContentPackage,
  options?: {
    websiteStrategy?: WebsiteStrategy | null;
    marketIntelligence?: MarketIntelligenceBrief | null;
    thriveIntelligence?: ThriveIntelligence | null;
  }
): BuildSpec {
  const strategy = options?.websiteStrategy ?? null;
  const marketIntelligence = options?.marketIntelligence ?? null;
  const thriveIntelligence = options?.thriveIntelligence ?? null;
  const researchConfidence = inferResearchConfidence({ marketIntelligence, strategy });
  const appLike = isAppOrSaasSite(sitePlan);

  const draftPages = sitePlan.pages.map((page) => {
    const content = contentPackage.pages.find((entry) => entry.pageId === page.id);
    const role = pageRole(page.slug, sitePlan.homepageSlug);

    const sections = page.sections.map((section) => {
      const match = content?.sections.find((entry) => entry.sectionId === section.id);
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
          thriveRefs: {
            symbolRefCandidates: [],
            templateRefCandidates: [],
            sectionRefCandidates: [],
          },
          landingPageCandidate: role === "homepage" ? `${page.slug}-landing` : null,
          rendererMode: "wp_safe_mode" as const,
          contractCaptureRef: null,
          sectionIntent: sectionIntent(section.sectionType),
          renderTarget: "wordpress_page_content" as const,
          researchConfidence,
          preferredRenderTarget: "wordpress_page_content" as const,
          thriveSymbolRoleCandidate,
          visualComposition,
        },
      };
    });

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
        shellStrategy: strategy?.thriveExecutionHints.preferredShellType ?? null,
        reusableSymbolCandidates: [],
        contentTemplateCandidates: [],
        thriveRefs: {
          symbolRefCandidates: [],
          templateRefCandidates: [],
          sectionRefCandidates: [],
        },
        landingPageCandidate: role === "homepage" ? `${page.slug}-landing` : null,
        rendererMode: "wp_safe_mode" as const,
        contractCaptureRef: null,
        researchConfidence,
        preferredRenderTarget: "wordpress_page_content" as const,
      },
    };
  });

  const draft: BuildSpec = {
    siteTitle: contentPackage.siteTitle,
    homepageSlug: sitePlan.homepageSlug,
    menu: sitePlan.navigation.map((label) => ({
      label,
      slug: draftPages.find((page) => page.title === label)?.slug ?? "home",
    })),
    pages: draftPages,
    metadata: {
      conversionFocus: "high",
      thriveAware: false,
      thriveMode: "wp_safe_mode",
      thriveExecutionMode: "wp_safe_mode",
      thriveIntelligenceUsed: false,
      researchConfidence,
      strategySignals: strategy
        ? {
            siteType: strategy.siteType,
            primaryConversionGoal: strategy.primaryConversionGoal,
            trustModel: strategy.positioning.trustModel,
          }
        : undefined,
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

  const composition = resolveThriveComposition({
    buildSpec: draft,
    researchIntelligence: marketIntelligence?.researchIntelligence ?? null,
    websiteStrategy: strategy,
    thriveIntelligence,
    marketIntelligence,
  });

  const resolvedPages = draft.pages.map((page) => {
    const pageResolution = composition.pages.find((entry) => entry.pageSlug === page.slug);

    const updatedSections = page.sections.map((section) => {
      const sectionResolution = pageResolution?.sections.find((entry) => entry.sectionId === section.id);
      const renderDecision = sectionResolution?.render_target ?? "safe_wordpress_render_with_thrive_hints";
      const preferredTarget = toPreferredRenderTarget(renderDecision);
      const sectionRendererMode: "wp_safe_mode" | "thrive_intel_mode" | "staging_native_mode" =
        sectionResolution?.render_target === "staging_only_native_write_required"
          ? "staging_native_mode"
          : sectionResolution?.render_target === "safe_wordpress_render_with_thrive_hints"
            ? "wp_safe_mode"
            : "thrive_intel_mode";

      return {
        ...section,
        metadata: {
          ...(section.metadata ?? {}),
          renderTargetDecision: renderDecision,
          fallbackReason: sectionResolution?.fallback_reason ?? null,
          rendererMode: sectionRendererMode,
          renderTarget: preferredTarget,
          preferredRenderTarget: preferredTarget,
          thriveRefs: {
            symbolRefSelected: sectionResolution?.symbol_ref_selected ?? null,
            symbolRefCandidates: sectionResolution?.symbol_ref_candidates ?? [],
            templateRefSelected: sectionResolution?.template_ref_selected ?? null,
            templateRefCandidates: sectionResolution?.template_ref_candidates ?? [],
            layoutRefSelected: sectionResolution?.layout_ref_selected ?? null,
            layoutRefCandidates: sectionResolution?.layout_ref_candidates ?? [],
            sectionRefSelected: sectionResolution?.section_ref_selected ?? null,
            sectionRefCandidates: sectionResolution?.section_ref_candidates ?? [],
          },
          trustStrategy: sectionResolution?.trust_strategy ?? "grounded_assurance_only",
          ctaRhythmHint: sectionResolution?.cta_rhythm_hint ?? "hero_primary_then_final_cta",
          mobileHierarchyHint: sectionResolution?.mobile_hierarchy_hint ?? "single_column_mobile_stack",
          premiumVisualStructureHint:
            sectionResolution?.visual_structure_hint ?? "clean_section_spacing_typography_hierarchy",
          mockupStrategy:
            sectionResolution?.mockup_strategy ??
            "polished_neutral_visual_anchor_without_placeholder_labels",
        },
      };
    });

    const pageRenderDecision = pageResolution?.render_target ?? "safe_wordpress_render_with_thrive_hints";
    return {
      ...page,
      metadata: {
        ...page.metadata,
        shellStrategy: pageResolution?.shell_strategy ?? page.metadata.shellStrategy,
        shellLayoutCandidate:
          pageResolution?.layout_ref_selected != null
            ? (thriveIntelligence?.layouts ?? []).find((entry) => entry.id === pageResolution.layout_ref_selected)?.slug ?? page.metadata.shellLayoutCandidate
            : page.metadata.shellLayoutCandidate,
        renderTargetDecision: pageRenderDecision,
        fallbackReason: pageResolution?.fallback_reason ?? null,
        rendererMode: pageResolution?.render_mode ?? "wp_safe_mode",
        preferredRenderTarget: toPreferredRenderTarget(pageRenderDecision),
        thriveRefs: {
          symbolRefSelected: pageResolution?.symbol_ref_selected ?? null,
          symbolRefCandidates: pageResolution?.symbol_ref_candidates ?? [],
          templateRefSelected: pageResolution?.template_ref_selected ?? null,
          templateRefCandidates: pageResolution?.template_ref_candidates ?? [],
          layoutRefSelected: pageResolution?.layout_ref_selected ?? null,
          layoutRefCandidates: pageResolution?.layout_ref_candidates ?? [],
          sectionRefSelected: pageResolution?.section_ref_selected ?? null,
          sectionRefCandidates: pageResolution?.section_ref_candidates ?? [],
        },
        premiumCompositionSummary: pageResolution?.premium_composition_summary ?? null,
        homepageSequenceHint: pageResolution?.homepage_sequence_hint ?? null,
      },
      sections: updatedSections,
    };
  });

  return {
    ...draft,
    pages: resolvedPages,
  };
}
