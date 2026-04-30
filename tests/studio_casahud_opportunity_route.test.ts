import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  getStudioIntegrationSecret: vi.fn(),
  isStudioIntegrationEncryptionConfigured: vi.fn(),
  isStudioIntegrationStoreAvailable: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: mocks.ensureUser,
  resolveUserId: mocks.resolveUserId,
}));

vi.mock("@/app/api/studio/domara/_utils/integration-settings", () => ({
  getStudioIntegrationSecret: mocks.getStudioIntegrationSecret,
  isStudioIntegrationEncryptionConfigured: mocks.isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationStoreAvailable: mocks.isStudioIntegrationStoreAvailable,
}));

describe("CasaFlix opportunity route", () => {
  beforeEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.getStudioIntegrationSecret.mockReset();
    mocks.isStudioIntegrationEncryptionConfigured.mockReset();
    mocks.isStudioIntegrationStoreAvailable.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue("11111111-1111-4111-8111-111111111111");
    mocks.getStudioIntegrationSecret.mockResolvedValue(null);
    mocks.isStudioIntegrationEncryptionConfigured.mockReturnValue(false);
    mocks.isStudioIntegrationStoreAvailable.mockResolvedValue(false);
  });

  it("returns typed opportunity output and falls back safely when YouTube credentials are unavailable", async () => {
    const route = await import("@/app/api/studio/domara/opportunity/route");
    const request = new NextRequest("http://localhost/api/studio/domara/opportunity", {
      method: "POST",
      body: JSON.stringify({ preferredMarket: "Italian real-estate YouTube" }),
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.output.providerStatus.mode).toBe("casahud_patterns");
    expect(payload.output.titleCandidates.length).toBeGreaterThanOrEqual(3);
    expect(payload.output.titleCandidates.length).toBeLessThanOrEqual(10);
    expect(payload.output.selectedTitle.title).toBeTruthy();
    expect(payload.output.selectedTitle.campaignType).toBe(payload.output.campaignTypePrediction);
  });

  it("rejects invalid preferredMarket input with a safe validation error", async () => {
    const route = await import("@/app/api/studio/domara/opportunity/route");
    const request = new NextRequest("http://localhost/api/studio/domara/opportunity", {
      method: "POST",
      body: JSON.stringify({ preferredMarket: 42 }),
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_INPUT");
  });
});
