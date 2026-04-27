import {
  createCasaHudContentStrategy,
  discoverListingsForStrategy,
  enrichLocationsForListings,
  generateCasaHudTitleCandidates,
  generateCasaHudYouTubePackage,
  generateScriptPackage,
  generateStoryboardAndRenderPlan,
  validateListingsAgainstStrategy,
  type CasaHudListingDiscoveryProvider,
} from "@/lib/studio/domara/ai-channel-engine/agents";
import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudProductionRepository } from "@/lib/studio/domara/ai-channel-engine/repository";
import { createYouTubeResearchProvider, type CasaHudYouTubeResearchProvider } from "@/lib/studio/domara/ai-channel-engine/youtube-research-agent";
import type {
  CasaHudGenerateRequest,
  CasaHudGenerationRun,
  CasaHudOrchestratorOutput,
  CasaHudProject,
  CasaHudRunStatus,
  CasaHudStageName,
  CasaHudStageRecord,
  CasaHudStageStatus,
} from "@/lib/studio/domara/ai-channel-engine/types";

export type CasaHudOrchestratorDependencies = {
  repository: CasaHudProductionRepository;
  youtubeResearchProvider?: CasaHudYouTubeResearchProvider;
  listingDiscoveryProvider?: CasaHudListingDiscoveryProvider;
};

function makeRun(request: CasaHudGenerateRequest): CasaHudGenerationRun {
  const createdAt = nowIso();
  return {
    id: stableCasaHudId("casahud-run", `${request.userId}:${createdAt}:${request.preferredMarket || "next"}`),
    userId: request.userId,
    status: "running",
    objective: request.objective || "generate_next_property_video",
    currentStage: "youtube_research",
    createdAt,
    updatedAt: createdAt,
  };
}

function makeStage<TOutput>(
  name: CasaHudStageName,
  status: CasaHudStageStatus,
  output?: TOutput,
  error?: string,
): CasaHudStageRecord<TOutput> {
  const timestamp = nowIso();
  return {
    name,
    status,
    startedAt: timestamp,
    completedAt: status === "running" || status === "pending" ? undefined : timestamp,
    output,
    error,
    retryable: status === "failed" || status === "needs_credentials",
  };
}

async function saveStage(
  repository: CasaHudProductionRepository,
  run: CasaHudGenerationRun,
  stages: CasaHudStageRecord[],
  stage: CasaHudStageRecord,
): Promise<void> {
  stages.push(stage);
  await repository.saveStage(run.id, stage);
}

function updateRun(run: CasaHudGenerationRun, status: CasaHudRunStatus, currentStage: CasaHudStageName): CasaHudGenerationRun {
  return {
    ...run,
    status,
    currentStage,
    updatedAt: nowIso(),
  };
}

function makeProject(params: {
  run: CasaHudGenerationRun;
  selectedTitle: string;
  videoType: CasaHudProject["videoType"];
  status: CasaHudRunStatus;
}): CasaHudProject {
  const timestamp = nowIso();
  return {
    id: stableCasaHudId("casahud-project", `${params.run.userId}:${params.selectedTitle}`),
    userId: params.run.userId,
    name: params.selectedTitle,
    selectedTitle: params.selectedTitle,
    videoType: params.videoType,
    status: params.status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function runCasaHudOrchestrator(
  request: CasaHudGenerateRequest,
  dependencies: CasaHudOrchestratorDependencies,
): Promise<CasaHudOrchestratorOutput> {
  const repository = dependencies.repository;
  const stages: CasaHudStageRecord[] = [];
  let run = makeRun(request);
  await repository.createRun(run);

  const query = [
    request.preferredMarket || "Italian property videos",
    "affordable homes relocation real estate YouTube",
  ].join(" ");
  const researchProvider = dependencies.youtubeResearchProvider || createYouTubeResearchProvider({ apiKey: process.env.YOUTUBE_API_KEY });
  const research = await researchProvider.research(query);
  await saveStage(repository, run, stages, makeStage("youtube_research", "complete", research));

  const titleCandidates = generateCasaHudTitleCandidates(research);
  const selectedTitle = titleCandidates.find((candidate) => candidate.selected) || titleCandidates[0]!;
  await saveStage(repository, run, stages, makeStage("viral_title", "complete", { titleCandidates, selectedTitle }));

  const strategy = createCasaHudContentStrategy(selectedTitle.title);
  const project = makeProject({
    run,
    selectedTitle: selectedTitle.title,
    videoType: strategy.videoType,
    status: "running",
  });
  await repository.createProject(project);
  run = { ...updateRun(run, "running", "content_strategy"), projectId: project.id };
  await repository.updateRun(run);
  await saveStage(repository, run, stages, makeStage("project_creation", "complete", project));
  await saveStage(repository, run, stages, makeStage("content_strategy", "complete", strategy));

  const listingDiscovery = await discoverListingsForStrategy({
    strategy,
    provider: dependencies.listingDiscoveryProvider,
  });
  await saveStage(
    repository,
    run,
    stages,
    makeStage(
      "listing_discovery",
      listingDiscovery.status === "ready" ? "complete" : "needs_credentials",
      listingDiscovery,
    ),
  );

  if (listingDiscovery.status !== "ready") {
    run = updateRun(run, "needs_credentials", "listing_discovery");
    await repository.updateRun(run);
    const output: CasaHudOrchestratorOutput = {
      run,
      project: { ...project, status: "needs_credentials", updatedAt: nowIso() },
      research,
      titleCandidates,
      selectedTitle,
      strategy,
      listingDiscovery,
      locationIntelligence: [],
      stages,
    };
    await repository.saveOutput(output);
    return output;
  }

  const listingValidation = validateListingsAgainstStrategy(strategy, listingDiscovery.listings);
  await saveStage(
    repository,
    run,
    stages,
    makeStage(
      "listing_validation",
      listingValidation.status === "ready" ? "complete" : "failed",
      listingValidation,
      listingValidation.blockingReasons.join(" "),
    ),
  );

  if (listingValidation.status !== "ready") {
    run = updateRun(run, "failed", "listing_validation");
    await repository.updateRun(run);
    const output: CasaHudOrchestratorOutput = {
      run,
      project: { ...project, status: "failed", updatedAt: nowIso() },
      research,
      titleCandidates,
      selectedTitle,
      strategy,
      listingDiscovery,
      listingValidation,
      locationIntelligence: [],
      stages,
    };
    await repository.saveOutput(output);
    return output;
  }

  const locationIntelligence = await enrichLocationsForListings(listingValidation.selectedListings);
  await saveStage(repository, run, stages, makeStage("location_intelligence", "complete", locationIntelligence));

  const script = generateScriptPackage({
    title: selectedTitle.title,
    strategy,
    listings: listingValidation.selectedListings,
    locationIntelligence,
  });
  await saveStage(repository, run, stages, makeStage("script", "complete", script));

  const storyboard = generateStoryboardAndRenderPlan({
    title: selectedTitle.title,
    script,
    listings: listingValidation.selectedListings,
    locationIntelligence,
  });
  await saveStage(repository, run, stages, makeStage("storyboard_render_plan", "complete", storyboard));
  await saveStage(repository, run, stages, makeStage("render", "complete", {
    status: "render_job_ready",
    renderPlanId: storyboard.renderPlan.id,
    requiresReviewBeforeRender: true,
  }));

  const youtubePackage = generateCasaHudYouTubePackage({
    title: selectedTitle.title,
    titleCandidates,
    script,
    listings: listingValidation.selectedListings,
    locationIntelligence,
  });
  await saveStage(repository, run, stages, makeStage("youtube_package", "complete", youtubePackage));

  const review = {
    status: "awaiting_review" as const,
    approvalRequired: true as const,
    reviewFlags: listingValidation.validations.flatMap((validation) => validation.riskFlags),
    questionableClaims: listingValidation.validations
      .filter((validation) => validation.riskFlags.length > 0)
      .map((validation) => `${validation.title}: ${validation.riskFlags.join(", ")}`),
    publishBlockedUntilApproved: true as const,
  };
  await saveStage(repository, run, stages, makeStage("review", "complete", review));
  await saveStage(repository, run, stages, makeStage("publishing", "skipped", {
    status: request.capabilities.youtubePublishing ? "awaiting_review" : "needs_credentials",
    message: request.capabilities.youtubePublishing
      ? "YouTube publish/schedule is blocked until human approval."
      : "YouTube credentials are required before publish or schedule.",
  }));

  run = updateRun(run, "awaiting_review", "review");
  await repository.updateRun(run);

  const output: CasaHudOrchestratorOutput = {
    run,
    project: { ...project, status: "awaiting_review", updatedAt: nowIso() },
    research,
    titleCandidates,
    selectedTitle,
    strategy,
    listingDiscovery,
    listingValidation,
    locationIntelligence,
    script,
    storyboard,
    youtubePackage,
    review,
    stages,
  };
  await repository.saveOutput(output);
  return output;
}
