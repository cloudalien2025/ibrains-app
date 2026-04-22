export const siteforgeBuildStages = [
  "planning",
  "writing",
  "building",
  "reviewing",
  "finalizing",
  "executing",
  "completed",
  "failed",
] as const;

export type BuildStage = (typeof siteforgeBuildStages)[number];

export type SitePlanSection = {
  id: string;
  sectionType: "hero" | "problem" | "solution" | "features" | "testimonials" | "cta" | "faq" | "contact";
  purpose: string;
};

export type SitePlanPage = {
  id: string;
  title: string;
  slug: string;
  purpose: string;
  sections: SitePlanSection[];
};

export type SitePlan = {
  businessType: string;
  businessSummary: string;
  siteGoal: string;
  primaryCTA: string;
  targetAudience: string | null;
  homepageSlug: string;
  navigation: string[];
  pages: SitePlanPage[];
  assumptions: string[];
  warnings: string[];
};

export const websiteGoalOptions = [
  "book_calls",
  "capture_leads",
  "sell_products",
  "drive_demos_trials",
  "build_authority",
] as const;

export type WebsiteGoal = (typeof websiteGoalOptions)[number];

export const brandToneOptions = ["premium", "friendly", "expert", "bold", "modern"] as const;

export type BrandTone = (typeof brandToneOptions)[number];

export type WebsiteBrief = {
  businessName: string;
  businessType: string;
  businessDescription: string;
  targetAudience: string;
  websiteGoal: WebsiteGoal;
  mainOffer: string;
  brandTone: BrandTone;
  marketLocation: string | null;
  competitors: string | null;
  differentiators: string | null;
};

export type MarketIntelligenceStatus = "not_configured" | "used" | "error";

export type MarketIntelligenceSource = "none" | "serpapi";

export type ResearchSourceSnapshot = {
  query: string;
  title: string;
  snippet: string;
  link: string;
  domain: string;
};

export type ResearchIntelligence = {
  niche: string;
  audienceSegments: string[];
  conversionGoal: string;
  recurringValueProps: string[];
  recurringCtaPatterns: string[];
  recurringTrustPatterns: string[];
  recurringSectionPatterns: string[];
  visualDirectionSignals: string[];
  differentiationOpportunities: string[];
  recommendedPages: string[];
  confidenceNotes: string[];
  sourceSnapshots: ResearchSourceSnapshot[];
};

export type WebsiteStrategy = {
  siteType: "app" | "service" | "product" | "hybrid";
  primaryAudience: string;
  secondaryAudience: string[];
  primaryConversionGoal: string;
  positioning: {
    category: string;
    differentiatedPromise: string;
    tone: string;
    trustModel: string;
  };
  homepageStrategy: {
    heroObjective: string;
    keyMessages: string[];
    sectionBlueprint: Array<"hero" | "problem" | "solution" | "features" | "testimonials" | "cta" | "faq" | "contact">;
    primaryCta: string;
    secondaryCta: string;
  };
  pageStrategy: {
    requiredPages: string[];
    optionalPages: string[];
  };
  designDirection: {
    visualTone: string;
    density: "compact" | "balanced" | "spacious";
    hierarchyStyle: string;
    proofStyle: string;
    mockupStrategy: string;
  };
  thriveExecutionHints: {
    preferredShellType: string;
    preferredSectionPatterns: string[];
    preferredSymbolCategories: string[];
    prefersLandingPageStyle: boolean;
  };
};

export type MarketIntelligenceBrief = {
  status: MarketIntelligenceStatus;
  source: MarketIntelligenceSource;
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
  researchIntelligence?: ResearchIntelligence;
};

export type ContentSection = {
  sectionId: string;
  heading: string;
  body: string;
  cta?: string;
};

export type ContentPageContent = {
  pageId: string;
  title: string;
  slug: string;
  headline: string;
  subheadline: string;
  sections: ContentSection[];
  cta: string;
};

export type ContentPackage = {
  siteTitle: string;
  brandVoice: string;
  pages: ContentPageContent[];
};

export type BuildSpecSection = {
  id: string;
  type: SitePlanSection["sectionType"];
  heading: string;
  body: string;
  cta?: string;
  metadata?: {
    source?: string;
    pageSlug?: string;
    sectionIntent?: "conversion" | "informational" | "trust" | "navigation";
    thriveSymbolRoleCandidate?: "header" | "footer" | "section" | "unknown";
    pageRole?: PageIntent;
    shellRole?: "homepage_shell" | "standard_shell" | "conversion_shell" | "utility_shell" | "unknown";
    symbolCandidateType?: "header" | "footer" | "cta" | "testimonial" | "faq" | "marketing" | "generic";
    preferredRenderTarget?: ThriveRenderTarget;
    shellTemplateGroupCandidate?: string | null;
    shellLayoutCandidate?: string | null;
    reusableSymbolCandidates?: number[];
    contentTemplateCandidates?: number[];
    landingPageCandidate?: string | null;
    rendererMode?: "wp_safe_mode" | "thrive_intel_mode" | "staging_native_mode";
    visualComposition?: VisualSectionComposition;
    visualPrimitiveSelection?: {
      requestedPattern: VisualPattern;
      selectedPrimitive: ThriveVisualPrimitive;
      selectedVia: "existing_reusable_symbol" | "existing_compatible_primitive" | "native_create_contract" | "safe_fallback";
      reason: string;
      designIntentSatisfied: boolean;
      fallbackReason?: string | null;
    };
    themeArtifactRef?: string | null;
    architectContentArtifactRef?: string | null;
    landingPageArtifactRef?: string | null;
    designPackArtifactRef?: string | null;
    contractCaptureRef?: string | null;
    thriveRefs?: {
      symbolRefCandidates?: number[];
      templateRefCandidates?: number[];
      sectionRefCandidates?: number[];
    };
    renderTarget?: ThriveRenderTarget;
    researchConfidence?: "high" | "medium" | "low";
    [key: string]: unknown;
  };
};

export type BuildSpecPage = {
  pageId: string;
  title: string;
  slug: string;
  purpose: string;
  sections: BuildSpecSection[];
  metadata: {
    template: "landing" | "standard" | "contact";
    thriveLayoutKey?: string;
    pageRole?: PageIntent;
    shellRole?: "homepage_shell" | "standard_shell" | "conversion_shell" | "utility_shell" | "unknown";
    preferredRenderTarget?: ThriveRenderTarget;
    shellTemplateGroupCandidate?: string | null;
    shellLayoutCandidate?: string | null;
    reusableSymbolCandidates?: number[];
    contentTemplateCandidates?: number[];
    landingPageCandidate?: string | null;
    rendererMode?: "wp_safe_mode" | "thrive_intel_mode" | "staging_native_mode";
    themeArtifactRef?: string | null;
    architectContentArtifactRef?: string | null;
    landingPageArtifactRef?: string | null;
    designPackArtifactRef?: string | null;
    contractCaptureRef?: string | null;
    shellStrategy?: string | null;
    researchConfidence?: "high" | "medium" | "low";
    thriveRefs?: {
      symbolRefCandidates?: number[];
      templateRefCandidates?: number[];
      sectionRefCandidates?: number[];
    };
    [key: string]: unknown;
  };
};

export type BuildSpec = {
  siteTitle: string;
  homepageSlug: string;
  menu: Array<{ label: string; slug: string }>;
  pages: BuildSpecPage[];
  metadata: {
    conversionFocus: "high" | "medium";
    thriveAware: boolean;
    thriveMode?: "wp_safe_mode" | "future_thrive_native_mode";
    thriveIntelligenceUsed?: boolean;
    thriveExecutionMode?: "wp_safe_mode" | "thrive_intel_mode" | "staging_native_mode";
    designSystemVersion?: "siteforge_visual_v1";
    visualDesignTokens?: SiteForgeVisualDesignTokens;
    themeArtifactRef?: string | null;
    architectContentArtifactRef?: string | null;
    landingPageArtifactRef?: string | null;
    designPackArtifactRef?: string | null;
    contractCaptureRef?: string | null;
    researchConfidence?: "high" | "medium" | "low";
    strategySignals?: {
      siteType: WebsiteStrategy["siteType"];
      primaryConversionGoal: string;
      trustModel: string;
    };
    createdAt: string;
  };
};

export type PageIntent = "homepage" | "about" | "contact" | "faq" | "features" | "pricing" | "generic";
export type VisualPattern =
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
export type ThriveVisualPrimitive =
  | "thrive_content_box"
  | "thrive_call_to_action"
  | "thrive_toggle"
  | "thrive_template_symbol"
  | "thrive_columns_background_band"
  | "wordpress_structured_fallback";
export type VisualSectionComposition = {
  visualPattern: VisualPattern;
  sectionLayout: "split" | "centered" | "grid_2" | "grid_3" | "grid_4" | "row" | "band";
  emphasisLevel: "high" | "medium" | "low";
  backgroundStyle: "surface" | "muted_band" | "accent_band" | "contrast_band";
  cardStyle: "none" | "soft" | "elevated" | "outlined";
  mediaSlot: "none" | "image" | "app_screenshot" | "icon_cluster";
  iconStyle: "none" | "line" | "duotone" | "solid";
  ctaStyle: "none" | "primary_button" | "dual_button" | "inline_link";
  spacingDensity: "compact" | "comfortable" | "airy";
  sectionBandStyle: "none" | "light" | "accent" | "dark";
  trustSignalStyle: "none" | "badge_strip" | "rating_row" | "logo_row";
  preferredNativePrimitives: ThriveVisualPrimitive[];
};
export type SiteForgeVisualDesignTokens = {
  headingScale: "balanced_saas" | "bold_marketing";
  bodyScale: "comfortable" | "compact";
  sectionSpacing: "mobile_first_spacious" | "standard";
  cardRadiusShadowLevel: "soft_depth" | "flat_clean";
  buttonHierarchy: "primary_strong_secondary_ghost" | "single_primary";
  accentBackgroundContrast: "high_contrast_clear_cta" | "soft_contrast";
  trustSectionStyling: "logo_badge_with_soft_band" | "minimal";
  appProductVisualEmphasis: "screenshot_forward" | "copy_forward";
  maxTextDensityPerSection: "tight" | "moderate";
};
export type ThriveRenderTarget =
  | "wordpress_page_content"
  | "thrive_symbol_reference"
  | "thrive_content_template_reference"
  | "future_thrive_template_assignment"
  | "future_landing_page_candidate"
  | "wp_html_fallback";

export type QAWarning = {
  code: string;
  message: string;
  field?: string;
};

export type QAError = {
  code: string;
  message: string;
  field?: string;
};

export type QAResult = {
  isValid: boolean;
  warnings: QAWarning[];
  errors: QAError[];
  recommendations: string[];
};

export type ExecutionActionLog = {
  at: string;
  action: string;
  success: boolean;
  detail: string;
  payload?: Record<string, unknown>;
};

export type ExecutionPageRecord = {
  title: string;
  slug: string;
  pageId: number | null;
  url: string | null;
  status: "created" | "updated" | "failed";
  error?: string;
  intent?: PageIntent;
  decision?: "reused_existing" | "created_new";
  decisionReason?: string;
  matchedPage?: {
    id: number | null;
    slug: string;
    title: string;
    status?: string;
  } | null;
};

export type ExecutionResult = {
  success: boolean;
  createdPages: ExecutionPageRecord[];
  homepage: {
    success: boolean;
    pageId: number | null;
    message: string;
    title?: string | null;
    reason?: string;
  };
  menu: {
    success: boolean;
    menuId: number | null;
    message: string;
  };
  thrive: {
    enabled: boolean;
    appliedMappings: string[];
    fallbackUsed: boolean;
    executionMode: "wp_safe_mode" | "future_thrive_native_mode";
    buildModeUsed?: "thrive_native" | "thrive_fallback" | "wordpress_fallback";
    buildModeReason?: string | null;
    intelligenceAvailable: boolean;
    symbolInventoryPresent: boolean;
    intelligence: ThriveIntelligence | null;
    runtime: {
      wpSafeMode: boolean;
      thriveIntelMode: boolean;
      stagingNativeMode: boolean;
    };
    currentMode: "wp_safe_mode" | "thrive_intel_mode" | "thrive_native_staging_mode" | "blocked_native_mode";
    nativeGuard: ThriveNativeGuardStatus | null;
    nativeComposition: ThriveNativeCompositionPlan | null;
    nativeExecution: ThriveNativeExecutionResult | null;
    nativeValidation: ThriveNativeValidationResult | null;
    sectionResolutions: ThriveSectionResolution[];
  };
  actionLog: ExecutionActionLog[];
  warnings: string[];
  errors: string[];
  discovery?: {
    source: "wordpress";
    frontPageId: number | null;
    frontPageTitle: string | null;
    pages: Array<{
      id: number;
      slug: string;
      title: string;
      status: string;
      url: string | null;
    }>;
  };
  reconciliation?: {
    homepageStrategy: HomepageStrategyMode;
    decisions: Array<{
      slug: string;
      intent: PageIntent;
      decision: "reused_existing" | "created_new";
      targetPageId: number | null;
      reason: string;
    }>;
  };
};

export type RevisionRequest = {
  message: string;
};

export type RevisionOperation = {
  pageSlug: string;
  sectionType?: BuildSpecSection["type"];
  operation: "replace_text" | "append_section" | "rewrite_page" | "adjust_tone";
  instructions: string;
};

export type BuildDelta = {
  summary: string;
  operations: RevisionOperation[];
};

export type RevisionExecutionResult = {
  success: boolean;
  updatedPages: ExecutionPageRecord[];
  warnings: string[];
  errors: string[];
};

export const homepageStrategyModes = [
  "use_existing",
  "replace_existing",
  "create_new",
  "draft_only",
] as const;

export type HomepageStrategyMode = (typeof homepageStrategyModes)[number];

export type ConnectionProfile = {
  id: string;
  label: string;
  baseUrl: string;
  username: string;
  appPassword?: string;
  hasThriveHint?: boolean;
  lastValidatedAt?: string | null;
};

export type CapabilityCheckResult = {
  connected: boolean;
  canWritePages: boolean;
  canManageSettings: boolean;
  thriveDetected: boolean;
  thriveSignals: string[];
  message: string;
};

export type ThriveSymbolRole = "header" | "footer" | "section" | "unknown";

export type ThriveSymbolIntelligence = {
  id: number;
  title: string;
  slug: string;
  taxonomy: {
    slug: string | null;
    name: string | null;
  };
  inferredRole: ThriveSymbolRole;
  reusable: boolean;
  hasBuilderContent: boolean;
  hasCustomCss: boolean;
  contentHash?: string | null;
  cssHash?: string | null;
  keywords?: string[];
};

export type ThriveSectionResolution = {
  pageSlug: string;
  sectionId: string;
  sectionType: BuildSpecSection["type"];
  sectionIntent: NonNullable<BuildSpecSection["metadata"]>["sectionIntent"];
  symbolCandidateType: NonNullable<BuildSpecSection["metadata"]>["symbolCandidateType"];
  preferredRenderTarget: ThriveRenderTarget;
  resolution: "existing_symbol" | "existing_content_template" | "future_landing_page_candidate" | "wp_html_fallback";
  visualPattern: VisualPattern;
  selectedVisualPrimitive: ThriveVisualPrimitive;
  primitiveSelectionSource: "existing_reusable_symbol" | "existing_compatible_primitive" | "native_create_contract" | "safe_fallback";
  designIntentSatisfied: boolean;
  fallbackReason: string | null;
  matchedSymbolId: number | null;
  matchedSymbolTitle: string | null;
  matchedRole: ThriveSymbolRole | null;
  confidence: number;
  reason: string;
  rejectedReasons: string[];
};

export type ThriveIntelligence = {
  storageMode?: "wordpress-rest-readonly";
  namespaces?: string[];
  source: "wordpress_rest_get";
  collectedAt: string;
  mode: "wp_safe_mode";
  homepage?: {
    showOnFront: string;
    pageOnFront: number | null;
    pageForPosts: number | null;
  };
  activeSkin: {
    id: number;
    name: string;
    slug: string;
    tag: string | null;
    isActive?: boolean;
  } | null;
  templates?: Array<{
    id: number;
    slug: string;
    title: string;
  }>;
  layouts?: Array<{
    id: number;
    slug: string;
    title: string;
  }>;
  sections?: Array<{
    id: number;
    slug: string;
    title: string;
  }>;
  symbolInventory: ThriveSymbolIntelligence[];
  symbolSummary: {
    total: number;
    headers: number;
    footers: number;
    sections: number;
    unknown: number;
  };
  primitiveCounts: {
    thriveTemplate: number;
    thriveLayout: number;
    thriveSection: number;
    tcbSymbol: number;
  };
  safeHints: {
    frontPageUsesWpSettings: boolean;
  };
  discoveredCapabilities?: {
    hasTtbNamespace: boolean;
    hasTcbNamespace: boolean;
    hasThemeNamespace: boolean;
    hasTdNamespace: boolean;
    hasTveDashNamespace: boolean;
    designPackLikelyAvailable: boolean;
  };
  warnings: string[];
};

export type ThriveNativeOperation =
  | "assignTemplateToPost"
  | "createOrUpdateSymbol"
  | "createOrUpdateSection"
  | "createOrUpdateTemplateShellReference"
  | "attachReusablePrimitiveToPagePlan"
  | "importArchitectContentArtifact"
  | "importThemeBuilderArtifact";

export type ThriveNativeGuardStatus = {
  eligible: boolean;
  blockedReason: string | null;
  environment: "test" | "development" | "production";
  nativeTargetMode: "blocked" | "approved_non_production_target" | "unapproved_target";
  targetClassification: "approved_non_production_target" | "unapproved_target" | "unknown_target";
  nativeTargetEligibility: "eligible" | "blocked";
  approvedTargetHost: string | null;
  approvalSource: "env_allowlist" | "project_policy" | "unknown" | null;
  connectionHost: string;
  allowlistedOperations: ThriveNativeOperation[];
  routeAllowlist: string[];
  schemaContractVersion: string | null;
};

export type ThriveNativeCompositionSection = {
  pageSlug: string;
  sectionId: string;
  sectionType: BuildSpecSection["type"];
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
  selectedOperation: ThriveNativeOperation | null;
  targetObjectType: "thrive_template" | "thrive_section" | "tcb_symbol" | "attachment" | "none";
  matchedSymbolId: number | null;
  visualPattern?: VisualPattern;
  visualPrimitive?: ThriveVisualPrimitive;
  designIntentSatisfied?: boolean;
  fallbackReason?: string | null;
  reason: string;
};

export type ThriveNativeCompositionPlan = {
  mode: "thrive_native_staging_mode" | "blocked_native_mode";
  homepagePostId: number | null;
  shellTemplateGroupCandidate: string | null;
  shellLayoutCandidate: string | null;
  operations: Array<{
    operation: ThriveNativeOperation;
    objectType: "thrive_template" | "thrive_section" | "tcb_symbol" | "attachment";
    payload: Record<string, unknown>;
    payloadHash: string;
    reason: string;
  }>;
  sections: ThriveNativeCompositionSection[];
  summary: {
    reusedExisting: number;
    createdNative: number;
    wpFallback: number;
    blockedByGuard: number;
    blockedByMissingContract: number;
  };
};

export type ThriveNativeExecutionStepResult = {
  operation: ThriveNativeOperation;
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
};

export type ThriveNativeExecutionResult = {
  executedAt: string;
  success: boolean;
  mode: "thrive_native_staging_mode" | "blocked_native_mode";
  steps: ThriveNativeExecutionStepResult[];
  createdObjects: Array<{
    objectType: "thrive_template" | "thrive_section" | "tcb_symbol";
    id: number;
    sourceOperation: ThriveNativeOperation;
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
};

export type ThriveNativeValidationSectionOutcome = {
  pageSlug: string;
  sectionId: string;
  sectionType: BuildSpecSection["type"];
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
  operation: ThriveNativeOperation | null;
  targetId: number | null;
  visualPattern?: VisualPattern;
  visualPrimitive?: ThriveVisualPrimitive;
  designIntentSatisfied?: boolean;
  fallbackReason?: string | null;
  reason: string;
};

export type ThriveNativeRenderabilityStatus =
  | "render_ok"
  | "wp_404"
  | "wrong_target_url"
  | "redirect_mismatch"
  | "network_failure"
  | "template_assignment_incomplete"
  | "front_page_mismatch"
  | "unknown_render_failure";

export type ThriveNativeValidationResult = {
  runId: string;
  mode: "dry_run" | "real_run";
  startedAt: string;
  completedAt: string;
  status: "passed" | "failed" | "blocked";
  guard: ThriveNativeGuardStatus;
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
  sectionOutcomes: ThriveNativeValidationSectionOutcome[];
  verification: {
    stepsTotal: number;
    verifiedSteps: number;
    failedSteps: number;
    pageReachable: boolean;
    pageIdentityOk: boolean;
    objectStateOk: boolean;
    renderability: {
      status: ThriveNativeRenderabilityStatus;
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
  execution: ThriveNativeExecutionResult | null;
  rollback: ThriveNativeExecutionResult["rollback"] | null;
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
};

export type BuildRunState = {
  currentStage: BuildStage;
  progressPct: number;
  timeline: Array<{
    at: string;
    stage: BuildStage;
    message: string;
    level: "info" | "warning" | "error";
  }>;
};

export type BuildSessionStatus = "queued" | "running" | "completed" | "failed";
export type BuildSessionType = "generate" | "refine";
export type BuildTriggerSource = "user" | "resume" | "system";

export type BuildSession = {
  id: string;
  projectId: string;
  userId: string;
  connectionId: string | null;
  type: BuildSessionType;
  triggerSource: BuildTriggerSource;
  prompt: string;
  websiteBrief: WebsiteBrief | null;
  generationSource: "user_key" | "platform_key" | "deterministic_fallback";
  aiModel: string | null;
  marketIntelligence: MarketIntelligenceBrief | null;
  websiteStrategy?: WebsiteStrategy | null;
  connectionProfile: Omit<ConnectionProfile, "appPassword"> | null;
  status: BuildSessionStatus;
  runState: BuildRunState;
  sitePlan: SitePlan | null;
  contentPackage: ContentPackage | null;
  buildSpec: BuildSpec | null;
  qaResult: QAResult | null;
  executionResult: ExecutionResult | null;
  revisionHistory: Array<{
    id: string;
    at: string;
    request: RevisionRequest;
    delta: BuildDelta;
    qa: QAResult;
    execution: RevisionExecutionResult;
  }>;
  errorSummary: string | null;
  startedAt: string;
  completedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteForgeProjectStatus = "draft" | "active" | "archived";

export type SiteForgeProject = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  status: SiteForgeProjectStatus;
  siteType: string | null;
  primaryPrompt: string | null;
  websiteBrief?: WebsiteBrief | null;
  currentState: string;
  homepageStrategy: HomepageStrategyMode;
  aiProvider?: "openai" | null;
  aiModel?: string | null;
  aiSecretRef?: string | null;
  hasSavedAiSecret?: boolean;
  serpApiProvider?: "serpapi" | null;
  serpApiSecretRef?: string | null;
  hasSavedSerpApiSecret?: boolean;
  lastOpenedAt: string | null;
  description: string;
  latestSessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionValidationStatus = "not_validated" | "valid" | "invalid";

export type StoredConnectionSecret = {
  ref: string;
  cipherText: string;
};

export type StoredAiSecret = {
  ref: string;
  cipherText: string;
};

export type SiteForgeConnection = {
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
  lastValidationStatus: ConnectionValidationStatus;
  createdAt: string;
  updatedAt: string;
};

export type SiteForgeRunLog = {
  logId: string;
  sessionId: string;
  stage: BuildStage;
  message: string;
  level: "info" | "warning" | "error";
  timestamp: string;
};

export type SiteForgeSnapshot = {
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
    intent?: PageIntent;
    source?: "existing" | "created" | "reused";
    decision?: "reused_existing" | "created_new";
  }>;
  knownMenus: Array<{ id: number | null; label: string; source: string }>;
  thriveDetected: boolean;
  thriveIntelligence: ThriveIntelligence | null;
  thriveSectionResolutions: ThriveSectionResolution[];
  thriveModeSummary: {
    wpSafeMode: boolean;
    thriveIntelMode: boolean;
    stagingNativeMode: boolean;
  };
  thriveNativeGuard: ThriveNativeGuardStatus | null;
  thriveNativeComposition: ThriveNativeCompositionPlan | null;
  thriveNativeExecution: ThriveNativeExecutionResult | null;
  thriveNativeValidation: ThriveNativeValidationResult | null;
  marketIntelligence: MarketIntelligenceBrief | null;
  homepageStrategy: HomepageStrategyMode;
  lastRunSummary: string | null;
  lastRunStatus: BuildSessionStatus | null;
  pagesAffected: number;
  lastSyncedAt: string;
};

export type SiteForgeWorkspace = {
  project: SiteForgeProject;
  activeConnection: SiteForgeConnection | null;
  snapshot: SiteForgeSnapshot | null;
  latestRun: BuildSession | null;
  runHistory: BuildSession[];
  runLogs: SiteForgeRunLog[];
};

export type RetryDirective = {
  retryable: boolean;
  reason: string;
};

export type OrchestratorInput = {
  prompt: string;
  connection: ConnectionProfile | null;
};

export type OrchestratorOutput = {
  sitePlan: SitePlan;
  contentPackage: ContentPackage;
  buildSpec: BuildSpec;
  qaResult: QAResult;
  executionResult: ExecutionResult | null;
};
