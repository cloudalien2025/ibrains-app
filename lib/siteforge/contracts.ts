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
  metadata?: Record<string, unknown>;
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
    createdAt: string;
  };
};

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
};

export type ExecutionResult = {
  success: boolean;
  createdPages: ExecutionPageRecord[];
  homepage: {
    success: boolean;
    pageId: number | null;
    message: string;
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
  };
  actionLog: ExecutionActionLog[];
  warnings: string[];
  errors: string[];
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

export type BuildSession = {
  id: string;
  projectId: string;
  userId: string;
  prompt: string;
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
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteForgeProject = {
  id: string;
  userId: string;
  name: string;
  description: string;
  latestSessionId: string | null;
  createdAt: string;
  updatedAt: string;
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
