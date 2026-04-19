import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SiteForgePersistenceError } from "@/lib/siteforge/repository/persistence";

const mocks = {
  requireSignedInUser: vi.fn(),
  getSiteForgeRepository: vi.fn(),
  saveProjectAiConfig: vi.fn(),
  clearProjectAiConfig: vi.fn(),
  normalizeWorkspace: vi.fn(),
};

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));
vi.mock("@/lib/siteforge/repository", () => ({
  getSiteForgeRepository: mocks.getSiteForgeRepository,
}));
vi.mock("@/lib/siteforge/workspace", () => ({
  saveProjectAiConfig: mocks.saveProjectAiConfig,
  clearProjectAiConfig: mocks.clearProjectAiConfig,
}));
vi.mock("@/lib/siteforge/workspaceShape", () => ({
  normalizeWorkspace: mocks.normalizeWorkspace,
}));

describe("siteforge AI route contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("saves AI key and returns masked status only", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "u1", unauthorizedResponse: null });
    const repo = {
      getProject: vi.fn().mockResolvedValue({ id: "p1", aiModel: "gpt-4.1-mini", hasSavedAiSecret: false }),
      getWorkspace: vi.fn().mockResolvedValue({ project: { id: "p1" } }),
    };
    mocks.getSiteForgeRepository.mockResolvedValue(repo);
    mocks.normalizeWorkspace.mockReturnValue({ project: { hasSavedAiSecret: true } });

    const { POST } = await import("@/app/api/siteforge/projects/[projectId]/ai/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects/p1/ai", {
      method: "POST",
      body: JSON.stringify({ apiKey: "sk-test-123", model: "gpt-4.1-mini" }),
    });

    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(mocks.saveProjectAiConfig).toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("sk-test-123");
    expect(body.ai).toEqual({ provider: "openai", model: "gpt-4.1-mini", status: "saved" });
  });

  it("removes stored key", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "u1", unauthorizedResponse: null });
    const repo = {
      getProject: vi.fn().mockResolvedValue({ id: "p1", aiModel: "gpt-4.1-mini", hasSavedAiSecret: true }),
      getWorkspace: vi.fn().mockResolvedValue({ project: { id: "p1" } }),
    };
    mocks.getSiteForgeRepository.mockResolvedValue(repo);
    mocks.normalizeWorkspace.mockReturnValue({ project: { aiModel: "gpt-4.1-mini" } });

    const { DELETE } = await import("@/app/api/siteforge/projects/[projectId]/ai/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects/p1/ai", { method: "DELETE" });

    const res = await DELETE(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(200);
    expect(mocks.clearProjectAiConfig).toHaveBeenCalled();
  });

  it("returns precise persistence error when storage is unavailable", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "u1", unauthorizedResponse: null });
    const persistenceError = new SiteForgePersistenceError({
      availability: {
        available: false,
        reasonCode: "db_unreachable",
        reason: "Database connectivity check failed.",
      },
      policy: {
        runtimeEnv: "production",
        fallbackAllowed: false,
        fallbackFlag: false,
      },
    });
    mocks.getSiteForgeRepository.mockRejectedValue(persistenceError);

    const { POST } = await import("@/app/api/siteforge/projects/[projectId]/ai/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects/p1/ai", {
      method: "POST",
      body: JSON.stringify({ apiKey: "sk-test-123", model: "gpt-4.1-mini" }),
    });

    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(res.status).toBe(503);
    expect(body.error.code).toBe("SITEFORGE_PERSISTENCE_UNAVAILABLE");
    expect(body.error.message).toMatch(/Persistent SiteForge storage is unavailable in production/);
  });
});
