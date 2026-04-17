import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

describe("requireSignedInUser e2e mode", () => {
  afterEach(() => {
    delete process.env.E2E_MOCK_GRAPH;
    vi.clearAllMocks();
  });

  it("returns synthetic e2e user without calling Clerk auth when E2E_MOCK_GRAPH=1", async () => {
    process.env.E2E_MOCK_GRAPH = "1";
    const { requireSignedInUser } = await import("@/lib/auth/requireSignedInUser");

    const result = await requireSignedInUser();

    expect(result.userId).toBe("e2e-admin");
    expect(result.unauthorizedResponse).toBeNull();
    expect(authMock).not.toHaveBeenCalled();
  });
});
