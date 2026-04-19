import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SiteForgePersistenceError } from "@/lib/siteforge/repository/persistence";

const mocks = {
  requireSignedInUser: vi.fn(),
  getSiteForgeRepository: vi.fn(),
  parseBuildPayload: vi.fn(),
  resolveConnection: vi.fn(),
  sanitizeConnection: vi.fn(),
  resolveRuntimeConnection: vi.fn(),
  resolveProjectAiApiKey: vi.fn(),
  enqueueBuildJob: vi.fn(),
  createInitialRunState: vi.fn(() => ({ currentStage: "planning", progressPct: 0, timeline: [] })),
};

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));
vi.mock("@/lib/siteforge/repository", () => ({
  getSiteForgeRepository: mocks.getSiteForgeRepository,
}));
vi.mock("@/lib/siteforge/api", () => ({
  parseBuildPayload: mocks.parseBuildPayload,
  resolveConnection: mocks.resolveConnection,
  sanitizeConnection: mocks.sanitizeConnection,
}));
vi.mock("@/lib/siteforge/workspace", () => ({
  resolveRuntimeConnection: mocks.resolveRuntimeConnection,
  resolveProjectAiApiKey: mocks.resolveProjectAiApiKey,
}));
vi.mock("@/lib/siteforge/runner", () => ({
  enqueueBuildJob: mocks.enqueueBuildJob,
}));
vi.mock("@/lib/siteforge/orchestrator", () => ({
  createInitialRunState: mocks.createInitialRunState,
}));

describe("siteforge build route AI guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SITEFORGE_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("blocks generation when no user key and no platform key", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "u1", unauthorizedResponse: null });
    mocks.parseBuildPayload.mockReturnValue({
      prompt: "x",
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
      homepageStrategy: "use_existing",
    });
    mocks.resolveConnection.mockReturnValue(null);
    mocks.resolveRuntimeConnection.mockResolvedValue({ connection: null, connectionId: null });
    mocks.resolveProjectAiApiKey.mockResolvedValue(null);

    const repo = {
      getProject: vi.fn().mockResolvedValue({ id: "p1", homepageStrategy: "use_existing", aiModel: "gpt-4.1-mini" }),
      createSession: vi.fn(),
      updateProject: vi.fn(),
      markProjectOpened: vi.fn(),
    };
    mocks.getSiteForgeRepository.mockResolvedValue(repo);

    const { POST } = await import("@/app/api/siteforge/projects/[projectId]/build/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects/p1/build", {
      method: "POST",
      body: JSON.stringify({ websiteBrief: {} }),
    });

    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("AI_KEY_REQUIRED");
    expect(mocks.enqueueBuildJob).not.toHaveBeenCalled();
  });

  it("returns precise persistence error when repository selection fails in production", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "u1", unauthorizedResponse: null });
    mocks.parseBuildPayload.mockReturnValue({
      prompt: "x",
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
      homepageStrategy: "use_existing",
    });

    const persistenceError = new SiteForgePersistenceError({
      availability: {
        available: false,
        reasonCode: "missing_tables",
        reason: "Required SiteForge database tables are missing.",
      },
      policy: {
        runtimeEnv: "production",
        fallbackAllowed: false,
        fallbackFlag: false,
      },
    });
    mocks.getSiteForgeRepository.mockRejectedValue(persistenceError);

    const { POST } = await import("@/app/api/siteforge/projects/[projectId]/build/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects/p1/build", {
      method: "POST",
      body: JSON.stringify({ websiteBrief: {} }),
    });

    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(res.status).toBe(503);
    expect(body.error.code).toBe("SITEFORGE_PERSISTENCE_UNAVAILABLE");
    expect(body.error.message).toMatch(/Persistent SiteForge storage is unavailable in production/);
  });
});
