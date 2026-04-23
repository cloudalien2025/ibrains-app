import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  encryptSecret: vi.fn(),
  decryptSecret: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: mocks.query,
}));

vi.mock("@/app/api/ecomviper/_utils/crypto", () => ({
  encryptSecret: mocks.encryptSecret,
  decryptSecret: mocks.decryptSecret,
}));

describe("directoryiq credentials canonical non-BD store path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.encryptSecret.mockReturnValue("enc-secret");
    mocks.decryptSecret.mockReturnValue("plain-secret");
  });

  it("checks canonical non-BD table readiness", async () => {
    mocks.query.mockResolvedValueOnce([{ exists: "directoryiq_signal_source_credentials" }]);

    const { isDirectoryIqCredentialStoreAvailable } = await import("@/app/api/directoryiq/_utils/credentials");
    const available = await isDirectoryIqCredentialStoreAvailable();

    expect(available).toBe(true);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("to_regclass('public.directoryiq_signal_source_credentials')")
    );
  });

  it("saves openai in directoryiq_signal_source_credentials", async () => {
    const { saveDirectoryIqIntegration } = await import("@/app/api/directoryiq/_utils/credentials");

    await saveDirectoryIqIntegration({
      userId: "user_1",
      provider: "openai",
      secret: "sk-openai",
      meta: { label: "primary" },
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO directoryiq_signal_source_credentials");
    expect(sql).not.toContain("integrations_credentials");
    expect(params[0]).toBe("user_1");
    expect(params[1]).toBe("openai");
  });

  it("lists serpapi and ga4 from canonical non-BD table", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          connector_id: "serpapi",
          secret_ciphertext: "cipher-1",
          secret_last4: "1234",
          secret_length: 16,
          label: "research",
          config_json: {},
          updated_at: "2026-04-23T00:00:00.000Z",
        },
        {
          connector_id: "ga4",
          secret_ciphertext: "cipher-2",
          secret_last4: "5678",
          secret_length: 20,
          label: null,
          config_json: { measurementId: "G-TEST123" },
          updated_at: "2026-04-23T00:00:00.000Z",
        },
      ]);

    const { listDirectoryIqIntegrations } = await import("@/app/api/directoryiq/_utils/credentials");
    const result = await listDirectoryIqIntegrations("user_1");

    const serp = result.find((entry) => entry.provider === "serpapi");
    const ga4 = result.find((entry) => entry.provider === "ga4");
    expect(serp?.status).toBe("connected");
    expect(ga4?.status).toBe("connected");
    const sqlCalls = mocks.query.mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes("FROM directoryiq_signal_source_credentials"))).toBe(true);
  });

  it("deletes ga4 from canonical non-BD table", async () => {
    const { deleteDirectoryIqIntegration } = await import("@/app/api/directoryiq/_utils/credentials");

    await deleteDirectoryIqIntegration("user_1", "ga4");

    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("DELETE FROM directoryiq_signal_source_credentials");
    expect(params).toEqual(["user_1", "ga4"]);
  });
});
