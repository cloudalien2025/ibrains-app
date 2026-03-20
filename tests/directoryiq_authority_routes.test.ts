import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthorityRouteError } from "@/app/api/directoryiq/_utils/authorityErrors";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqOpenAiKey = vi.fn(async () => "test-key");
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "site-1:321",
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture-listing",
    raw_json: { description: "Sample listing description" },
  },
  evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
  settings: { imageStylePreference: "editorial clean" },
}));
const findListingCandidates = vi.fn(async () => [
  { sourceId: "site-1:321", siteId: "site-1", siteLabel: "Site One" },
]);
const upsertAuthorityPostDraft = vi.fn(async () => {});
const saveAuthorityImage = vi.fn(async () => {});
const proxyDirectoryIqRequest = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 502 }));
const shouldServeDirectoryIqLocally = vi.fn(() => true);
const generateAuthorityDraft = vi.fn(async () => "<p>Draft html</p>");
const generateAuthorityImage = vi.fn(async () => "data:image/png;base64,abc123");
const validateDraftHtml = vi.fn((input: { html: string; listingUrl: string }) => {
  const hasContextualListingLink = Boolean(input.listingUrl) && input.html.includes(input.listingUrl);
  return {
    valid: hasContextualListingLink,
    hasContextualListingLink,
    errors: hasContextualListingLink ? ([] as string[]) : ["Draft must include a contextual in-body link to the listing URL."],
  };
});
const ensureContextualListingLink = vi.fn((input: { html: string; listingUrl: string; listingTitle: string; focusTopic: string }) => {
  if (!input.listingUrl || input.html.includes(input.listingUrl)) return input.html;
  return `${input.html}\n\nFor ${input.focusTopic}, see [${input.listingTitle}](${input.listingUrl}).`;
});
const validateOpenAiKeyPresent = vi.fn((value: string | null) => {
  if (!value) throw new AuthorityRouteError(400, "OPENAI_KEY_MISSING", "Missing key");
  return value;
});

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqOpenAiKey,
}));
vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRequest,
}));
vi.mock("@/app/api/directoryiq/_utils/runtimeParity", () => ({
  shouldServeDirectoryIqLocally,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
  findListingCandidates,
  upsertAuthorityPostDraft,
  saveAuthorityImage,
}));

vi.mock("@/lib/openai/serverClient", () => ({
  generateAuthorityDraft,
  generateAuthorityImage,
  validateOpenAiKeyPresent,
}));

vi.mock("@/lib/directoryiq/contentGovernance", () => ({
  buildGovernedPrompt: vi.fn(() => "prompt"),
  validateDraftHtml,
  ensureContextualListingLink,
  buildImagePrompt: vi.fn(() => "image prompt"),
}));

describe("directoryiq authority routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a draft for an authority slot", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Best in Miami",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(generateAuthorityDraft).toHaveBeenCalledTimes(1);
    expect(upsertAuthorityPostDraft).toHaveBeenCalledTimes(1);
  });

  it("returns structured error when OpenAI key is missing", async () => {
    getDirectoryIqOpenAiKey.mockResolvedValueOnce(null as unknown as string);
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("OPENAI_KEY_MISSING");
    expect(typeof json.error.reqId).toBe("string");
    expect(saveAuthorityImage).not.toHaveBeenCalled();
  });

  it("returns success shape for image generation and persists the image", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.featured_image_url).toBe("data:image/png;base64,abc123");
    expect(json.prompt).toBe("image prompt");
    expect(generateAuthorityImage).toHaveBeenCalledTimes(1);
    expect(saveAuthorityImage).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "site-1:321", 1, {
      imagePrompt: "image prompt",
      imageUrl: "data:image/png;base64,abc123",
    });
  });

  it("keeps image generation on the canonical local path even when parity helper reports proxy host", async () => {
    shouldServeDirectoryIqLocally.mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(generateAuthorityImage).toHaveBeenCalledTimes(1);
    expect(proxyDirectoryIqRequest).not.toHaveBeenCalled();
  });

  it("returns DRAFT_VALIDATION_FAILED when generated draft misses governance checks", async () => {
    validateDraftHtml.mockReturnValueOnce({
      valid: false,
      hasContextualListingLink: false,
      errors: ["Missing contextual listing link."],
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Best in Miami",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error?.code).toBe("DRAFT_VALIDATION_FAILED");
    expect(String(json.error?.message ?? "")).toContain("Draft failed governance validation");
    expect(String(json.error?.details ?? "")).toContain("Missing contextual listing link.");
  });

  it("uses listing URL fallback fields from listing raw_json for draft generation", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "site-1:321",
        title: "Fixture Listing",
        url: null,
        raw_json: {
          description: "Sample listing description",
          profile_url: "https://example.com/listings/fixture-listing",
        },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Best in Miami",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(generateAuthorityDraft).toHaveBeenCalledTimes(1);
  });

  it("uses step2 contract mission plan listing_url fallback for reciprocal slot draft generation", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "site-1:321",
        title: "Fixture Listing",
        url: null,
        raw_json: {
          description: "Sample listing description",
        },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/4/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Reciprocal support post",
        focus_topic: "supportive scenario guide",
        type: "local_guide",
        step2_contract: {
          mission_plan_slot: {
            slot_id: "publish_reciprocal_support_post",
            listing_url: "https://example.com/listings/fixture-listing",
          },
        },
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "4" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(generateAuthorityDraft).toHaveBeenCalledTimes(1);
    expect(validateDraftHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        listingUrl: "https://example.com/listings/fixture-listing",
      })
    );
  });

  it("deterministically enforces contextual listing link before governance validation when draft omits the URL", async () => {
    generateAuthorityDraft.mockResolvedValueOnce("Plain draft without required listing URL.");

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/2/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Missing Link Draft",
        focus_topic: "best service area guide",
        type: "local_guide",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "2" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(ensureContextualListingLink).toHaveBeenCalledTimes(1);
    expect(validateDraftHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("https://example.com/listings/fixture-listing"),
        listingUrl: "https://example.com/listings/fixture-listing",
      })
    );
  });

  it("maps transient DB timeout errors to safe message while preserving reqId/code/details", async () => {
    generateAuthorityDraft.mockRejectedValueOnce(
      Object.assign(new Error("connect ETIMEDOUT 45.55.71.52:25060"), {
        code: "ETIMEDOUT",
        syscall: "connect",
        address: "45.55.71.52",
        port: 25060,
      })
    );

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Best in Miami",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error?.code).toBe("DB_TIMEOUT");
    expect(json.error?.message).toBe("Article generation is temporarily unavailable. Please try again.");
    expect(typeof json.error?.reqId).toBe("string");
    expect(String(json.error?.details ?? "")).toContain("ETIMEDOUT");
    expect(String(json.error?.details ?? "")).toContain("45.55.71.52");
    expect(String(json.error?.message ?? "").toLowerCase()).not.toContain("etimedout");
  });

  it("maps transient network connectivity errors to safe message while preserving reqId/code/details", async () => {
    generateAuthorityDraft.mockRejectedValueOnce(
      Object.assign(new Error("getaddrinfo ENOTFOUND upstream.service.local"), {
        code: "ENOTFOUND",
        syscall: "getaddrinfo",
      })
    );

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Best in Miami",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error?.code).toBe("NETWORK_CONNECTIVITY");
    expect(json.error?.message).toBe("We couldn't reach a required service. Please try again.");
    expect(typeof json.error?.reqId).toBe("string");
    expect(String(json.error?.details ?? "")).toContain("ENOTFOUND");
    expect(String(json.error?.message ?? "").toLowerCase()).not.toContain("enotfound");
  });
});
