import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  shouldServeDirectoryIqLocally: vi.fn(),
  proxyDirectoryIqRequest: vi.fn(),
  listBdSites: vi.fn(),
  hasCanonicalDirectoryIqConnection: vi.fn(),
  listDirectoryIqIntegrations: vi.fn(),
  getDirectoryIqIntegration: vi.fn(),
  saveDirectoryIqIntegration: vi.fn(),
  deleteDirectoryIqIntegration: vi.fn(),
  isDirectoryIqCredentialStoreAvailable: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: mocks.ensureUser,
  resolveUserId: mocks.resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/runtimeParity", () => ({
  shouldServeDirectoryIqLocally: mocks.shouldServeDirectoryIqLocally,
}));

vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRequest: mocks.proxyDirectoryIqRequest,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: mocks.listBdSites,
}));

vi.mock("@/app/api/directoryiq/_utils/connectedState", () => ({
  hasCanonicalDirectoryIqConnection: mocks.hasCanonicalDirectoryIqConnection,
}));

vi.mock("@/app/api/directoryiq/_utils/credentials", () => ({
  listDirectoryIqIntegrations: mocks.listDirectoryIqIntegrations,
  getDirectoryIqIntegration: mocks.getDirectoryIqIntegration,
  saveDirectoryIqIntegration: mocks.saveDirectoryIqIntegration,
  deleteDirectoryIqIntegration: mocks.deleteDirectoryIqIntegration,
  isDirectoryIqCredentialStoreAvailable: mocks.isDirectoryIqCredentialStoreAvailable,
}));

describe("directoryiq signal-sources non-BD persistence route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldServeDirectoryIqLocally.mockReturnValue(true);
    mocks.resolveUserId.mockReturnValue("user_1");
    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.isDirectoryIqCredentialStoreAvailable.mockResolvedValue(true);
    mocks.getDirectoryIqIntegration.mockResolvedValue({
      provider: "openai",
      status: "connected",
      masked: "********1234",
      savedAt: "2026-01-01T00:00:00.000Z",
      meta: {},
    });
    mocks.listDirectoryIqIntegrations.mockResolvedValue([
      {
        provider: "brilliant_directories",
        status: "disconnected",
        masked: "",
        savedAt: null,
        meta: {},
      },
      {
        provider: "openai",
        status: "connected",
        masked: "********1234",
        savedAt: "2026-01-01T00:00:00.000Z",
        meta: {},
      },
      {
        provider: "serpapi",
        status: "connected",
        masked: "********5678",
        savedAt: "2026-01-01T00:00:00.000Z",
        meta: {},
      },
      {
        provider: "ga4",
        status: "connected",
        masked: "********9012",
        savedAt: "2026-01-01T00:00:00.000Z",
        meta: {},
      },
    ]);
    mocks.listBdSites.mockResolvedValue([]);
    mocks.hasCanonicalDirectoryIqConnection.mockReturnValue(false);
  });

  it.each([
    { connectorId: "openai", provider: "openai", secret: "sk-openai" },
    { connectorId: "serpapi", provider: "serpapi", secret: "serpapi-secret" },
    { connectorId: "ga4", provider: "ga4", secret: "ga4-secret" },
  ])("saves $connectorId using canonical integration store", async ({ connectorId, provider, secret }) => {
    const { POST } = await import("@/app/api/directoryiq/signal-sources/route");
    const req = new NextRequest("http://localhost/api/directoryiq/signal-sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connector_id: connectorId,
        secret,
        label: "primary",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok?: boolean; connector_id?: string; error?: string };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.connector_id).toBe(connectorId);
    expect(mocks.saveDirectoryIqIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        provider,
        secret,
      })
    );
  });

  it.each([
    { connectorId: "openai", expected: "OpenAI API credential persistence is currently unavailable in this environment." },
    { connectorId: "serpapi", expected: "SerpAPI credential persistence is currently unavailable in this environment." },
    { connectorId: "ga4", expected: "GA4 credential persistence is currently unavailable in this environment." },
  ])("returns connector-specific unavailability when storage is unsupported for $connectorId", async ({ connectorId, expected }) => {
    mocks.isDirectoryIqCredentialStoreAvailable.mockResolvedValue(false);

    const { POST } = await import("@/app/api/directoryiq/signal-sources/route");
    const req = new NextRequest("http://localhost/api/directoryiq/signal-sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connector_id: connectorId,
        secret: "test-secret",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(503);
    expect(body.error).toBe(expected);
    expect(body.error?.toLowerCase()).not.toContain("brilliant directories");
    expect(mocks.saveDirectoryIqIntegration).not.toHaveBeenCalled();
  });

  it.each([
    { connectorId: "openai", expected: "OpenAI API credential persistence is currently unavailable in this environment." },
    { connectorId: "serpapi", expected: "SerpAPI credential persistence is currently unavailable in this environment." },
    { connectorId: "ga4", expected: "GA4 credential persistence is currently unavailable in this environment." },
  ])("maps legacy relation errors to connector-specific copy for $connectorId", async ({ connectorId, expected }) => {
    mocks.saveDirectoryIqIntegration.mockRejectedValue(
      new Error('relation "public.directoryiq_signal_source_credentials" does not exist')
    );

    const { POST } = await import("@/app/api/directoryiq/signal-sources/route");
    const req = new NextRequest("http://localhost/api/directoryiq/signal-sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connector_id: connectorId,
        secret: "test-secret",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe(expected);
    expect(body.error?.toLowerCase()).not.toContain("brilliant directories");
  });

  it("reports non-BD connector support as enabled when canonical store is available", async () => {
    const { GET } = await import("@/app/api/directoryiq/signal-sources/route");
    const req = new NextRequest("http://localhost/api/directoryiq/signal-sources", {
      method: "GET",
    });

    const res = await GET(req);
    const body = (await res.json()) as {
      connector_support?: Record<string, boolean>;
    };

    expect(res.status).toBe(200);
    expect(body.connector_support).toMatchObject({
      openai: true,
      serpapi: true,
      ga4: true,
      brilliant_directories_api: true,
    });
  });

  it.each([
    { connectorId: "openai", provider: "openai" },
    { connectorId: "serpapi", provider: "serpapi" },
    { connectorId: "ga4", provider: "ga4" },
  ])("deletes $connectorId through canonical integration store", async ({ connectorId, provider }) => {
    const { DELETE } = await import("@/app/api/directoryiq/signal-sources/route");
    const req = new NextRequest(`http://localhost/api/directoryiq/signal-sources?connector_id=${connectorId}`, {
      method: "DELETE",
    });

    const res = await DELETE(req);
    const body = (await res.json()) as { ok?: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.deleteDirectoryIqIntegration).toHaveBeenCalledWith("user_1", provider);
  });
});
