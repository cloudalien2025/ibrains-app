import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getSiteForgeRepository: vi.fn(),
  validateWordPressConnection: vi.fn(),
  resolveRuntimeConnection: vi.fn(),
  saveConnectionProfile: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/siteforge/repository", () => ({
  getSiteForgeRepository: mocks.getSiteForgeRepository,
}));

vi.mock("@/lib/siteforge/wordpress/service", () => ({
  validateWordPressConnection: mocks.validateWordPressConnection,
}));

vi.mock("@/lib/siteforge/workspace", () => ({
  resolveRuntimeConnection: mocks.resolveRuntimeConnection,
  saveConnectionProfile: mocks.saveConnectionProfile,
}));

describe("siteforge connection route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
  });

  it("returns precise not-found-for-user error for missing project ownership", async () => {
    const repo = {
      getProject: vi.fn().mockResolvedValue(null),
    };
    mocks.getSiteForgeRepository.mockResolvedValue(repo);

    const { POST } = await import("@/app/api/siteforge/projects/[projectId]/connection/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects/p_missing/connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://example.com", username: "admin", appPassword: "pw" }),
    });

    const res = await POST(req, { params: { projectId: "p_missing" } });
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Project not found for current user.");
    expect(repo.getProject).toHaveBeenCalledWith("p_missing", "user_1");
  });

  it("returns precise bad-request error when project id is missing", async () => {
    const repo = {
      getProject: vi.fn(),
    };
    mocks.getSiteForgeRepository.mockResolvedValue(repo);

    const { POST } = await import("@/app/api/siteforge/projects/[projectId]/connection/route");
    const req = new NextRequest("http://localhost/api/siteforge/projects/%20/connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://example.com", username: "admin", appPassword: "pw" }),
    });

    const res = await POST(req, { params: { projectId: "   " } });
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe("Project id is required.");
    expect(repo.getProject).not.toHaveBeenCalled();
  });
});
