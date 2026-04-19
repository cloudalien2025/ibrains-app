import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SiteForgePersistenceError } from "@/lib/siteforge/repository/persistence";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getSiteForgeRepository: vi.fn(),
  createId: vi.fn(),
  nowIso: vi.fn(),
  toSlug: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/siteforge/repository", () => ({
  getSiteForgeRepository: mocks.getSiteForgeRepository,
}));

vi.mock("@/lib/siteforge/utils", () => ({
  createId: mocks.createId,
  nowIso: mocks.nowIso,
  toSlug: mocks.toSlug,
}));

describe("siteforge projects route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.createId.mockReturnValue("sfp_test_1");
    mocks.nowIso.mockReturnValue("2026-01-01T00:00:00.000Z");
    mocks.toSlug.mockImplementation((value: string) => value.trim().toLowerCase().replace(/\s+/g, "-"));
  });

  it("rejects missing/whitespace names and does not create placeholder project", async () => {
    const repo = {
      createProject: vi.fn(),
      markProjectOpened: vi.fn(),
      getLastOpenedProjectId: vi.fn(),
      listProjects: vi.fn(),
    };
    mocks.getSiteForgeRepository.mockResolvedValue(repo);

    const { POST } = await import("@/app/api/siteforge/projects/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(repo.createProject).not.toHaveBeenCalled();
  });

  it("creates project with exact typed name and opens it", async () => {
    const repo = {
      createProject: vi.fn(),
      markProjectOpened: vi.fn(),
      getLastOpenedProjectId: vi.fn(),
      listProjects: vi.fn(),
    };
    mocks.getSiteForgeRepository.mockResolvedValue(repo);

    const { POST } = await import("@/app/api/siteforge/projects/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "iPetzo" }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { project: { id: string; name: string } };

    expect(res.status).toBe(201);
    expect(body.project.name).toBe("iPetzo");
    expect(repo.createProject).toHaveBeenCalledTimes(1);
    expect(repo.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sfp_test_1",
        userId: "user_1",
        name: "iPetzo",
      })
    );
    expect(repo.markProjectOpened).toHaveBeenCalledWith("user_1", "sfp_test_1");
  });

  it("returns precise persistence error when production storage is unavailable", async () => {
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

    const { GET } = await import("@/app/api/siteforge/projects/route");
    const res = await GET();
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("SITEFORGE_PERSISTENCE_UNAVAILABLE");
    expect(body.error.message).toMatch(/Persistent SiteForge storage is unavailable in production/);
  });
});
