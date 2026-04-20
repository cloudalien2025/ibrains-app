import { createId, nowIso, toSlug } from "@/lib/siteforge/utils";
import { WebsiteBrief, brandToneOptions, websiteGoalOptions } from "@/lib/siteforge/contracts";

export type BuildStage =
  | "planning"
  | "writing"
  | "building"
  | "reviewing"
  | "finalizing"
  | "executing"
  | "completed"
  | "failed";

export type HomepageStrategy = "use_existing" | "replace_existing" | "create_new" | "draft_only";

export type MarketIntelligenceView = {
  status: "not_configured" | "used" | "error";
  source: "none" | "serpapi";
  querySet: string[];
  competitorPatterns: string[];
  commonPageSections: string[];
  recurringValueProps: string[];
  trustSignals: string[];
  ctaPatterns: string[];
  faqThemes: string[];
  visualPatternHints: string[];
  appStorePositioningHints: string[];
  contentWarnings: string[];
  summary: string;
  fingerprint: string;
  generatedAt: string;
  plannerEnriched: boolean;
  contentEnriched: boolean;
};

export type SiteForgeProjectView = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  siteType: string | null;
  primaryPrompt: string | null;
  websiteBrief: WebsiteBrief | null;
  currentState: string;
  homepageStrategy: HomepageStrategy;
  aiProvider: "openai" | null;
  aiModel: string | null;
  aiSecretRef: string | null;
  hasSavedAiSecret: boolean;
  serpApiProvider: "serpapi" | null;
  serpApiSecretRef: string | null;
  hasSavedSerpApiSecret: boolean;
  lastOpenedAt: string | null;
  description: string;
  latestSessionId: string | null;
  updatedAt: string;
};

export type SiteForgeConnectionView = {
  connectionId: string;
  projectId: string;
  label: string;
  wordpressUrl: string;
  username: string;
  authType: "application_password";
  secretRef: string | null;
  hasSavedSecret: boolean;
  thriveDetected: boolean;
  writeAccess: boolean;
  lastValidatedAt: string | null;
  lastValidationStatus: "not_validated" | "valid" | "invalid";
  createdAt: string;
  updatedAt: string;
};

export type SiteForgeSnapshotView = {
  snapshotId: string;
  projectId: string;
  connectionId: string | null;
  currentHomepageId: number | null;
  currentHomepageTitle: string | null;
  currentHomepageSource: "wordpress" | "thrive" | "unknown";
  knownPages: Array<{
    id: number | null;
    slug: string;
    title: string;
    url: string | null;
    status?: string;
    intent?: "homepage" | "about" | "contact" | "faq" | "features" | "pricing" | "generic";
    source?: "existing" | "created" | "reused";
    decision?: "reused_existing" | "created_new";
  }>;
  knownMenus: Array<{ id: number | null; label: string; source: string }>;
  thriveDetected: boolean;
  thriveIntelligence: {
    source: "wordpress_rest_get";
    collectedAt: string;
    mode: "wp_safe_mode";
    activeSkin: { id: number; name: string; slug: string; tag: string | null } | null;
    symbolInventory: Array<{
      id: number;
      title: string;
      slug: string;
      taxonomy: { slug: string | null; name: string | null };
      inferredRole: "header" | "footer" | "section" | "unknown";
      reusable: boolean;
      hasBuilderContent: boolean;
      hasCustomCss: boolean;
      contentHash?: string | null;
      cssHash?: string | null;
      keywords?: string[];
    }>;
    symbolSummary: { total: number; headers: number; footers: number; sections: number; unknown: number };
    primitiveCounts: { thriveTemplate: number; thriveLayout: number; thriveSection: number; tcbSymbol: number };
    safeHints: { frontPageUsesWpSettings: boolean };
    warnings: string[];
  } | null;
  thriveSectionResolutions: Array<{
    pageSlug: string;
    sectionId: string;
    sectionType: "hero" | "problem" | "solution" | "features" | "testimonials" | "cta" | "faq" | "contact";
    sectionIntent: "conversion" | "informational" | "trust" | "navigation";
    symbolCandidateType: "header" | "footer" | "cta" | "testimonial" | "faq" | "marketing" | "generic";
    preferredRenderTarget:
      | "wordpress_page_content"
      | "thrive_symbol_reference"
      | "thrive_content_template_reference"
      | "future_thrive_template_assignment"
      | "future_landing_page_candidate"
      | "wp_html_fallback";
    resolution: "existing_symbol" | "existing_content_template" | "future_landing_page_candidate" | "wp_html_fallback";
    visualPattern:
      | "hero_split"
      | "hero_centered"
      | "feature_cards_grid"
      | "icon_benefits_row"
      | "testimonial_cards"
      | "faq_toggle"
      | "cta_band"
      | "trust_strip"
      | "app_mockup_showcase"
      | "alternating_content_band";
    selectedVisualPrimitive:
      | "thrive_content_box"
      | "thrive_call_to_action"
      | "thrive_toggle"
      | "thrive_template_symbol"
      | "thrive_columns_background_band"
      | "wordpress_structured_fallback";
    primitiveSelectionSource:
      | "existing_reusable_symbol"
      | "existing_compatible_primitive"
      | "native_create_contract"
      | "safe_fallback";
    designIntentSatisfied: boolean;
    fallbackReason: string | null;
    matchedSymbolId: number | null;
    matchedSymbolTitle: string | null;
    matchedRole: "header" | "footer" | "section" | "unknown" | null;
    confidence: number;
    reason: string;
    rejectedReasons: string[];
  }>;
  thriveModeSummary: {
    wpSafeMode: boolean;
    thriveIntelMode: boolean;
    stagingNativeMode: boolean;
  };
  thriveNativeGuard: {
    eligible: boolean;
    blockedReason: string | null;
    environment: "test" | "development" | "production";
    nativeTargetMode: "blocked" | "approved_non_production_target" | "unapproved_target";
    targetClassification: "approved_non_production_target" | "unapproved_target" | "unknown_target";
    nativeTargetEligibility: "eligible" | "blocked";
    approvedTargetHost: string | null;
    approvalSource: "env_allowlist" | "project_policy" | "unknown" | null;
    connectionHost: string;
    allowlistedOperations: Array<
      | "assignTemplateToPost"
      | "createOrUpdateSymbol"
      | "createOrUpdateSection"
      | "createOrUpdateTemplateShellReference"
      | "attachReusablePrimitiveToPagePlan"
      | "importArchitectContentArtifact"
      | "importThemeBuilderArtifact"
    >;
    routeAllowlist: string[];
    schemaContractVersion: string | null;
  } | null;
  thriveNativeComposition: {
    mode: "thrive_native_staging_mode" | "blocked_native_mode";
    homepagePostId: number | null;
    shellTemplateGroupCandidate: string | null;
    shellLayoutCandidate: string | null;
    operations: Array<{
      operation:
        | "assignTemplateToPost"
        | "createOrUpdateSymbol"
        | "createOrUpdateSection"
        | "createOrUpdateTemplateShellReference"
        | "attachReusablePrimitiveToPagePlan"
        | "importArchitectContentArtifact"
        | "importThemeBuilderArtifact";
      objectType: "thrive_template" | "thrive_section" | "tcb_symbol" | "attachment";
      payloadHash: string;
      reason: string;
    }>;
    sections: Array<{
      pageSlug: string;
      sectionId: string;
      sectionType: "hero" | "problem" | "solution" | "features" | "testimonials" | "cta" | "faq" | "contact";
      intent:
        | "reused_existing"
        | "created_native"
        | "wp_fallback"
        | "blocked_by_guard"
        | "blocked_by_missing_contract"
        | "reused_visual_symbol"
        | "created_visual_native_section"
        | "created_visual_cta_block"
        | "created_visual_faq_toggle"
        | "improved_visual_fallback";
      selectedOperation:
        | "assignTemplateToPost"
        | "createOrUpdateSymbol"
        | "createOrUpdateSection"
        | "createOrUpdateTemplateShellReference"
        | "attachReusablePrimitiveToPagePlan"
        | "importArchitectContentArtifact"
        | "importThemeBuilderArtifact"
        | null;
      targetObjectType: "thrive_template" | "thrive_section" | "tcb_symbol" | "attachment" | "none";
      matchedSymbolId: number | null;
      visualPattern?:
        | "hero_split"
        | "hero_centered"
        | "feature_cards_grid"
        | "icon_benefits_row"
        | "testimonial_cards"
        | "faq_toggle"
        | "cta_band"
        | "trust_strip"
        | "app_mockup_showcase"
        | "alternating_content_band";
      visualPrimitive?:
        | "thrive_content_box"
        | "thrive_call_to_action"
        | "thrive_toggle"
        | "thrive_template_symbol"
        | "thrive_columns_background_band"
        | "wordpress_structured_fallback";
      designIntentSatisfied?: boolean;
      fallbackReason?: string | null;
      reason: string;
    }>;
    summary: {
      reusedExisting: number;
      createdNative: number;
      wpFallback: number;
      blockedByGuard: number;
      blockedByMissingContract: number;
    };
  } | null;
  thriveNativeExecution: {
    executedAt: string;
    success: boolean;
    mode: "thrive_native_staging_mode" | "blocked_native_mode";
    steps: Array<{
      operation:
        | "assignTemplateToPost"
        | "createOrUpdateSymbol"
        | "createOrUpdateSection"
        | "createOrUpdateTemplateShellReference"
        | "attachReusablePrimitiveToPagePlan"
        | "importArchitectContentArtifact"
        | "importThemeBuilderArtifact";
      objectType: "thrive_template" | "thrive_section" | "tcb_symbol" | "attachment";
      targetId: number | null;
      endpoint: string;
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      payloadHash: string;
      success: boolean;
      verificationPassed: boolean;
      rollbackReady: boolean;
      detail: string;
      responseStatus?: number;
    }>;
    createdObjects: Array<{
      objectType: "thrive_template" | "thrive_section" | "tcb_symbol";
      id: number;
      sourceOperation:
        | "assignTemplateToPost"
        | "createOrUpdateSymbol"
        | "createOrUpdateSection"
        | "createOrUpdateTemplateShellReference"
        | "attachReusablePrimitiveToPagePlan"
        | "importArchitectContentArtifact"
        | "importThemeBuilderArtifact";
    }>;
    rollback: {
      available: boolean;
      steps: Array<{
        objectType: "thrive_template" | "thrive_section" | "tcb_symbol";
        id: number;
        operation: "DELETE";
        attempted: boolean;
        success: boolean;
        detail: string;
      }>;
    };
    warnings: string[];
  } | null;
  thriveNativeValidation: {
    runId: string;
    mode: "dry_run" | "real_run";
    startedAt: string;
    completedAt: string;
    status: "passed" | "failed" | "blocked";
    planMode: "thrive_native_staging_mode" | "blocked_native_mode";
    homepagePostId: number | null;
    summary: {
      reusedExisting: number;
      createdNative: number;
      wpFallback: number;
      verificationFailed: number;
      blockedByGuard: number;
      blockedByMissingContract: number;
    };
    sectionOutcomes: Array<{
      pageSlug: string;
      sectionId: string;
      sectionType: "hero" | "problem" | "solution" | "features" | "testimonials" | "cta" | "faq" | "contact";
      outcome:
        | "reused_existing"
        | "created_native"
        | "wp_fallback"
        | "verification_failed"
        | "blocked_by_guard"
        | "blocked_by_missing_contract"
        | "reused_visual_symbol"
        | "created_visual_native_section"
        | "created_visual_cta_block"
        | "created_visual_faq_toggle"
        | "improved_visual_fallback";
      operation:
        | "assignTemplateToPost"
        | "createOrUpdateSymbol"
        | "createOrUpdateSection"
        | "createOrUpdateTemplateShellReference"
        | "attachReusablePrimitiveToPagePlan"
        | "importArchitectContentArtifact"
        | "importThemeBuilderArtifact"
        | null;
      targetId: number | null;
      visualPattern?:
        | "hero_split"
        | "hero_centered"
        | "feature_cards_grid"
        | "icon_benefits_row"
        | "testimonial_cards"
        | "faq_toggle"
        | "cta_band"
        | "trust_strip"
        | "app_mockup_showcase"
        | "alternating_content_band";
      visualPrimitive?:
        | "thrive_content_box"
        | "thrive_call_to_action"
        | "thrive_toggle"
        | "thrive_template_symbol"
        | "thrive_columns_background_band"
        | "wordpress_structured_fallback";
      designIntentSatisfied?: boolean;
      fallbackReason?: string | null;
      reason: string;
    }>;
    verification: {
      stepsTotal: number;
      verifiedSteps: number;
      failedSteps: number;
      pageReachable: boolean;
      pageIdentityOk: boolean;
      objectStateOk: boolean;
      renderability: {
        status:
          | "render_ok"
          | "wp_404"
          | "wrong_target_url"
          | "redirect_mismatch"
          | "network_failure"
          | "template_assignment_incomplete"
          | "front_page_mismatch"
          | "unknown_render_failure";
        checkedUrl: string | null;
        finalUrl: string | null;
        legacyPageLink: string | null;
        httpStatus: number | null;
        redirectChain: string[];
        responseHeaders: Record<string, string>;
        bodySnippet: string | null;
      };
      notes: string[];
    };
    rollbackVerification: {
      attempted: boolean;
      success: boolean;
      notes: string[];
    };
    promotionCandidateSummary: {
      ready: boolean;
      reason: string;
      environment: string;
      runFingerprint: string;
      pageId: number | null;
      shellTemplateId: number | null;
      reusedSymbolIds: number[];
      createdObjectIds: Array<{
        objectType: "thrive_template" | "thrive_section" | "tcb_symbol";
        id: number;
      }>;
      payloadHashes: string[];
      verificationSnapshot: {
        stepsTotal: number;
        verifiedSteps: number;
        failedSteps: number;
        objectStateOk: boolean;
        pageReachable: boolean;
        pageIdentityOk: boolean;
      };
      rollbackSnapshot: {
        available: boolean;
        attempted: boolean;
        success: boolean;
      };
      themeArtifactRef: string | null;
      architectContentArtifactRef: string | null;
      landingPageArtifactRef: string | null;
      designPackArtifactRef: string | null;
      contractCaptureRef: string | null;
    };
  } | null;
  marketIntelligence: MarketIntelligenceView | null;
  homepageStrategy: HomepageStrategy;
  lastRunSummary: string | null;
  lastRunStatus: "queued" | "running" | "completed" | "failed" | null;
  pagesAffected: number;
  lastSyncedAt: string;
};

export type BuildSessionView = {
  id: string;
  projectId: string;
  prompt: string;
  generationSource: "user_key" | "platform_key" | "deterministic_fallback";
  aiModel: string | null;
  marketIntelligence: MarketIntelligenceView | null;
  connectionId: string | null;
  type: "generate" | "refine";
  createdAt: string;
  status: "queued" | "running" | "completed" | "failed";
  runState: {
    currentStage: BuildStage;
    progressPct: number;
    timeline: Array<{
      at: string;
      stage: BuildStage;
      message: string;
      level: "info" | "warning" | "error";
    }>;
  };
  buildSpec: {
    siteTitle: string;
    pages: Array<{ title: string; slug: string; sections: Array<{ heading: string; body: string }> }>;
  } | null;
  executionResult: {
    success: boolean;
    createdPages: Array<{
      slug: string;
      status: string;
      url: string | null;
      intent?: "homepage" | "about" | "contact" | "faq" | "features" | "pricing" | "generic";
      decision?: "reused_existing" | "created_new";
      decisionReason?: string;
    }>;
    homepage: {
      success: boolean;
      message: string;
      title?: string | null;
      reason?: string;
    };
    menu: { success: boolean; message: string };
    thrive: {
      enabled: boolean;
      appliedMappings: string[];
      fallbackUsed: boolean;
      executionMode: "wp_safe_mode" | "future_thrive_native_mode";
      intelligenceAvailable: boolean;
      symbolInventoryPresent: boolean;
      intelligence: SiteForgeSnapshotView["thriveIntelligence"] | null;
      runtime: SiteForgeSnapshotView["thriveModeSummary"];
      currentMode: "wp_safe_mode" | "thrive_intel_mode" | "thrive_native_staging_mode" | "blocked_native_mode";
      nativeGuard: SiteForgeSnapshotView["thriveNativeGuard"] | null;
      nativeComposition: SiteForgeSnapshotView["thriveNativeComposition"] | null;
      nativeExecution: SiteForgeSnapshotView["thriveNativeExecution"] | null;
      nativeValidation: SiteForgeSnapshotView["thriveNativeValidation"] | null;
      sectionResolutions: SiteForgeSnapshotView["thriveSectionResolutions"];
    };
    warnings: string[];
    errors: string[];
  } | null;
  revisionHistory: Array<{ id: string; at: string; request: { message: string } }>;
  errorSummary: string | null;
};

export type SiteForgeRunLogView = {
  logId: string;
  sessionId: string;
  stage: BuildStage;
  message: string;
  level: "info" | "warning" | "error";
  timestamp: string;
};

export type SiteForgeWorkspaceView = {
  project: SiteForgeProjectView;
  activeConnection: SiteForgeConnectionView | null;
  snapshot: SiteForgeSnapshotView | null;
  latestRun: BuildSessionView | null;
  runHistory: BuildSessionView[];
  runLogs: SiteForgeRunLogView[];
};

const stageSet = new Set<BuildStage>([
  "planning",
  "writing",
  "building",
  "reviewing",
  "finalizing",
  "executing",
  "completed",
  "failed",
]);

const strategySet = new Set<HomepageStrategy>([
  "use_existing",
  "replace_existing",
  "create_new",
  "draft_only",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function boolOr(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function normalizeMarketIntelligence(value: unknown): MarketIntelligenceView | null {
  if (!isRecord(value)) return null;
  return {
    status:
      value.status === "used" || value.status === "error" || value.status === "not_configured"
        ? value.status
        : "not_configured",
    source: value.source === "serpapi" ? "serpapi" : "none",
    querySet: stringArray(value.querySet),
    competitorPatterns: stringArray(value.competitorPatterns),
    commonPageSections: stringArray(value.commonPageSections),
    recurringValueProps: stringArray(value.recurringValueProps),
    trustSignals: stringArray(value.trustSignals),
    ctaPatterns: stringArray(value.ctaPatterns),
    faqThemes: stringArray(value.faqThemes),
    visualPatternHints: stringArray(value.visualPatternHints),
    appStorePositioningHints: stringArray(value.appStorePositioningHints),
    contentWarnings: stringArray(value.contentWarnings),
    summary: stringOr(value.summary, "No market intelligence summary available."),
    fingerprint: stringOr(value.fingerprint, "none"),
    generatedAt: stringOr(value.generatedAt, nowIso()),
    plannerEnriched: boolOr(value.plannerEnriched),
    contentEnriched: boolOr(value.contentEnriched),
  };
}

function normalizeVisualPattern(value: unknown): NonNullable<SiteForgeSnapshotView["thriveSectionResolutions"][number]["visualPattern"]> {
  return value === "hero_split" ||
    value === "hero_centered" ||
    value === "feature_cards_grid" ||
    value === "icon_benefits_row" ||
    value === "testimonial_cards" ||
    value === "faq_toggle" ||
    value === "cta_band" ||
    value === "trust_strip" ||
    value === "app_mockup_showcase" ||
    value === "alternating_content_band"
    ? value
    : "alternating_content_band";
}

function normalizeVisualPrimitive(value: unknown): NonNullable<SiteForgeSnapshotView["thriveSectionResolutions"][number]["selectedVisualPrimitive"]> {
  return value === "thrive_content_box" ||
    value === "thrive_call_to_action" ||
    value === "thrive_toggle" ||
    value === "thrive_template_symbol" ||
    value === "thrive_columns_background_band" ||
    value === "wordpress_structured_fallback"
    ? value
    : "wordpress_structured_fallback";
}

function normalizePrimitiveSelectionSource(
  value: unknown
): NonNullable<SiteForgeSnapshotView["thriveSectionResolutions"][number]["primitiveSelectionSource"]> {
  return value === "existing_reusable_symbol" ||
    value === "existing_compatible_primitive" ||
    value === "native_create_contract" ||
    value === "safe_fallback"
    ? value
    : "safe_fallback";
}

function normalizeThriveIntelligence(value: unknown): SiteForgeSnapshotView["thriveIntelligence"] | null {
  if (!isRecord(value)) return null;
  const activeSkinRaw = isRecord(value.activeSkin) ? value.activeSkin : null;
  const symbolInventoryRaw = Array.isArray(value.symbolInventory) ? value.symbolInventory : [];
  const symbolSummaryRaw = isRecord(value.symbolSummary) ? value.symbolSummary : {};
  const primitiveCountsRaw = isRecord(value.primitiveCounts) ? value.primitiveCounts : {};
  const safeHintsRaw = isRecord(value.safeHints) ? value.safeHints : {};

  return {
    source: "wordpress_rest_get",
    collectedAt: stringOr(value.collectedAt, nowIso()),
    mode: "wp_safe_mode",
    activeSkin: activeSkinRaw
      ? {
          id: numberOr(activeSkinRaw.id),
          name: stringOr(activeSkinRaw.name, "Unknown Skin"),
          slug: stringOr(activeSkinRaw.slug, "unknown-skin"),
          tag: nullableString(activeSkinRaw.tag),
        }
      : null,
    symbolInventory: symbolInventoryRaw
      .filter(isRecord)
      .map((entry) => ({
        id: numberOr(entry.id),
        title: stringOr(entry.title, "Untitled Symbol"),
        slug: stringOr(entry.slug, "symbol"),
        taxonomy: isRecord(entry.taxonomy)
          ? {
              slug: nullableString(entry.taxonomy.slug),
              name: nullableString(entry.taxonomy.name),
            }
          : { slug: null, name: null },
        inferredRole:
          entry.inferredRole === "header" ||
          entry.inferredRole === "footer" ||
          entry.inferredRole === "section" ||
          entry.inferredRole === "unknown"
            ? entry.inferredRole
            : "unknown",
        reusable: boolOr(entry.reusable, true),
        hasBuilderContent: boolOr(entry.hasBuilderContent),
        hasCustomCss: boolOr(entry.hasCustomCss),
        contentHash: nullableString(entry.contentHash),
        cssHash: nullableString(entry.cssHash),
        keywords: Array.isArray(entry.keywords)
          ? entry.keywords.filter((keyword): keyword is string => typeof keyword === "string")
          : [],
      })),
    symbolSummary: {
      total: numberOr(symbolSummaryRaw.total),
      headers: numberOr(symbolSummaryRaw.headers),
      footers: numberOr(symbolSummaryRaw.footers),
      sections: numberOr(symbolSummaryRaw.sections),
      unknown: numberOr(symbolSummaryRaw.unknown),
    },
    primitiveCounts: {
      thriveTemplate: numberOr(primitiveCountsRaw.thriveTemplate),
      thriveLayout: numberOr(primitiveCountsRaw.thriveLayout),
      thriveSection: numberOr(primitiveCountsRaw.thriveSection),
      tcbSymbol: numberOr(primitiveCountsRaw.tcbSymbol),
    },
    safeHints: {
      frontPageUsesWpSettings: boolOr(safeHintsRaw.frontPageUsesWpSettings),
    },
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((entry): entry is string => typeof entry === "string") : [],
  };
}

function normalizeThriveSectionResolutions(value: unknown): SiteForgeSnapshotView["thriveSectionResolutions"] {
  const input = Array.isArray(value) ? value : [];
  return input
    .filter(isRecord)
    .map((entry) => ({
      pageSlug: stringOr(entry.pageSlug, ""),
      sectionId: stringOr(entry.sectionId, ""),
      sectionType:
        entry.sectionType === "hero" ||
        entry.sectionType === "problem" ||
        entry.sectionType === "solution" ||
        entry.sectionType === "features" ||
        entry.sectionType === "testimonials" ||
        entry.sectionType === "cta" ||
        entry.sectionType === "faq" ||
        entry.sectionType === "contact"
          ? entry.sectionType
          : "solution",
      sectionIntent:
        entry.sectionIntent === "conversion" ||
        entry.sectionIntent === "informational" ||
        entry.sectionIntent === "trust" ||
        entry.sectionIntent === "navigation"
          ? entry.sectionIntent
          : "informational",
      symbolCandidateType:
        entry.symbolCandidateType === "header" ||
        entry.symbolCandidateType === "footer" ||
        entry.symbolCandidateType === "cta" ||
        entry.symbolCandidateType === "testimonial" ||
        entry.symbolCandidateType === "faq" ||
        entry.symbolCandidateType === "marketing" ||
        entry.symbolCandidateType === "generic"
          ? entry.symbolCandidateType
          : "generic",
      preferredRenderTarget:
        entry.preferredRenderTarget === "thrive_symbol_reference" ||
        entry.preferredRenderTarget === "thrive_content_template_reference" ||
        entry.preferredRenderTarget === "future_thrive_template_assignment" ||
        entry.preferredRenderTarget === "future_landing_page_candidate" ||
        entry.preferredRenderTarget === "wp_html_fallback"
          ? entry.preferredRenderTarget
          : "wordpress_page_content",
      resolution:
        entry.resolution === "existing_symbol" ||
        entry.resolution === "existing_content_template" ||
        entry.resolution === "future_landing_page_candidate" ||
        entry.resolution === "wp_html_fallback"
          ? entry.resolution
          : "wp_html_fallback",
      visualPattern: normalizeVisualPattern(entry.visualPattern),
      selectedVisualPrimitive: normalizeVisualPrimitive(entry.selectedVisualPrimitive),
      primitiveSelectionSource: normalizePrimitiveSelectionSource(entry.primitiveSelectionSource),
      designIntentSatisfied: boolOr(entry.designIntentSatisfied),
      fallbackReason: nullableString(entry.fallbackReason),
      matchedSymbolId: typeof entry.matchedSymbolId === "number" ? entry.matchedSymbolId : null,
      matchedSymbolTitle: nullableString(entry.matchedSymbolTitle),
      matchedRole:
        entry.matchedRole === "header" ||
        entry.matchedRole === "footer" ||
        entry.matchedRole === "section" ||
        entry.matchedRole === "unknown"
          ? entry.matchedRole
          : null,
      confidence: numberOr(entry.confidence),
      reason: stringOr(entry.reason, "no_reason"),
      rejectedReasons: Array.isArray(entry.rejectedReasons)
        ? entry.rejectedReasons.filter((item): item is string => typeof item === "string")
        : [],
    }));
}

function normalizeNativeOperation(
  value: unknown
): NonNullable<SiteForgeSnapshotView["thriveNativeGuard"]>["allowlistedOperations"][number] {
  return value === "assignTemplateToPost" ||
    value === "createOrUpdateSymbol" ||
    value === "createOrUpdateSection" ||
    value === "createOrUpdateTemplateShellReference" ||
    value === "attachReusablePrimitiveToPagePlan" ||
    value === "importArchitectContentArtifact" ||
    value === "importThemeBuilderArtifact"
    ? value
    : "attachReusablePrimitiveToPagePlan";
}

function normalizeThriveNativeGuard(value: unknown): SiteForgeSnapshotView["thriveNativeGuard"] {
  if (!isRecord(value)) return null;
  return {
    eligible: boolOr(value.eligible),
    blockedReason: nullableString(value.blockedReason),
    environment:
      value.environment === "production" || value.environment === "test" || value.environment === "development"
        ? value.environment
        : "development",
    nativeTargetMode:
      value.nativeTargetMode === "approved_non_production_target" ||
      value.nativeTargetMode === "unapproved_target" ||
      value.nativeTargetMode === "blocked"
        ? value.nativeTargetMode
        : "blocked",
    targetClassification:
      value.targetClassification === "approved_non_production_target" ||
      value.targetClassification === "unapproved_target" ||
      value.targetClassification === "unknown_target"
        ? value.targetClassification
        : "unknown_target",
    nativeTargetEligibility: value.nativeTargetEligibility === "eligible" ? "eligible" : "blocked",
    approvedTargetHost: nullableString(value.approvedTargetHost),
    approvalSource:
      value.approvalSource === "env_allowlist" ||
      value.approvalSource === "project_policy" ||
      value.approvalSource === "unknown"
        ? value.approvalSource
        : null,
    connectionHost: stringOr(value.connectionHost, ""),
    allowlistedOperations: Array.isArray(value.allowlistedOperations)
      ? value.allowlistedOperations.map((entry) => normalizeNativeOperation(entry))
      : [],
    routeAllowlist: Array.isArray(value.routeAllowlist)
      ? value.routeAllowlist.filter((entry): entry is string => typeof entry === "string")
      : [],
    schemaContractVersion: nullableString(value.schemaContractVersion),
  };
}

function normalizeThriveNativeComposition(value: unknown): SiteForgeSnapshotView["thriveNativeComposition"] {
  if (!isRecord(value)) return null;
  return {
    mode: value.mode === "blocked_native_mode" ? "blocked_native_mode" : "thrive_native_staging_mode",
    homepagePostId: typeof value.homepagePostId === "number" ? value.homepagePostId : null,
    shellTemplateGroupCandidate: nullableString(value.shellTemplateGroupCandidate),
    shellLayoutCandidate: nullableString(value.shellLayoutCandidate),
    operations: Array.isArray(value.operations)
      ? value.operations
          .filter(isRecord)
          .map((entry) => ({
            operation: normalizeNativeOperation(entry.operation),
            objectType:
              entry.objectType === "thrive_template" ||
              entry.objectType === "thrive_section" ||
              entry.objectType === "tcb_symbol"
                ? entry.objectType
                : "attachment",
            payloadHash: stringOr(entry.payloadHash, ""),
            reason: stringOr(entry.reason, ""),
          }))
      : [],
    sections: Array.isArray(value.sections)
      ? value.sections
          .filter(isRecord)
          .map((entry) => ({
            pageSlug: stringOr(entry.pageSlug, ""),
            sectionId: stringOr(entry.sectionId, ""),
            sectionType:
              entry.sectionType === "hero" ||
              entry.sectionType === "problem" ||
              entry.sectionType === "solution" ||
              entry.sectionType === "features" ||
              entry.sectionType === "testimonials" ||
              entry.sectionType === "cta" ||
              entry.sectionType === "faq" ||
              entry.sectionType === "contact"
                ? entry.sectionType
                : "solution",
            intent:
              entry.intent === "reused_existing" ||
              entry.intent === "created_native" ||
              entry.intent === "wp_fallback" ||
              entry.intent === "blocked_by_guard" ||
              entry.intent === "blocked_by_missing_contract" ||
              entry.intent === "reused_visual_symbol" ||
              entry.intent === "created_visual_native_section" ||
              entry.intent === "created_visual_cta_block" ||
              entry.intent === "created_visual_faq_toggle" ||
              entry.intent === "improved_visual_fallback"
                ? entry.intent
                : "wp_fallback",
            selectedOperation: entry.selectedOperation == null ? null : normalizeNativeOperation(entry.selectedOperation),
            targetObjectType:
              entry.targetObjectType === "thrive_template" ||
              entry.targetObjectType === "thrive_section" ||
              entry.targetObjectType === "tcb_symbol" ||
              entry.targetObjectType === "attachment" ||
              entry.targetObjectType === "none"
                ? entry.targetObjectType
                : "none",
            matchedSymbolId: typeof entry.matchedSymbolId === "number" ? entry.matchedSymbolId : null,
            visualPattern: entry.visualPattern == null ? undefined : normalizeVisualPattern(entry.visualPattern),
            visualPrimitive: entry.visualPrimitive == null ? undefined : normalizeVisualPrimitive(entry.visualPrimitive),
            designIntentSatisfied: typeof entry.designIntentSatisfied === "boolean" ? entry.designIntentSatisfied : undefined,
            fallbackReason: entry.fallbackReason == null ? undefined : nullableString(entry.fallbackReason),
            reason: stringOr(entry.reason, ""),
          }))
      : [],
    summary: isRecord(value.summary)
      ? {
          reusedExisting: numberOr(value.summary.reusedExisting),
          createdNative: numberOr(value.summary.createdNative),
          wpFallback: numberOr(value.summary.wpFallback),
          blockedByGuard: numberOr(value.summary.blockedByGuard),
          blockedByMissingContract: numberOr(value.summary.blockedByMissingContract),
        }
      : {
          reusedExisting: 0,
          createdNative: 0,
          wpFallback: 0,
          blockedByGuard: 0,
          blockedByMissingContract: 0,
        },
  };
}

function normalizeThriveNativeExecution(value: unknown): SiteForgeSnapshotView["thriveNativeExecution"] {
  if (!isRecord(value)) return null;
  return {
    executedAt: stringOr(value.executedAt, nowIso()),
    success: boolOr(value.success),
    mode: value.mode === "blocked_native_mode" ? "blocked_native_mode" : "thrive_native_staging_mode",
    steps: Array.isArray(value.steps)
      ? value.steps
          .filter(isRecord)
          .map((step) => ({
            operation: normalizeNativeOperation(step.operation),
            objectType:
              step.objectType === "thrive_template" ||
              step.objectType === "thrive_section" ||
              step.objectType === "tcb_symbol"
                ? step.objectType
                : "attachment",
            targetId: typeof step.targetId === "number" ? step.targetId : null,
            endpoint: stringOr(step.endpoint, ""),
            method:
              step.method === "GET" ||
              step.method === "PUT" ||
              step.method === "PATCH" ||
              step.method === "DELETE" ||
              step.method === "POST"
                ? step.method
                : "POST",
            payloadHash: stringOr(step.payloadHash, ""),
            success: boolOr(step.success),
            verificationPassed: boolOr(step.verificationPassed),
            rollbackReady: boolOr(step.rollbackReady),
            detail: stringOr(step.detail, ""),
            responseStatus: typeof step.responseStatus === "number" ? step.responseStatus : undefined,
          }))
      : [],
    createdObjects: Array.isArray(value.createdObjects)
      ? value.createdObjects
          .filter(isRecord)
          .map((entry) => ({
            objectType:
              entry.objectType === "thrive_template" || entry.objectType === "thrive_section" ? entry.objectType : "tcb_symbol",
            id: numberOr(entry.id),
            sourceOperation: normalizeNativeOperation(entry.sourceOperation),
          }))
      : [],
    rollback: isRecord(value.rollback)
      ? {
          available: boolOr(value.rollback.available),
          steps: Array.isArray(value.rollback.steps)
            ? value.rollback.steps
                .filter(isRecord)
                .map((entry) => ({
                  objectType:
                    entry.objectType === "thrive_template" ||
                    entry.objectType === "thrive_section" ||
                    entry.objectType === "tcb_symbol"
                      ? entry.objectType
                      : "tcb_symbol",
                  id: numberOr(entry.id),
                  operation: "DELETE" as const,
                  attempted: boolOr(entry.attempted),
                  success: boolOr(entry.success),
                  detail: stringOr(entry.detail, ""),
                }))
            : [],
        }
      : { available: false, steps: [] },
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((entry): entry is string => typeof entry === "string") : [],
  };
}

function normalizeThriveNativeValidation(value: unknown): SiteForgeSnapshotView["thriveNativeValidation"] {
  if (!isRecord(value)) return null;
  const summaryRaw = isRecord(value.summary) ? value.summary : {};
  const verificationRaw = isRecord(value.verification) ? value.verification : {};
  const renderabilityRaw = isRecord(verificationRaw.renderability) ? verificationRaw.renderability : {};
  const rollbackVerificationRaw = isRecord(value.rollbackVerification) ? value.rollbackVerification : {};
  const promotionRaw = isRecord(value.promotionCandidateSummary) ? value.promotionCandidateSummary : {};
  const verificationSnapshotRaw = isRecord(promotionRaw.verificationSnapshot) ? promotionRaw.verificationSnapshot : {};
  const rollbackSnapshotRaw = isRecord(promotionRaw.rollbackSnapshot) ? promotionRaw.rollbackSnapshot : {};

  return {
    runId: stringOr(value.runId, ""),
    mode: value.mode === "dry_run" ? "dry_run" : "real_run",
    startedAt: stringOr(value.startedAt, nowIso()),
    completedAt: stringOr(value.completedAt, nowIso()),
    status: value.status === "passed" || value.status === "blocked" ? value.status : "failed",
    planMode: value.planMode === "blocked_native_mode" ? "blocked_native_mode" : "thrive_native_staging_mode",
    homepagePostId: typeof value.homepagePostId === "number" ? value.homepagePostId : null,
    summary: {
      reusedExisting: numberOr(summaryRaw.reusedExisting),
      createdNative: numberOr(summaryRaw.createdNative),
      wpFallback: numberOr(summaryRaw.wpFallback),
      verificationFailed: numberOr(summaryRaw.verificationFailed),
      blockedByGuard: numberOr(summaryRaw.blockedByGuard),
      blockedByMissingContract: numberOr(summaryRaw.blockedByMissingContract),
    },
    sectionOutcomes: Array.isArray(value.sectionOutcomes)
      ? value.sectionOutcomes
          .filter(isRecord)
          .map((entry) => ({
            pageSlug: stringOr(entry.pageSlug, ""),
            sectionId: stringOr(entry.sectionId, ""),
            sectionType:
              entry.sectionType === "hero" ||
              entry.sectionType === "problem" ||
              entry.sectionType === "solution" ||
              entry.sectionType === "features" ||
              entry.sectionType === "testimonials" ||
              entry.sectionType === "cta" ||
              entry.sectionType === "faq" ||
              entry.sectionType === "contact"
                ? entry.sectionType
                : "hero",
            outcome:
              entry.outcome === "reused_existing" ||
              entry.outcome === "created_native" ||
              entry.outcome === "wp_fallback" ||
              entry.outcome === "verification_failed" ||
              entry.outcome === "blocked_by_guard" ||
              entry.outcome === "blocked_by_missing_contract" ||
              entry.outcome === "reused_visual_symbol" ||
              entry.outcome === "created_visual_native_section" ||
              entry.outcome === "created_visual_cta_block" ||
              entry.outcome === "created_visual_faq_toggle" ||
              entry.outcome === "improved_visual_fallback"
                ? entry.outcome
                : "wp_fallback",
            operation: entry.operation ? normalizeNativeOperation(entry.operation) : null,
            targetId: typeof entry.targetId === "number" ? entry.targetId : null,
            visualPattern: entry.visualPattern == null ? undefined : normalizeVisualPattern(entry.visualPattern),
            visualPrimitive: entry.visualPrimitive == null ? undefined : normalizeVisualPrimitive(entry.visualPrimitive),
            designIntentSatisfied: typeof entry.designIntentSatisfied === "boolean" ? entry.designIntentSatisfied : undefined,
            fallbackReason: entry.fallbackReason == null ? undefined : nullableString(entry.fallbackReason),
            reason: stringOr(entry.reason, ""),
          }))
      : [],
    verification: {
      stepsTotal: numberOr(verificationRaw.stepsTotal),
      verifiedSteps: numberOr(verificationRaw.verifiedSteps),
      failedSteps: numberOr(verificationRaw.failedSteps),
      pageReachable: boolOr(verificationRaw.pageReachable),
      pageIdentityOk: boolOr(verificationRaw.pageIdentityOk),
      objectStateOk: boolOr(verificationRaw.objectStateOk),
      renderability: {
        status:
          renderabilityRaw.status === "render_ok" ||
          renderabilityRaw.status === "wp_404" ||
          renderabilityRaw.status === "wrong_target_url" ||
          renderabilityRaw.status === "redirect_mismatch" ||
          renderabilityRaw.status === "network_failure" ||
          renderabilityRaw.status === "template_assignment_incomplete" ||
          renderabilityRaw.status === "front_page_mismatch" ||
          renderabilityRaw.status === "unknown_render_failure"
            ? renderabilityRaw.status
            : "unknown_render_failure",
        checkedUrl: nullableString(renderabilityRaw.checkedUrl),
        finalUrl: nullableString(renderabilityRaw.finalUrl),
        legacyPageLink: nullableString(renderabilityRaw.legacyPageLink),
        httpStatus: typeof renderabilityRaw.httpStatus === "number" ? renderabilityRaw.httpStatus : null,
        redirectChain: Array.isArray(renderabilityRaw.redirectChain)
          ? renderabilityRaw.redirectChain.filter((entry): entry is string => typeof entry === "string")
          : [],
        responseHeaders: isRecord(renderabilityRaw.responseHeaders)
          ? Object.fromEntries(
              Object.entries(renderabilityRaw.responseHeaders)
                .filter(([, value]) => typeof value === "string")
                .map(([key, value]) => [key, value as string])
            )
          : {},
        bodySnippet: nullableString(renderabilityRaw.bodySnippet),
      },
      notes: Array.isArray(verificationRaw.notes)
        ? verificationRaw.notes.filter((entry): entry is string => typeof entry === "string")
        : [],
    },
    rollbackVerification: {
      attempted: boolOr(rollbackVerificationRaw.attempted),
      success: boolOr(rollbackVerificationRaw.success),
      notes: Array.isArray(rollbackVerificationRaw.notes)
        ? rollbackVerificationRaw.notes.filter((entry): entry is string => typeof entry === "string")
        : [],
    },
    promotionCandidateSummary: {
      ready: boolOr(promotionRaw.ready),
      reason: stringOr(promotionRaw.reason, ""),
      environment: stringOr(promotionRaw.environment, "unknown"),
      runFingerprint: stringOr(promotionRaw.runFingerprint, ""),
      pageId: typeof promotionRaw.pageId === "number" ? promotionRaw.pageId : null,
      shellTemplateId: typeof promotionRaw.shellTemplateId === "number" ? promotionRaw.shellTemplateId : null,
      reusedSymbolIds: Array.isArray(promotionRaw.reusedSymbolIds)
        ? promotionRaw.reusedSymbolIds.filter((entry): entry is number => typeof entry === "number")
        : [],
      createdObjectIds: Array.isArray(promotionRaw.createdObjectIds)
        ? promotionRaw.createdObjectIds
            .filter(isRecord)
            .map((entry) => ({
              objectType:
                entry.objectType === "thrive_template" || entry.objectType === "thrive_section" ? entry.objectType : "tcb_symbol",
              id: numberOr(entry.id),
            }))
        : [],
      payloadHashes: Array.isArray(promotionRaw.payloadHashes)
        ? promotionRaw.payloadHashes.filter((entry): entry is string => typeof entry === "string")
        : [],
      verificationSnapshot: {
        stepsTotal: numberOr(verificationSnapshotRaw.stepsTotal),
        verifiedSteps: numberOr(verificationSnapshotRaw.verifiedSteps),
        failedSteps: numberOr(verificationSnapshotRaw.failedSteps),
        objectStateOk: boolOr(verificationSnapshotRaw.objectStateOk),
        pageReachable: boolOr(verificationSnapshotRaw.pageReachable),
        pageIdentityOk: boolOr(verificationSnapshotRaw.pageIdentityOk),
      },
      rollbackSnapshot: {
        available: boolOr(rollbackSnapshotRaw.available),
        attempted: boolOr(rollbackSnapshotRaw.attempted),
        success: boolOr(rollbackSnapshotRaw.success),
      },
      themeArtifactRef: nullableString(promotionRaw.themeArtifactRef),
      architectContentArtifactRef: nullableString(promotionRaw.architectContentArtifactRef),
      landingPageArtifactRef: nullableString(promotionRaw.landingPageArtifactRef),
      designPackArtifactRef: nullableString(promotionRaw.designPackArtifactRef),
      contractCaptureRef: nullableString(promotionRaw.contractCaptureRef),
    },
  };
}

function toStage(value: unknown): BuildStage {
  return typeof value === "string" && stageSet.has(value as BuildStage) ? (value as BuildStage) : "planning";
}

function toStrategy(value: unknown): HomepageStrategy {
  return typeof value === "string" && strategySet.has(value as HomepageStrategy)
    ? (value as HomepageStrategy)
    : "use_existing";
}

function toSessionStatus(value: unknown): "queued" | "running" | "completed" | "failed" {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }
  return "queued";
}

export function normalizeProject(value: unknown): SiteForgeProjectView | null {
  if (!isRecord(value)) return null;
  const id = nullableString(value.id);
  if (!id) return null;

  const name = stringOr(value.name, "Untitled SiteForge Project");
  return {
    id,
    name,
    slug: stringOr(value.slug, toSlug(name)),
    status: value.status === "active" || value.status === "archived" ? value.status : "draft",
    siteType: nullableString(value.siteType),
    primaryPrompt: nullableString(value.primaryPrompt),
    websiteBrief: normalizeWebsiteBrief(value.websiteBrief),
    currentState: stringOr(value.currentState, "workspace"),
    homepageStrategy: toStrategy(value.homepageStrategy),
    aiProvider: value.aiProvider === "openai" ? "openai" : null,
    aiModel: nullableString(value.aiModel),
    aiSecretRef: nullableString(value.aiSecretRef),
    hasSavedAiSecret: boolOr(value.hasSavedAiSecret),
    serpApiProvider: value.serpApiProvider === "serpapi" ? "serpapi" : null,
    serpApiSecretRef: nullableString(value.serpApiSecretRef),
    hasSavedSerpApiSecret: boolOr(value.hasSavedSerpApiSecret),
    lastOpenedAt: nullableString(value.lastOpenedAt),
    description: stringOr(value.description, "SiteForge workspace project"),
    latestSessionId: nullableString(value.latestSessionId),
    updatedAt: stringOr(value.updatedAt, nowIso()),
  };
}

function normalizeWebsiteBrief(value: unknown): WebsiteBrief | null {
  if (!isRecord(value)) return null;
  const businessName = stringOr(value.businessName, "");
  const businessType = stringOr(value.businessType, "");
  const businessDescription = stringOr(value.businessDescription, "");
  const targetAudience = stringOr(value.targetAudience, "");
  const websiteGoal = stringOr(value.websiteGoal, "");
  const mainOffer = stringOr(value.mainOffer, "");
  const brandTone = stringOr(value.brandTone, "");
  if (
    !businessName ||
    !businessType ||
    !businessDescription ||
    !targetAudience ||
    !mainOffer ||
    !(websiteGoalOptions as readonly string[]).includes(websiteGoal) ||
    !(brandToneOptions as readonly string[]).includes(brandTone)
  ) {
    return null;
  }
  return {
    businessName,
    businessType,
    businessDescription,
    targetAudience,
    websiteGoal: websiteGoal as WebsiteBrief["websiteGoal"],
    mainOffer,
    brandTone: brandTone as WebsiteBrief["brandTone"],
    marketLocation: nullableString(value.marketLocation),
    competitors: nullableString(value.competitors),
    differentiators: nullableString(value.differentiators),
  };
}

function normalizeConnection(value: unknown, projectId: string): SiteForgeConnectionView | null {
  if (!isRecord(value)) return null;
  const connectionId = nullableString(value.connectionId);
  if (!connectionId) return null;

  const createdAt = stringOr(value.createdAt, nowIso());
  return {
    connectionId,
    projectId,
    label: stringOr(value.label, "WordPress"),
    wordpressUrl: stringOr(value.wordpressUrl, ""),
    username: stringOr(value.username, ""),
    authType: "application_password",
    secretRef: nullableString(value.secretRef),
    hasSavedSecret: boolOr(value.hasSavedSecret),
    thriveDetected: boolOr(value.thriveDetected),
    writeAccess: boolOr(value.writeAccess),
    lastValidatedAt: nullableString(value.lastValidatedAt),
    lastValidationStatus:
      value.lastValidationStatus === "valid" || value.lastValidationStatus === "invalid"
        ? value.lastValidationStatus
        : "not_validated",
    createdAt,
    updatedAt: stringOr(value.updatedAt, createdAt),
  };
}

export function normalizeSession(value: unknown, projectId: string): BuildSessionView | null {
  if (!isRecord(value)) return null;
  const id = nullableString(value.id);
  if (!id) return null;

  const runStateRaw = isRecord(value.runState) ? value.runState : {};
  const timelineRaw = Array.isArray(runStateRaw.timeline) ? runStateRaw.timeline : [];

  return {
    id,
    projectId: stringOr(value.projectId, projectId),
    prompt: stringOr(value.prompt, ""),
    generationSource:
      value.generationSource === "user_key" || value.generationSource === "platform_key"
        ? value.generationSource
        : "deterministic_fallback",
    aiModel: nullableString(value.aiModel),
    marketIntelligence: normalizeMarketIntelligence(value.marketIntelligence),
    connectionId: nullableString(value.connectionId),
    type: value.type === "refine" ? "refine" : "generate",
    createdAt: stringOr(value.createdAt, nowIso()),
    status: toSessionStatus(value.status),
    runState: {
      currentStage: toStage(runStateRaw.currentStage),
      progressPct: numberOr(runStateRaw.progressPct),
      timeline: timelineRaw.map((entry) => {
        const line = isRecord(entry) ? entry : {};
        return {
          at: stringOr(line.at, nowIso()),
          stage: toStage(line.stage),
          message: stringOr(line.message, "Stage updated"),
          level: line.level === "warning" || line.level === "error" ? line.level : "info",
        };
      }),
    },
    buildSpec: isRecord(value.buildSpec)
      ? {
          siteTitle: stringOr(value.buildSpec.siteTitle, "SiteForge Site"),
          pages: Array.isArray(value.buildSpec.pages)
            ? value.buildSpec.pages
                .filter(isRecord)
                .map((page) => ({
                  title: stringOr(page.title, "Untitled"),
                  slug: stringOr(page.slug, "page"),
                  sections: Array.isArray(page.sections)
                    ? page.sections
                        .filter(isRecord)
                        .map((section) => ({
                          heading: stringOr(section.heading, "Section"),
                          body: stringOr(section.body, ""),
                        }))
                    : [],
                }))
            : [],
        }
      : null,
    executionResult: isRecord(value.executionResult)
      ? {
          success: boolOr(value.executionResult.success),
          createdPages: Array.isArray(value.executionResult.createdPages)
            ? value.executionResult.createdPages
                .filter(isRecord)
                .map((page) => ({
                  slug: stringOr(page.slug, ""),
                  status: stringOr(page.status, "unknown"),
                  url: nullableString(page.url),
                  intent:
                    page.intent === "homepage" ||
                    page.intent === "about" ||
                    page.intent === "contact" ||
                    page.intent === "faq" ||
                    page.intent === "features" ||
                    page.intent === "pricing" ||
                    page.intent === "generic"
                      ? page.intent
                      : undefined,
                  decision: page.decision === "reused_existing" || page.decision === "created_new" ? page.decision : undefined,
                  decisionReason: typeof page.decisionReason === "string" ? page.decisionReason : undefined,
                }))
            : [],
          homepage: isRecord(value.executionResult.homepage)
            ? {
                success: boolOr(value.executionResult.homepage.success),
                message: stringOr(value.executionResult.homepage.message, ""),
                title:
                  value.executionResult.homepage.title == null
                    ? null
                    : stringOr(value.executionResult.homepage.title, ""),
                reason: typeof value.executionResult.homepage.reason === "string" ? value.executionResult.homepage.reason : undefined,
              }
            : { success: false, message: "", title: null },
          menu: isRecord(value.executionResult.menu)
            ? {
                success: boolOr(value.executionResult.menu.success),
                message: stringOr(value.executionResult.menu.message, ""),
              }
            : { success: false, message: "" },
          thrive: isRecord(value.executionResult.thrive)
            ? {
                enabled: boolOr(value.executionResult.thrive.enabled),
                appliedMappings: Array.isArray(value.executionResult.thrive.appliedMappings)
                  ? value.executionResult.thrive.appliedMappings.filter((entry): entry is string => typeof entry === "string")
                  : [],
                fallbackUsed: boolOr(value.executionResult.thrive.fallbackUsed),
                executionMode:
                  value.executionResult.thrive.executionMode === "future_thrive_native_mode"
                    ? "future_thrive_native_mode"
                    : "wp_safe_mode",
                intelligenceAvailable: boolOr(value.executionResult.thrive.intelligenceAvailable),
                symbolInventoryPresent: boolOr(value.executionResult.thrive.symbolInventoryPresent),
                intelligence: normalizeThriveIntelligence(value.executionResult.thrive.intelligence),
                runtime: isRecord(value.executionResult.thrive.runtime)
                  ? {
                      wpSafeMode: boolOr(value.executionResult.thrive.runtime.wpSafeMode, true),
                      thriveIntelMode: boolOr(value.executionResult.thrive.runtime.thriveIntelMode),
                      stagingNativeMode: boolOr(value.executionResult.thrive.runtime.stagingNativeMode),
                    }
                  : { wpSafeMode: true, thriveIntelMode: false, stagingNativeMode: false },
                currentMode:
                  value.executionResult.thrive.currentMode === "thrive_native_staging_mode" ||
                  value.executionResult.thrive.currentMode === "blocked_native_mode" ||
                  value.executionResult.thrive.currentMode === "thrive_intel_mode"
                    ? value.executionResult.thrive.currentMode
                    : "wp_safe_mode",
                nativeGuard: normalizeThriveNativeGuard(value.executionResult.thrive.nativeGuard),
                nativeComposition: normalizeThriveNativeComposition(value.executionResult.thrive.nativeComposition),
                nativeExecution: normalizeThriveNativeExecution(value.executionResult.thrive.nativeExecution),
                nativeValidation: normalizeThriveNativeValidation(value.executionResult.thrive.nativeValidation),
                sectionResolutions: normalizeThriveSectionResolutions(value.executionResult.thrive.sectionResolutions),
              }
            : {
                enabled: false,
                appliedMappings: [],
                fallbackUsed: false,
                executionMode: "wp_safe_mode",
                intelligenceAvailable: false,
                symbolInventoryPresent: false,
                intelligence: null,
                runtime: { wpSafeMode: true, thriveIntelMode: false, stagingNativeMode: false },
                currentMode: "wp_safe_mode",
                nativeGuard: null,
                nativeComposition: null,
                nativeExecution: null,
                nativeValidation: null,
                sectionResolutions: [],
              },
          warnings: Array.isArray(value.executionResult.warnings)
            ? value.executionResult.warnings.filter((entry): entry is string => typeof entry === "string")
            : [],
          errors: Array.isArray(value.executionResult.errors)
            ? value.executionResult.errors.filter((entry): entry is string => typeof entry === "string")
            : [],
        }
      : null,
    revisionHistory: Array.isArray(value.revisionHistory)
      ? value.revisionHistory
          .filter(isRecord)
          .map((entry) => ({
            id: stringOr(entry.id, createId("rev")),
            at: stringOr(entry.at, nowIso()),
            request: isRecord(entry.request)
              ? {
                  message: stringOr(entry.request.message, ""),
                }
              : { message: "" },
          }))
      : [],
    errorSummary: nullableString(value.errorSummary),
  };
}

function normalizeSnapshot(value: unknown, projectId: string): SiteForgeSnapshotView | null {
  if (!isRecord(value)) return null;
  const snapshotId = nullableString(value.snapshotId);
  if (!snapshotId) return null;

  return {
    snapshotId,
    projectId: stringOr(value.projectId, projectId),
    connectionId: nullableString(value.connectionId),
    currentHomepageId: typeof value.currentHomepageId === "number" ? value.currentHomepageId : null,
    currentHomepageTitle: nullableString(value.currentHomepageTitle),
    currentHomepageSource:
      value.currentHomepageSource === "wordpress" || value.currentHomepageSource === "thrive"
        ? value.currentHomepageSource
        : "unknown",
    knownPages: Array.isArray(value.knownPages)
      ? value.knownPages
          .filter(isRecord)
          .map((page) => ({
            id: typeof page.id === "number" ? page.id : null,
            slug: stringOr(page.slug, ""),
            title: stringOr(page.title, "Untitled"),
            url: nullableString(page.url),
            status: typeof page.status === "string" ? page.status : undefined,
            intent:
              page.intent === "homepage" ||
              page.intent === "about" ||
              page.intent === "contact" ||
              page.intent === "faq" ||
              page.intent === "features" ||
              page.intent === "pricing" ||
              page.intent === "generic"
                ? page.intent
                : undefined,
            source:
              page.source === "existing" || page.source === "created" || page.source === "reused" ? page.source : undefined,
            decision: page.decision === "reused_existing" || page.decision === "created_new" ? page.decision : undefined,
          }))
      : [],
    knownMenus: Array.isArray(value.knownMenus)
      ? value.knownMenus
          .filter(isRecord)
          .map((menu) => ({
            id: typeof menu.id === "number" ? menu.id : null,
            label: stringOr(menu.label, "Menu"),
            source: stringOr(menu.source, "wordpress"),
          }))
      : [],
    thriveDetected: boolOr(value.thriveDetected),
    thriveIntelligence: normalizeThriveIntelligence(value.thriveIntelligence),
    thriveSectionResolutions: normalizeThriveSectionResolutions(value.thriveSectionResolutions),
    thriveModeSummary: isRecord(value.thriveModeSummary)
      ? {
          wpSafeMode: boolOr(value.thriveModeSummary.wpSafeMode, true),
          thriveIntelMode: boolOr(value.thriveModeSummary.thriveIntelMode),
          stagingNativeMode: boolOr(value.thriveModeSummary.stagingNativeMode),
        }
      : { wpSafeMode: true, thriveIntelMode: false, stagingNativeMode: false },
    thriveNativeGuard: normalizeThriveNativeGuard(value.thriveNativeGuard),
    thriveNativeComposition: normalizeThriveNativeComposition(value.thriveNativeComposition),
    thriveNativeExecution: normalizeThriveNativeExecution(value.thriveNativeExecution),
    thriveNativeValidation: normalizeThriveNativeValidation(value.thriveNativeValidation),
    marketIntelligence: normalizeMarketIntelligence(value.marketIntelligence),
    homepageStrategy: toStrategy(value.homepageStrategy),
    lastRunSummary: nullableString(value.lastRunSummary),
    lastRunStatus:
      value.lastRunStatus === "queued" ||
      value.lastRunStatus === "running" ||
      value.lastRunStatus === "completed" ||
      value.lastRunStatus === "failed"
        ? value.lastRunStatus
        : null,
    pagesAffected: numberOr(value.pagesAffected),
    lastSyncedAt: stringOr(value.lastSyncedAt, nowIso()),
  };
}

function normalizeRunLog(value: unknown): SiteForgeRunLogView | null {
  if (!isRecord(value)) return null;
  const logId = nullableString(value.logId);
  if (!logId) return null;

  return {
    logId,
    sessionId: stringOr(value.sessionId, ""),
    stage: toStage(value.stage),
    message: stringOr(value.message, ""),
    level: value.level === "warning" || value.level === "error" ? value.level : "info",
    timestamp: stringOr(value.timestamp, nowIso()),
  };
}

export function normalizeWorkspace(value: unknown): SiteForgeWorkspaceView | null {
  if (!isRecord(value)) return null;
  const project = normalizeProject(value.project);
  if (!project) return null;

  const runHistoryRaw = Array.isArray(value.runHistory) ? value.runHistory : [];
  const runHistory = runHistoryRaw
    .map((entry) => normalizeSession(entry, project.id))
    .filter((entry): entry is BuildSessionView => Boolean(entry));

  const latestRun = normalizeSession(value.latestRun, project.id) ?? runHistory[0] ?? null;

  return {
    project,
    activeConnection: normalizeConnection(value.activeConnection, project.id),
    snapshot: normalizeSnapshot(value.snapshot, project.id),
    latestRun,
    runHistory,
    runLogs: (Array.isArray(value.runLogs) ? value.runLogs : [])
      .map(normalizeRunLog)
      .filter((entry): entry is SiteForgeRunLogView => Boolean(entry)),
  };
}

export function normalizeProjectsPayload(value: unknown): {
  projects: SiteForgeProjectView[];
  lastOpenedProjectId: string | null;
} {
  if (!isRecord(value)) {
    return { projects: [], lastOpenedProjectId: null };
  }

  const projects = (Array.isArray(value.projects) ? value.projects : [])
    .map(normalizeProject)
    .filter((entry): entry is SiteForgeProjectView => Boolean(entry));

  const lastOpenedProjectId = nullableString(value.lastOpenedProjectId);

  return {
    projects,
    lastOpenedProjectId,
  };
}

export function normalizeProjectPayload(value: unknown): { project: SiteForgeProjectView } | null {
  if (!isRecord(value)) return null;
  const project = normalizeProject(value.project);
  if (!project) return null;
  return { project };
}

export function resolveInitialProjectId(projects: SiteForgeProjectView[], requestedId: string | null): string | null {
  if (!projects.length) return null;
  if (requestedId && projects.some((project) => project.id === requestedId)) {
    return requestedId;
  }
  return projects[0].id;
}
