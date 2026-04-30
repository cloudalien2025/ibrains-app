import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type {
  CasaHudCampaign,
  CasaHudListingCandidate,
  CasaHudValidatedListing,
} from "@/lib/studio/domara/campaigns";
import type {
  CasaHudExecutionData,
  CasaHudExecutionProviderStatus,
  CasaHudExecutionRun,
  CasaHudPublishStatus,
  CasaHudRenderOutput,
  CasaHudScheduleStatus,
} from "@/lib/studio/domara/campaign-execution";
import { createDomaraRenderPlan, type DomaraRenderStyle } from "@/lib/studio/domara/render-plan";
import { renderDomaraPropertyVideo } from "@/lib/studio/domara/video-renderer";

const execFileAsync = promisify(execFile);

export type CasaHudYouTubeExecutionContext = {
  connected: boolean;
  uploadAvailable: boolean;
  providerStatus: CasaHudExecutionProviderStatus;
};

type RenderAgentResult = {
  ok: boolean;
  httpStatus: number;
  message: string;
  execution: CasaHudExecutionData;
};

type PublishAgentResult = {
  ok: boolean;
  httpStatus: number;
  message: string;
  execution: CasaHudExecutionData;
};

type ScheduleAgentResult = {
  ok: boolean;
  httpStatus: number;
  message: string;
  execution: CasaHudExecutionData;
};

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function cloneExecution(campaign: CasaHudCampaign): CasaHudExecutionData {
  return {
    approvalStatus: campaign.approvalStatus,
    approvedAt: campaign.approvedAt,
    approvedBy: campaign.approvedBy,
    renderStatus: campaign.renderStatus,
    renderJobId: campaign.renderJobId,
    renderOutput: campaign.renderOutput ? { ...campaign.renderOutput, metadata: { ...campaign.renderOutput.metadata }, warnings: [...campaign.renderOutput.warnings] } : null,
    renderOutputUrl: campaign.renderOutputUrl,
    renderOutputPath: campaign.renderOutputPath,
    renderProviderStatus: campaign.renderProviderStatus ? { ...campaign.renderProviderStatus } : null,
    renderWarnings: [...campaign.renderWarnings],
    renderErrors: [...campaign.renderErrors],
    renderRunHistory: [...campaign.renderRunHistory],
    publishStatus: campaign.publishStatus,
    publishedVideoId: campaign.publishedVideoId,
    publishedVideoUrl: campaign.publishedVideoUrl,
    publishProviderStatus: campaign.publishProviderStatus ? { ...campaign.publishProviderStatus } : null,
    publishWarnings: [...campaign.publishWarnings],
    publishErrors: [...campaign.publishErrors],
    publishRunHistory: [...campaign.publishRunHistory],
    scheduleStatus: campaign.scheduleStatus,
    scheduledPublishAt: campaign.scheduledPublishAt,
    scheduleProviderStatus: campaign.scheduleProviderStatus ? { ...campaign.scheduleProviderStatus } : null,
    scheduleWarnings: [...campaign.scheduleWarnings],
    scheduleErrors: [...campaign.scheduleErrors],
    scheduleRunHistory: [...campaign.scheduleRunHistory],
    executionRunHistory: [...campaign.executionRunHistory],
    finalState: campaign.finalState,
  };
}

function appendRun(history: CasaHudExecutionRun[], run: CasaHudExecutionRun): CasaHudExecutionRun[] {
  return [run, ...history.filter((item) => item.id !== run.id)].slice(0, 25);
}

function applyRun(execution: CasaHudExecutionData, run: CasaHudExecutionRun): CasaHudExecutionData {
  const updated = {
    ...execution,
    executionRunHistory: appendRun(execution.executionRunHistory, run),
  };

  if (run.type === "render") {
    updated.renderRunHistory = appendRun(execution.renderRunHistory, run);
  } else if (run.type === "publish") {
    updated.publishRunHistory = appendRun(execution.publishRunHistory, run);
  } else {
    updated.scheduleRunHistory = appendRun(execution.scheduleRunHistory, run);
  }

  return updated;
}

function deriveFinalState(execution: CasaHudExecutionData): CasaHudExecutionData["finalState"] {
  if (execution.publishStatus === "published") return "published";
  if (execution.scheduleStatus === "scheduled") return "scheduled";
  if (execution.renderStatus === "blocked" || execution.publishStatus === "blocked" || execution.scheduleStatus === "blocked") {
    return "blocked";
  }
  if (execution.renderStatus === "rendered") return "rendered";
  if (execution.approvalStatus === "approved") return "approved";
  if (execution.renderStatus === "queued" || execution.renderStatus === "rendering") return "render_ready";
  return "review_pending";
}

function markApproved(execution: CasaHudExecutionData, requestedBy?: string | null): CasaHudExecutionData {
  if (execution.approvalStatus === "approved") return execution;
  const approvedAt = nowIso();
  return {
    ...execution,
    approvalStatus: "approved",
    approvedAt,
    approvedBy: requestedBy?.trim() || execution.approvedBy || "studio_operator",
  };
}

function leadListing(campaign: CasaHudCampaign): CasaHudValidatedListing | CasaHudListingCandidate | null {
  return campaign.approvedListings[0] || campaign.listingCandidates[0] || null;
}

function toListingProvider(
  provider: CasaHudValidatedListing["provider"] | CasaHudListingCandidate["provider"] | undefined,
): "manual" | "idealista" | "immobiliare" | "mock" {
  if (provider === "idealista") return "idealista";
  if (provider === "immobiliare") return "immobiliare";
  return "mock";
}

function buildRenderImageUrls(campaign: CasaHudCampaign): string[] {
  const assetUrls = campaign.visualAssets
    .filter((asset) => asset.availabilityStatus === "available" && typeof asset.sourceUrl === "string")
    .map((asset) => asset.sourceUrl as string);
  const listingUrls = campaign.approvedListings.flatMap((listing) => listing.imageUrls || []);
  const fallbackUrls = campaign.listingCandidates.flatMap((listing) => listing.imageUrls || []);

  return uniqueStrings([...assetUrls, ...listingUrls, ...fallbackUrls]).slice(0, 18);
}

function buildRenderStyle(campaign: CasaHudCampaign): DomaraRenderStyle {
  return campaign.campaignType === "single_property_showcase" ? "property_showcase" : "premium_listing";
}

function buildDomaraRenderRequest(campaign: CasaHudCampaign) {
  const listing = leadListing(campaign);
  const imageUrls = buildRenderImageUrls(campaign);
  const scenes =
    campaign.renderPlan?.scenes.map((scene) => ({
      order: scene.order,
      title: scene.sceneTitle,
      visualDirection:
        campaign.sceneAssetMapping.find((mapping) => mapping.sceneId === scene.id)?.visualPurpose ||
        "Use the strongest approved property and location imagery for this beat.",
      narration: scene.narrationExcerpt,
      overlayText: scene.sceneTitle,
      suggestedMedia: scene.assetIds,
      durationSeconds: scene.durationSeconds,
    })) ||
    campaign.scriptSegments.map((segment, index) => ({
      order: index + 1,
      title: segment.title,
      visualDirection: segment.visualNote || "Use the strongest available asset for this segment.",
      narration: segment.narration,
      overlayText: segment.title,
      suggestedMedia: [],
      durationSeconds: segment.durationSeconds,
    }));

  const plan = {
    id: stableCasaHudId("casahud-render-plan", `${campaign.id}:${campaign.updatedAt}`),
    channel: "Expat AI" as const,
    status: "draft_plan_ready" as const,
    listingSummary: campaign.packagingSummary || campaign.mediaPlanSummary || campaign.name,
    hook: campaign.openingHook || scenes[0]?.narration || campaign.name,
    scenes,
    narrationScript:
      campaign.fullScriptText ||
      scenes.map((scene) => `${scene.title}\n${scene.narration}`).join("\n\n") ||
      campaign.scriptSummary ||
      campaign.name,
    youtubeTitle: campaign.finalTitle || campaign.selectedViralTitle,
    youtubeDescription: campaign.youtubeDescription || campaign.scriptSummary || campaign.name,
    enrichmentSummary: campaign.locationStory?.summary || campaign.locationIntelligenceSummary?.coverageSummary || "Location context is included in the review package.",
    renderPlaceholder: {
      status: "pending_provider_connection" as const,
      nextStep: "Render the reviewed CasaFlix package into a final preview or MP4.",
      provider: "CasaFlix Render Agent",
    },
  };

  const listingInput = {
    listingUrl: listing?.sourceUrl,
    source: listing?.provider ? `CasaFlix ${listing.provider}` : "CasaFlix shortlist",
    provider: toListingProvider(listing?.provider),
    country: listing?.country || "Italy",
    city: listing?.city,
    region: listing?.region,
    title: listing?.title || campaign.finalTitle || campaign.name,
    description: listing?.descriptionSnippet || campaign.youtubeDescription || undefined,
    price:
      typeof listing?.price === "number"
        ? `${listing.currency || "EUR"} ${listing.price.toLocaleString("en-US")}`
        : undefined,
    propertyType: listing?.propertyType,
    bedrooms: listing?.bedrooms,
    bathrooms: listing?.bathrooms,
    squareMeters: listing?.sizeSqm,
    imageUrls,
    latitude: listing?.coordinates?.latitude,
    longitude: listing?.coordinates?.longitude,
  };

  return {
    plan,
    listingInput,
    stylePreset: buildRenderStyle(campaign),
  };
}

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { maxBuffer: 2 * 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function buildRun(
  campaignId: string,
  type: CasaHudExecutionRun["type"],
  provider: CasaHudExecutionRun["provider"],
  status: CasaHudExecutionRun["status"],
  message: string,
  error?: string,
  resultRef?: string,
): CasaHudExecutionRun {
  const startedAt = nowIso();
  return {
    id: stableCasaHudId("casahud-execution-run", `${campaignId}:${type}:${startedAt}:${status}:${message}`),
    type,
    status,
    startedAt,
    completedAt: startedAt,
    provider,
    message,
    error,
    resultRef,
  };
}

function previewRenderOutput(campaign: CasaHudCampaign, message: string, warnings: string[]): CasaHudRenderOutput {
  return {
    id: stableCasaHudId("casahud-render-output", `${campaign.id}:preview:${campaign.updatedAt}`),
    type: "preview_package",
    status: "rendered",
    url: null,
    path: null,
    durationSeconds: campaign.renderPlan?.estimatedDurationSeconds || campaign.estimatedDurationSeconds || null,
    format: "preview_package",
    createdAt: nowIso(),
    provider: "preview_package",
    metadata: {
      finalTitle: campaign.finalTitle || campaign.selectedViralTitle,
      sceneCount: campaign.renderPlan?.sceneCount || campaign.scriptSegments.length,
      readinessScore: campaign.readinessScore ?? null,
      message,
    },
    warnings,
  };
}

function publishReadyStatus(campaign: CasaHudCampaign, execution: CasaHudExecutionData): CasaHudPublishStatus {
  if (execution.publishStatus === "published") return execution.publishStatus;
  return execution.renderStatus === "rendered" && execution.renderOutput?.type === "mp4" ? "ready" : "not_ready";
}

export async function runCasaHudRenderAgent(
  campaign: CasaHudCampaign,
  params: { requestedBy?: string | null } = {},
): Promise<RenderAgentResult> {
  let execution = cloneExecution(campaign);

  if (execution.renderStatus === "queued" || execution.renderStatus === "rendering") {
    const message = "A render job is already in progress for this campaign.";
    const run = buildRun(campaign.id, "render", execution.renderProviderStatus?.provider || "preview_package", "blocked", message);
    execution.renderStatus = "blocked";
    execution.renderErrors = [];
    execution.renderWarnings = uniqueStrings([message, ...execution.renderWarnings]);
    execution.renderProviderStatus = execution.renderProviderStatus || { provider: "preview_package", state: "queued", detail: message };
    execution.finalState = deriveFinalState(execution);
    return { ok: false, httpStatus: 423, message, execution: applyRun(execution, run) };
  }

  if (!campaign.renderPlan && !campaign.previewPackage) {
    const message = "CasaFlix needs the Phase 9 render plan before it can start render execution.";
    const run = buildRun(campaign.id, "render", "preview_package", "blocked", message);
    execution.renderStatus = "blocked";
    execution.renderErrors = [message];
    execution.renderProviderStatus = { provider: "preview_package", state: "unavailable", detail: message };
    execution.finalState = deriveFinalState(execution);
    return { ok: false, httpStatus: 409, message, execution: applyRun(execution, run) };
  }

  if (campaign.reviewStatus === "blocked") {
    const message = campaign.reviewBlockers[0] || "CasaFlix review blockers must be cleared before render execution starts.";
    const run = buildRun(campaign.id, "render", "preview_package", "blocked", message);
    execution.renderStatus = "blocked";
    execution.renderErrors = uniqueStrings([message, ...campaign.reviewBlockers]);
    execution.renderProviderStatus = { provider: "preview_package", state: "unavailable", detail: message };
    execution.finalState = deriveFinalState(execution);
    return { ok: false, httpStatus: 409, message, execution: applyRun(execution, run) };
  }

  if (campaign.reviewStatus === "ready_for_review") {
    execution = markApproved(execution, params.requestedBy);
  }

  const renderWarnings = uniqueStrings([
    ...campaign.renderWarnings,
    ...(campaign.reviewStatus === "needs_revision"
      ? ["Review warnings are still open, so this render should be treated as a checked preview rather than publish-ready output."]
      : []),
  ]);

  const forcedPreview = campaign.renderBlockers.length > 0 || (campaign.renderPlan?.missingAssets.length || 0) > 0;
  if (forcedPreview || !(await ffmpegAvailable())) {
    const detail = forcedPreview
      ? "CasaFlix prepared a preview package because missing assets or render blockers still need attention before a final MP4 is safe."
      : "CasaFlix prepared a preview package because the local MP4 renderer is not available in this workspace.";
    const outputWarnings = uniqueStrings([
      detail,
      ...renderWarnings,
      ...campaign.renderBlockers,
      ...(campaign.renderPlan?.missingAssets.length
        ? [`${campaign.renderPlan.missingAssets.length} required asset${campaign.renderPlan.missingAssets.length === 1 ? "" : "s"} still need to be resolved before a full MP4 render.`]
        : []),
    ]);
    const output = previewRenderOutput(campaign, detail, outputWarnings);
    const run = buildRun(campaign.id, "render", "preview_package", "rendered", detail, undefined, output.id);

    execution.renderStatus = "rendered";
    execution.renderJobId = output.id;
    execution.renderOutput = output;
    execution.renderOutputUrl = null;
    execution.renderOutputPath = null;
    execution.renderProviderStatus = {
      provider: "preview_package",
      state: forcedPreview ? "degraded" : "unavailable",
      detail,
      externalRef: output.id,
    };
    execution.renderWarnings = outputWarnings;
    execution.renderErrors = [];
    execution.publishStatus = publishReadyStatus(campaign, execution);
    execution.finalState = deriveFinalState(execution);
    return { ok: true, httpStatus: 200, message: detail, execution: applyRun(execution, run) };
  }

  try {
    const renderRequest = buildDomaraRenderRequest(campaign);
    const renderPlan = createDomaraRenderPlan(renderRequest);
    const result = await renderDomaraPropertyVideo(renderPlan);
    const output: CasaHudRenderOutput = {
      id: result.renderId,
      type: "mp4",
      status: "rendered",
      url: result.downloadUrl,
      path: result.outputPath,
      durationSeconds: result.durationSeconds,
      format: "mp4",
      createdAt: result.generatedAt,
      provider: "ffmpeg_local",
      metadata: {
        filename: result.filename,
        sceneCount: result.sceneCount,
        imageCount: result.imageCount,
        skippedImageCount: result.skippedImageCount,
        stylePreset: result.stylePreset,
        audioIncluded: result.audioIncluded,
      },
      warnings: uniqueStrings([
        ...renderWarnings,
        ...(result.skippedImageCount > 0 ? [`${result.skippedImageCount} image asset${result.skippedImageCount === 1 ? "" : "s"} were skipped during render validation.`] : []),
      ]),
    };
    const message = `Render ready. "${campaign.name}" now has a final MP4 output.`;
    const run = buildRun(campaign.id, "render", "ffmpeg_local", "rendered", message, undefined, result.renderId);

    execution.renderStatus = "rendered";
    execution.renderJobId = result.renderId;
    execution.renderOutput = output;
    execution.renderOutputUrl = result.downloadUrl;
    execution.renderOutputPath = result.outputPath;
    execution.renderProviderStatus = {
      provider: "ffmpeg_local",
      state: "connected",
      detail: "CasaFlix rendered a final MP4 through the local FFmpeg render seam.",
      externalRef: result.renderId,
    };
    execution.renderWarnings = output.warnings;
    execution.renderErrors = [];
    execution.publishStatus = publishReadyStatus(campaign, execution);
    execution.finalState = deriveFinalState(execution);

    return { ok: true, httpStatus: 200, message, execution: applyRun(execution, run) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown rendering failure.";
    const message = "CasaFlix could not render the final video right now.";
    const run = buildRun(campaign.id, "render", "ffmpeg_local", "failed", message, detail);
    execution.renderStatus = "failed";
    execution.renderErrors = [detail];
    execution.renderProviderStatus = { provider: "ffmpeg_local", state: "error", detail };
    execution.finalState = deriveFinalState(execution);
    return { ok: false, httpStatus: 500, message: `${message} ${detail}`, execution: applyRun(execution, run) };
  }
}

function publishBlockedResult(
  campaign: CasaHudCampaign,
  execution: CasaHudExecutionData,
  providerStatus: CasaHudExecutionProviderStatus,
  status: CasaHudPublishStatus | CasaHudScheduleStatus,
  type: "publish" | "schedule",
  message: string,
  httpStatus: number,
  opts: { scheduledAt?: string | null; saveScheduleIntent?: boolean } = {},
): PublishAgentResult | ScheduleAgentResult {
  const run = buildRun(campaign.id, type, providerStatus.provider, status, message);
  const updated = { ...execution };

  if (type === "publish") {
    updated.publishStatus = status as CasaHudPublishStatus;
    updated.publishProviderStatus = providerStatus;
    updated.publishWarnings = uniqueStrings([message, ...updated.publishWarnings]);
    updated.publishErrors = providerStatus.state === "error" ? [message] : [];
  } else {
    updated.scheduleStatus = status as CasaHudScheduleStatus;
    updated.scheduleProviderStatus = providerStatus;
    updated.scheduleWarnings = uniqueStrings([message, ...updated.scheduleWarnings]);
    updated.scheduleErrors = providerStatus.state === "error" ? [message] : [];
    updated.scheduledPublishAt = opts.saveScheduleIntent ? opts.scheduledAt || null : updated.scheduledPublishAt;
  }

  updated.finalState = deriveFinalState(updated);
  return { ok: false, httpStatus, message, execution: applyRun(updated, run) };
}

export async function runCasaHudPublishAgent(
  campaign: CasaHudCampaign,
  youtube: CasaHudYouTubeExecutionContext,
): Promise<PublishAgentResult> {
  let execution = cloneExecution(campaign);

  if (execution.publishStatus === "publishing") {
    return publishBlockedResult(
      campaign,
      execution,
      execution.publishProviderStatus || youtube.providerStatus,
      "blocked",
      "publish",
      "A publish job is already in progress for this campaign.",
      423,
    ) as PublishAgentResult;
  }

  if (campaign.reviewStatus === "blocked" || campaign.reviewStatus === "needs_revision") {
    const message =
      campaign.reviewBlockers[0] ||
      campaign.reviewWarnings[0] ||
      "CasaFlix review findings still need attention before publishing can begin.";
    return publishBlockedResult(
      campaign,
      execution,
      { provider: "youtube_unavailable", state: "unavailable", detail: message },
      "blocked",
      "publish",
      message,
      409,
    ) as PublishAgentResult;
  }

  if (campaign.renderStatus !== "rendered" || campaign.renderOutput?.type !== "mp4") {
    return publishBlockedResult(
      campaign,
      execution,
      { provider: "youtube_unavailable", state: "unavailable", detail: "A final MP4 render is required before CasaFlix can publish to YouTube." },
      "not_ready",
      "publish",
      "A final MP4 render is required before CasaFlix can publish to YouTube.",
      409,
    ) as PublishAgentResult;
  }

  execution = markApproved(execution, campaign.approvedBy);
  execution.publishStatus = "ready";

  if (!youtube.connected) {
    return publishBlockedResult(campaign, execution, youtube.providerStatus, "blocked", "publish", youtube.providerStatus.detail, 503) as PublishAgentResult;
  }

  if (!youtube.uploadAvailable) {
    return publishBlockedResult(campaign, execution, youtube.providerStatus, "blocked", "publish", youtube.providerStatus.detail, 503) as PublishAgentResult;
  }

  return publishBlockedResult(
    campaign,
    execution,
    { provider: "youtube_unavailable", state: "unavailable", detail: "YouTube publishing is not implemented in this workspace." },
    "blocked",
    "publish",
    "YouTube publishing is not implemented in this workspace.",
    503,
  ) as PublishAgentResult;
}

export async function runCasaHudScheduleAgent(
  campaign: CasaHudCampaign,
  youtube: CasaHudYouTubeExecutionContext,
  scheduledAt: string,
): Promise<ScheduleAgentResult> {
  let execution = cloneExecution(campaign);

  if (execution.scheduleStatus === "scheduling") {
    return publishBlockedResult(
      campaign,
      execution,
      execution.scheduleProviderStatus || youtube.providerStatus,
      "blocked",
      "schedule",
      "A schedule request is already in progress for this campaign.",
      423,
    ) as ScheduleAgentResult;
  }

  if (campaign.reviewStatus === "blocked" || campaign.reviewStatus === "needs_revision") {
    const message =
      campaign.reviewBlockers[0] ||
      campaign.reviewWarnings[0] ||
      "CasaFlix review findings still need attention before scheduling can begin.";
    return publishBlockedResult(
      campaign,
      execution,
      { provider: "youtube_unavailable", state: "unavailable", detail: message },
      "blocked",
      "schedule",
      message,
      409,
      { scheduledAt, saveScheduleIntent: false },
    ) as ScheduleAgentResult;
  }

  if (campaign.renderStatus !== "rendered" || campaign.renderOutput?.type !== "mp4") {
    return publishBlockedResult(
      campaign,
      execution,
      { provider: "youtube_unavailable", state: "unavailable", detail: "A final MP4 render is required before CasaFlix can schedule to YouTube." },
      "blocked",
      "schedule",
      "A final MP4 render is required before CasaFlix can schedule to YouTube.",
      409,
      { scheduledAt, saveScheduleIntent: false },
    ) as ScheduleAgentResult;
  }

  execution = markApproved(execution, campaign.approvedBy);
  execution.publishStatus = "ready";

  if (!youtube.connected) {
    return publishBlockedResult(
      campaign,
      execution,
      youtube.providerStatus,
      "blocked",
      "schedule",
      youtube.providerStatus.detail,
      503,
      { scheduledAt, saveScheduleIntent: false },
    ) as ScheduleAgentResult;
  }

  if (!youtube.uploadAvailable) {
    const message = `${youtube.providerStatus.detail} CasaFlix saved the requested schedule intent, but nothing has been queued on YouTube yet.`;
    return publishBlockedResult(
      campaign,
      execution,
      youtube.providerStatus,
      "blocked",
      "schedule",
      message,
      503,
      { scheduledAt, saveScheduleIntent: true },
    ) as ScheduleAgentResult;
  }

  return publishBlockedResult(
    campaign,
    execution,
    { provider: "youtube_unavailable", state: "unavailable", detail: "YouTube scheduling is not implemented in this workspace." },
    "blocked",
    "schedule",
    "YouTube scheduling is not implemented in this workspace.",
    503,
    { scheduledAt, saveScheduleIntent: true },
  ) as ScheduleAgentResult;
}
