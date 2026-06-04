import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { buildOperatorIntegrationRows } from "@/lib/studio/domara/integrations-ui";
import { getDomaraIntegrationStatuses, mergeDomaraIntegrationStatusesWithStored } from "@/lib/studio/domara/integrations";

const state = {
  available: true,
  rows: new Map<string, { secret_ciphertext: string; secret_last4: string | null; updated_at: string }>(),
  now: 0,
};

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  encryptSecret: vi.fn(),
  decryptSecret: vi.fn(),
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: mocks.query,
}));

vi.mock("@/app/api/ecomviper/_utils/crypto", () => ({
  encryptSecret: mocks.encryptSecret,
  decryptSecret: mocks.decryptSecret,
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: mocks.ensureUser,
  resolveUserId: mocks.resolveUserId,
}));

function keyFor(userId: string, connectorId: string): string {
  return `${userId}:${connectorId}`;
}

describe("Studio integration settings persistence", () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "1111111111111111111111111111111111111111111111111111111111111111";
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.IDEALISTA_API_KEY;
    delete process.env.IMMOBILIARE_API_KEY;
    delete process.env.CLOUDINARY_URL;
    delete process.env.DO_SPACES_ACCESS_KEY;
    delete process.env.DO_SPACES_SECRET_KEY;
    delete process.env.DO_SPACES_BUCKET;
    delete process.env.YOUTUBE_API_KEY;
    state.available = true;
    state.rows.clear();
    state.now = 0;
    mocks.query.mockReset();
    mocks.encryptSecret.mockReset();
    mocks.decryptSecret.mockReset();
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();

    mocks.resolveUserId.mockReturnValue("11111111-1111-4111-8111-111111111111");
    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.encryptSecret.mockImplementation((secret: string) => `enc:${secret}`);
    mocks.decryptSecret.mockImplementation((payload: string) => payload.replace(/^enc:/, ""));

    mocks.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.includes("to_regclass('public.directoryiq_signal_source_credentials')")) {
        return [{ exists: state.available ? "directoryiq_signal_source_credentials" : null }];
      }

      if (normalized.startsWith("insert into directoryiq_signal_source_credentials")) {
        const [userId, connectorId, secretCiphertext, secretLast4] = params as [string, string, string, string | null];
        state.now += 1;
        state.rows.set(keyFor(userId, connectorId), {
          secret_ciphertext: secretCiphertext,
          secret_last4: secretLast4 || null,
          updated_at: `2026-04-27T00:00:0${state.now}.000Z`,
        });
        return [];
      }

      if (normalized.includes("where user_id = $1 and connector_id like 'studio_domara_%'")) {
        const [userId] = params as [string];
        return Array.from(state.rows.entries())
          .filter(([key]) => key.startsWith(`${userId}:studio_domara_`))
          .map(([key, value]) => ({
            connector_id: key.split(":")[1],
            secret_ciphertext: value.secret_ciphertext,
            secret_last4: value.secret_last4,
            updated_at: value.updated_at,
          }));
      }

      if (normalized.startsWith("delete from directoryiq_signal_source_credentials")) {
        const [userId, connectorId] = params as [string, string];
        state.rows.delete(keyFor(userId, connectorId));
        return [];
      }

      if (normalized.includes("where user_id = $1 and connector_id = $2")) {
        const [userId, connectorId] = params as [string, string];
        const row = state.rows.get(keyFor(userId, connectorId));
        if (!row) return [];
        return [
          {
            connector_id: connectorId,
            secret_ciphertext: row.secret_ciphertext,
            secret_last4: row.secret_last4,
            updated_at: row.updated_at,
          },
        ];
      }

      throw new Error(`Unhandled SQL in test: ${sql}`);
    });
  });

  it("saves credential, returns safe status metadata, and hides raw secret", async () => {
    const { saveStudioIntegrationSecret, listStudioStoredIntegrationStatuses } = await import(
      "@/app/api/studio/domara/_utils/integration-settings"
    );

    await saveStudioIntegrationSecret({
      userId: "11111111-1111-4111-8111-111111111111",
      providerId: "openai",
      apiKey: "super-secret-openai-key",
    });

    const stored = await listStudioStoredIntegrationStatuses("11111111-1111-4111-8111-111111111111");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.providerId).toBe("openai");
    expect(stored[0]?.configured).toBe(true);
    expect(stored[0]?.secretLast4).toBe("e-key".slice(-4));

    const merged = mergeDomaraIntegrationStatusesWithStored(getDomaraIntegrationStatuses({}), stored);
    const rows = buildOperatorIntegrationRows(merged);
    const openai = rows.find((row) => row.providerId === "openai");

    expect(openai?.status).toBe("connected");
    expect(openai?.maskedKey?.endsWith("e-key".slice(-4))).toBe(true);
    expect(JSON.stringify(rows).includes("super-secret-openai-key")).toBe(false);
  });

  it("status readback shows configured after save and false after clear", async () => {
    const integrationStore = await import("@/app/api/studio/domara/_utils/integration-settings");
    const statusRoute = await import("@/app/api/studio/domara/integrations/status/route");

    await integrationStore.saveStudioIntegrationSecret({
      userId: "11111111-1111-4111-8111-111111111111",
      providerId: "openai",
      apiKey: "sk-test-openai-secret-123456",
    });

    const statusReq = new NextRequest("http://localhost/api/studio/domara/integrations/status");
    const beforeClear = await statusRoute.GET(statusReq);
    const beforePayload = await beforeClear.json();
    const beforeOpenAi = beforePayload.providers.find((provider: { providerId: string }) => provider.providerId === "openai");
    expect(beforeOpenAi?.configured).toBe(true);
    expect(beforePayload.connectionCards.map((card: { title: string }) => card.title)).toEqual(
      expect.arrayContaining([
        "OpenAI",
        "YouTube Channel",
        "Listing Sources",
        "Maps & Location Visuals",
        "Local Places & POIs",
        "Media Storage",
        "Voice Narration",
      ])
    );
    expect(JSON.stringify(beforePayload)).not.toMatch(/super-secret|API_KEY|DATABASE_URL|DIRECTORYIQ_DATABASE_URL|environment|provider seam|migration/i);

    await integrationStore.clearStudioIntegrationSecret({
      userId: "11111111-1111-4111-8111-111111111111",
      providerId: "openai",
    });

    const storedAfterClear = await integrationStore.listStudioStoredIntegrationStatuses(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(storedAfterClear.some((entry) => entry.providerId === "openai")).toBe(false);

    const afterClear = await statusRoute.GET(statusReq);
    const afterPayload = await afterClear.json();
    const afterOpenAi = afterPayload.providers.find((provider: { providerId: string }) => provider.providerId === "openai");
    expect(afterOpenAi?.configuredBy === "saved").toBe(false);
  });

  it("rejects unsupported provider and empty key via route handlers", async () => {
    const route = await import("@/app/api/studio/domara/integrations/[provider]/route");

    const unsupportedReq = new NextRequest("http://localhost/api/studio/domara/integrations/unknown", {
      method: "POST",
      body: JSON.stringify({ apiKey: "abc" }),
    });
    const unsupportedResp = await route.POST(unsupportedReq, { params: { provider: "unknown" } });
    expect(unsupportedResp.status).toBe(400);

    const emptyReq = new NextRequest("http://localhost/api/studio/domara/integrations/openai", {
      method: "POST",
      body: JSON.stringify({ apiKey: "   " }),
    });
    const emptyResp = await route.POST(emptyReq, { params: { provider: "openai" } });
    expect(emptyResp.status).toBe(400);
  });

  it("save route does not echo raw key and clear route returns unconfigured provider", async () => {
    const route = await import("@/app/api/studio/domara/integrations/[provider]/route");
    const raw = "super-secret-elevenlabs-key";

    const saveReq = new NextRequest("http://localhost/api/studio/domara/integrations/elevenlabs", {
      method: "POST",
      body: JSON.stringify({ apiKey: raw }),
    });
    const saveResp = await route.POST(saveReq, { params: { provider: "elevenlabs" } });
    expect(saveResp.status).toBe(200);
    const savePayload = await saveResp.json();
    expect(JSON.stringify(savePayload).includes(raw)).toBe(false);
    expect(savePayload.provider?.configured).toBe(true);

    const clearReq = new NextRequest("http://localhost/api/studio/domara/integrations/elevenlabs", {
      method: "DELETE",
    });
    const clearResp = await route.DELETE(clearReq, { params: { provider: "elevenlabs" } });
    expect(clearResp.status).toBe(200);
    const clearPayload = await clearResp.json();
    expect(clearPayload.provider?.configuredBy === "saved").toBe(false);
  });

  it("test route validates saved connections without returning connection keys", async () => {
    const saveRoute = await import("@/app/api/studio/domara/integrations/[provider]/route");
    const testRoute = await import("@/app/api/studio/domara/integrations/[provider]/test/route");
    const raw = "sk-test-openai-secret-123456";

    const saveReq = new NextRequest("http://localhost/api/studio/domara/integrations/openai", {
      method: "POST",
      body: JSON.stringify({ connectionKey: raw }),
    });
    const saveResp = await saveRoute.POST(saveReq, { params: { provider: "openai" } });
    expect(saveResp.status).toBe(200);

    const testReq = new NextRequest("http://localhost/api/studio/domara/integrations/openai/test", {
      method: "POST",
    });
    const testResp = await testRoute.POST(testReq, { params: { provider: "openai" } });
    expect(testResp.status).toBe(200);
    const testPayload = await testResp.json();
    expect(testPayload.message).toBe("Connection looks ready.");
    expect(JSON.stringify(testPayload).includes(raw)).toBe(false);
  });
});
