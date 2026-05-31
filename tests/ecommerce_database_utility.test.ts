import { afterEach, describe, expect, it, vi } from "vitest";

async function importWithPoolMock() {
  vi.resetModules();

  const poolQuery = vi.fn();
  const poolEnd = vi.fn();
  const poolCtor = vi.fn().mockImplementation((config: { connectionString: string }) => ({
    __config: config,
    query: poolQuery,
    end: poolEnd,
  }));

  vi.doMock("pg", () => ({
    Pool: poolCtor,
  }));

  const mod = await import("@/lib/ecommerce/database");
  return { mod, poolCtor, poolQuery, poolEnd };
}

describe("ecommerce database utility", () => {
  const originalEcommerceDatabaseUrl = process.env.ECOMMERCE_DATABASE_URL;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalEcommerceDatabaseUrl === undefined) {
      delete process.env.ECOMMERCE_DATABASE_URL;
    } else {
      process.env.ECOMMERCE_DATABASE_URL = originalEcommerceDatabaseUrl;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("requires ECOMMERCE_DATABASE_URL and never falls back to DATABASE_URL", async () => {
    delete process.env.ECOMMERCE_DATABASE_URL;
    process.env.DATABASE_URL = "postgres://platform-user:platform-pass@db.example.com:5432/ibrains";

    const { mod, poolCtor } = await importWithPoolMock();

    expect(() => mod.getRequiredEcommerceDatabaseUrl()).toThrow(
      "Missing required env var: ECOMMERCE_DATABASE_URL"
    );
    expect(() => mod.getEcommercePool()).toThrow("Missing required env var: ECOMMERCE_DATABASE_URL");
    expect(poolCtor).not.toHaveBeenCalled();
  });

  it("builds and reuses a singleton pool from ECOMMERCE_DATABASE_URL", async () => {
    process.env.ECOMMERCE_DATABASE_URL = "  postgres://ecom-user:ecom-pass@db.example.com:5432/ibrains_ecommerce  ";
    delete process.env.DATABASE_URL;

    const { mod, poolCtor } = await importWithPoolMock();

    const firstPool = mod.getEcommercePool();
    const secondPool = mod.getEcommercePool();

    expect(firstPool).toBe(secondPool);
    expect(poolCtor).toHaveBeenCalledTimes(1);
    expect(poolCtor).toHaveBeenCalledWith({
      connectionString: "postgres://ecom-user:ecom-pass@db.example.com:5432/ibrains_ecommerce",
    });
  });

  it("masks credentials when logging connection targets", async () => {
    const { mod } = await importWithPoolMock();

    const masked = mod.maskConnectionString(
      "postgres://ecom-user:super-secret@db.example.com:5432/ibrains_ecommerce?sslmode=require"
    );

    expect(masked).toContain("postgres://ecom-user:***@db.example.com:5432/ibrains_ecommerce");
    expect(masked).not.toContain("super-secret");
    expect(masked).not.toContain("sslmode=require");
  });
});
