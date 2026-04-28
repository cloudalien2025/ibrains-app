import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveFrontdoorAuthState } from "@/lib/auth/frontdoorAuthState";

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));
const originalNodeEnv = process.env.NODE_ENV;
const originalVitestEnv = process.env.VITEST;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

describe("frontdoor auth state", () => {
  beforeEach(() => {
    authMock.mockReset();
    delete process.env.E2E_MOCK_GRAPH;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VITEST = originalVitestEnv;
  });

  it("treats the frontdoor as signed out when clerk runtime config is absent", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.VITEST;

    await expect(resolveFrontdoorAuthState()).resolves.toEqual({ status: "signed-out" });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("treats the frontdoor as signed out when clerk auth is unavailable at runtime", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_frontdoor";
    process.env.CLERK_SECRET_KEY = "sk_test_frontdoor";
    authMock.mockRejectedValue(new Error("Clerk middleware unavailable"));

    await expect(resolveFrontdoorAuthState()).resolves.toEqual({ status: "signed-out" });
    expect(authMock).toHaveBeenCalledTimes(1);
  });

  it("returns a signed-in frontdoor state when clerk resolves a user session", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_frontdoor";
    process.env.CLERK_SECRET_KEY = "sk_test_frontdoor";
    authMock.mockResolvedValue({ userId: "user_frontdoor" });

    await expect(resolveFrontdoorAuthState()).resolves.toEqual({
      status: "signed-in",
      userId: "user_frontdoor",
    });
  });

  it("supports e2e frontdoor auth without calling clerk", async () => {
    process.env.E2E_MOCK_GRAPH = "1";

    await expect(resolveFrontdoorAuthState()).resolves.toEqual({
      status: "signed-in",
      userId: "e2e-admin",
    });
    expect(authMock).not.toHaveBeenCalled();
  });
});
