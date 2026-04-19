import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteForgePersistenceError } from "@/lib/siteforge/repository/persistence";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getSiteForgeRepository: vi.fn(),
  getSiteForgeStorageStatus: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/siteforge/repository", () => ({
  getSiteForgeRepository: mocks.getSiteForgeRepository,
  getSiteForgeStorageStatus: mocks.getSiteForgeStorageStatus,
}));

describe("siteforge admin summary storage health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
  });

  it("returns storage health details when persistence is unavailable", async () => {
    mocks.getSiteForgeRepository.mockRejectedValue(
      new SiteForgePersistenceError({
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
      })
    );
    mocks.getSiteForgeStorageStatus.mockReturnValue({
      storageMode: "postgres",
      persistenceHealth: "unavailable",
      fallbackAllowed: false,
      fallbackActive: false,
      reason: "Required SiteForge database tables are missing.",
      postgresAvailable: false,
      postgresReasonCode: "missing_tables",
      postgresReason: "Required SiteForge database tables are missing.",
      runtimeEnv: "production",
    });

    const { GET } = await import("@/app/api/siteforge/admin/summary/route");
    const res = await GET();
    const body = (await res.json()) as {
      error: { code: string; message: string };
      summary: { persistenceHealth: string; storageMode: string; fallbackActive: boolean };
    };

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("SITEFORGE_PERSISTENCE_UNAVAILABLE");
    expect(body.summary.storageMode).toBe("postgres");
    expect(body.summary.persistenceHealth).toBe("unavailable");
    expect(body.summary.fallbackActive).toBe(false);
  });
});
