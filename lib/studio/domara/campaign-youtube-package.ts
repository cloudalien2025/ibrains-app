export type CasaHudYouTubePackageStatus = "not_started" | "package_prepared";
export type CasaHudReviewStatus = "not_started" | "ready_for_review" | "needs_revision" | "blocked";
export type CasaHudRenderPlanStatus = "not_started" | "render_plan_ready";

export type CasaHudPackageProvider = "openai" | "casahud_package_patterns";
export type CasaHudPackageProviderState = "connected" | "fallback" | "error";

export type CasaHudPackageProviderStatus = {
  provider: CasaHudPackageProvider;
  label: string;
  state: CasaHudPackageProviderState;
  configured: boolean;
  used: boolean;
  detail: string;
  warning?: string;
};

export type CasaHudYouTubeChapter = {
  id: string;
  startTimeSeconds: number;
  title: string;
  summary: string;
  associatedSegmentIds: string[];
};

export type CasaHudThumbnailConcept = {
  headline: string;
  visualDirection: string;
  textOverlay: string;
  primaryAssetIds: string[];
  compositionNotes: string;
  emotionalHook: string;
  warnings: string[];
};

export type CasaHudPublishMetadataDraft = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: string[];
  thumbnailTextOverlay: string;
  audienceHook: string;
  packageNote: string;
};

export type CasaHudReviewFindingSeverity = "info" | "warning" | "blocker";
export type CasaHudReviewFindingCategory =
  | "title_truthfulness"
  | "unsupported_claims"
  | "weak_listings"
  | "visual_gaps"
  | "metadata_quality"
  | "thumbnail_alignment"
  | "script_package_consistency";

export type CasaHudReviewFinding = {
  id: string;
  severity: CasaHudReviewFindingSeverity;
  category: CasaHudReviewFindingCategory;
  headline: string;
  detail: string;
  recommendedFix?: string;
};

export type CasaHudRenderSceneStatus = "ready" | "warning" | "blocked";

export type CasaHudRenderPlanScene = {
  id: string;
  order: number;
  sceneTitle: string;
  segmentId: string;
  durationSeconds: number;
  narrationExcerpt: string;
  assetIds: string[];
  status: CasaHudRenderSceneStatus;
  notes: string[];
};

export type CasaHudRenderPlan = {
  id: string;
  status: CasaHudRenderPlanStatus;
  estimatedDurationSeconds: number;
  sceneCount: number;
  scenes: CasaHudRenderPlanScene[];
  requiredAssets: string[];
  missingAssets: string[];
  assetReadinessSummary: string;
  audioPlanPlaceholder: string;
  outputFormatDraft: string;
  warnings: string[];
};

export type CasaHudPreviewPackage = {
  finalTitle: string;
  descriptionPreview: string;
  chapterCount: number;
  sceneCount: number;
  estimatedDurationSeconds: number;
  thumbnailHeadline: string;
  assetReadinessSummary: string;
};

export type CasaHudYouTubePackageData = {
  youtubePackageStatus: CasaHudYouTubePackageStatus;
  finalTitle: string | null;
  titleRationale: string | null;
  youtubeDescription: string | null;
  youtubeTags: string[];
  youtubeHashtags: string[];
  youtubeChapters: CasaHudYouTubeChapter[];
  thumbnailConcept: CasaHudThumbnailConcept | null;
  publishMetadataDraft: CasaHudPublishMetadataDraft | null;
  packagingSummary: string | null;
  packageWarnings: string[];
  packageProviderStatus: CasaHudPackageProviderStatus | null;
  reviewStatus: CasaHudReviewStatus;
  reviewSummary: string | null;
  reviewFindings: CasaHudReviewFinding[];
  reviewBlockers: string[];
  reviewWarnings: string[];
  recommendedFixes: string[];
  readinessScore: number | null;
  readinessExplanation: string | null;
  renderPlanStatus: CasaHudRenderPlanStatus;
  renderPlan: CasaHudRenderPlan | null;
  previewPackage: CasaHudPreviewPackage | null;
  renderBlockers: string[];
  renderWarnings: string[];
};

export type CasaHudCampaignFuturePackagingState = {
  status: CasaHudYouTubePackageStatus;
  finalTitle?: string;
  summary?: string;
  generatedAt?: string;
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

function isYouTubePackageStatus(value: unknown): value is CasaHudYouTubePackageStatus {
  return value === "not_started" || value === "package_prepared";
}

function isReviewStatus(value: unknown): value is CasaHudReviewStatus {
  return value === "not_started" || value === "ready_for_review" || value === "needs_revision" || value === "blocked";
}

function isRenderPlanStatus(value: unknown): value is CasaHudRenderPlanStatus {
  return value === "not_started" || value === "render_plan_ready";
}

function isPackageProvider(value: unknown): value is CasaHudPackageProvider {
  return value === "openai" || value === "casahud_package_patterns";
}

function isPackageProviderState(value: unknown): value is CasaHudPackageProviderState {
  return value === "connected" || value === "fallback" || value === "error";
}

function isPackageProviderStatus(value: unknown): value is CasaHudPackageProviderStatus {
  return (
    isRecord(value) &&
    isPackageProvider(value.provider) &&
    isNonEmptyString(value.label) &&
    isPackageProviderState(value.state) &&
    typeof value.configured === "boolean" &&
    typeof value.used === "boolean" &&
    isNonEmptyString(value.detail) &&
    (value.warning === undefined || isNonEmptyString(value.warning))
  );
}

function isYouTubeChapter(value: unknown): value is CasaHudYouTubeChapter {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.startTimeSeconds) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.summary) &&
    isStringArray(value.associatedSegmentIds)
  );
}

function isThumbnailConcept(value: unknown): value is CasaHudThumbnailConcept {
  return (
    isRecord(value) &&
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.visualDirection) &&
    isNonEmptyString(value.textOverlay) &&
    isStringArray(value.primaryAssetIds) &&
    isNonEmptyString(value.compositionNotes) &&
    isNonEmptyString(value.emotionalHook) &&
    isStringArray(value.warnings)
  );
}

function isPublishMetadataDraft(value: unknown): value is CasaHudPublishMetadataDraft {
  return (
    isRecord(value) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isStringArray(value.tags) &&
    isStringArray(value.hashtags) &&
    isStringArray(value.chapters) &&
    isNonEmptyString(value.thumbnailTextOverlay) &&
    isNonEmptyString(value.audienceHook) &&
    isNonEmptyString(value.packageNote)
  );
}

function isReviewFindingSeverity(value: unknown): value is CasaHudReviewFindingSeverity {
  return value === "info" || value === "warning" || value === "blocker";
}

function isReviewFindingCategory(value: unknown): value is CasaHudReviewFindingCategory {
  return (
    value === "title_truthfulness" ||
    value === "unsupported_claims" ||
    value === "weak_listings" ||
    value === "visual_gaps" ||
    value === "metadata_quality" ||
    value === "thumbnail_alignment" ||
    value === "script_package_consistency"
  );
}

function isReviewFinding(value: unknown): value is CasaHudReviewFinding {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isReviewFindingSeverity(value.severity) &&
    isReviewFindingCategory(value.category) &&
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.detail) &&
    (value.recommendedFix === undefined || isNonEmptyString(value.recommendedFix))
  );
}

function isRenderSceneStatus(value: unknown): value is CasaHudRenderSceneStatus {
  return value === "ready" || value === "warning" || value === "blocked";
}

function isRenderPlanScene(value: unknown): value is CasaHudRenderPlanScene {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.order) &&
    isNonEmptyString(value.sceneTitle) &&
    isNonEmptyString(value.segmentId) &&
    isFiniteNumber(value.durationSeconds) &&
    isNonEmptyString(value.narrationExcerpt) &&
    isStringArray(value.assetIds) &&
    isRenderSceneStatus(value.status) &&
    isStringArray(value.notes)
  );
}

function isRenderPlan(value: unknown): value is CasaHudRenderPlan {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isRenderPlanStatus(value.status) &&
    isFiniteNumber(value.estimatedDurationSeconds) &&
    isFiniteNumber(value.sceneCount) &&
    Array.isArray(value.scenes) &&
    value.scenes.every((item) => isRenderPlanScene(item)) &&
    isStringArray(value.requiredAssets) &&
    isStringArray(value.missingAssets) &&
    isNonEmptyString(value.assetReadinessSummary) &&
    isNonEmptyString(value.audioPlanPlaceholder) &&
    isNonEmptyString(value.outputFormatDraft) &&
    isStringArray(value.warnings)
  );
}

function isPreviewPackage(value: unknown): value is CasaHudPreviewPackage {
  return (
    isRecord(value) &&
    isNonEmptyString(value.finalTitle) &&
    isNonEmptyString(value.descriptionPreview) &&
    isFiniteNumber(value.chapterCount) &&
    isFiniteNumber(value.sceneCount) &&
    isFiniteNumber(value.estimatedDurationSeconds) &&
    isNonEmptyString(value.thumbnailHeadline) &&
    isNonEmptyString(value.assetReadinessSummary)
  );
}

export function createEmptyCasaHudYouTubePackageData(): CasaHudYouTubePackageData {
  return {
    youtubePackageStatus: "not_started",
    finalTitle: null,
    titleRationale: null,
    youtubeDescription: null,
    youtubeTags: [],
    youtubeHashtags: [],
    youtubeChapters: [],
    thumbnailConcept: null,
    publishMetadataDraft: null,
    packagingSummary: null,
    packageWarnings: [],
    packageProviderStatus: null,
    reviewStatus: "not_started",
    reviewSummary: null,
    reviewFindings: [],
    reviewBlockers: [],
    reviewWarnings: [],
    recommendedFixes: [],
    readinessScore: null,
    readinessExplanation: null,
    renderPlanStatus: "not_started",
    renderPlan: null,
    previewPackage: null,
    renderBlockers: [],
    renderWarnings: [],
  };
}

export function buildCasaHudFuturePackagingState(
  data: Pick<CasaHudYouTubePackageData, "youtubePackageStatus" | "finalTitle" | "packagingSummary">,
): CasaHudCampaignFuturePackagingState | null {
  if (data.youtubePackageStatus !== "package_prepared") return null;
  return {
    status: data.youtubePackageStatus,
    finalTitle: data.finalTitle || undefined,
    summary: data.packagingSummary || undefined,
  };
}

export function parseCasaHudYouTubePackageData(campaign: Record<string, unknown>): CasaHudYouTubePackageData {
  const finalTitle = isNonEmptyString(campaign.finalTitle) ? campaign.finalTitle : null;
  const titleRationale = isNonEmptyString(campaign.titleRationale) ? campaign.titleRationale : null;
  const youtubeDescription = isNonEmptyString(campaign.youtubeDescription) ? campaign.youtubeDescription : null;
  const youtubeTags = isStringArray(campaign.youtubeTags) ? campaign.youtubeTags : [];
  const youtubeHashtags = isStringArray(campaign.youtubeHashtags) ? campaign.youtubeHashtags : [];
  const youtubeChapters = Array.isArray(campaign.youtubeChapters)
    ? campaign.youtubeChapters.filter((item): item is CasaHudYouTubeChapter => isYouTubeChapter(item))
    : [];
  const thumbnailConcept = isThumbnailConcept(campaign.thumbnailConcept) ? campaign.thumbnailConcept : null;
  const publishMetadataDraft = isPublishMetadataDraft(campaign.publishMetadataDraft) ? campaign.publishMetadataDraft : null;
  const packagingSummary = isNonEmptyString(campaign.packagingSummary) ? campaign.packagingSummary : null;
  const packageWarnings = isStringArray(campaign.packageWarnings) ? campaign.packageWarnings : [];
  const packageProviderStatus = isPackageProviderStatus(campaign.packageProviderStatus) ? campaign.packageProviderStatus : null;
  const reviewSummary = isNonEmptyString(campaign.reviewSummary) ? campaign.reviewSummary : null;
  const reviewFindings = Array.isArray(campaign.reviewFindings)
    ? campaign.reviewFindings.filter((item): item is CasaHudReviewFinding => isReviewFinding(item))
    : [];
  const reviewBlockers = isStringArray(campaign.reviewBlockers) ? campaign.reviewBlockers : [];
  const reviewWarnings = isStringArray(campaign.reviewWarnings) ? campaign.reviewWarnings : [];
  const recommendedFixes = isStringArray(campaign.recommendedFixes) ? campaign.recommendedFixes : [];
  const readinessScore = isFiniteNumber(campaign.readinessScore) ? campaign.readinessScore : null;
  const readinessExplanation = isNonEmptyString(campaign.readinessExplanation) ? campaign.readinessExplanation : null;
  const renderPlan = isRenderPlan(campaign.renderPlan) ? campaign.renderPlan : null;
  const previewPackage = isPreviewPackage(campaign.previewPackage) ? campaign.previewPackage : null;
  const renderBlockers = isStringArray(campaign.renderBlockers) ? campaign.renderBlockers : [];
  const renderWarnings = isStringArray(campaign.renderWarnings) ? campaign.renderWarnings : [];

  const youtubePackageStatus = isYouTubePackageStatus(campaign.youtubePackageStatus)
    ? campaign.youtubePackageStatus
    : finalTitle ||
        titleRationale ||
        youtubeDescription ||
        youtubeTags.length > 0 ||
        youtubeHashtags.length > 0 ||
        youtubeChapters.length > 0 ||
        thumbnailConcept ||
        publishMetadataDraft ||
        packagingSummary
      ? "package_prepared"
      : "not_started";

  const reviewStatus = isReviewStatus(campaign.reviewStatus)
    ? campaign.reviewStatus
    : reviewSummary || reviewFindings.length > 0 || reviewBlockers.length > 0 || reviewWarnings.length > 0
      ? reviewBlockers.length > 0
        ? "blocked"
        : reviewWarnings.length > 0
          ? "needs_revision"
          : "ready_for_review"
      : "not_started";

  const renderPlanStatus = isRenderPlanStatus(campaign.renderPlanStatus)
    ? campaign.renderPlanStatus
    : renderPlan || previewPackage
      ? "render_plan_ready"
      : "not_started";

  return {
    youtubePackageStatus,
    finalTitle,
    titleRationale,
    youtubeDescription,
    youtubeTags,
    youtubeHashtags,
    youtubeChapters,
    thumbnailConcept,
    publishMetadataDraft,
    packagingSummary,
    packageWarnings,
    packageProviderStatus,
    reviewStatus,
    reviewSummary,
    reviewFindings,
    reviewBlockers,
    reviewWarnings,
    recommendedFixes,
    readinessScore,
    readinessExplanation,
    renderPlanStatus,
    renderPlan,
    previewPackage,
    renderBlockers,
    renderWarnings,
  };
}
