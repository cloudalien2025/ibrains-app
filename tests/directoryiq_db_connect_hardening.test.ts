import { beforeEach, describe, expect, it, vi } from "vitest";

const poolQueryMock = vi.fn();
const poolConnectMock = vi.fn();
const poolCtorMock = vi.fn(() => ({
  query: poolQueryMock,
  connect: poolConnectMock,
}));

vi.mock("pg", () => ({
  Pool: poolCtorMock,
}));

describe("directoryiq db connect hardening", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...envSnapshot };
    process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/postgres";
    process.env.DATABASE_CONNECTION_TIMEOUT_MS = "3210";
    process.env.DATABASE_CONNECT_MAX_ATTEMPTS = "2";
    process.env.DATABASE_CONNECT_RETRY_BASE_MS = "1";
  });

  it("configures pool connection timeout and performs query via connected client", async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [{ ok: true }] });
    const release = vi.fn();
    poolConnectMock.mockResolvedValueOnce({ query: clientQuery, release });

    const db = await import("@/app/api/ecomviper/_utils/db");
    const rows = await db.query<{ ok: boolean }>("select 1");

    expect(poolCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 3210,
      })
    );
    expect(rows).toEqual([{ ok: true }]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("retries transient connect failures for first query connect path", async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const transient = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [{ ok: true }] });
    const release = vi.fn();
    poolConnectMock.mockRejectedValueOnce(transient).mockResolvedValueOnce({ query: clientQuery, release });

    const db = await import("@/app/api/ecomviper/_utils/db");
    const rows = await db.query<{ ok: boolean }>("select 1");

    expect(rows).toEqual([{ ok: true }]);
    expect(poolConnectMock).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
