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
import { decidePageThriveApplication, decideSectionThriveApplication } from "@/lib/siteforge/thriveApplicationDecision";
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

function premiumProfilesForSection(params: {
  siteType: WebsiteStrategy["siteType"] | null;
  sectionType: BuildSpec["pages"][number]["sections"][number]["type"];
  pageRole: PageIntent;
  sectionIndex: number;
}): {
  hero_visual_strategy: string;
  hero_layout_variant: string;
  section_spacing_profile: string;
  typography_hierarchy_profile: string;
  cta_rhythm_profile: string;
  trust_render_strategy: string;
  mockup_render_strategy: string;
  mobile_stack_strategy: string;
  section_transition_strategy: string;
} {
  const siteType = params.siteType ?? "hybrid";
  const hero_visual_strategy =
    siteType === "app"
      ? "category_clarity_plus_differentiated_promise_plus_feature_chips"
      : siteType === "service"
        ? "audience_outcome_clarity_plus_process_assurance"
        : siteType === "product"
          ? "offer_clarity_plus_use_case_framing_plus_benefit_stack"
          : "balanced_service_product_value_ladder";
  const hero_layout_variant =
    siteType === "app"
      ? "split_value_stack_with_framed_product_visual"
      : siteType === "service"
        ? "outcome_lead_split_with_process_trust_strip"
        : siteType === "product"
          ? "offer_led_split_with_benefit_stack"
          : "balanced_split_with_dual_value_columns";
  const section_spacing_profile =
    params.sectionType === "hero"
      ? "premium_hero_spacious"
      : params.sectionType === "cta"
        ? "conversion_band_compact"
        : params.sectionType === "testimonials"
          ? "assurance_band_comfortable"
          : params.sectionType === "faq"
            ? "question_stack_compact"
            : "alternating_content_spacious";
  const typography_hierarchy_profile =
    params.sectionType === "hero"
      ? "hero_high_contrast_headline_stack"
      : params.sectionType === "cta"
        ? "cta_directive_headline_with_short_support"
        : "section_heading_with_clear_supporting_copy";
  const cta_rhythm_profile =
    siteType === "service"
      ? "hero_primary_then_mid_process_cta_then_final_consult_cta"
      : siteType === "product"
        ? "hero_offer_cta_then_value_cta_then_final_buy_cta"
        : "hero_primary_then_midpage_reinforcement_then_final_primary";
  const trust_render_strategy =
    siteType === "service"
      ? "process_rigor_scope_and_assurance_without_fabricated_reviews"
      : siteType === "product"
        ? "risk_reduction_and_purchase_clarity_without_fake_stats"
        : "operational_clarity_and_assurance_without_fabricated_social_proof";
  const mockup_render_strategy =
    siteType === "app" || params.sectionType === "hero"
      ? "framed_ui_mockup_with_value_callouts_without_placeholder_labels"
      : "benefit_panels_without_synthetic_artifacts";
  const mobile_stack_strategy =
    params.sectionType === "hero"
      ? "headline_then_subheadline_then_value_stack_then_primary_cta_then_secondary_cta_then_visual"
      : params.sectionType === "cta"
        ? "single_column_cta_group_with_stacked_buttons"
        : "single_column_scannable_groups_with_short_copy_blocks";
  const section_transition_strategy =
    params.sectionIndex === 0
      ? "hero_to_value_transition"
      : params.sectionType === "cta"
        ? "high_contrast_conversion_closure"
        : params.pageRole === "homepage"
          ? "alternating_surface_and_accent_bands"
          : "calm_editorial_progression";

  return {
    hero_visual_strategy,
    hero_layout_variant,
    section_spacing_profile,
    typography_hierarchy_profile,
    cta_rhythm_profile,
    trust_render_strategy,
    mockup_render_strategy,
    mobile_stack_strategy,
    section_transition_strategy,
  };
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

    const sections = page.sections.map((section, sectionIndex) => {
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
      const premiumProfiles = premiumProfilesForSection({
        siteType: strategy?.siteType ?? null,
        sectionType: section.sectionType,
        pageRole: role,
        sectionIndex,
      });
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
          ...premiumProfiles,
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
    const pageRenderDecision = pageResolution?.render_target ?? "safe_wordpress_render_with_thrive_hints";

    const updatedSections = page.sections.map((section, sectionIndex) => {
      const sectionResolution = pageResolution?.sections.find((entry) => entry.sectionId === section.id);
      const renderDecision = sectionResolution?.render_target ?? "safe_wordpress_render_with_thrive_hints";
      const preferredTarget = toPreferredRenderTarget(renderDecision);
      const sectionRendererMode: "wp_safe_mode" | "thrive_intel_mode" | "staging_native_mode" =
        sectionResolution?.render_target === "staging_only_native_write_required"
          ? "staging_native_mode"
          : sectionResolution?.render_target === "safe_wordpress_render_with_thrive_hints"
            ? "wp_safe_mode"
            : "thrive_intel_mode";
      const premiumProfiles = premiumProfilesForSection({
        siteType: strategy?.siteType ?? null,
        sectionType: section.type,
        pageRole: (page.metadata.pageRole as PageIntent) ?? pageRole(page.slug, sitePlan.homepageSlug),
        sectionIndex,
      });
      const sectionApplicationDecision = decideSectionThriveApplication({
        page,
        section,
        decision: renderDecision,
        fallbackReason: sectionResolution?.fallback_reason ?? null,
        strategy,
        thriveIntelligence,
      });

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
          hero_visual_strategy: sectionResolution?.hero_visual_strategy ?? premiumProfiles.hero_visual_strategy,
          hero_layout_variant: sectionResolution?.hero_layout_variant ?? premiumProfiles.hero_layout_variant,
          section_spacing_profile: sectionResolution?.section_spacing_profile ?? premiumProfiles.section_spacing_profile,
          typography_hierarchy_profile:
            sectionResolution?.typography_hierarchy_profile ?? premiumProfiles.typography_hierarchy_profile,
          cta_rhythm_profile: sectionResolution?.cta_rhythm_profile ?? premiumProfiles.cta_rhythm_profile,
          trust_render_strategy: sectionResolution?.trust_render_strategy ?? premiumProfiles.trust_render_strategy,
          mockup_render_strategy: sectionResolution?.mockup_render_strategy ?? premiumProfiles.mockup_render_strategy,
          mobile_stack_strategy: sectionResolution?.mobile_stack_strategy ?? premiumProfiles.mobile_stack_strategy,
          section_transition_strategy:
            sectionResolution?.section_transition_strategy ?? premiumProfiles.section_transition_strategy,
          thriveApplicationDecision: sectionApplicationDecision,
          native_authoring_mode: sectionApplicationDecision.native_authoring_mode,
          native_authoring_requirements: sectionApplicationDecision.native_authoring_requirements,
          native_authoring_blockers: sectionApplicationDecision.native_authoring_blockers,
          staging_bundle_candidates: sectionApplicationDecision.staging_bundle_candidates,
          design_pack_candidate: sectionApplicationDecision.design_pack_candidate,
          symbol_creation_candidate: sectionApplicationDecision.symbol_creation_candidate,
          template_creation_candidate: sectionApplicationDecision.template_creation_candidate,
          section_creation_candidate: sectionApplicationDecision.section_creation_candidate,
        },
      };
    });

    const pageApplicationDecision = decidePageThriveApplication({
      page,
      decision: pageRenderDecision,
      fallbackReason: pageResolution?.fallback_reason ?? null,
      strategy,
      thriveIntelligence,
    });
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
        hero_visual_strategy: updatedSections[0]?.metadata?.hero_visual_strategy ?? undefined,
        hero_layout_variant: updatedSections[0]?.metadata?.hero_layout_variant ?? undefined,
        section_spacing_profile: "alternating_dense_light_sections",
        typography_hierarchy_profile: "premium_heading_scale_with_clear_subheads",
        cta_rhythm_profile: updatedSections.find((section) => section.type === "cta")?.metadata?.cta_rhythm_profile ?? undefined,
        trust_render_strategy: updatedSections.find((section) => section.type === "testimonials")?.metadata?.trust_render_strategy ?? undefined,
        mockup_render_strategy: updatedSections.find((section) => section.type === "hero")?.metadata?.mockup_render_strategy ?? undefined,
        mobile_stack_strategy: "mobile_first_single_column_scannable",
        section_transition_strategy: "deliberate_section_band_progression",
        thriveApplicationDecision: pageApplicationDecision,
        native_authoring_mode: pageApplicationDecision.native_authoring_mode,
        native_authoring_requirements: pageApplicationDecision.native_authoring_requirements,
        native_authoring_blockers: pageApplicationDecision.native_authoring_blockers,
        staging_bundle_candidates: pageApplicationDecision.staging_bundle_candidates,
        design_pack_candidate: pageApplicationDecision.design_pack_candidate,
        symbol_creation_candidate: pageApplicationDecision.symbol_creation_candidate,
        template_creation_candidate: pageApplicationDecision.template_creation_candidate,
        section_creation_candidate: pageApplicationDecision.section_creation_candidate,
      },
      sections: updatedSections,
    };
  });

  return {
    ...draft,
    pages: resolvedPages,
  };
}
