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
    }>;
    symbolSummary: { total: number; headers: number; footers: number; sections: number; unknown: number };
    primitiveCounts: { thriveTemplate: number; thriveLayout: number; thriveSection: number; tcbSymbol: number };
    safeHints: { frontPageUsesWpSettings: boolean };
    warnings: string[];
  } | null;
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
              }
            : {
                enabled: false,
                appliedMappings: [],
                fallbackUsed: false,
                executionMode: "wp_safe_mode",
                intelligenceAvailable: false,
                symbolInventoryPresent: false,
                intelligence: null,
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
