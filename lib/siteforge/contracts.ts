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
    themeArtifactRef?: string | null;
    architectContentArtifactRef?: string | null;
    landingPageArtifactRef?: string | null;
    designPackArtifactRef?: string | null;
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
    themeArtifactRef?: string | null;
    architectContentArtifactRef?: string | null;
    landingPageArtifactRef?: string | null;
    designPackArtifactRef?: string | null;
    createdAt: string;
  };
};

export type PageIntent = "homepage" | "about" | "contact" | "faq" | "features" | "pricing" | "generic";
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
    intelligenceAvailable: boolean;
    symbolInventoryPresent: boolean;
    intelligence: ThriveIntelligence | null;
    runtime: {
      wpSafeMode: boolean;
      thriveIntelMode: boolean;
      stagingNativeMode: boolean;
    };
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
  matchedSymbolId: number | null;
  matchedSymbolTitle: string | null;
  matchedRole: ThriveSymbolRole | null;
  confidence: number;
  reason: string;
  rejectedReasons: string[];
};

export type ThriveIntelligence = {
  source: "wordpress_rest_get";
  collectedAt: string;
  mode: "wp_safe_mode";
  activeSkin: {
    id: number;
    name: string;
    slug: string;
    tag: string | null;
  } | null;
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
  warnings: string[];
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
