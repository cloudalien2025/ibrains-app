import {
  BuildSpec,
  BuildSpecSection,
  CapabilityCheckResult,
  PageIntent,
  ThriveExecutionPathDecision,
  ThriveRenderTarget,
  ThriveVisualPrimitive,
  ThriveIntelligence,
  ThriveSectionResolution,
  ThriveSymbolIntelligence,
  ThriveSymbolRole,
  VisualPattern,
} from "@/lib/siteforge/contracts";

export type ThriveTranslationResult = {
  spec: BuildSpec;
  appliedMappings: string[];
  fallbackUsed: boolean;
  intelligenceUsed: boolean;
  sectionResolutions: ThriveSectionResolution[];
};

export function detectThriveCapability(capability: CapabilityCheckResult): boolean {
  return capability.thriveDetected;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function wordsFromText(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pageRoleFor(page: BuildSpec["pages"][number], homepageSlug: string): PageIntent {
  const slug = normalizeToken(page.slug);
  const title = page.title.toLowerCase();

  if (slug === normalizeToken(homepageSlug) || slug === "home" || title.includes("home")) return "homepage";
  if (slug.includes("about") || title.includes("about")) return "about";
  if (slug.includes("contact") || title.includes("contact")) return "contact";
  if (slug === "faq" || slug.includes("faqs") || title.includes("faq")) return "faq";
  if (slug.includes("feature") || title.includes("feature")) return "features";
  if (slug.includes("pricing") || slug.includes("plans") || title.includes("pricing") || title.includes("plans")) {
    return "pricing";
  }

  return "generic";
}

function shellRoleFor(pageRole: PageIntent): NonNullable<BuildSpec["pages"][number]["metadata"]>["shellRole"] {
  if (pageRole === "homepage") return "homepage_shell";
  if (pageRole === "contact") return "utility_shell";
  if (pageRole === "pricing" || pageRole === "features") return "conversion_shell";
  if (pageRole === "about" || pageRole === "faq") return "standard_shell";
  return "unknown";
}

function sectionIntentFor(sectionType: BuildSpecSection["type"]): NonNullable<BuildSpecSection["metadata"]>["sectionIntent"] {
  if (sectionType === "hero" || sectionType === "cta") return "conversion";
  if (sectionType === "testimonials") return "trust";
  if (sectionType === "contact") return "navigation";
  return "informational";
}

function symbolCandidateTypeFor(sectionType: BuildSpecSection["type"]): NonNullable<BuildSpecSection["metadata"]>["symbolCandidateType"] {
  if (sectionType === "hero") return "header";
  if (sectionType === "contact") return "footer";
  if (sectionType === "cta") return "cta";
  if (sectionType === "testimonials") return "testimonial";
  if (sectionType === "faq") return "faq";
  if (sectionType === "features") return "marketing";
  return "generic";
}

function sectionKeywords(type: NonNullable<BuildSpecSection["metadata"]>["symbolCandidateType"]): string[] {
  if (type === "header") return ["header", "nav", "menu", "top"];
  if (type === "footer") return ["footer", "bottom", "contact", "legal"];
  if (type === "cta") return ["cta", "action", "book", "buy", "start", "call"];
  if (type === "testimonial") return ["testimonial", "review", "social", "proof"];
  if (type === "faq") return ["faq", "question", "answer"];
  if (type === "marketing") return ["feature", "benefit", "service", "offer"];
  return ["section", "block", "content"];
}

function roleScore(candidateType: NonNullable<BuildSpecSection["metadata"]>["symbolCandidateType"], role: ThriveSymbolRole): number {
  if (candidateType === "header") return role === "header" ? 5 : role === "section" ? 1 : 0;
  if (candidateType === "footer") return role === "footer" ? 5 : role === "section" ? 1 : 0;
  if (candidateType === "cta" || candidateType === "testimonial" || candidateType === "faq" || candidateType === "marketing") {
    return role === "section" ? 4 : role === "unknown" ? 1 : 0;
  }
  return role === "section" ? 3 : role === "unknown" ? 1 : 0;
}

function scoreSymbol(params: {
  symbol: ThriveSymbolIntelligence;
  candidateType: NonNullable<BuildSpecSection["metadata"]>["symbolCandidateType"];
  intent: NonNullable<BuildSpecSection["metadata"]>["sectionIntent"];
  sectionHeading: string;
  sectionBody: string;
}): { score: number; reasons: string[]; rejections: string[] } {
  const reasons: string[] = [];
  const rejections: string[] = [];
  let score = 0;

  const rolePts = roleScore(params.candidateType, params.symbol.inferredRole);
  score += rolePts;
  if (rolePts > 0) reasons.push(`role_match:${params.symbol.inferredRole}`);
  else rejections.push(`role_mismatch:${params.symbol.inferredRole}`);

  const haystack = `${params.symbol.title} ${params.symbol.slug} ${params.symbol.taxonomy.slug ?? ""} ${params.symbol.taxonomy.name ?? ""}`.toLowerCase();
  const keywords = sectionKeywords(params.candidateType);
  const hitCount = keywords.filter((keyword) => haystack.includes(keyword)).length;
  if (hitCount > 0) {
    score += Math.min(4, hitCount * 2);
    reasons.push(`keyword_hits:${hitCount}`);
  } else {
    rejections.push("keyword_no_match");
  }

  if (params.symbol.hasBuilderContent) {
    score += 2;
    reasons.push("builder_payload_present");
  } else {
    rejections.push("no_builder_payload");
  }

  if (params.symbol.hasCustomCss) {
    score += 1;
    reasons.push("custom_css_present");
  }

  const sectionWords = new Set([...wordsFromText(params.sectionHeading), ...wordsFromText(params.sectionBody)]);
  const symbolWords = new Set(wordsFromText(`${params.symbol.title} ${params.symbol.slug}`));
  let overlap = 0;
  sectionWords.forEach((word) => {
    if (symbolWords.has(word)) overlap += 1;
  });
  if (overlap > 0) {
    score += Math.min(3, overlap);
    reasons.push(`semantic_overlap:${overlap}`);
  }

  if (params.intent === "conversion" && (params.candidateType === "cta" || params.candidateType === "header")) {
    score += 1;
  }

  return { score, reasons, rejections };
}

function shellTemplateGroupCandidate(pageRole: PageIntent): string {
  if (pageRole === "homepage") return "homepage";
  if (pageRole === "contact") return "utility";
  if (pageRole === "pricing" || pageRole === "features") return "conversion";
  return "content";
}

function shellLayoutCandidate(pageRole: PageIntent): string {
  if (pageRole === "homepage") return "thrive-homepage-canonical";
  if (pageRole === "contact") return "thrive-contact-utility";
  return "thrive-standard-content";
}

function visualPatternFromSection(section: BuildSpecSection): VisualPattern {
  return section.metadata?.visualComposition?.visualPattern ?? (section.type === "hero"
    ? "hero_centered"
    : section.type === "features"
      ? "feature_cards_grid"
      : section.type === "faq"
        ? "faq_toggle"
        : section.type === "testimonials"
          ? "testimonial_cards"
          : section.type === "cta"
            ? "cta_band"
            : "alternating_content_band");
}

function preferredPrimitiveFromPattern(pattern: VisualPattern): ThriveVisualPrimitive {
  if (pattern === "faq_toggle") return "thrive_toggle";
  if (pattern === "cta_band") return "thrive_call_to_action";
  if (pattern === "hero_split" || pattern === "hero_centered" || pattern === "app_mockup_showcase") {
    return "thrive_columns_background_band";
  }
  if (pattern === "feature_cards_grid" || pattern === "testimonial_cards" || pattern === "trust_strip" || pattern === "icon_benefits_row") {
    return "thrive_content_box";
  }
  return "wordpress_structured_fallback";
}

function renderTargetFromDecision(
  decision: ThriveExecutionPathDecision
): { preferredRenderTarget: ThriveRenderTarget; rendererMode: NonNullable<BuildSpecSection["metadata"]>["rendererMode"] } {
  if (decision === "prefer_existing_thrive_symbol") {
    return { preferredRenderTarget: "thrive_symbol_reference", rendererMode: "thrive_intel_mode" };
  }
  if (decision === "prefer_existing_thrive_section" || decision === "prefer_existing_thrive_template" || decision === "prefer_existing_thrive_layout") {
    return { preferredRenderTarget: "thrive_content_template_reference", rendererMode: "thrive_intel_mode" };
  }
  if (decision === "staging_only_native_write_required") {
    return { preferredRenderTarget: "future_landing_page_candidate", rendererMode: "wp_safe_mode" };
  }
  return { preferredRenderTarget: "wp_html_fallback", rendererMode: "wp_safe_mode" };
}

function resolveSection(params: {
  pageSlug: string;
  section: BuildSpecSection;
  sectionIntent: NonNullable<BuildSpecSection["metadata"]>["sectionIntent"];
  symbolCandidateType: NonNullable<BuildSpecSection["metadata"]>["symbolCandidateType"];
  intelligence: ThriveIntelligence | null;
}): { metadata: NonNullable<BuildSpecSection["metadata"]>; resolution: ThriveSectionResolution } {
  const symbols = params.intelligence?.symbolInventory ?? [];
  const visualPattern = visualPatternFromSection(params.section);
  const selectedVisualPrimitive = preferredPrimitiveFromPattern(visualPattern);
  const renderTargetDecision = params.section.metadata?.renderTargetDecision as ThriveExecutionPathDecision | undefined;
  const thriveRefs = params.section.metadata?.thriveRefs;

  if (renderTargetDecision) {
    const selected = renderTargetFromDecision(renderTargetDecision);
    const selectedSymbolId = typeof thriveRefs?.symbolRefSelected === "number" ? thriveRefs.symbolRefSelected : null;
    const selectedSectionId = typeof thriveRefs?.sectionRefSelected === "number" ? thriveRefs.sectionRefSelected : null;
    const selectedTemplateId = typeof thriveRefs?.templateRefSelected === "number" ? thriveRefs.templateRefSelected : null;
    const selectedLayoutId = typeof thriveRefs?.layoutRefSelected === "number" ? thriveRefs.layoutRefSelected : null;
    const selectedContentRef =
      renderTargetDecision === "prefer_existing_thrive_section"
        ? selectedSectionId
        : renderTargetDecision === "prefer_existing_thrive_template"
          ? selectedTemplateId
          : renderTargetDecision === "prefer_existing_thrive_layout"
            ? selectedLayoutId
            : selectedTemplateId ?? selectedSectionId ?? selectedLayoutId;
    const confidence = selectedSymbolId ? 0.92 : selectedContentRef ? 0.84 : 0.46;
    return {
      metadata: {
        ...(params.section.metadata ?? {}),
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        thriveSymbolRoleCandidate: selectedSymbolId ? "section" : params.symbolCandidateType === "header" ? "header" : "unknown",
        preferredRenderTarget: selected.preferredRenderTarget,
        reusableSymbolCandidates: thriveRefs?.symbolRefCandidates ?? [],
        contentTemplateCandidates: [
          ...(thriveRefs?.templateRefCandidates ?? []),
          ...(thriveRefs?.sectionRefCandidates ?? []),
          ...(thriveRefs?.layoutRefCandidates ?? []),
        ],
        visualPrimitiveSelection: {
          requestedPattern: visualPattern,
          selectedPrimitive: selectedSymbolId ? "thrive_template_symbol" : selectedVisualPrimitive,
          selectedVia:
            renderTargetDecision === "safe_wordpress_render_with_thrive_hints"
              ? "safe_fallback"
              : renderTargetDecision === "prefer_existing_thrive_symbol"
                ? "existing_reusable_symbol"
                : "existing_compatible_primitive",
          reason: "thrive_composition_resolver_selection",
          designIntentSatisfied: renderTargetDecision !== "safe_wordpress_render_with_thrive_hints",
          fallbackReason: params.section.metadata?.fallbackReason as string | null | undefined,
        },
        rendererMode: selected.rendererMode,
      },
      resolution: {
        pageSlug: params.pageSlug,
        sectionId: params.section.id,
        sectionType: params.section.type,
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        preferredRenderTarget: selected.preferredRenderTarget,
        resolution:
          renderTargetDecision === "prefer_existing_thrive_symbol"
            ? "existing_symbol"
            : renderTargetDecision === "safe_wordpress_render_with_thrive_hints"
              ? "wp_html_fallback"
              : renderTargetDecision === "staging_only_native_write_required"
                ? "future_landing_page_candidate"
                : "existing_content_template",
        visualPattern,
        selectedVisualPrimitive: selectedSymbolId ? "thrive_template_symbol" : selectedVisualPrimitive,
        primitiveSelectionSource:
          renderTargetDecision === "safe_wordpress_render_with_thrive_hints"
            ? "safe_fallback"
            : renderTargetDecision === "prefer_existing_thrive_symbol"
              ? "existing_reusable_symbol"
              : "existing_compatible_primitive",
        designIntentSatisfied: renderTargetDecision !== "safe_wordpress_render_with_thrive_hints",
        fallbackReason: (params.section.metadata?.fallbackReason as string | null | undefined) ?? null,
        matchedSymbolId: selectedSymbolId,
        matchedSymbolTitle: selectedSymbolId ? `symbol-${selectedSymbolId}` : selectedContentRef ? `template-ref-${selectedContentRef}` : null,
        matchedRole: selectedSymbolId ? "section" : null,
        confidence,
        reason: "resolver_guided_decision_with_selected_refs",
        rejectedReasons: [],
      },
    };
  }

  const scored = symbols
    .map((symbol) => {
      const evaluated = scoreSymbol({
        symbol,
        candidateType: params.symbolCandidateType,
        intent: params.sectionIntent,
        sectionHeading: params.section.heading,
        sectionBody: params.section.body,
      });
      return {
        symbol,
        score: evaluated.score,
        reasons: evaluated.reasons,
        rejections: evaluated.rejections,
      };
    })
    .sort((a, b) => b.score - a.score || a.symbol.id - b.symbol.id);

  const top = scored[0] ?? null;
  const candidates = scored.filter((entry) => entry.score >= 5).slice(0, 5);
  const preferredRenderTargetThreshold = params.symbolCandidateType === "header" || params.symbolCandidateType === "footer" ? 6 : 7;

  if (top && top.score >= preferredRenderTargetThreshold) {
    const confidence = Math.min(1, top.score / 12);
    return {
      metadata: {
        ...(params.section.metadata ?? {}),
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        thriveSymbolRoleCandidate: top.symbol.inferredRole,
        preferredRenderTarget: "thrive_symbol_reference",
        reusableSymbolCandidates: candidates.map((entry) => entry.symbol.id),
        visualPrimitiveSelection: {
          requestedPattern: visualPattern,
          selectedPrimitive: "thrive_template_symbol",
          selectedVia: "existing_reusable_symbol",
          reason: "existing_symbol_matched",
          designIntentSatisfied: true,
          fallbackReason: null,
        },
        rendererMode: "thrive_intel_mode",
      },
      resolution: {
        pageSlug: params.pageSlug,
        sectionId: params.section.id,
        sectionType: params.section.type,
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        preferredRenderTarget: "thrive_symbol_reference",
        resolution: "existing_symbol",
        visualPattern,
        selectedVisualPrimitive: "thrive_template_symbol",
        primitiveSelectionSource: "existing_reusable_symbol",
        designIntentSatisfied: true,
        fallbackReason: null,
        matchedSymbolId: top.symbol.id,
        matchedSymbolTitle: top.symbol.title,
        matchedRole: top.symbol.inferredRole,
        confidence,
        reason: top.reasons.join("|"),
        rejectedReasons: top.rejections,
      },
    };
  }

  if ((params.intelligence?.primitiveCounts.thriveTemplate ?? 0) > 0) {
    const reason = top ? `no_symbol_match_best_score:${top.score}` : "no_symbol_inventory";
    return {
      metadata: {
        ...(params.section.metadata ?? {}),
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        thriveSymbolRoleCandidate: "unknown",
        preferredRenderTarget: "thrive_content_template_reference",
        contentTemplateCandidates: [],
        visualPrimitiveSelection: {
          requestedPattern: visualPattern,
          selectedPrimitive: selectedVisualPrimitive,
          selectedVia: "existing_compatible_primitive",
          reason: "existing_template_or_primitive_available",
          designIntentSatisfied: true,
          fallbackReason: null,
        },
        rendererMode: "thrive_intel_mode",
      },
      resolution: {
        pageSlug: params.pageSlug,
        sectionId: params.section.id,
        sectionType: params.section.type,
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        preferredRenderTarget: "thrive_content_template_reference",
        resolution: "existing_content_template",
        visualPattern,
        selectedVisualPrimitive,
        primitiveSelectionSource: "existing_compatible_primitive",
        designIntentSatisfied: true,
        fallbackReason: null,
        matchedSymbolId: null,
        matchedSymbolTitle: null,
        matchedRole: null,
        confidence: 0.35,
        reason,
        rejectedReasons: top?.rejections ?? ["no_template_candidates_enumerated"],
      },
    };
  }

  if (params.section.type === "hero" || params.section.type === "features") {
    return {
      metadata: {
        ...(params.section.metadata ?? {}),
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        thriveSymbolRoleCandidate: "unknown",
        preferredRenderTarget: "future_landing_page_candidate",
        landingPageCandidate: `${params.pageSlug}-landing-candidate`,
        visualPrimitiveSelection: {
          requestedPattern: visualPattern,
          selectedPrimitive: selectedVisualPrimitive,
          selectedVia: "native_create_contract",
          reason: "future_native_create_candidate",
          designIntentSatisfied: true,
          fallbackReason: null,
        },
        rendererMode: "wp_safe_mode",
      },
      resolution: {
        pageSlug: params.pageSlug,
        sectionId: params.section.id,
        sectionType: params.section.type,
        sectionIntent: params.sectionIntent,
        symbolCandidateType: params.symbolCandidateType,
        preferredRenderTarget: "future_landing_page_candidate",
        resolution: "future_landing_page_candidate",
        visualPattern,
        selectedVisualPrimitive,
        primitiveSelectionSource: "native_create_contract",
        designIntentSatisfied: true,
        fallbackReason: null,
        matchedSymbolId: null,
        matchedSymbolTitle: null,
        matchedRole: null,
        confidence: 0.2,
        reason: "landing_page_candidate_reserved",
        rejectedReasons: top?.rejections ?? ["no_symbol_or_template_match"],
      },
    };
  }

  return {
    metadata: {
      ...(params.section.metadata ?? {}),
      sectionIntent: params.sectionIntent,
      symbolCandidateType: params.symbolCandidateType,
      thriveSymbolRoleCandidate: top?.symbol.inferredRole ?? "unknown",
      preferredRenderTarget: "wp_html_fallback",
      visualPrimitiveSelection: {
        requestedPattern: visualPattern,
        selectedPrimitive: "wordpress_structured_fallback",
        selectedVia: "safe_fallback",
        reason: "safe_wp_fallback_with_visual_metadata",
        designIntentSatisfied: false,
        fallbackReason: "native_primitive_unavailable",
      },
      rendererMode: "wp_safe_mode",
    },
    resolution: {
      pageSlug: params.pageSlug,
      sectionId: params.section.id,
      sectionType: params.section.type,
      sectionIntent: params.sectionIntent,
      symbolCandidateType: params.symbolCandidateType,
      preferredRenderTarget: "wp_html_fallback",
      resolution: "wp_html_fallback",
      visualPattern,
      selectedVisualPrimitive: "wordpress_structured_fallback",
      primitiveSelectionSource: "safe_fallback",
      designIntentSatisfied: false,
      fallbackReason: "native_primitive_unavailable",
      matchedSymbolId: null,
      matchedSymbolTitle: null,
      matchedRole: null,
      confidence: 0,
      reason: "fallback_to_safe_wp_html",
      rejectedReasons: top?.rejections ?? ["no_symbol_inventory"],
    },
  };
}

export function applyThriveMappings(spec: BuildSpec, enabled: boolean, intelligence: ThriveIntelligence | null): ThriveTranslationResult {
  if (!enabled) {
    return {
      spec,
      appliedMappings: [],
      fallbackUsed: true,
      intelligenceUsed: false,
      sectionResolutions: [],
    };
  }

  const appliedMappings: string[] = [];
  const sectionResolutions: ThriveSectionResolution[] = [];

  const translated: BuildSpec = {
    ...spec,
    metadata: {
      ...spec.metadata,
      thriveAware: true,
      thriveMode: "wp_safe_mode",
      thriveExecutionMode: intelligence ? "thrive_intel_mode" : "wp_safe_mode",
      thriveIntelligenceUsed: Boolean(intelligence),
      designSystemVersion: spec.metadata.designSystemVersion ?? "siteforge_visual_v1",
      themeArtifactRef: spec.metadata.themeArtifactRef ?? null,
      architectContentArtifactRef: spec.metadata.architectContentArtifactRef ?? null,
      landingPageArtifactRef: spec.metadata.landingPageArtifactRef ?? null,
      designPackArtifactRef: spec.metadata.designPackArtifactRef ?? null,
      contractCaptureRef: spec.metadata.contractCaptureRef ?? null,
    },
    pages: spec.pages.map((page) => {
      const pageRole = pageRoleFor(page, spec.homepageSlug);
      const shellRole = shellRoleFor(pageRole);
      const layoutCandidate = shellLayoutCandidate(pageRole);
      const templateGroup = shellTemplateGroupCandidate(pageRole);
      const rendererMode = intelligence ? "thrive_intel_mode" : "wp_safe_mode";

      const pageSymbols = (intelligence?.symbolInventory ?? [])
        .map((symbol) => ({
          symbol,
          score: scoreSymbol({
            symbol,
            candidateType: pageRole === "contact" ? "footer" : pageRole === "homepage" ? "header" : "marketing",
            intent: pageRole === "homepage" ? "conversion" : "informational",
            sectionHeading: page.title,
            sectionBody: page.purpose,
          }).score,
        }))
        .sort((a, b) => b.score - a.score || a.symbol.id - b.symbol.id)
        .slice(0, 3)
        .map((entry) => entry.symbol.id);

      appliedMappings.push(`${page.slug}:${layoutCandidate}:${pageRole}:${rendererMode}`);

      return {
        ...page,
        metadata: {
          ...page.metadata,
          thriveLayoutKey: layoutCandidate,
          thrivePageRole: pageRole === "homepage" ? "homepage" : "content",
          pageRole,
          shellRole,
          shellTemplateGroupCandidate: templateGroup,
          shellLayoutCandidate: layoutCandidate,
          reusableSymbolCandidates: pageSymbols,
          contentTemplateCandidates: [],
          landingPageCandidate: pageRole === "homepage" ? `${page.slug}-landing` : null,
          preferredRenderTarget: "wordpress_page_content",
          rendererMode,
          thriveExecutionMode: "wp_safe_mode",
          contractCaptureRef: page.metadata.contractCaptureRef ?? null,
        },
        sections: page.sections.map((section) => {
          const sectionIntent = sectionIntentFor(section.type);
          const symbolCandidateType = symbolCandidateTypeFor(section.type);
          const resolved = resolveSection({
            pageSlug: page.slug,
            section,
            sectionIntent,
            symbolCandidateType,
            intelligence,
          });

          sectionResolutions.push(resolved.resolution);

          return {
            ...section,
            metadata: {
              ...resolved.metadata,
              pageRole,
              shellRole,
              shellTemplateGroupCandidate: templateGroup,
              shellLayoutCandidate: layoutCandidate,
              contractCaptureRef: section.metadata?.contractCaptureRef ?? null,
            },
          };
        }),
      };
    }),
  };

  if (intelligence) {
    translated.metadata.themeArtifactRef = translated.metadata.themeArtifactRef ?? `theme-skin:${intelligence.activeSkin?.slug ?? "unknown"}`;
  }

  return {
    spec: translated,
    appliedMappings,
    fallbackUsed: false,
    intelligenceUsed: Boolean(intelligence),
    sectionResolutions,
  };
}
