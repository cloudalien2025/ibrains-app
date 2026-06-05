import { afterEach, describe, expect, it, vi } from "vitest";

async function importRepositoryWithPool(poolImpl: { query: ReturnType<typeof vi.fn> }) {
  vi.resetModules();
  vi.doMock("@/lib/brain-learning/db", () => ({
    getBrainLearningPool: () => poolImpl,
  }));
  return import("@/lib/siteforge/repository");
}

afterEach(() => {
  delete process.env.SITEFORGE_ALLOW_MEMORY_FALLBACK;
  delete process.env.APP_ENV;
  delete process.env.VERCEL_ENV;
  delete process.env.NODE_ENV;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("siteforge persistence policy", () => {
  it("forbids memory fallback in production when SiteForge tables are missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.SITEFORGE_ALLOW_MEMORY_FALLBACK = "1";

    const pool = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ ok: false }] }),
    };

    const { getSiteForgeRepository } = await importRepositoryWithPool(pool);

    await expect(getSiteForgeRepository()).rejects.toMatchObject({
      code: "SITEFORGE_PERSISTENCE_UNAVAILABLE",
      message: expect.stringContaining("Persistent SiteForge storage is unavailable in production"),
    });
  });

  it("allows memory mode in test when persistent storage is unavailable", async () => {
    process.env.NODE_ENV = "test";

    const pool = {
      query: vi.fn().mockRejectedValue(new Error("Missing required env var: DATABASE_URL")),
    };

    const { getSiteForgeRepository } = await importRepositoryWithPool(pool);
    const repo = await getSiteForgeRepository();
    const summary = await repo.getAdminSummary();

    expect(summary.storageMode).toBe("memory");
    expect(summary.persistenceHealth).toBe("degraded");
    expect(summary.fallbackAllowed).toBe(true);
    expect(summary.fallbackActive).toBe(true);
  });

  it("allows dev memory fallback only when explicit flag is set", async () => {
    process.env.NODE_ENV = "development";

    const missingDbPool = {
      query: vi.fn().mockRejectedValue(new Error("db down")),
    };

    const modWithoutFlag = await importRepositoryWithPool(missingDbPool);
    await expect(modWithoutFlag.getSiteForgeRepository()).rejects.toMatchObject({
      code: "SITEFORGE_PERSISTENCE_UNAVAILABLE",
    });

    process.env.NODE_ENV = "development";
    process.env.SITEFORGE_ALLOW_MEMORY_FALLBACK = "1";

    const modWithFlag = await importRepositoryWithPool(missingDbPool);
    const repo = await modWithFlag.getSiteForgeRepository();
    const summary = await repo.getAdminSummary();

    expect(summary.storageMode).toBe("memory");
    expect(summary.fallbackAllowed).toBe(true);
    expect(summary.fallbackActive).toBe(true);
  });

  it("ignores retired Vercel environment flags for runtime policy", async () => {
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "production";
    process.env.SITEFORGE_ALLOW_MEMORY_FALLBACK = "1";

    const pool = {
      query: vi.fn().mockRejectedValue(new Error("db down")),
    };

    const { getSiteForgeRepository } = await importRepositoryWithPool(pool);
    const repo = await getSiteForgeRepository();
    const summary = await repo.getAdminSummary();

    expect(summary.storageMode).toBe("memory");
    expect(summary.fallbackAllowed).toBe(true);
    expect(summary.fallbackActive).toBe(true);
  });

  it("keeps healthy postgres mode when tables are available", async () => {
    process.env.NODE_ENV = "production";

    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ ok: true }] })
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })
        .mockResolvedValueOnce({ rows: [{ count: 9 }] })
        .mockResolvedValueOnce({ rows: [{ active_runs: 1, failed_runs: 2, completed_runs: 6 }] })
        .mockResolvedValueOnce({ rows: [{ updated_at: "2026-04-19T00:00:00.000Z" }] }),
    };

    const { getSiteForgeRepository } = await importRepositoryWithPool(pool);
    const repo = await getSiteForgeRepository();
    const summary = await repo.getAdminSummary();

    expect(summary.storageMode).toBe("postgres");
    expect(summary.persistenceHealth).toBe("healthy");
    expect(summary.fallbackActive).toBe(false);
    expect(summary.projects).toBe(3);
    expect(summary.sessions).toBe(9);
  });
});
