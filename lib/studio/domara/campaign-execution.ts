export type CasaHudApprovalStatus = "pending" | "approved";

export type CasaHudRenderStatus = "not_started" | "queued" | "rendering" | "rendered" | "failed" | "blocked";
export type CasaHudPublishStatus = "not_ready" | "ready" | "publishing" | "published" | "failed" | "blocked";
export type CasaHudScheduleStatus = "not_scheduled" | "scheduling" | "scheduled" | "failed" | "blocked";

export type CasaHudRenderOutputType = "mp4" | "preview_package" | "queued_job";
export type CasaHudExecutionProvider = "ffmpeg_local" | "preview_package" | "youtube_channel" | "youtube_unavailable";
export type CasaHudExecutionProviderState =
  | "connected"
  | "needs_connection"
  | "queued"
  | "unavailable"
  | "degraded"
  | "error";

export type CasaHudExecutionProviderStatus = {
  provider: CasaHudExecutionProvider;
  state: CasaHudExecutionProviderState;
  detail: string;
  externalRef?: string;
};

export type CasaHudRenderOutput = {
  id: string;
  type: CasaHudRenderOutputType;
  status: CasaHudRenderStatus;
  url: string | null;
  path: string | null;
  durationSeconds: number | null;
  format: string | null;
  createdAt: string;
  provider: CasaHudExecutionProvider;
  metadata: Record<string, string | number | boolean | null>;
  warnings: string[];
};

export type CasaHudExecutionRunType = "render" | "publish" | "schedule";
export type CasaHudExecutionRunStatus =
  | CasaHudRenderStatus
  | CasaHudPublishStatus
  | CasaHudScheduleStatus
  | "completed"
  | "running";

export type CasaHudExecutionRun = {
  id: string;
  type: CasaHudExecutionRunType;
  status: CasaHudExecutionRunStatus;
  startedAt: string;
  completedAt?: string;
  provider: CasaHudExecutionProvider;
  message: string;
  error?: string;
  resultRef?: string;
};

export type CasaHudExecutionData = {
  approvalStatus: CasaHudApprovalStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  renderStatus: CasaHudRenderStatus;
  renderJobId: string | null;
  renderOutput: CasaHudRenderOutput | null;
  renderOutputUrl: string | null;
  renderOutputPath: string | null;
  renderProviderStatus: CasaHudExecutionProviderStatus | null;
  renderWarnings: string[];
  renderErrors: string[];
  renderRunHistory: CasaHudExecutionRun[];
  publishStatus: CasaHudPublishStatus;
  publishedVideoId: string | null;
  publishedVideoUrl: string | null;
  publishProviderStatus: CasaHudExecutionProviderStatus | null;
  publishWarnings: string[];
  publishErrors: string[];
  publishRunHistory: CasaHudExecutionRun[];
  scheduleStatus: CasaHudScheduleStatus;
  scheduledPublishAt: string | null;
  scheduleProviderStatus: CasaHudExecutionProviderStatus | null;
  scheduleWarnings: string[];
  scheduleErrors: string[];
  scheduleRunHistory: CasaHudExecutionRun[];
  executionRunHistory: CasaHudExecutionRun[];
  finalState: "review_pending" | "approved" | "render_ready" | "rendered" | "published" | "scheduled" | "blocked";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isApprovalStatus(value: unknown): value is CasaHudApprovalStatus {
  return value === "pending" || value === "approved";
}

function isRenderStatus(value: unknown): value is CasaHudRenderStatus {
  return (
    value === "not_started" ||
    value === "queued" ||
    value === "rendering" ||
    value === "rendered" ||
    value === "failed" ||
    value === "blocked"
  );
}

function isPublishStatus(value: unknown): value is CasaHudPublishStatus {
  return value === "not_ready" || value === "ready" || value === "publishing" || value === "published" || value === "failed" || value === "blocked";
}

function isScheduleStatus(value: unknown): value is CasaHudScheduleStatus {
  return value === "not_scheduled" || value === "scheduling" || value === "scheduled" || value === "failed" || value === "blocked";
}

function isRenderOutputType(value: unknown): value is CasaHudRenderOutputType {
  return value === "mp4" || value === "preview_package" || value === "queued_job";
}

function isExecutionProvider(value: unknown): value is CasaHudExecutionProvider {
  return value === "ffmpeg_local" || value === "preview_package" || value === "youtube_channel" || value === "youtube_unavailable";
}

function isExecutionProviderState(value: unknown): value is CasaHudExecutionProviderState {
  return (
    value === "connected" ||
    value === "needs_connection" ||
    value === "queued" ||
    value === "unavailable" ||
    value === "degraded" ||
    value === "error"
  );
}

function isExecutionProviderStatus(value: unknown): value is CasaHudExecutionProviderStatus {
  return (
    isRecord(value) &&
    isExecutionProvider(value.provider) &&
    isExecutionProviderState(value.state) &&
    isNonEmptyString(value.detail) &&
    (value.externalRef === undefined || isNonEmptyString(value.externalRef))
  );
}

function isExecutionRunType(value: unknown): value is CasaHudExecutionRunType {
  return value === "render" || value === "publish" || value === "schedule";
}

function isExecutionRunStatus(value: unknown): value is CasaHudExecutionRunStatus {
  return (
    value === "completed" ||
    value === "running" ||
    isRenderStatus(value) ||
    isPublishStatus(value) ||
    isScheduleStatus(value)
  );
}

function isExecutionRun(value: unknown): value is CasaHudExecutionRun {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isExecutionRunType(value.type) &&
    isExecutionRunStatus(value.status) &&
    isNonEmptyString(value.startedAt) &&
    isExecutionProvider(value.provider) &&
    isNonEmptyString(value.message) &&
    (value.completedAt === undefined || isNonEmptyString(value.completedAt)) &&
    (value.error === undefined || isNonEmptyString(value.error)) &&
    (value.resultRef === undefined || isNonEmptyString(value.resultRef))
  );
}

function isRenderOutput(value: unknown): value is CasaHudRenderOutput {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isRenderOutputType(value.type) &&
    isRenderStatus(value.status) &&
    isNonEmptyString(value.createdAt) &&
    isExecutionProvider(value.provider) &&
    isRecord(value.metadata) &&
    isStringArray(value.warnings) &&
    (value.url === null || value.url === undefined || isNonEmptyString(value.url)) &&
    (value.path === null || value.path === undefined || isNonEmptyString(value.path)) &&
    (value.durationSeconds === null || value.durationSeconds === undefined || isFiniteNumber(value.durationSeconds)) &&
    (value.format === null || value.format === undefined || isNonEmptyString(value.format))
  );
}

function isFinalState(value: unknown): value is CasaHudExecutionData["finalState"] {
  return (
    value === "review_pending" ||
    value === "approved" ||
    value === "render_ready" ||
    value === "rendered" ||
    value === "published" ||
    value === "scheduled" ||
    value === "blocked"
  );
}

export function createEmptyCasaHudExecutionData(): CasaHudExecutionData {
  return {
    approvalStatus: "pending",
    approvedAt: null,
    approvedBy: null,
    renderStatus: "not_started",
    renderJobId: null,
    renderOutput: null,
    renderOutputUrl: null,
    renderOutputPath: null,
    renderProviderStatus: null,
    renderWarnings: [],
    renderErrors: [],
    renderRunHistory: [],
    publishStatus: "not_ready",
    publishedVideoId: null,
    publishedVideoUrl: null,
    publishProviderStatus: null,
    publishWarnings: [],
    publishErrors: [],
    publishRunHistory: [],
    scheduleStatus: "not_scheduled",
    scheduledPublishAt: null,
    scheduleProviderStatus: null,
    scheduleWarnings: [],
    scheduleErrors: [],
    scheduleRunHistory: [],
    executionRunHistory: [],
    finalState: "review_pending",
  };
}

export function parseCasaHudExecutionData(campaign: Record<string, unknown>): CasaHudExecutionData {
  const renderOutput = isRenderOutput(campaign.renderOutput) ? campaign.renderOutput : null;
  const renderRunHistory = Array.isArray(campaign.renderRunHistory)
    ? campaign.renderRunHistory.filter((item): item is CasaHudExecutionRun => isExecutionRun(item))
    : [];
  const publishRunHistory = Array.isArray(campaign.publishRunHistory)
    ? campaign.publishRunHistory.filter((item): item is CasaHudExecutionRun => isExecutionRun(item))
    : [];
  const scheduleRunHistory = Array.isArray(campaign.scheduleRunHistory)
    ? campaign.scheduleRunHistory.filter((item): item is CasaHudExecutionRun => isExecutionRun(item))
    : [];
  const executionRunHistory = Array.isArray(campaign.executionRunHistory)
    ? campaign.executionRunHistory.filter((item): item is CasaHudExecutionRun => isExecutionRun(item))
    : [...renderRunHistory, ...publishRunHistory, ...scheduleRunHistory];

  const renderStatus = isRenderStatus(campaign.renderStatus)
    ? campaign.renderStatus
    : renderOutput
      ? renderOutput.status
      : "not_started";
  const publishStatus = isPublishStatus(campaign.publishStatus)
    ? campaign.publishStatus
    : isNonEmptyString(campaign.publishedVideoId) || isNonEmptyString(campaign.publishedVideoUrl)
      ? "published"
      : "not_ready";
  const scheduleStatus = isScheduleStatus(campaign.scheduleStatus)
    ? campaign.scheduleStatus
    : isNonEmptyString(campaign.scheduledPublishAt)
      ? "scheduled"
      : "not_scheduled";

  const finalState = isFinalState(campaign.finalState)
    ? campaign.finalState
    : publishStatus === "published"
      ? "published"
      : scheduleStatus === "scheduled"
        ? "scheduled"
        : renderStatus === "rendered"
          ? "rendered"
          : renderStatus === "blocked"
            ? "blocked"
            : isApprovalStatus(campaign.approvalStatus) && campaign.approvalStatus === "approved"
              ? "approved"
              : renderStatus === "not_started"
                ? "review_pending"
                : "render_ready";

  return {
    approvalStatus: isApprovalStatus(campaign.approvalStatus) ? campaign.approvalStatus : "pending",
    approvedAt: isNonEmptyString(campaign.approvedAt) ? campaign.approvedAt : null,
    approvedBy: isNonEmptyString(campaign.approvedBy) ? campaign.approvedBy : null,
    renderStatus,
    renderJobId: isNonEmptyString(campaign.renderJobId) ? campaign.renderJobId : null,
    renderOutput,
    renderOutputUrl: isNonEmptyString(campaign.renderOutputUrl) ? campaign.renderOutputUrl : renderOutput?.url ?? null,
    renderOutputPath: isNonEmptyString(campaign.renderOutputPath) ? campaign.renderOutputPath : renderOutput?.path ?? null,
    renderProviderStatus: isExecutionProviderStatus(campaign.renderProviderStatus) ? campaign.renderProviderStatus : null,
    renderWarnings: isStringArray(campaign.renderWarnings) ? campaign.renderWarnings : [],
    renderErrors: isStringArray(campaign.renderErrors) ? campaign.renderErrors : [],
    renderRunHistory,
    publishStatus,
    publishedVideoId: isNonEmptyString(campaign.publishedVideoId) ? campaign.publishedVideoId : null,
    publishedVideoUrl: isNonEmptyString(campaign.publishedVideoUrl) ? campaign.publishedVideoUrl : null,
    publishProviderStatus: isExecutionProviderStatus(campaign.publishProviderStatus) ? campaign.publishProviderStatus : null,
    publishWarnings: isStringArray(campaign.publishWarnings) ? campaign.publishWarnings : [],
    publishErrors: isStringArray(campaign.publishErrors) ? campaign.publishErrors : [],
    publishRunHistory,
    scheduleStatus,
    scheduledPublishAt: isNonEmptyString(campaign.scheduledPublishAt) ? campaign.scheduledPublishAt : null,
    scheduleProviderStatus: isExecutionProviderStatus(campaign.scheduleProviderStatus) ? campaign.scheduleProviderStatus : null,
    scheduleWarnings: isStringArray(campaign.scheduleWarnings) ? campaign.scheduleWarnings : [],
    scheduleErrors: isStringArray(campaign.scheduleErrors) ? campaign.scheduleErrors : [],
    scheduleRunHistory,
    executionRunHistory,
    finalState,
  };
}
