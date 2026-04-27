import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CasaHudListingDiscoveryProvider } from "@/lib/studio/domara/ai-channel-engine/agents";
import { InMemoryCasaHudRepository } from "@/lib/studio/domara/ai-channel-engine/repository";
import { runCasaHudOrchestrator } from "@/lib/studio/domara/ai-channel-engine/orchestrator";
import { resolvePublishScheduleGate } from "@/lib/studio/domara/ai-channel-engine/publishing-agent";
import type { CasaHudYouTubeResearchProvider } from "@/lib/studio/domara/ai-channel-engine/youtube-research-agent";
import type { CasaHudContentStrategy, CasaHudYouTubeResearchResult } from "@/lib/studio/domara/ai-channel-engine/types";
import type { PropertyListingInput } from "@/lib/studio/domara/types";

const userId = "11111111-1111-4111-8111-111111111111";

const liveResearchProvider: CasaHudYouTubeResearchProvider = {
  providerName: "youtube_data_api",
  async research(query: string): Promise<CasaHudYouTubeResearchResult> {
    return {
      provider: "youtube_data_api",
      status: "live",
      credentialRequired: false,
      query,
      opportunitySummary: "Live ranking videos favor specific budget/location promises.",
      titlePatterns: ["7 Tuscany Farmhouses Under 1M You Can Actually Buy"],
      nicheGaps: ["Validated listing proof is missing in competing videos."],
      similarVideos: [
        {
          videoId: "abc123",
          title: "Tuscany Homes Under 1M",
          viewCount: 450000,
          velocityScore: 12000,
        },
      ],
      generatedAt: "2026-04-27T00:00:00.000Z",
    };
  },
};

function listing(index: number, overrides: Partial<PropertyListingInput> = {}): PropertyListingInput {
  return {
    listingUrl: `https://provider.example/listings/southern-italy-${index}`,
    source: "Provider Feed",
    provider: "idealista",
    country: "Italy",
    city: index % 2 === 0 ? "Scalea" : "Tropea",
    region: "Southern Italy",
    title: `Beachfront apartment ${index}`,
    description: "Real provider-sourced listing with coastal access, source attribution, and lifestyle context.",
    price: `EUR ${220000 + index * 25000}`,
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    squareMeters: 82,
    imageUrls: [
      `https://provider.example/images/${index}-1.jpg`,
      `https://provider.example/images/${index}-2.jpg`,
      `https://provider.example/images/${index}-3.jpg`,
    ],
    latitude: 39.812,
    longitude: 15.7932,
    sourceAttribution: "Provider Feed | active listing URL",
    providerMetadata: {
      listingId: `provider-${index}`,
      externalId: `ext-${index}`,
    },
    ...overrides,
  };
}

const fixtureListingProvider: CasaHudListingDiscoveryProvider = {
  providerName: "fixture",
  async discover(strategy: CasaHudContentStrategy): Promise<PropertyListingInput[]> {
    const count = Math.max(3, strategy.listingCountTarget);
    return Array.from({ length: count }, (_, index) => listing(index + 1));
  },
};

async function runComplete() {
  const repository = new InMemoryCasaHudRepository();
  const output = await runCasaHudOrchestrator(
    {
      userId,
      capabilities: {
        openaiGeneration: true,
        youtubeResearch: true,
        listingDiscovery: true,
        mapPoiEnrichment: true,
        renderJobs: true,
        youtubePublishing: true,
      },
    },
    {
      repository,
      youtubeResearchProvider: liveResearchProvider,
      listingDiscoveryProvider: fixtureListingProvider,
    },
  );

  return { output, repository };
}

describe("CasaHUD AI channel engine orchestrator", () => {
  it("creates a run and project without manual project naming and uses the viral title as project name", async () => {
    const { output, repository } = await runComplete();

    expect(output.run.status).toBe("awaiting_review");
    expect(output.project?.name).toBe(output.selectedTitle.title);
    expect(output.project?.selectedTitle).toBe(output.selectedTitle.title);
    expect(repository.projects.get(output.project!.id)?.name).toBe(output.selectedTitle.title);
  });

  it("persists title candidates and selected title through the repository", async () => {
    const { output, repository } = await runComplete();
    const saved = repository.outputs.get(output.run.id);

    expect(output.titleCandidates.length).toBeGreaterThanOrEqual(5);
    expect(output.titleCandidates.filter((candidate) => candidate.selected)).toHaveLength(1);
    expect(saved?.selectedTitle.title).toBe(output.selectedTitle.title);
  });

  it("produces structured stage outputs for research, strategy, listings, maps, script, render plan, package, and review", async () => {
    const { output } = await runComplete();
    const stageNames = output.stages.map((stage) => stage.name);

    expect(stageNames).toEqual(
      expect.arrayContaining([
        "youtube_research",
        "viral_title",
        "project_creation",
        "content_strategy",
        "listing_discovery",
        "listing_validation",
        "location_intelligence",
        "script",
        "storyboard_render_plan",
        "youtube_package",
        "review",
      ]),
    );
    expect(output.script?.scenes.length).toBeGreaterThan(0);
    expect(output.storyboard?.renderPlan.timeline.length).toBeGreaterThan(0);
    expect(output.youtubePackage?.finalRecommendedTitle).toBe(output.selectedTitle.title);
  });

  it("supports roundup and niche strategy decisions from generated titles", async () => {
    const { output } = await runComplete();

    expect(["roundup", "niche", "location_category"]).toContain(output.strategy.videoType);
    expect(output.strategy.listingCountTarget).toBeGreaterThan(1);
    expect(output.listingValidation?.selectedListings.length).toBeGreaterThan(1);
  });

  it("degrades gracefully when listing credentials are missing and does not create production mock listings", async () => {
    const repository = new InMemoryCasaHudRepository();
    const output = await runCasaHudOrchestrator(
      {
        userId,
        capabilities: {
          openaiGeneration: false,
          youtubeResearch: false,
          listingDiscovery: false,
          mapPoiEnrichment: false,
          renderJobs: true,
          youtubePublishing: false,
        },
      },
      { repository },
    );

    expect(output.run.status).toBe("needs_credentials");
    expect(output.project?.name).toBe(output.selectedTitle.title);
    expect(output.listingDiscovery.status).toBe("needs_credentials");
    expect(output.listingDiscovery.listings).toEqual([]);
    expect(output.stages.find((stage) => stage.name === "listing_discovery")?.status).toBe("needs_credentials");
  });

  it("uses the YouTube provider seam when credentials are available and falls back to heuristics otherwise", async () => {
    const complete = await runComplete();
    expect(complete.output.research.provider).toBe("youtube_data_api");
    expect(complete.output.research.similarVideos[0]?.viewCount).toBe(450000);

    const repository = new InMemoryCasaHudRepository();
    const limited = await runCasaHudOrchestrator(
      {
        userId,
        capabilities: {
          openaiGeneration: false,
          youtubeResearch: false,
          listingDiscovery: false,
          mapPoiEnrichment: false,
          renderJobs: true,
          youtubePublishing: false,
        },
      },
      { repository },
    );
    expect(limited.research.provider).toBe("heuristic");
    expect(limited.research.credentialRequired).toBe(true);
  });

  it("validates listing/title mismatches before video creation", async () => {
    const badProvider: CasaHudListingDiscoveryProvider = {
      providerName: "fixture",
      async discover(): Promise<PropertyListingInput[]> {
        return [
          listing(1, {
            listingUrl: undefined,
            sourceAttribution: undefined,
            region: "Norway",
            imageUrls: [],
          }),
        ];
      },
    };
    const repository = new InMemoryCasaHudRepository();
    const output = await runCasaHudOrchestrator(
      {
        userId,
        capabilities: {
          openaiGeneration: true,
          youtubeResearch: true,
          listingDiscovery: true,
          mapPoiEnrichment: true,
          renderJobs: true,
          youtubePublishing: true,
        },
      },
      {
        repository,
        youtubeResearchProvider: liveResearchProvider,
        listingDiscoveryProvider: badProvider,
      },
    );

    expect(output.run.status).toBe("failed");
    expect(output.listingValidation?.status).toBe("blocked");
    expect(output.listingValidation?.validations[0]?.riskFlags).toEqual(
      expect.arrayContaining(["Missing source URL.", "Too few listing images for video production."]),
    );
  });

  it("uses maps and POIs in script and storyboard/render planning", async () => {
    const { output } = await runComplete();

    expect(output.locationIntelligence[0]?.enrichment.pointsOfInterest.length).toBeGreaterThan(0);
    expect(output.script?.narrationScript.toLowerCase()).toContain("location matters");
    expect(output.storyboard?.mapSceneCount).toBeGreaterThan(0);
    expect(output.storyboard?.poiDrivenSceneCount).toBeGreaterThan(0);
  });

  it("persists render jobs, YouTube package, and requires approval before publish or schedule", async () => {
    const { output } = await runComplete();

    expect(output.review?.approvalRequired).toBe(true);
    expect(output.youtubePackage?.description).toContain("Human approval required");
    const blocked = await resolvePublishScheduleGate({
      approved: false,
      youtubeConfigured: true,
      request: { mode: "publish_now" },
      packageData: output.youtubePackage!,
    });
    expect(blocked.status).toBe("needs_approval");
  });

  it("requires YouTube credentials before scheduling after approval", async () => {
    const { output } = await runComplete();
    const result = await resolvePublishScheduleGate({
      approved: true,
      youtubeConfigured: false,
      request: { mode: "schedule", scheduledAt: "2026-05-01T16:00:00.000Z" },
      packageData: output.youtubePackage!,
    });

    expect(result.status).toBe("needs_credentials");
  });
});

describe("CasaHUD production contracts", () => {
  it("adds durable persistence tables for the channel engine", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "db/migrations/20260427_casahud_ai_channel_engine.sql"),
      "utf8",
    );

    for (const table of [
      "casahud_projects",
      "casahud_generation_runs",
      "casahud_youtube_research_results",
      "casahud_title_candidates",
      "casahud_listing_discovery_results",
      "casahud_imported_listings",
      "casahud_listing_validation_results",
      "casahud_location_enrichments",
      "casahud_script_outputs",
      "casahud_storyboards",
      "casahud_render_plans",
      "casahud_render_jobs",
      "casahud_youtube_packages",
      "casahud_review_states",
      "casahud_publish_jobs",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("keeps production UI free of fake listing/render/publish success states", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/apps/studio/studio-domara-client.tsx"), "utf8");

    expect(source).toContain("Create Next YouTube Property Video");
    expect(source).toContain("Project name = selected viral title");
    expect(source).toContain("Review required before publish");
    expect(source).toContain("fallbackToMock: false");
    expect(source).not.toContain("Mode: Mock-first MVP");
    expect(source).not.toContain("deterministic mock listing used");
    expect(source).not.toContain("<DomaraCampaignWorkflowShell");
    expect(source).not.toContain("fake connected");
  });
});
