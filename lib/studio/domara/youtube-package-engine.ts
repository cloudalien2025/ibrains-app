import { stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import {
  createEmptyCasaHudYouTubePackageData,
  type CasaHudPreviewPackage,
  type CasaHudPublishMetadataDraft,
  type CasaHudRenderPlan,
  type CasaHudRenderPlanScene,
  type CasaHudReviewFinding,
  type CasaHudReviewStatus,
  type CasaHudThumbnailConcept,
  type CasaHudYouTubeChapter,
  type CasaHudYouTubePackageData,
} from "@/lib/studio/domara/campaign-youtube-package";
import type { CasaHudCampaign, CasaHudValidatedListing } from "@/lib/studio/domara/campaigns";
import { deriveCasaHudWorkingListings } from "@/lib/studio/domara/listing-working-set";

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
}

function orderedWorkingListings(campaign: CasaHudCampaign): CasaHudValidatedListing[] {
  const rankMap = new Map(campaign.listingRankOrder.map((id, index) => [id, index]));
  return [...deriveCasaHudWorkingListings(campaign)].sort((left, right) => {
    const leftRank = rankMap.get(left.id) ?? left.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankMap.get(right.id) ?? right.rank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return right.overallScore - left.overallScore;
  });
}

function takeExcerpt(input: string, maxLength = 180) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function toTimestamp(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildFinalTitle(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]) {
  const baseTitle = campaign.selectedViralTitle.trim();
  const listingCount = listings.length;
  const weakSupport = (campaign.titleSupportConfidence ?? 0) < 80 || campaign.scriptWarnings.length > 0;
  if (!weakSupport) {
    return {
      finalTitle: baseTitle,
      titleRationale:
        "The selected viral title already stays aligned with the current shortlist, location story, and current media coverage, so CasaFlix kept the promise intact rather than forcing a cosmetic rewrite.",
    };
  }

  const evidenceSuffix = `${listingCount} Real Listing${listingCount === 1 ? "" : "s"} Reviewed`;
  const finalTitle = baseTitle.endsWith("?") ? `${baseTitle} ${evidenceSuffix}` : `${baseTitle} | ${evidenceSuffix}`;
  return {
    finalTitle,
    titleRationale:
      "CasaFlix kept the original click angle but added an evidence-first framing cue because title support or script warnings suggest the package should signal real shortlist coverage more explicitly.",
  };
}

function buildDescription(campaign: CasaHudCampaign, finalTitle: string, listings: CasaHudValidatedListing[]) {
  const featuredListings = listings
    .slice(0, 3)
    .map((listing) => {
      const supportedFacts = [
        listing.price && listing.currency ? `${listing.currency} ${listing.price.toLocaleString("en-US")}` : null,
        listing.propertyType || null,
        listing.city || null,
      ];
      return `${listing.title} (${supportedFacts.filter(Boolean).join(" • ")})`;
    })
    .join("; ");

  const sections = [
    `In this video, CasaFlix follows the title promise behind "${finalTitle}" using the current shortlist and location story rather than generic relocation claims.`,
    campaign.scriptSummary || campaign.researchBrief.summary,
    featuredListings ? `Featured properties: ${featuredListings}.` : null,
    campaign.locationStory?.summary || campaign.locationIntelligenceSummary?.coverageSummary || null,
    campaign.reviewStatus === "blocked"
      ? null
      : "This package is still reviewed for truthfulness and visual coverage before any render or publish step moves forward.",
  ].filter(Boolean);

  return sections.join("\n\n");
}

function buildTags(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]) {
  const leadListing = listings[0];
  return uniqueStrings([
    "CasaFlix",
    campaign.marketRegionHint,
    campaign.selectedTitle.regionHint,
    campaign.campaignType.replace(/_/g, " "),
    leadListing?.city,
    leadListing?.region,
    leadListing?.propertyType,
    "real estate",
    "property video",
    "relocation",
  ]).slice(0, 10);
}

function buildHashtags(campaign: CasaHudCampaign) {
  return uniqueStrings([
    "#CasaFlix",
    "#RealEstate",
    "#PropertyVideo",
    campaign.campaignType === "lifestyle_relocation" ? "#Relocation" : "#LuxuryHomes",
    campaign.marketRegionHint?.toLowerCase().includes("italy") ? "#ItalyRealEstate" : null,
    campaign.marketRegionHint ? `#${campaign.marketRegionHint.replace(/[^a-z0-9]+/gi, "")}` : null,
  ]).slice(0, 6);
}

function buildChapters(campaign: CasaHudCampaign): CasaHudYouTubeChapter[] {
  let elapsed = 0;
  return campaign.scriptSegments.map((segment) => {
    const chapter = {
      id: stableCasaHudId("casahud-youtube-chapter", `${campaign.id}:${segment.id}:chapter`),
      startTimeSeconds: elapsed,
      title: segment.title,
      summary: takeExcerpt(segment.narration, 120),
      associatedSegmentIds: [segment.id],
    };
    elapsed += segment.durationSeconds;
    return chapter;
  });
}

function buildThumbnailConcept(campaign: CasaHudCampaign, finalTitle: string): CasaHudThumbnailConcept | null {
  const leadCandidate = campaign.thumbnailCandidateInputs[0];
  const leadListing = orderedWorkingListings(campaign)[0];
  if (!leadCandidate && !leadListing) return null;

  return {
    headline: leadCandidate?.title || "Editorial lead-property frame",
    visualDirection:
      leadCandidate?.rationale ||
      "Use the lead approved property and the strongest place cue so the frame feels premium, specific, and truthfully tied to the script.",
    textOverlay: leadCandidate?.textOverlayIdea || finalTitle,
    primaryAssetIds: leadCandidate?.associatedAssetIds || [],
    compositionNotes:
      leadCandidate?.compositionNotes ||
      "Keep the hero property dominant, leave room for restrained text, and avoid overpromising with collage-heavy framing.",
    emotionalHook:
      campaign.locationStory?.headline ||
      campaign.confidenceReasoning.titleOpportunitySummary ||
      "Make the viewer feel the place promise before they parse the listing details.",
    warnings: uniqueStrings([
      ...(leadCandidate?.warnings || []),
      leadCandidate && leadCandidate.associatedAssetIds.length === 0
        ? "No primary media asset is attached to the current thumbnail direction yet."
        : null,
    ]),
  };
}

function buildPublishMetadataDraft(
  finalTitle: string,
  youtubeDescription: string,
  youtubeTags: string[],
  youtubeHashtags: string[],
  chapters: CasaHudYouTubeChapter[],
  thumbnailConcept: CasaHudThumbnailConcept | null,
): CasaHudPublishMetadataDraft {
  return {
    title: finalTitle,
    description: youtubeDescription,
    tags: youtubeTags,
    hashtags: youtubeHashtags,
    chapters: chapters.map((chapter) => `${toTimestamp(chapter.startTimeSeconds)} ${chapter.title}`),
    thumbnailTextOverlay: thumbnailConcept?.textOverlay || finalTitle,
    audienceHook: "Keep the metadata specific, believable, and tightly aligned with the verified property and location package.",
    packageNote: "Prepared for review before any render, publish, or scheduling action.",
  };
}

function buildPackagingSummary(campaign: CasaHudCampaign, finalTitle: string, chapters: CasaHudYouTubeChapter[]) {
  const listings = orderedWorkingListings(campaign);
  return `A review-ready YouTube package built around "${finalTitle}", ${listings.length} shortlist listing${listings.length === 1 ? "" : "s"}, ${chapters.length} chapter${chapters.length === 1 ? "" : "s"}, and the current media plan.`;
}

function buildPackageWarnings(campaign: CasaHudCampaign, thumbnailConcept: CasaHudThumbnailConcept | null) {
  return uniqueStrings([
    ...campaign.scriptWarnings,
    ...campaign.validationWarnings,
    ...campaign.missingMediaWarnings,
    (campaign.titleSupportConfidence ?? 0) < 80
      ? "Title support confidence is below the strongest range, so the final metadata should stay conservative about the title promise."
      : null,
    thumbnailConcept?.warnings[0] || null,
  ]);
}

function buildReviewFindings(
  campaign: CasaHudCampaign,
  finalTitle: string,
  description: string,
  chapters: CasaHudYouTubeChapter[],
  thumbnailConcept: CasaHudThumbnailConcept | null,
  packageWarnings: string[],
): CasaHudReviewFinding[] {
  const findings: CasaHudReviewFinding[] = [];
  const missingScenes = campaign.sceneAssetMapping.filter((scene) => scene.coverageStatus === "missing").length;
  const placeholderScenes = campaign.sceneAssetMapping.filter((scene) =>
    scene.assignedAssetIds.some((assetId) => campaign.visualAssets.find((asset) => asset.id === assetId)?.type === "fallback_placeholder"),
  ).length;

  if ((campaign.titleSupportConfidence ?? 0) < 75) {
    findings.push({
      id: stableCasaHudId("casahud-review-finding", `${campaign.id}:title-truthfulness`),
      severity: "warning",
      category: "title_truthfulness",
      headline: "Title support is thinner than ideal",
      detail: `The final title "${finalTitle}" still leans on a promise that scored ${Math.round(campaign.titleSupportConfidence ?? 0)} for title support.`,
      recommendedFix: "Keep the packaging language evidence-first and avoid adding stronger claims in the description or thumbnail.",
    });
  }

  if (campaign.scriptWarnings.length > 0) {
    findings.push({
      id: stableCasaHudId("casahud-review-finding", `${campaign.id}:unsupported-claims`),
      severity: "warning",
      category: "unsupported_claims",
      headline: "Script warnings remain visible",
      detail: campaign.scriptWarnings[0],
      recommendedFix: "Tighten the phrasing around the flagged claim before render planning moves forward.",
    });
  }

  if (campaign.rejectedListings.length > 0) {
    findings.push({
      id: stableCasaHudId("casahud-review-finding", `${campaign.id}:weak-listings`),
      severity: "info",
      category: "weak_listings",
      headline: "Rejected listings remain outside the package",
      detail: `${campaign.rejectedListings.length} listing${campaign.rejectedListings.length === 1 ? "" : "s"} were excluded because they weakened the title promise or data support.`,
      recommendedFix: "Keep the default package focused on the current shortlist.",
    });
  }

  if (missingScenes > 0 || placeholderScenes > 0 || campaign.missingMediaWarnings.length > 0) {
    findings.push({
      id: stableCasaHudId("casahud-review-finding", `${campaign.id}:visual-gaps`),
      severity: missingScenes > 0 ? "blocker" : "warning",
      category: "visual_gaps",
      headline: missingScenes > 0 ? "Scene coverage is incomplete" : "Visual coverage is still thin in places",
      detail:
        missingScenes > 0
          ? `${missingScenes} script scene${missingScenes === 1 ? "" : "s"} still have missing asset coverage.`
          : `${placeholderScenes} scene${placeholderScenes === 1 ? "" : "s"} still rely on placeholders or thin media coverage.`,
      recommendedFix: "Strengthen listing media or reduce the number of scenes that depend on placeholder coverage before render.",
    });
  }

  if (description.length < 220 || chapters.length < 3) {
    findings.push({
      id: stableCasaHudId("casahud-review-finding", `${campaign.id}:metadata-quality`),
      severity: "warning",
      category: "metadata_quality",
      headline: "Metadata depth is still a little thin",
      detail: "The current package could use a fuller description or a more complete chapter structure before final review.",
      recommendedFix: "Expand the description with the strongest listing and location proof points, and keep the chapter flow aligned to the script.",
    });
  }

  if (thumbnailConcept?.warnings.length) {
    findings.push({
      id: stableCasaHudId("casahud-review-finding", `${campaign.id}:thumbnail-alignment`),
      severity: "warning",
      category: "thumbnail_alignment",
      headline: "Thumbnail concept still has media constraints",
      detail: thumbnailConcept.warnings[0],
      recommendedFix: "Use the strongest current hero asset or simplify the concept until better media is available.",
    });
  }

  if (packageWarnings.length === 0 && findings.length === 0) {
    findings.push({
      id: stableCasaHudId("casahud-review-finding", `${campaign.id}:script-package-consistency`),
      severity: "info",
      category: "script_package_consistency",
      headline: "Package stays aligned with the shortlist narrative",
      detail: "The title, metadata, thumbnail direction, and scene plan remain aligned with the script and current shortlist.",
    });
  }

  return findings;
}

function buildReviewState(findings: CasaHudReviewFinding[]) {
  const blockers = findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.detail);
  const warnings = findings.filter((finding) => finding.severity === "warning").map((finding) => finding.detail);
  const recommendedFixes = uniqueStrings(findings.map((finding) => finding.recommendedFix));

  const status: CasaHudReviewStatus =
    blockers.length > 0 ? "blocked" : warnings.length > 0 ? "needs_revision" : findings.length > 0 ? "ready_for_review" : "not_started";

  return { status, blockers, warnings, recommendedFixes };
}

function buildReadinessScore(campaign: CasaHudCampaign, findings: CasaHudReviewFinding[]) {
  let score = 100;
  const support = campaign.titleSupportConfidence ?? 80;
  if (support < 85) score -= Math.min(25, Math.round((85 - support) / 2));
  score -= findings.filter((finding) => finding.severity === "warning").length * 8;
  score -= findings.filter((finding) => finding.severity === "blocker").length * 18;
  score -= campaign.sceneAssetMapping.filter((scene) => scene.coverageStatus === "partial").length * 3;
  score -= campaign.sceneAssetMapping.filter((scene) => scene.coverageStatus === "missing").length * 10;
  return Math.max(0, Math.min(100, score));
}

function buildReadinessExplanation(status: CasaHudReviewStatus, score: number, blockers: string[], warnings: string[]) {
  if (status === "blocked") {
    return `Blocked from render handoff for now. CasaFlix found ${blockers.length} blocker${blockers.length === 1 ? "" : "s"} that should be resolved before the package moves forward.`;
  }
  if (status === "needs_revision") {
    return `The package is close, but ${warnings.length} warning${warnings.length === 1 ? "" : "s"} still need editorial tightening before final review. Current readiness: ${score}/100.`;
  }
  if (status === "ready_for_review") {
    return `The package is review-ready with a readiness score of ${score}/100 and no blocking truthfulness or render issues detected in the current pass.`;
  }
  return "The package has not been prepared yet.";
}

function buildRenderPlan(
  campaign: CasaHudCampaign,
  packageFields: {
    youtubeDescription: string;
    youtubeChapters: CasaHudYouTubeChapter[];
    thumbnailConcept: CasaHudThumbnailConcept | null;
  },
  finalTitle: string,
  reviewWarnings: string[],
  reviewBlockers: string[],
): { renderPlan: CasaHudRenderPlan; previewPackage: CasaHudPreviewPackage; renderWarnings: string[]; renderBlockers: string[] } {
  const scenes: CasaHudRenderPlanScene[] = campaign.scriptSegments.map((segment, index) => {
    const mapping = campaign.sceneAssetMapping.find((scene) => scene.segmentId === segment.id);
    const assetIds = mapping?.assignedAssetIds || [];
    const placeholderOnly =
      assetIds.length > 0 &&
      assetIds.every((assetId) => campaign.visualAssets.find((asset) => asset.id === assetId)?.type === "fallback_placeholder");
    const status = assetIds.length === 0 ? "blocked" : mapping?.coverageStatus === "strong" && !placeholderOnly ? "ready" : "warning";
    return {
      id: stableCasaHudId("casahud-render-scene", `${campaign.id}:${segment.id}:render-scene`),
      order: index + 1,
      sceneTitle: segment.title,
      segmentId: segment.id,
      durationSeconds: segment.durationSeconds,
      narrationExcerpt: takeExcerpt(segment.narration, 140),
      assetIds,
      status,
      notes: uniqueStrings([
        mapping?.visualPurpose,
        ...(mapping?.warnings || []),
        placeholderOnly ? "This scene still relies on placeholder media." : null,
      ]),
    };
  });

  const requiredAssets = uniqueStrings([
    ...scenes.flatMap((scene) => scene.assetIds),
    ...(packageFields.thumbnailConcept?.primaryAssetIds || []),
  ]);
  const missingAssets = scenes.filter((scene) => scene.assetIds.length === 0).map((scene) => `scene:${scene.segmentId}`);
  const renderBlockers = uniqueStrings([
    ...reviewBlockers,
    missingAssets.length > 0
      ? `${missingAssets.length} render scene${missingAssets.length === 1 ? "" : "s"} still have no assigned assets.`
      : null,
  ]);
  const renderWarnings = uniqueStrings([
    ...reviewWarnings,
    ...scenes.filter((scene) => scene.status === "warning").flatMap((scene) => scene.notes),
  ]);
  const estimatedDurationSeconds =
    campaign.estimatedDurationSeconds || campaign.scriptSegments.reduce((total, segment) => total + segment.durationSeconds, 0);
  const assetReadinessSummary =
    renderBlockers.length > 0
      ? "Render planning is blocked until missing scene coverage is resolved."
      : renderWarnings.length > 0
        ? "Render planning is assembled, but some scenes still rely on partial or placeholder coverage."
        : "All planned scenes have usable asset assignments for the current render draft.";

  const renderPlan: CasaHudRenderPlan = {
    id: stableCasaHudId("casahud-render-plan", `${campaign.id}:render-plan`),
    status: "render_plan_ready",
    estimatedDurationSeconds,
    sceneCount: scenes.length,
    scenes,
    requiredAssets,
    missingAssets,
    assetReadinessSummary,
    audioPlanPlaceholder: "Narration, music, and final audio treatment remain part of the Phase 10 execution layer.",
    outputFormatDraft: "16:9 landscape YouTube master, draft MP4 output plan held for the render phase.",
    warnings: renderWarnings,
  };

  const previewPackage: CasaHudPreviewPackage = {
    finalTitle,
    descriptionPreview: takeExcerpt(packageFields.youtubeDescription || campaign.scriptSummary || campaign.researchBrief.summary, 180),
    chapterCount: packageFields.youtubeChapters.length,
    sceneCount: scenes.length,
    estimatedDurationSeconds,
    thumbnailHeadline: packageFields.thumbnailConcept?.headline || "Thumbnail concept pending",
    assetReadinessSummary,
  };

  return { renderPlan, previewPackage, renderWarnings, renderBlockers };
}

export function runCasaHudYouTubePackageReview(campaign: CasaHudCampaign): CasaHudYouTubePackageData {
  const listings = orderedWorkingListings(campaign);
  if (
    listings.length === 0 ||
    campaign.scriptGenerationStatus !== "script_generated" ||
    campaign.mediaPlanningStatus !== "media_plan_built"
  ) {
    return createEmptyCasaHudYouTubePackageData();
  }

  const { finalTitle, titleRationale } = buildFinalTitle(campaign, listings);
  const youtubeDescription = buildDescription(campaign, finalTitle, listings);
  const youtubeTags = buildTags(campaign, listings);
  const youtubeHashtags = buildHashtags(campaign);
  const youtubeChapters = buildChapters(campaign);
  const thumbnailConcept = buildThumbnailConcept(campaign, finalTitle);
  const publishMetadataDraft = buildPublishMetadataDraft(
    finalTitle,
    youtubeDescription,
    youtubeTags,
    youtubeHashtags,
    youtubeChapters,
    thumbnailConcept,
  );
  const packagingSummary = buildPackagingSummary(campaign, finalTitle, youtubeChapters);
  const packageWarnings = buildPackageWarnings(campaign, thumbnailConcept);
  const reviewFindings = buildReviewFindings(campaign, finalTitle, youtubeDescription, youtubeChapters, thumbnailConcept, packageWarnings);
  const reviewState = buildReviewState(reviewFindings);
  const readinessScore = buildReadinessScore(campaign, reviewFindings);
  const readinessExplanation = buildReadinessExplanation(
    reviewState.status,
    readinessScore,
    reviewState.blockers,
    reviewState.warnings,
  );

  const { renderPlan, previewPackage, renderWarnings, renderBlockers } = buildRenderPlan(
    campaign,
    {
      youtubeDescription,
      youtubeChapters,
      thumbnailConcept,
    },
    finalTitle,
    reviewState.warnings,
    reviewState.blockers,
  );

  return {
    youtubePackageStatus: "package_prepared",
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
    packageProviderStatus: {
      provider: "casahud_package_patterns",
      label: "CasaFlix packaging patterns",
      state: "fallback",
      configured: true,
      used: true,
      detail: "Using deterministic CasaFlix packaging, review, and render-plan composition.",
    },
    reviewStatus: reviewState.status,
    reviewSummary:
      reviewState.status === "blocked"
        ? "The package is coherent, but CasaFlix found blockers that should be resolved before final render review."
        : reviewState.status === "needs_revision"
          ? "The package is mostly assembled, but CasaFlix recommends tightening claims or coverage before final review."
          : "The package is aligned enough to move into a human review pass before render execution.",
    reviewFindings,
    reviewBlockers: reviewState.blockers,
    reviewWarnings: reviewState.warnings,
    recommendedFixes: reviewState.recommendedFixes,
    readinessScore,
    readinessExplanation,
    renderPlanStatus: "render_plan_ready",
    renderPlan,
    previewPackage,
    renderBlockers,
    renderWarnings,
  };
}
