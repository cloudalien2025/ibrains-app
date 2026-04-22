import {
  BuildSpecPage,
  BuildSpecSection,
  ThriveApplicationDecisionRecord,
  ThriveApplicationPath,
  ThriveExecutionPathDecision,
  ThriveIntelligence,
  WebsiteStrategy,
} from "@/lib/siteforge/contracts";

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function mapRenderPath(decision: ThriveExecutionPathDecision, intelligenceAvailable: boolean): ThriveApplicationPath {
  if (decision === "prefer_existing_thrive_symbol") return "apply_existing_thrive_symbol";
  if (decision === "prefer_existing_thrive_section") return "apply_existing_thrive_section";
  if (decision === "prefer_existing_thrive_template") return "apply_existing_thrive_template";
  if (decision === "prefer_existing_thrive_layout") return "apply_existing_thrive_layout";
  if (decision === "staging_only_native_write_required") return "staging_only_native_write_required";
  return intelligenceAvailable ? "safe_wordpress_render_with_thrive_hints" : "safe_wordpress_render_with_premium_visual_hints";
}

function confidenceFromRefs(refs: {
  symbol?: number | null;
  section?: number | null;
  template?: number | null;
  layout?: number | null;
  symbolCandidates: number[];
  sectionCandidates: number[];
  templateCandidates: number[];
  layoutCandidates: number[];
}): number {
  if (refs.symbol) return 0.93;
  if (refs.section) return 0.85;
  if (refs.template || refs.layout) return 0.81;
  const depth =
    refs.symbolCandidates.length * 0.08 +
    refs.sectionCandidates.length * 0.05 +
    refs.templateCandidates.length * 0.05 +
    refs.layoutCandidates.length * 0.04;
  return clampScore(0.38 + depth);
}

function sectionCreationCandidate(section: BuildSpecSection): string | null {
  if (section.type === "hero") return "premium_hero_native_section";
  if (section.type === "cta") return "high_contrast_cta_native_section";
  if (section.type === "faq") return "faq_toggle_native_section";
  if (section.type === "testimonials") return "assurance_strip_native_section";
  return "standard_native_section";
}

export function decideSectionThriveApplication(params: {
  page: BuildSpecPage;
  section: BuildSpecSection;
  decision: ThriveExecutionPathDecision;
  fallbackReason: string | null;
  strategy: WebsiteStrategy | null;
  thriveIntelligence: ThriveIntelligence | null;
}): ThriveApplicationDecisionRecord {
  const refs = params.section.metadata?.thriveRefs;
  const path = mapRenderPath(params.decision, Boolean(params.thriveIntelligence));
  const hasStrongReuse = path.startsWith("apply_existing_thrive_");
  const stageOnly = path === "staging_only_native_write_required";
  const confidenceScore = confidenceFromRefs({
    symbol: refs?.symbolRefSelected ?? null,
    section: refs?.sectionRefSelected ?? null,
    template: refs?.templateRefSelected ?? null,
    layout: refs?.layoutRefSelected ?? null,
    symbolCandidates: refs?.symbolRefCandidates ?? [],
    sectionCandidates: refs?.sectionRefCandidates ?? [],
    templateCandidates: refs?.templateRefCandidates ?? [],
    layoutCandidates: refs?.layoutRefCandidates ?? [],
  });
  const siteType = params.strategy?.siteType ?? "hybrid";

  const native_authoring_requirements = stageOnly
    ? [
        "approved_non_production_target",
        "allowlisted_write_operation",
        "verified_template_or_section_contract",
        "native_validation_run",
      ]
    : [];
  const native_authoring_blockers =
    stageOnly && !params.thriveIntelligence
      ? ["missing_thrive_inventory"]
      : stageOnly
        ? ["live_safe_write_not_supported_for_selected_operation"]
        : [];

  return {
    path,
    reason: hasStrongReuse
      ? "existing_allowlisted_thrive_asset_selected"
      : stageOnly
        ? "native_asset_creation_required_for_selected_visual_goal"
        : path === "safe_wordpress_render_with_thrive_hints"
          ? "live_safe_fallback_with_thrive_layout_hints"
          : "live_safe_fallback_with_premium_visual_hints",
    confidenceScore,
    fallbackReason: params.fallbackReason,
    native_authoring_mode: hasStrongReuse
      ? "live_safe_native_reuse"
      : stageOnly
        ? "staging_only_native_write_required"
        : path === "safe_wordpress_render_with_thrive_hints"
          ? "safe_wordpress_render_with_thrive_hints"
          : "safe_wordpress_render_with_premium_visual_hints",
    native_authoring_requirements,
    native_authoring_blockers,
    staging_bundle_candidates: stageOnly ? [`page:${params.page.slug}`, `section:${params.section.id}`] : [],
    design_pack_candidate: stageOnly ? `${siteType}_premium_${params.page.slug}_design_pack` : null,
    symbol_creation_candidate: stageOnly ? `${params.section.type}_symbol_candidate` : null,
    template_creation_candidate: stageOnly && params.page.slug === "home" ? `${siteType}_homepage_template_candidate` : null,
    section_creation_candidate: stageOnly ? sectionCreationCandidate(params.section) : null,
  };
}

export function decidePageThriveApplication(params: {
  page: BuildSpecPage;
  decision: ThriveExecutionPathDecision;
  fallbackReason: string | null;
  strategy: WebsiteStrategy | null;
  thriveIntelligence: ThriveIntelligence | null;
}): ThriveApplicationDecisionRecord {
  const refs = params.page.metadata.thriveRefs;
  const path = mapRenderPath(params.decision, Boolean(params.thriveIntelligence));
  const hasStrongReuse = path.startsWith("apply_existing_thrive_");
  const stageOnly = path === "staging_only_native_write_required";
  const confidenceScore = confidenceFromRefs({
    symbol: refs?.symbolRefSelected ?? null,
    section: refs?.sectionRefSelected ?? null,
    template: refs?.templateRefSelected ?? null,
    layout: refs?.layoutRefSelected ?? null,
    symbolCandidates: refs?.symbolRefCandidates ?? [],
    sectionCandidates: refs?.sectionRefCandidates ?? [],
    templateCandidates: refs?.templateRefCandidates ?? [],
    layoutCandidates: refs?.layoutRefCandidates ?? [],
  });
  const siteType = params.strategy?.siteType ?? "hybrid";

  return {
    path,
    reason: hasStrongReuse
      ? "page_shell_reuses_existing_thrive_assets"
      : stageOnly
        ? "page_shell_requires_staging_native_authoring"
        : path === "safe_wordpress_render_with_thrive_hints"
          ? "page_shell_falls_back_to_wp_with_thrive_hints"
          : "page_shell_falls_back_to_wp_with_premium_visual_hints",
    confidenceScore,
    fallbackReason: params.fallbackReason,
    native_authoring_mode: hasStrongReuse
      ? "live_safe_native_reuse"
      : stageOnly
        ? "staging_only_native_write_required"
        : path === "safe_wordpress_render_with_thrive_hints"
          ? "safe_wordpress_render_with_thrive_hints"
          : "safe_wordpress_render_with_premium_visual_hints",
    native_authoring_requirements: stageOnly ? ["approved_non_production_target", "allowlisted_write_operation", "native_validation_run"] : [],
    native_authoring_blockers: stageOnly ? ["live_safe_template_creation_not_supported"] : [],
    staging_bundle_candidates: stageOnly ? [`page:${params.page.slug}`] : [],
    design_pack_candidate: stageOnly ? `${siteType}_page_shell_design_pack` : null,
    symbol_creation_candidate: null,
    template_creation_candidate: stageOnly ? `${params.page.slug}_template_candidate` : null,
    section_creation_candidate: null,
  };
}
