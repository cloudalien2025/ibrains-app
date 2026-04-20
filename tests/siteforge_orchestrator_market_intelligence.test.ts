import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = {
  runPlannerAgent: vi.fn(),
  runContentAgent: vi.fn(),
  runBuildSpecAgent: vi.fn(),
  runQaAgent: vi.fn(),
  runMarketIntelligenceAgent: vi.fn(),
  runPlannerAgentResult: {
    businessType: "SaaS",
    businessSummary: "summary",
    siteGoal: "goal",
    primaryCTA: "Book Demo",
    targetAudience: "buyers",
    homepageSlug: "home",
    navigation: ["Home"],
    pages: [{ id: "p1", title: "Home", slug: "home", purpose: "home", sections: [{ id: "s1", sectionType: "hero", purpose: "hero" }] }],
    assumptions: [],
    warnings: [],
  },
  runContentAgentResult: {
    siteTitle: "Acme",
    brandVoice: "expert",
    pages: [{ pageId: "p1", title: "Home", slug: "home", headline: "h", subheadline: "s", cta: "Book Demo", sections: [{ sectionId: "s1", heading: "h", body: "b" }] }],
  },
  runBuildSpecAgentResult: {
    siteTitle: "Acme",
    homepageSlug: "home",
    menu: [{ label: "Home", slug: "home" }],
    pages: [{ pageId: "p1", title: "Home", slug: "home", purpose: "home", sections: [{ id: "s1", type: "hero", heading: "h", body: "b" }], metadata: { template: "landing" } }],
    metadata: { conversionFocus: "high", thriveAware: false, createdAt: "2026-04-20T00:00:00.000Z" },
  },
};

vi.mock("@/lib/siteforge/agents/planner", () => ({
  runPlannerAgent: mocks.runPlannerAgent,
}));
vi.mock("@/lib/siteforge/agents/content", () => ({
  runContentAgent: mocks.runContentAgent,
}));
vi.mock("@/lib/siteforge/agents/buildSpec", () => ({
  runBuildSpecAgent: mocks.runBuildSpecAgent,
}));
vi.mock("@/lib/siteforge/agents/qa", () => ({
  runQaAgent: mocks.runQaAgent,
}));
vi.mock("@/lib/siteforge/agents/marketIntelligence", () => ({
  runMarketIntelligenceAgent: mocks.runMarketIntelligenceAgent,
}));
vi.mock("@/lib/siteforge/thrive", () => ({
  applyThriveMappings: vi.fn((spec: unknown) => ({ spec, appliedMappings: [], fallbackUsed: false, sectionResolutions: [] })),
  detectThriveCapability: vi.fn(() => false),
}));
vi.mock("@/lib/siteforge/thriveIntelligence", () => ({
  discoverThriveIntelligence: vi.fn(async () => null),
}));
vi.mock("@/lib/siteforge/thriveNativeHarness", () => ({
  evaluateThriveNativeGuard: vi.fn(() => ({ eligible: false })),
  getThriveExecutionRuntime: vi.fn(() => ({ wpSafeMode: true, thriveIntelMode: false, stagingNativeMode: false })),
}));
vi.mock("@/lib/siteforge/thriveNativeComposer", () => ({
  createThriveNativeCompositionPlan: vi.fn(() => null),
}));
vi.mock("@/lib/siteforge/thriveNativeValidation", () => ({
  runThriveNativeValidation: vi.fn(async () => null),
}));
vi.mock("@/lib/siteforge/wordpress/service", () => ({
  executeBuildSpecToWordPress: vi.fn(async () => null),
  executeRevisionToWordPress: vi.fn(async () => null),
  validateWordPressConnection: vi.fn(async () => ({ connected: false, canWritePages: false, message: "n/a" })),
}));

describe("siteforge orchestrator market intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runPlannerAgent.mockResolvedValue(mocks.runPlannerAgentResult);
    mocks.runContentAgent.mockResolvedValue(mocks.runContentAgentResult);
    mocks.runBuildSpecAgent.mockReturnValue(mocks.runBuildSpecAgentResult);
    mocks.runQaAgent.mockReturnValue({ isValid: true, warnings: [], errors: [], recommendations: [] });
  });

  function makeRepo() {
    const session = {
      id: "s1",
      projectId: "p1",
      userId: "u1",
      connectionId: null,
      type: "generate" as const,
      triggerSource: "user" as const,
      prompt: "x",
      websiteBrief: null,
      generationSource: "user_key" as const,
      aiModel: "gpt-4.1-mini",
      marketIntelligence: null,
      connectionProfile: null,
      status: "running" as const,
      runState: { currentStage: "planning" as const, progressPct: 0, timeline: [] as Array<{ at: string; stage: "planning" | "writing" | "building" | "reviewing" | "finalizing" | "executing" | "completed" | "failed"; message: string; level: "info" | "warning" | "error" }> },
      sitePlan: null,
      contentPackage: null,
      buildSpec: null,
      qaResult: null,
      executionResult: null,
      revisionHistory: [],
      errorSummary: null,
      startedAt: "2026-04-20T00:00:00.000Z",
      completedAt: null,
      finishedAt: null,
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    };

    return {
      getSession: vi.fn(async () => session),
      updateSession: vi.fn(async (_id: string, patch: Record<string, unknown>) => Object.assign(session, patch)),
      appendRunLog: vi.fn(async () => {}),
      appendFailure: vi.fn(async () => {}),
      getProject: vi.fn(async () => ({ id: "p1", homepageStrategy: "use_existing" })),
      upsertSnapshot: vi.fn(async (snapshot: unknown) => snapshot),
    };
  }

  it("runs planner/content with market intelligence not_configured when SerpApi key is absent", async () => {
    const repo = makeRepo();
    mocks.runMarketIntelligenceAgent.mockResolvedValue({
      status: "not_configured",
      source: "none",
      querySet: [],
      competitorPatterns: [],
      commonPageSections: [],
      recurringValueProps: [],
      trustSignals: [],
      ctaPatterns: [],
      faqThemes: [],
      visualPatternHints: [],
      appStorePositioningHints: [],
      contentWarnings: ["serpapi_not_configured"],
      summary: "skipped",
      fingerprint: "abc",
      generatedAt: "2026-04-20T00:00:00.000Z",
      plannerEnriched: false,
      contentEnriched: false,
    });

    const { runBuildPipeline } = await import("@/lib/siteforge/orchestrator");
    await runBuildPipeline({
      repo: repo as never,
      sessionId: "s1",
      prompt: "build",
      websiteBrief: {
        businessName: "Acme",
        businessType: "SaaS",
        businessDescription: "desc",
        targetAudience: "buyers",
        websiteGoal: "capture_leads",
        mainOffer: "offer",
        brandTone: "expert",
        marketLocation: null,
        competitors: null,
        differentiators: null,
      },
      apiKey: "sk-test",
      serpApiKey: null,
      aiModel: "gpt-4.1-mini",
      generationSource: "user_key",
      connection: null,
    });

    expect(mocks.runMarketIntelligenceAgent).toHaveBeenCalled();
    expect(mocks.runPlannerAgent).toHaveBeenCalledWith(expect.objectContaining({ marketIntelligence: expect.objectContaining({ status: "not_configured" }) }));
    expect(mocks.runContentAgent).toHaveBeenCalledWith(expect.objectContaining({ marketIntelligence: expect.objectContaining({ status: "not_configured" }) }));
  });

  it("passes SerpApi-backed intelligence into planner and content when key exists", async () => {
    const repo = makeRepo();
    mocks.runMarketIntelligenceAgent.mockResolvedValue({
      status: "used",
      source: "serpapi",
      querySet: ["q1"],
      competitorPatterns: ["example.com"],
      commonPageSections: ["hero_section"],
      recurringValueProps: ["ease_of_use"],
      trustSignals: ["social_proof"],
      ctaPatterns: ["book_demo"],
      faqThemes: ["how_it_works"],
      visualPatternHints: ["card_grid_layout"],
      appStorePositioningHints: [],
      contentWarnings: ["patterns_only_no_copy"],
      summary: "used",
      fingerprint: "abcd",
      generatedAt: "2026-04-20T00:00:00.000Z",
      plannerEnriched: true,
      contentEnriched: true,
    });

    const { runBuildPipeline } = await import("@/lib/siteforge/orchestrator");
    await runBuildPipeline({
      repo: repo as never,
      sessionId: "s1",
      prompt: "build",
      websiteBrief: {
        businessName: "Acme",
        businessType: "SaaS",
        businessDescription: "desc",
        targetAudience: "buyers",
        websiteGoal: "capture_leads",
        mainOffer: "offer",
        brandTone: "expert",
        marketLocation: null,
        competitors: null,
        differentiators: null,
      },
      apiKey: "sk-test",
      serpApiKey: "serpapi-test",
      aiModel: "gpt-4.1-mini",
      generationSource: "user_key",
      connection: null,
    });

    expect(mocks.runMarketIntelligenceAgent).toHaveBeenCalledWith(
      expect.objectContaining({ serpApiKey: "serpapi-test" })
    );
    expect(mocks.runPlannerAgent).toHaveBeenCalledWith(expect.objectContaining({ marketIntelligence: expect.objectContaining({ status: "used" }) }));
    expect(mocks.runContentAgent).toHaveBeenCalledWith(expect.objectContaining({ marketIntelligence: expect.objectContaining({ source: "serpapi" }) }));
  });
});
