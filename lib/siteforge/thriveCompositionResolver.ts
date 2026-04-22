import {
  BuildSpec,
  BuildSpecSection,
  MarketIntelligenceBrief,
  ThriveExecutionPathDecision,
  ThriveIntelligence,
  WebsiteStrategy,
} from "@/lib/siteforge/contracts";

type PrimitiveRef = { id: number; slug: string; title: string };

type RankedRef = {
  id: number;
  slug: string;
  title: string;
  score: number;
  reasons: string[];
};

export type ResolvedSectionComposition = {
  sectionId: string;
  render_target: ThriveExecutionPathDecision;
  fallback_reason: string | null;
  symbol_ref_selected: number | null;
  symbol_ref_candidates: number[];
  section_ref_selected: number | null;
  section_ref_candidates: number[];
  template_ref_selected: number | null;
  template_ref_candidates: number[];
  layout_ref_selected: number | null;
  layout_ref_candidates: number[];
  trust_strategy: string;
  cta_rhythm_hint: string;
  mobile_hierarchy_hint: string;
  visual_structure_hint: string;
  mockup_strategy: string;
  hero_visual_strategy: string;
  hero_layout_variant: string;
  section_spacing_profile: string;
  typography_hierarchy_profile: string;
  cta_rhythm_profile: string;
  trust_render_strategy: string;
  mockup_render_strategy: string;
  mobile_stack_strategy: string;
  section_transition_strategy: string;
};

export type ResolvedPageComposition = {
  pageSlug: string;
  shell_strategy: string;
  render_mode: "thrive_intel_mode" | "wp_safe_mode" | "staging_native_mode";
  render_target: ThriveExecutionPathDecision;
  fallback_reason: string | null;
  template_ref_selected: number | null;
  template_ref_candidates: number[];
  layout_ref_selected: number | null;
  layout_ref_candidates: number[];
  section_ref_selected: number | null;
  section_ref_candidates: number[];
  symbol_ref_selected: number | null;
  symbol_ref_candidates: number[];
  premium_composition_summary: string;
  homepage_sequence_hint: string[];
  sections: ResolvedSectionComposition[];
};

export type ThriveCompositionResolution = {
  pages: ResolvedPageComposition[];
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function scoreRefs(params: {
  refs: PrimitiveRef[];
  contextTokens: string[];
  roleTokens: string[];
  premiumTokens: string[];
  homepage: boolean;
}): RankedRef[] {
  const { refs, contextTokens, roleTokens, premiumTokens, homepage } = params;
  const contextSet = new Set(contextTokens);
  const roleSet = new Set(roleTokens);
  const premiumSet = new Set(premiumTokens);

  return refs
    .map((ref) => {
      const titleTokens = tokenize(`${ref.title} ${ref.slug}`);
      let score = 0;
      const reasons: string[] = [];

      const overlap = titleTokens.filter((token) => contextSet.has(token)).length;
      if (overlap > 0) {
        score += overlap * 3;
        reasons.push(`title_slug_overlap:${overlap}`);
      }

      const roleOverlap = titleTokens.filter((token) => roleSet.has(token)).length;
      if (roleOverlap > 0) {
        score += roleOverlap * 4;
        reasons.push(`role_fit:${roleOverlap}`);
      }

      const premiumOverlap = titleTokens.filter((token) => premiumSet.has(token)).length;
      if (premiumOverlap > 0) {
        score += premiumOverlap * 2;
        reasons.push(`premium_fit:${premiumOverlap}`);
      }

      if (homepage && (titleTokens.includes("home") || titleTokens.includes("homepage") || titleTokens.includes("landing"))) {
        score += 5;
        reasons.push("homepage_fit");
      }

      if (titleTokens.includes("mobile") || titleTokens.includes("stack") || titleTokens.includes("responsive")) {
        score += 2;
        reasons.push("mobile_fit");
      }

      if (titleTokens.includes("hero") || titleTokens.includes("cta") || titleTokens.includes("trust")) {
        score += 2;
      }

      return { id: ref.id, slug: ref.slug, title: ref.title, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id || a.slug.localeCompare(b.slug));
}

function siteIntent(strategy: WebsiteStrategy | null, market: MarketIntelligenceBrief | null): "app" | "service" | "product" | "hybrid" {
  if (strategy?.siteType) return strategy.siteType;
  const corpus = normalize(`${market?.summary ?? ""} ${(market?.researchIntelligence?.conversionGoal ?? "")} ${(market?.commonPageSections ?? []).join(" ")}`);
  if (/app|saas|mobile|software/.test(corpus)) return "app";
  if (/service|consult|agency|practice/.test(corpus)) return "service";
  if (/product|store|commerce|shop/.test(corpus)) return "product";
  return "hybrid";
}

function sequenceForIntent(intent: "app" | "service" | "product" | "hybrid"): string[] {
  if (intent === "app") return ["hero", "features", "testimonials", "solution", "cta", "cta"];
  if (intent === "service") return ["hero", "solution", "features", "testimonials", "faq", "contact", "cta"];
  if (intent === "product") return ["hero", "features", "solution", "testimonials", "cta", "cta"];
  return ["hero", "problem", "solution", "features", "testimonials", "faq", "cta"];
}

function sectionRoleTokens(section: BuildSpecSection["type"]): string[] {
  if (section === "hero") return ["hero", "header", "landing", "promise"];
  if (section === "cta") return ["cta", "action", "conversion", "button"];
  if (section === "testimonials") return ["trust", "proof", "testimonial", "review"];
  if (section === "faq") return ["faq", "questions", "objections"];
  if (section === "features") return ["features", "benefits", "value", "cards"];
  if (section === "solution") return ["workflow", "how", "process", "steps"];
  if (section === "contact") return ["contact", "consult", "book", "reach"];
  return ["section", "content"];
}

function trustStrategyForIntent(intent: "app" | "service" | "product" | "hybrid"): string {
  if (intent === "app") return "assurance_without_fabricated_social_proof";
  if (intent === "service") return "process_credibility_and_scope_clarity";
  if (intent === "product") return "offer_clarity_and_purchase_risk_reduction";
  return "grounded_outcomes_and_operational_clarity";
}

function ctaRhythmForIntent(intent: "app" | "service" | "product" | "hybrid"): string {
  if (intent === "service") return "hero_primary_then_process_then_consult_cta_then_final_contact_cta";
  if (intent === "app") return "hero_primary_then_midpage_reinforcement_then_final_trial_cta";
  if (intent === "product") return "hero_offer_then_value_sections_then_repeated_buy_cta";
  return "hero_primary_then_midpoint_secondary_then_final_primary";
}

function heroVisualStrategyForIntent(intent: "app" | "service" | "product" | "hybrid"): string {
  if (intent === "app") return "category_clarity_and_differentiated_promise_with_feature_chips";
  if (intent === "service") return "audience_outcome_and_process_trust";
  if (intent === "product") return "offer_and_use_case_framing_with_benefit_stack";
  return "balanced_service_product_hierarchy";
}

function heroLayoutVariantForIntent(intent: "app" | "service" | "product" | "hybrid"): string {
  if (intent === "app") return "split_with_framed_mockup";
  if (intent === "service") return "split_with_outcome_stack";
  if (intent === "product") return "split_with_offer_stack";
  return "balanced_split_hybrid";
}

function decisionFromCandidates(params: {
  symbol: RankedRef | null;
  section: RankedRef | null;
  template: RankedRef | null;
  layout: RankedRef | null;
  hasThrive: boolean;
  needsLandingWrite: boolean;
}): { render_target: ThriveExecutionPathDecision; fallback_reason: string | null; render_mode: ResolvedPageComposition["render_mode"] } {
  if (params.symbol && params.symbol.score >= 7) {
    return { render_target: "prefer_existing_thrive_symbol", fallback_reason: null, render_mode: "thrive_intel_mode" };
  }
  if (params.section && params.section.score >= 8) {
    return { render_target: "prefer_existing_thrive_section", fallback_reason: null, render_mode: "thrive_intel_mode" };
  }
  if (params.template && params.template.score >= 8) {
    return { render_target: "prefer_existing_thrive_template", fallback_reason: null, render_mode: "thrive_intel_mode" };
  }
  if (params.layout && params.layout.score >= 8) {
    return { render_target: "prefer_existing_thrive_layout", fallback_reason: null, render_mode: "thrive_intel_mode" };
  }
  if (params.hasThrive && params.needsLandingWrite) {
    return {
      render_target: "staging_only_native_write_required",
      fallback_reason: "no_strong_existing_thrive_primitive_match_for_landing_shell",
      render_mode: "staging_native_mode",
    };
  }
  return {
    render_target: "safe_wordpress_render_with_thrive_hints",
    fallback_reason: params.hasThrive ? "existing_primitives_weak_match" : "no_thrive_inventory",
    render_mode: "wp_safe_mode",
  };
}

export function resolveThriveComposition(params: {
  buildSpec: BuildSpec;
  researchIntelligence: MarketIntelligenceBrief["researchIntelligence"] | null;
  websiteStrategy: WebsiteStrategy | null;
  thriveIntelligence: ThriveIntelligence | null;
  marketIntelligence: MarketIntelligenceBrief | null;
}): ThriveCompositionResolution {
  const intent = siteIntent(params.websiteStrategy, params.marketIntelligence);
  const sequenceHint = sequenceForIntent(intent);
  const premiumTokens = unique([
    "premium",
    "hero",
    "landing",
    "conversion",
    "mobile",
    "cta",
    "trust",
    ...(tokenize(params.websiteStrategy?.designDirection.visualTone ?? "")),
    ...(tokenize((params.researchIntelligence?.visualDirectionSignals ?? []).join(" "))),
  ]);

  const templates = params.thriveIntelligence?.templates ?? [];
  const layouts = params.thriveIntelligence?.layouts ?? [];
  const sections = params.thriveIntelligence?.sections ?? [];
  const symbols = params.thriveIntelligence?.symbolInventory ?? [];

  const resolvedPages = params.buildSpec.pages.map((page) => {
    const pageTokens = unique([
      ...tokenize(page.title),
      ...tokenize(page.purpose),
      ...tokenize(params.websiteStrategy?.primaryConversionGoal ?? ""),
      ...tokenize(params.websiteStrategy?.positioning.trustModel ?? ""),
      ...tokenize((params.researchIntelligence?.recurringSectionPatterns ?? []).join(" ")),
      ...tokenize((params.researchIntelligence?.recurringCtaPatterns ?? []).join(" ")),
      ...tokenize((params.researchIntelligence?.recurringTrustPatterns ?? []).join(" ")),
    ]);
    const homepage = page.slug === params.buildSpec.homepageSlug;

    const rankedTemplates = scoreRefs({
      refs: templates,
      contextTokens: pageTokens,
      roleTokens: homepage ? ["home", "homepage", "landing", "shell"] : ["content", "page", "standard"],
      premiumTokens,
      homepage,
    });

    const rankedLayouts = scoreRefs({
      refs: layouts,
      contextTokens: pageTokens,
      roleTokens: homepage ? ["home", "hero", "landing"] : ["content", "layout", "section"],
      premiumTokens,
      homepage,
    });

    const rankedSections = scoreRefs({
      refs: sections,
      contextTokens: pageTokens,
      roleTokens: ["section", "band", "block", ...(homepage ? ["hero", "cta", "trust"] : [])],
      premiumTokens,
      homepage,
    });

    const rankedSymbols = symbols
      .map((symbol) => {
        const asRef = { id: symbol.id, slug: symbol.slug, title: symbol.title };
        const ranked = scoreRefs({
          refs: [asRef],
          contextTokens: pageTokens,
          roleTokens: [
            symbol.inferredRole,
            ...(symbol.keywords ?? []),
            ...(homepage ? ["hero", "header", "cta"] : ["section", "content"]),
          ],
          premiumTokens,
          homepage,
        })[0];
        return ranked;
      })
      .sort((a, b) => b.score - a.score || a.id - b.id);

    const sectionResolutions = page.sections.map((section) => {
      const roleTokens = sectionRoleTokens(section.type);
      const contextTokens = unique([...pageTokens, ...tokenize(section.heading), ...tokenize(section.body), ...roleTokens]);

      const sectionSymbols = symbols
        .map((symbol) => {
          const ranked = scoreRefs({
            refs: [{ id: symbol.id, slug: symbol.slug, title: symbol.title }],
            contextTokens,
            roleTokens: [...roleTokens, symbol.inferredRole, ...(symbol.keywords ?? [])],
            premiumTokens,
            homepage,
          })[0];
          let adjusted = ranked.score;
          if (section.type === "hero" && symbol.inferredRole === "header") adjusted += 5;
          if (section.type === "contact" && symbol.inferredRole === "footer") adjusted += 5;
          if (section.type === "cta" && (symbol.keywords ?? []).some((entry) => entry.includes("cta") || entry.includes("action"))) adjusted += 4;
          if (section.type === "faq" && (symbol.keywords ?? []).some((entry) => entry.includes("faq"))) adjusted += 4;
          return { ...ranked, score: adjusted };
        })
        .sort((a, b) => b.score - a.score || a.id - b.id);

      const sectionSections = scoreRefs({
        refs: sections,
        contextTokens,
        roleTokens,
        premiumTokens,
        homepage,
      });

      const sectionTemplates = scoreRefs({
        refs: templates,
        contextTokens,
        roleTokens,
        premiumTokens,
        homepage,
      });

      const sectionLayouts = scoreRefs({
        refs: layouts,
        contextTokens,
        roleTokens,
        premiumTokens,
        homepage,
      });

      const decision = decisionFromCandidates({
        symbol: sectionSymbols[0] ?? null,
        section: sectionSections[0] ?? null,
        template: sectionTemplates[0] ?? null,
        layout: sectionLayouts[0] ?? null,
        hasThrive: Boolean(params.thriveIntelligence),
        needsLandingWrite: homepage && (section.type === "hero" || section.type === "cta"),
      });

      return {
        sectionId: section.id,
        render_target: decision.render_target,
        fallback_reason: decision.fallback_reason,
        symbol_ref_selected: sectionSymbols[0]?.id ?? null,
        symbol_ref_candidates: sectionSymbols.slice(0, 5).map((entry) => entry.id),
        section_ref_selected: sectionSections[0]?.id ?? null,
        section_ref_candidates: sectionSections.slice(0, 4).map((entry) => entry.id),
        template_ref_selected: sectionTemplates[0]?.id ?? null,
        template_ref_candidates: sectionTemplates.slice(0, 4).map((entry) => entry.id),
        layout_ref_selected: sectionLayouts[0]?.id ?? null,
        layout_ref_candidates: sectionLayouts.slice(0, 3).map((entry) => entry.id),
        trust_strategy: trustStrategyForIntent(intent),
        cta_rhythm_hint: ctaRhythmForIntent(intent),
        mobile_hierarchy_hint:
          section.type === "hero"
            ? "headline_then_supporting_copy_then_primary_cta_then_secondary_cta"
            : section.type === "cta"
              ? "single_column_high_contrast_cta_with_short_copy"
              : "single_column_stack_with_clear_subheads_and_short_paragraphs",
        visual_structure_hint:
          section.type === "hero"
            ? "premium_hero_with_clear_value_tier_and_polished_visual_anchor"
            : section.type === "testimonials"
              ? "grounded_assurance_module_without_fabricated_social_proof"
              : section.type === "cta"
                ? "high_contrast_conversion_band_with_clear_next_step"
                : "clean_section_band_with_deliberate_spacing_and_typographic_hierarchy",
        mockup_strategy:
          intent === "app"
            ? "polished_neutral_ui_card_or_framed_mockup_without_placeholder_labels"
            : "benefit_focused_visual_panels_without_fake_artifacts",
        hero_visual_strategy: heroVisualStrategyForIntent(intent),
        hero_layout_variant: heroLayoutVariantForIntent(intent),
        section_spacing_profile:
          section.type === "hero"
            ? "premium_hero_spacious"
            : section.type === "cta"
              ? "conversion_band_compact"
              : "balanced_section_spacing",
        typography_hierarchy_profile:
          section.type === "hero"
            ? "hero_first_strong_hierarchy"
            : section.type === "cta"
              ? "cta_priority_hierarchy"
              : "section_heading_subheading_hierarchy",
        cta_rhythm_profile: ctaRhythmForIntent(intent),
        trust_render_strategy: trustStrategyForIntent(intent),
        mockup_render_strategy:
          intent === "app"
            ? "framed_product_visual_without_placeholder_copy"
            : "benefit_visual_without_synthetic_artifacts",
        mobile_stack_strategy:
          section.type === "hero"
            ? "headline_support_value_stack_cta_then_visual"
            : section.type === "cta"
              ? "stacked_primary_secondary_buttons"
              : "single_column_scannable_content_groups",
        section_transition_strategy:
          section.type === "cta"
            ? "high_contrast_closing_band"
            : section.type === "hero"
              ? "hero_to_value_transition"
              : "alternating_band_progression",
      };
    });

    const pageDecision = decisionFromCandidates({
      symbol: rankedSymbols[0] ?? null,
      section: rankedSections[0] ?? null,
      template: rankedTemplates[0] ?? null,
      layout: rankedLayouts[0] ?? null,
      hasThrive: Boolean(params.thriveIntelligence),
      needsLandingWrite: homepage,
    });

    const shellStrategy = homepage
      ? `${intent}_homepage_shell_with_premium_mobile_first_rhythm`
      : `${intent}_content_shell_with_conversion_support`;

    return {
      pageSlug: page.slug,
      shell_strategy: shellStrategy,
      render_mode: pageDecision.render_mode,
      render_target: pageDecision.render_target,
      fallback_reason: pageDecision.fallback_reason,
      template_ref_selected: rankedTemplates[0]?.id ?? null,
      template_ref_candidates: rankedTemplates.slice(0, 4).map((entry) => entry.id),
      layout_ref_selected: rankedLayouts[0]?.id ?? null,
      layout_ref_candidates: rankedLayouts.slice(0, 4).map((entry) => entry.id),
      section_ref_selected: rankedSections[0]?.id ?? null,
      section_ref_candidates: rankedSections.slice(0, 6).map((entry) => entry.id),
      symbol_ref_selected: rankedSymbols[0]?.id ?? null,
      symbol_ref_candidates: rankedSymbols.slice(0, 6).map((entry) => entry.id),
      premium_composition_summary: homepage
        ? "premium_hero_trust_cta_rhythm_mobile_first"
        : "premium_section_spacing_and_conversion_support",
      homepage_sequence_hint: sequenceHint,
      sections: sectionResolutions,
    };
  });

  return { pages: resolvedPages };
}
