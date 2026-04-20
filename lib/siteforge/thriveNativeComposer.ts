import {
  BuildSpec,
  ExecutionResult,
  ThriveIntelligence,
  ThriveNativeCompositionPlan,
  ThriveNativeGuardStatus,
  ThriveNativeOperation,
  ThriveSectionResolution,
} from "@/lib/siteforge/contracts";
import { fingerprintNativePayload, getNativeContract } from "@/lib/siteforge/thriveNativeContracts";

const SUPPORTED_SECTION_TYPES = new Set(["hero", "cta", "features", "faq", "testimonials", "contact"]);

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function opAllowed(guard: ThriveNativeGuardStatus, operation: ThriveNativeOperation): boolean {
  return guard.eligible && guard.allowlistedOperations.includes(operation) && Boolean(getNativeContract(operation));
}

function summarize(planSections: ThriveNativeCompositionPlan["sections"]): ThriveNativeCompositionPlan["summary"] {
  return {
    reusedExisting: planSections.filter((entry) => entry.intent === "reused_existing" || entry.intent === "reused_visual_symbol").length,
    createdNative: planSections.filter((entry) =>
      entry.intent === "created_native" ||
      entry.intent === "created_visual_native_section" ||
      entry.intent === "created_visual_cta_block" ||
      entry.intent === "created_visual_faq_toggle"
    ).length,
    wpFallback: planSections.filter((entry) => entry.intent === "wp_fallback" || entry.intent === "improved_visual_fallback").length,
    blockedByGuard: planSections.filter((entry) => entry.intent === "blocked_by_guard").length,
    blockedByMissingContract: planSections.filter((entry) => entry.intent === "blocked_by_missing_contract").length,
  };
}

export function createThriveNativeCompositionPlan(params: {
  spec: BuildSpec;
  intelligence: ThriveIntelligence | null;
  sectionResolutions: ThriveSectionResolution[];
  execution: ExecutionResult;
  guard: ThriveNativeGuardStatus;
}): ThriveNativeCompositionPlan {
  const homepageSlug = params.spec.homepageSlug;
  const homepagePage = params.spec.pages.find((page) => page.slug === homepageSlug) ?? null;
  const homepageRecord =
    params.execution.createdPages.find((page) => page.slug === homepageSlug) ??
    params.execution.createdPages.find((page) => page.intent === "homepage") ??
    null;
  const homepagePostId = homepageRecord?.pageId ?? null;

  const shellLayoutCandidate = homepagePage?.metadata.shellLayoutCandidate ?? "thrive-homepage-canonical";
  const shellTemplateGroupCandidate = homepagePage?.metadata.shellTemplateGroupCandidate ?? "homepage";

  const operations: ThriveNativeCompositionPlan["operations"] = [];
  const sections: ThriveNativeCompositionPlan["sections"] = [];

  if (!params.guard.eligible) {
    const fallbackSections = (homepagePage?.sections ?? []).map((section) => ({
      pageSlug: homepageSlug,
      sectionId: section.id,
      sectionType: section.type,
      intent: "blocked_by_guard" as const,
      selectedOperation: null,
      targetObjectType: "none" as const,
      matchedSymbolId: null,
      visualPattern: section.metadata?.visualComposition?.visualPattern,
      visualPrimitive: section.metadata?.visualPrimitiveSelection?.selectedPrimitive,
      designIntentSatisfied: false,
      fallbackReason: params.guard.blockedReason ?? "guard_blocked",
      reason: params.guard.blockedReason ?? "guard_blocked",
    }));

    return {
      mode: "blocked_native_mode",
      homepagePostId,
      shellTemplateGroupCandidate,
      shellLayoutCandidate,
      operations: [],
      sections: fallbackSections,
      summary: summarize(fallbackSections),
    };
  }

  if (homepagePostId && opAllowed(params.guard, "createOrUpdateTemplateShellReference")) {
    const shellPayload: Record<string, unknown> = {
      title: `${params.spec.siteTitle} Homepage Shell`,
      slug: `${slugify(params.spec.siteTitle)}-homepage-shell`,
      shellLayoutCandidate,
      shellTemplateGroupCandidate,
      designSystemVersion: params.spec.metadata.designSystemVersion ?? "siteforge_visual_v1",
      visualDesignTokens: params.spec.metadata.visualDesignTokens ?? null,
      status: "publish",
    };
    operations.push({
      operation: "createOrUpdateTemplateShellReference",
      objectType: "thrive_template",
      payload: shellPayload,
      payloadHash: fingerprintNativePayload(shellPayload),
      reason: "homepage_shell_targeting",
    });
  }

  const resolutionBySection = new Map(
    params.sectionResolutions.filter((entry) => entry.pageSlug === homepageSlug).map((entry) => [entry.sectionId, entry])
  );

  for (const section of homepagePage?.sections ?? []) {
    if (!SUPPORTED_SECTION_TYPES.has(section.type)) {
      sections.push({
        pageSlug: homepageSlug,
        sectionId: section.id,
        sectionType: section.type,
        intent: "improved_visual_fallback",
        selectedOperation: null,
        targetObjectType: "none",
        matchedSymbolId: null,
        visualPattern: section.metadata?.visualComposition?.visualPattern,
        visualPrimitive: "wordpress_structured_fallback",
        designIntentSatisfied: false,
        fallbackReason: "section_type_out_of_scope_v1",
        reason: "section_type_out_of_scope_v1",
      });
      continue;
    }

    const resolution = resolutionBySection.get(section.id) ?? null;
    const matchedSymbolId = resolution?.matchedSymbolId ?? null;

    if (matchedSymbolId && opAllowed(params.guard, "attachReusablePrimitiveToPagePlan") && homepagePostId) {
      const payload: Record<string, unknown> = {
        postId: homepagePostId,
        primitiveId: matchedSymbolId,
        primitiveType: "tcb_symbol",
        sectionId: section.id,
        sectionType: section.type,
      };
      operations.push({
        operation: "attachReusablePrimitiveToPagePlan",
        objectType: "attachment",
        payload,
        payloadHash: fingerprintNativePayload(payload),
        reason: "reused_visual_symbol",
      });
      sections.push({
        pageSlug: homepageSlug,
        sectionId: section.id,
        sectionType: section.type,
        intent: "reused_visual_symbol",
        selectedOperation: "attachReusablePrimitiveToPagePlan",
        targetObjectType: "attachment",
        matchedSymbolId,
        visualPattern: resolution?.visualPattern,
        visualPrimitive: resolution?.selectedVisualPrimitive ?? "thrive_template_symbol",
        designIntentSatisfied: resolution?.designIntentSatisfied ?? true,
        fallbackReason: resolution?.fallbackReason ?? null,
        reason: resolution?.reason ?? "matched_symbol",
      });
      continue;
    }

    const createOperation: ThriveNativeOperation = section.type === "hero" || section.type === "contact" ? "createOrUpdateSymbol" : "createOrUpdateSection";
    if (!opAllowed(params.guard, createOperation)) {
      sections.push({
        pageSlug: homepageSlug,
        sectionId: section.id,
        sectionType: section.type,
        intent: "blocked_by_missing_contract",
        selectedOperation: null,
        targetObjectType: "none",
        matchedSymbolId: null,
        visualPattern: resolution?.visualPattern ?? section.metadata?.visualComposition?.visualPattern,
        visualPrimitive: resolution?.selectedVisualPrimitive ?? section.metadata?.visualPrimitiveSelection?.selectedPrimitive,
        designIntentSatisfied: false,
        fallbackReason: `operation_not_available:${createOperation}`,
        reason: `operation_not_available:${createOperation}`,
      });
      continue;
    }

    const payload: Record<string, unknown> = {
      title: `${params.spec.siteTitle} ${section.type} ${section.id}`,
      slug: slugify(`${params.spec.siteTitle}-${section.type}-${section.id}`),
      sectionId: section.id,
      sectionType: section.type,
      heading: section.heading,
      body: section.body,
      visualPattern: resolution?.visualPattern ?? section.metadata?.visualComposition?.visualPattern,
      visualPrimitive: resolution?.selectedVisualPrimitive ?? section.metadata?.visualPrimitiveSelection?.selectedPrimitive,
      designIntentSatisfied: resolution?.designIntentSatisfied ?? false,
      visualDesignTokens: params.spec.metadata.visualDesignTokens ?? null,
      status: "publish",
    };

    operations.push({
      operation: createOperation,
      objectType: createOperation === "createOrUpdateSymbol" ? "tcb_symbol" : "thrive_section",
      payload,
      payloadHash: fingerprintNativePayload(payload),
      reason: "create_minimal_native_v1",
    });

    sections.push({
      pageSlug: homepageSlug,
      sectionId: section.id,
      sectionType: section.type,
      intent:
        section.type === "faq"
          ? "created_visual_faq_toggle"
          : section.type === "cta"
            ? "created_visual_cta_block"
            : "created_visual_native_section",
      selectedOperation: createOperation,
      targetObjectType: createOperation === "createOrUpdateSymbol" ? "tcb_symbol" : "thrive_section",
      matchedSymbolId: null,
      visualPattern: resolution?.visualPattern ?? section.metadata?.visualComposition?.visualPattern,
      visualPrimitive: resolution?.selectedVisualPrimitive ?? section.metadata?.visualPrimitiveSelection?.selectedPrimitive,
      designIntentSatisfied: resolution?.designIntentSatisfied ?? true,
      fallbackReason: resolution?.fallbackReason ?? null,
      reason: "created_visual_native_from_design_intent",
    });
  }

  const templateStep = operations.find((entry) => entry.operation === "createOrUpdateTemplateShellReference");
  if (homepagePostId && templateStep && opAllowed(params.guard, "assignTemplateToPost")) {
    const payload: Record<string, unknown> = {
      postId: homepagePostId,
      templateId: 0,
      source: "composer_v1",
      status: "publish",
    };
    operations.push({
      operation: "assignTemplateToPost",
      objectType: "attachment",
      payload,
      payloadHash: fingerprintNativePayload(payload),
      reason: "assign_template_to_homepage",
    });
  }

  return {
    mode: "thrive_native_staging_mode",
    homepagePostId,
    shellTemplateGroupCandidate,
    shellLayoutCandidate,
    operations,
    sections,
    summary: summarize(sections),
  };
}
